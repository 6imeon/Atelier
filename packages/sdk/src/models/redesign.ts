/**
 * Redesign-related functions: fetch pages, extract content, plan and execute redesigns.
 */

import { Screen, ScreenData, DeviceType, ComponentNode } from "./screen.js";
import { DesignSystem } from "./design-system.js";
import { ComponentLibrary } from "./component.js";
import { getRouter } from "../utils/router.js";
import { PROMPTS } from "../utils/prompts.js";
import { extractBrandDataFull, type BrandData } from "../utils/brand-extractor.js";
import { type ParsedSection } from "../utils/section-parser.js";
import { parseSectionsWithFallback } from "../utils/spa-section-parser.js";
import { improveSectionLabels } from "../utils/label-improver.js";
import { extractSections, type AnimationPattern } from "../utils/section-extractor.js";
import { extractSourceAssets } from "../utils/source-image-extractor.js";
import { generatePageSectioned, type PageGenerationContext } from "./section-generator.js";
import { fixOrphanedHiddenStates } from "../utils/orphaned-hidden-states.js";
import { autoMatchPersona, buildPersonaPrompt, PERSONA_AAKER_VECTORS, type AakerVector } from "../utils/personas.js";
import { getOrCreateBusinessInfo, type BusinessInfo } from "../utils/business-info.js";
import { computeTypographicScale, formatScaleForPrompt } from "../utils/typographic-scale.js";
import { validateDesignTokenContrast } from "../utils/contrast.js";
import { computeDesignTokens, formatDesignTokensForPrompt } from "../utils/aaker-tokens.js";
import { fromExtractedDesign, serialize as serializeDesignMd, lint as lintDesignMd, isLintEnabled, type LintFinding } from "../utils/design-md.js";
import { stagedRefineHtml, getRefinePasses } from "../utils/staged-refine.js";

import { injectWhyAttributes } from "./consistency.js";
import { classifyIndustry } from "./industry.js";
import type { ProgressCallback } from "./project.js";
import { NOOP_RUN, type PipelineRun } from "../utils/logger.js";

interface FetchResult {
  html: string;
  markdown: string;
  fromCrawl4ai: boolean;
  /** Computed colors from browser-rendered elements (crawl4ai only) */
  computedColors?: Array<{ hex: string; count: number }>;
}

/**
 * Run DESIGN.md lint on an extracted design-tokens object and log findings.
 * Returns contrast-ratio findings for forwarding into UICrit. Non-blocking.
 */
function runDesignMdLint(
  extracted: Record<string, unknown>,
  brandName: string,
  log: PipelineRun,
): LintFinding[] {
  if (!isLintEnabled()) return [];
  try {
    const tokens = fromExtractedDesign(extracted as Parameters<typeof fromExtractedDesign>[0], brandName);
    const md = serializeDesignMd(tokens, brandName);
    const report = lintDesignMd(md);
    log.info(`DS lint: ${report.summary.errors}E / ${report.summary.warnings}W / ${report.summary.info}I`);
    for (const f of report.findings) {
      const line = `${f.rule}: ${f.message}`;
      if (f.severity === "error") log.warn(line);
      else if (f.severity === "warning") log.info(`  ??? ${line}`);
      else log.debug(line);
    }
    return report.findings.filter(f => f.rule === "contrast-ratio");
  } catch (err) {
    log.debug(`DS lint skipped: ${err instanceof Error ? err.message : err}`);
    return [];
  }
}

// Cookie dismissal + computed style extraction JS injected into crawl4ai
const CRAWL4AI_JS = `
(function() {
  try {
    // ── Cookie dismissal ──
    var selectors = [
      '[id*="cookie"] button', '[class*="cookie"] button',
      '[id*="consent"] button', '[class*="consent"] button',
      '[id*="gdpr"] button', '[class*="gdpr"] button',
      'button[id*="accept"]', 'button[class*="accept"]',
      '#onetrust-accept-btn-handler', '.onetrust-close-btn-handler',
      '#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll',
      '#truste-consent-button',
      '.cc-accept', '.cc-dismiss', '.cc-allow',
      '[aria-label*="accept" i]', '[aria-label*="consent" i]',
    ];
    for (var i = 0; i < selectors.length; i++) {
      try {
        var btns = document.querySelectorAll(selectors[i]);
        for (var j = 0; j < btns.length; j++) {
          var text = (btns[j].textContent || '').toLowerCase().trim();
          if (text.match(/accept|agree|allow|got it|ok|close|dismiss/)) btns[j].click();
        }
      } catch(e) {}
    }
    var overlays = ['[id*="cookie"]','[class*="cookie-banner"]','[id*="consent"]','[class*="consent-banner"]','[id*="gdpr"]','#onetrust-banner-sdk','#CybotCookiebotDialog','.cc-window','.cc-banner'];
    for (var i = 0; i < overlays.length; i++) {
      try { var els = document.querySelectorAll(overlays[i]); for (var j = 0; j < els.length; j++) els[j].style.display = 'none'; } catch(e) {}
    }
    document.body.style.overflow = '';

    // ── Extract computed colors from rendered elements ──
    var colorFreq = {};
    var els = document.querySelectorAll('*');
    var max = Math.min(els.length, 500);
    for (var i = 0; i < max; i++) {
      try {
        var cs = getComputedStyle(els[i]);
        var props = ['color', 'backgroundColor', 'borderColor'];
        for (var p = 0; p < props.length; p++) {
          var val = cs[props[p]];
          if (val && val !== 'rgba(0, 0, 0, 0)' && val !== 'transparent') {
            colorFreq[val] = (colorFreq[val] || 0) + 1;
          }
        }
      } catch(e) {}
    }
    var data = { computedColors: colorFreq };
    var div = document.createElement('div');
    div.id = '__brand_data__';
    div.style.display = 'none';
    div.textContent = JSON.stringify(data);
    document.body.appendChild(div);
  } catch(e) {}
})();
`;

/**
 * Context object passed to redesign functions so they can access
 * the project's state without needing a full Project reference.
 */
export interface RedesignContext {
  projectId: string;
  designSystem: DesignSystem | null;
  componentLibrary: ComponentLibrary | null;
  addScreen: (screen: Screen) => void;
}

/**
 * Fetch a page using crawl4ai (if available) with fallback to direct fetch.
 * crawl4ai uses a headless browser so it can bypass bot protection.
 */
export async function fetchPage(url: string, logger?: PipelineRun): Promise<FetchResult> {
  const log = logger || NOOP_RUN;
  const crawl4aiUrl = process.env.CRAWL4AI_URL;

  // Try crawl4ai first
  if (crawl4aiUrl) {
    try {
      log.info(`crawl4ai: ${url}`);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60_000);
      const res = await fetch(`${crawl4aiUrl}/crawl`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          urls: [url],
          word_count_threshold: 10,
          crawler_config: {
            js_code: [CRAWL4AI_JS],
            wait_until: "networkidle",
            delay_before_return_html: 3,
          },
        }),
      });
      clearTimeout(timeout);
      if (res.ok) {
        const data = await res.json();
        const result = data.results?.[0] ?? data;
        // crawl4ai v0.8+ may return markdown as an object — coerce to string
        const rawMd = result.markdown ?? result.extracted_content ?? "";
        const md = typeof rawMd === "string" ? rawMd : (rawMd?.raw_markdown ?? rawMd?.fit_markdown ?? JSON.stringify(rawMd) ?? "");
        const rawHtml = result.html ?? result.raw_html ?? "";
        const html = typeof rawHtml === "string" ? rawHtml : "";

        // Parse computed colors from injected __brand_data__ div
        let computedColors: Array<{ hex: string; count: number }> | undefined;
        const brandDataMatch = html.match(/<div id="__brand_data__"[^>]*>([\s\S]*?)<\/div>/);
        if (brandDataMatch) {
          try {
            const parsed = JSON.parse(brandDataMatch[1]);
            if (parsed.computedColors) {
              computedColors = Object.entries(parsed.computedColors).map(([color, count]) => ({
                hex: color, count: count as number,
              }));
              log.debug(`crawl4ai computed colors: ${computedColors.length} unique`);
            }
          } catch {}
        }

        if (md || html) {
          log.info(`Success: ${md.length} chars markdown, ${html.length} chars html`);
          return { html, markdown: md, fromCrawl4ai: true, computedColors };
        }
      }
      log.warn(`crawl4ai returned no content, falling back to direct fetch`);
    } catch (err) {
      log.warn(`crawl4ai unavailable: ${err instanceof Error ? err.message : err}`);
    }
  }

  // Fallback: direct fetch
  try {
    log.info(`Direct fetch: ${url}`);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" },
    });
    clearTimeout(timeout);
    const html = await res.text();
    log.info(`Direct fetch: ${html.length} chars`);
    return { html, markdown: "", fromCrawl4ai: false };
  } catch (err) {
    log.warn(`Direct fetch failed: ${err instanceof Error ? err.message : err}`);
    return { html: "", markdown: "", fromCrawl4ai: false };
  }
}

/**
 * Check if fetched HTML is a bot challenge/empty shell rather than real content.
 */
export function isBlocked(html: string): boolean {
  if (!html) return true;
  // Substring matches for phrases that only appear on challenge/block pages.
  const blockedSubstrings = ["Challenge Validation", "cf-browser-verification", "Just a moment", "Checking your browser"];
  if (blockedSubstrings.some(s => html.includes(s))) return true;
  // Word-boundary match for "captcha" so reCAPTCHA script tags and
  // /recaptcha/api.js URLs on legit sites don't falsely flag the page as
  // blocked. Only a bare "captcha" token counts — that's what actual
  // challenge pages show.
  if (/\bcaptcha\b/i.test(html)) return true;
  const textOnly = html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, "").trim();
  return textOnly.length < 200;
}

/**
 * Strip non-content HTML elements, keeping structure and text.
 */
export function stripHtml(html: string, maxLen = 12_000): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<svg[\s\S]*?<\/svg>/gi, "")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, "")
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<img[^>]*>/gi, (match) => {
      const alt = match.match(/alt="([^"]*)"/)?.[1] || "";
      return alt ? `[image: ${alt}]` : "";
    })
    .replace(/\s{2,}/g, " ")
    .replace(/>\s+</g, ">\n<")
    .slice(0, maxLen);
}

/**
 * Extract plain text content from HTML.
 */
export function extractText(html: string, maxLen = 4000): string {
  return html
    .replace(/<[^>]+>/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, maxLen);
}

/**
 * Extract brand/company name from HTML title tag or meta tags.
 * Falls back to domain-based guess.
 */
export function extractBrandName(html: string, url: string): string {
  // Try <title> tag first
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch) {
    let title = titleMatch[1].trim();
    // Strip common suffixes like " | Home", " - Homepage", " — Official Site"
    title = title.replace(/\s*[|–—-]\s*(home|homepage|official|welcome|main).*/i, "").trim();
    // If title is reasonable length, use it
    if (title.length > 1 && title.length < 60) return title;
  }

  // Try og:site_name meta tag
  const ogMatch = html.match(/<meta[^>]*property="og:site_name"[^>]*content="([^"]+)"/i);
  if (ogMatch) return ogMatch[1].trim();

  // Fallback: domain-based extraction
  const domain = new URL(url).hostname.replace("www.", "");
  // Handle multi-part TLDs like .co.uk, .com.au
  const parts = domain.split(".");
  let name = parts[0];
  if (parts.length > 2 && ["co", "com", "org", "net"].includes(parts[parts.length - 2])) {
    name = parts.slice(0, -2).join(".");
  } else if (parts.length > 1) {
    name = parts.slice(0, -1).join(".");
  }
  // Split on hyphens and try to detect camelCase
  return name
    .split(/[-_]/)
    .map(w => {
      // Try to split camelCase or concatenated words (e.g., "strattoncraig" → leave as-is, capitalize)
      return w.charAt(0).toUpperCase() + w.slice(1);
    })
    .join(" ");
}

export async function redesignFromURL(
  ctx: RedesignContext,
  url: string,
  prompt: string,
  deviceType: DeviceType = "DESKTOP",
  onProgress?: ProgressCallback,
  premiumScroll?: boolean,
  logger?: PipelineRun,
): Promise<Screen> {
  const log = logger || NOOP_RUN;
  const router = getRouter();
  log.phase("FETCH");
  onProgress?.("Fetching page...", url);
  const fetched = await fetchPage(url, logger);

  // Determine if we got real content
  let fetchSucceeded = false;
  let textContent = "";
  let stripped = "";

  if (fetched.fromCrawl4ai && fetched.markdown) {
    // crawl4ai returned clean markdown — best case
    fetchSucceeded = true;
    textContent = fetched.markdown.slice(0, 6000);
    stripped = stripHtml(fetched.html);
  } else if (!isBlocked(fetched.html)) {
    // Direct fetch got real content
    fetchSucceeded = true;
    stripped = stripHtml(fetched.html);
    textContent = extractText(stripped);
  }

  onProgress?.("Analyzing content...");
  // Extract brand name from page content or URL
  const domain = new URL(url).hostname.replace("www.", "");
  const brandGuess = extractBrandName(fetched.html || "", url);
  log.phase("PLAN");
  log.info(`Brand: "${brandGuess}" (${domain})`);

  // Classify what the company does, for what audience, in what voice —
  // used by the persona scorer and injected into the section prompt as
  // a <company> block so copy grounds to the right sector terminology.
  let businessInfo: BusinessInfo | null = null;
  if (fetchSucceeded && fetched.html) {
    try {
      businessInfo = await getOrCreateBusinessInfo(url, fetched.html, brandGuess, router, logger);
    } catch (err) {
      log.warn(`business-info enrichment failed: ${err instanceof Error ? err.message : err}`);
    }
  }

  // ─── Source animation detection (Track 1A) ──────────────────────────────
  // Extract animation patterns from the source HTML so we can feed them to
  // the model as concrete guidance instead of vague "use scroll effects" hints.
  let sourceAnimationSummary = "";
  let cinematicDetected = false;
  if (fetchSucceeded && fetched.html) {
    try {
      const extracted = extractSections(fetched.html, { sourceUrl: url, maxSections: 20 });
      const allPatterns: AnimationPattern[] = extracted.flatMap(s => s.animations);

      const cinematicLibs = new Set(["gsap", "scrolltrigger", "lottie", "three-js", "framer-motion"]);
      const scrollTriggers = new Set(["scroll", "viewport-enter"]);
      const hasCinematicLib = allPatterns.some(p => cinematicLibs.has(p.type));
      const scrollPatternCount = allPatterns.filter(p => scrollTriggers.has(p.trigger)).length;
      cinematicDetected = hasCinematicLib || scrollPatternCount >= 3;

      if (allPatterns.length > 0) {
        // Group by type for a compact summary
        const byType = new Map<string, number>();
        for (const p of allPatterns) byType.set(p.type, (byType.get(p.type) || 0) + 1);
        const typeSummary = [...byType.entries()]
          .sort((a, b) => b[1] - a[1])
          .map(([t, n]) => `${t}×${n}`)
          .join(", ");

        // Per-section highlights (only sections with animations)
        const sectionLines = extracted
          .filter(s => s.animations.length > 0)
          .slice(0, 12)
          .map(s => {
            const patterns = s.animations
              .map(a => `${a.type}/${a.trigger}${a.properties.length ? `:${a.properties.slice(0, 3).join(",")}` : ""}`)
              .join("; ");
            return `  - [${s.index}] ${s.classification.category} (${s.tier}): ${patterns}`;
          })
          .join("\n");

        sourceAnimationSummary = `\n\n=== SOURCE ANIMATION PATTERNS (detected from original site) ===\nTotal: ${allPatterns.length} effects across ${extracted.length} sections\nLibraries/types: ${typeSummary}\nCinematic mode: ${cinematicDetected ? "ON (auto-detected)" : "OFF"}\nPer-section:\n${sectionLines}`;
      }

      log.info(`Source animations: ${allPatterns.length} patterns, cinematic=${cinematicDetected}`);
    } catch (err) {
      log.warn(`Source animation extraction failed: ${err instanceof Error ? err.message : err}`);
    }
  }

  // Animation brief capture lives in generatePageSectioned (per-section
  // prompt injection). When the sectioning delegation at the bottom of this
  // function fires (cinematicDetected || premiumScroll), that function owns
  // the screenshot + brief work. The single-call path below never actually
  // used a brief — the old capture here only fired when cinematicDetected
  // was true, and cinematicDetected also routes to the sectioned flow, so
  // the captured brief was thrown away. Removed to save ~9s + LLM cost.
  const animationBriefSummary = "";

  // Extract brand data (colors, fonts, logos) using real CSS/HTML parsing.
  // Decoupled from fetchSucceeded: the extractor reads CSS <link> tags,
  // Google Fonts URLs, and inline styles from the raw HTML — it doesn't
  // need visible text. Hydration-shell SPAs (Webflow, Next.js SSR-shell,
  // etc.) return huge HTML with minimal body text, which sets fetchSucceeded
  // to false but still contains all the brand CSS the extractor needs.
  let extractedDesign: Record<string, unknown> = {};
  let brandData: BrandData | null = null;
  let designSystemLintFindings: LintFinding[] = [];
  if (fetched.html && fetched.html.length > 500) {
    try {
      onProgress?.("Extracting brand colors, fonts & logos...");
      const htmlForExtraction = fetched.html;
      log.info(`Extracting brand data from ${Math.round(htmlForExtraction.length / 1000)}K chars${!fetchSucceeded ? " (hydration-shell path)" : ""}`);
      brandData = await extractBrandDataFull(htmlForExtraction, url, fetched.computedColors, getRouter().analytics);
      // Convert to design tokens format for backward compatibility
      extractedDesign = {
        colors: {
          primary: brandData.colors.primary?.hex || null,
          secondary: brandData.colors.secondary?.hex || null,
          accent: brandData.colors.accent?.hex || null,
          background: brandData.colors.background?.hex || null,
          text: brandData.colors.text?.hex || null,
        },
        typography: {
          fontFamilies: {
            heading: brandData.fonts.heading?.family || null,
            body: brandData.fonts.body?.family || null,
          },
          googleFontsUrls: brandData.fonts.googleFontsUrls,
        },
        logos: brandData.logos.filter(l => l.data).slice(0, 4),
        _brandData: brandData, // Full brand data for the frontend
      };
      log.info(`Brand data: ${brandData.colors.all.length} colors, ${brandData.fonts.all.length} fonts, ${brandData.logos.length} logos`);
      designSystemLintFindings = runDesignMdLint(extractedDesign, brandGuess, log);
    } catch (err) {
      log.warn(`Brand extraction failed: ${err instanceof Error ? err.message : err}`);
    }
  } else {
    log.info(`Skipping brand extraction (no content)`);
  }

  // Auto-match a design persona based on brand signals
  const persona = autoMatchPersona({
    url, brandName: brandGuess, userPrompt: prompt,
    colors: brandData?.colors, fonts: brandData?.fonts,
    businessInfo,
  });
  const personaPrefix = persona ? buildPersonaPrompt(persona, { isRedesign: true }) : "";

  // ─── Cinematic delegation (Fix A) ──────────────────────────────────────
  // When cinematic mode fires, the single-call layout_generate path runs out
  // of token budget before Kimi can write the animation JS — content ends up
  // stuck in CSS "hidden" initial states with no reveal logic. Route to
  // generatePageSectioned instead: each section gets its own 12K budget,
  // parallelized, with the SECTION_GENERATE_CINEMATIC_SYSTEM prompt. The
  // sectioned flow already wires in Tracks 1A (HTML patterns) and 1B (visual
  // brief via screenshots) so we don't duplicate that work here.
  // Honour the `premiumScroll` param as a force-cinematic override so callers
  // (harnesses, UI toggles) can request sectioned cinematic generation even
  // when the source site has no GSAP/ScrollTrigger patterns of its own — e.g.
  // a plain Webflow/WordPress site the user wants reimagined cinematically.
  const shouldSection = (cinematicDetected || premiumScroll === true) && fetchSucceeded;
  if (shouldSection) {
    log.info(`${cinematicDetected ? "Cinematic detected" : "premiumScroll=true override"} → routing to sectioned flow (per-section budgets, parallelized)`);
    const pageCtx: PageGenerationContext = {
      projectId: ctx.projectId,
      designSystem: ctx.designSystem,
      componentLibrary: ctx.componentLibrary,
      addScreen: ctx.addScreen,
      dsLintFindings: designSystemLintFindings,
    };
    // Mine source assets (real brand images/videos) for the sectioned flow so
    // the LLM can reuse actual photography instead of picsum placeholders.
    // planRedesign does this for its own path; the cinematic delegation used
    // to bypass it and drop the data on the floor.
    const cineRawHtml = fetched.html || stripped;
    const cineAssets = extractSourceAssets(cineRawHtml, url, { maxImages: 20, maxVideos: 6 });
    log.info(`Source assets mined: ${cineAssets.images.length} images, ${cineAssets.videos.length} videos`);
    // Parse sections from raw (pre-strip) HTML so generatePageSectioned
    // doesn't have to fall back to parsing the stripped variant, which loses
    // <section>/<h2> structure on SPA-ish reports like Adidas.
    const cineRawSections = parseSectionsWithFallback(cineRawHtml, logger, { maxSections: 15 });
    const cineParsedSections = improveSectionLabels(cineRawSections);
    log.info(`Cinematic sections parsed: ${cineParsedSections.length} from raw HTML (labels: ${cineParsedSections.map(s => s.label).join(" | ")})`);
    return generatePageSectioned(
      pageCtx,
      url,
      brandGuess,
      prompt || `Redesign of ${brandGuess}`,
      brandGuess,
      { textContent, stripped, fetchSucceeded, parsedSections: cineParsedSections, sourceImages: cineAssets.images, sourceVideos: cineAssets.videos },
      { ...extractedDesign, brandName: brandGuess },
      deviceType,
      onProgress,
      undefined,
      cinematicDetected || premiumScroll === true, // pass cinematic flag through
      logger,
      businessInfo,
    );
  }

  // Typographic scale from persona's Aaker vector
  const aakerVec: AakerVector = persona ? (PERSONA_AAKER_VECTORS[persona.id] || [0.3, 0.3, 0.5, 0.4, 0.2]) : [0.3, 0.3, 0.5, 0.4, 0.2];
  const typeScale = computeTypographicScale(aakerVec);
  const typeScalePrompt = formatScaleForPrompt(typeScale);
  log.debug(`typescale ${persona?.id || "default"}: ratio=${typeScale.ratio}, base=${typeScale.basePx}px`);

  // Aaker-driven design tokens (border-radius, spacing, shadows, animation)
  const aakerDesignTokens = computeDesignTokens(aakerVec);
  const aakerTokensPrompt = formatDesignTokensForPrompt(aakerDesignTokens);
  log.debug(`Aaker tokens: density=${aakerDesignTokens.density}, radius=${aakerDesignTokens.borderRadius.md}px`);

  // APCA contrast validation — log but do NOT mutate brand colors for redesigns
  const contrastReport = validateDesignTokenContrast(extractedDesign as any);
  if (contrastReport.pairs.length > 0) {
    for (const pair of contrastReport.pairs) {
      const status = pair.passes ? "PASS" : "FAIL";
      log.debug(`contrast ${pair.name}: Lc ${pair.lc} ${status}`);
      if (!pair.passes && pair.suggestedFix) {
        log.debug(`  -> suggestion: ${pair.suggestedFix}`);
      }
    }
  }

  // Build logo instruction — prefer inline SVGs from header/nav, skip favicons
  const edLogos = (extractedDesign as any)?.logos;
  let logoInstruction = "";
  if (Array.isArray(edLogos) && edLogos.length > 0) {
    const inlineSvg = edLogos.find((l: any) => l.type === "semantic-logo" && l.data?.startsWith("data:image/svg"));
    const semanticUrl = edLogos.find((l: any) => l.type === "semantic-logo" && l.url && !l.url.includes("favicon") && !l.url.includes("icon") && !l.url.startsWith("data:"));
    const svgIcon = edLogos.find((l: any) => l.type === "svg-icon");

    if (inlineSvg) {
      logoInstruction = `\n- LOGO (CRITICAL): The brand logo MUST appear in the navigation bar. Use this exact SVG logo as an <img> src: ${inlineSvg.data}. Example: <img src="${inlineSvg.data}" alt="${brandGuess} logo" class="h-8 w-auto">. Place at left side of nav. Do NOT use text-only branding or a favicon.`;
    } else if (semanticUrl) {
      logoInstruction = `\n- LOGO (CRITICAL): Use: <img src="${semanticUrl.url}" alt="${brandGuess} logo" class="h-8 w-auto">. Place at left side of nav. Do NOT use a favicon.`;
    } else if (svgIcon) {
      logoInstruction = `\n- LOGO (CRITICAL): Use this SVG icon in the nav: <img src="${svgIcon.url}" alt="${brandGuess} logo" class="h-8 w-auto">. Do NOT use a raster favicon.`;
    }
  }

  // Build the prompt
  const systemPrompt = fetchSucceeded
    ? `${personaPrefix}You are redesigning an existing webpage. You MUST preserve the original content exactly.

ABSOLUTE RULES — VIOLATION MEANS FAILURE:
- The company/brand name is "${brandGuess}" (from ${domain}). Use this EXACT name. Do NOT invent a different name.
- Use the EXACT navigation menu items, headings, taglines, and body copy from the source below.
- Do NOT create fictional content — every piece of text must come from the source.
- Recreate the KEY sections from the original page. Include nav, hero, the main content sections, and footer. Aim for 8-12 well-designed sections total — consolidate similar sections rather than duplicating repetitive blocks.
- The page must be a COMPLETE redesign — not a shortened summary. But keep it compact — quality over quantity.
- EXACT COLORS (CRITICAL): You MUST use the EXACT hex color values from the DESIGN TOKENS below. Do NOT approximate or substitute colors. If the design tokens say primary is "#6aabcf", use exactly "#6aabcf" — not "#0094d8" or any other shade. Use Tailwind arbitrary values like bg-[#6aabcf], text-[#6aabcf], border-[#6aabcf] for precise control.${logoInstruction}

DESIGN RULES:
- LAYOUT: Every section MUST use full viewport width. Use full-bleed backgrounds (w-full) with max-w-7xl mx-auto for inner content. NEVER create a narrow centered column for the entire page. Sections should have bg colors or images that span edge-to-edge.
- SPACING: Keep sections COMPACT. Use py-12 to py-20 for section padding — NEVER py-24 or larger. The total page height should be 4000-6000px for a typical homepage. Do NOT add excessive whitespace.
- HERO (CRITICAL): The hero section MUST be visually impactful. Use a full-width background image (w-full, min-h-[500px] or min-h-[600px]) with a dark overlay gradient, large bold typography centered or left-aligned over the image, and a clear CTA. The hero should feel like a magazine cover — dramatic, high-contrast, with the brand's accent color used for highlights. Do NOT make a small/timid hero.
- Include <script src="https://cdn.tailwindcss.com"></script>
- Include Google Fonts via <link> tags
- ANIMATIONS: Include GSAP, ScrollTrigger, and Swiper for interactive elements. Add these in <head>:
  <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js"></script>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.css">
  <script src="https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.js"></script>
  Use GSAP ScrollTrigger for: fade-in on scroll, parallax on hero images, staggered card reveals, counter animations for numbers/statistics. Use Swiper for any carousels or highlight sliders. Add a <script> block before </body>.
- ANIMATION FIDELITY: If SOURCE ANIMATION PATTERNS are provided below, you MUST recreate them faithfully. The original site uses specific scroll effects — match them. Do not downgrade pinned/scrub sections to simple fades. Do not skip parallax if the source has it.${cinematicDetected ? `
- CINEMATIC MODE (AUTO-DETECTED): The source is a cinematic site — it uses pinned scroll sections, scrub animations, and choreographed reveals. You MUST produce a cinematic redesign:
  * Hero: parallax background + text-split reveal (use GSAP SplitText or manual span wrapping)
  * At least 2 sections with \`ScrollTrigger.create({ trigger, pin: true, scrub: 1, end: "+=150%" })\`
  * Animated stat counters (count from 0 to target on viewport enter)
  * Stagger reveals on card grids (\`stagger: 0.1\`)
  * Smooth transitions between section backgrounds (ScrollTrigger scrub on gradient shifts)
  * Do not produce a flat landing page — this must feel like an interactive story.` : ""}
- FULL-BLEED IMAGERY: Use large, dramatic images throughout — not just small thumbnails. Hero images should span the full viewport width. Feature sections should have large images (at least 50% of the section width). Use SEEDED picsum URLs \`https://picsum.photos/seed/{brand-slug}-{context}/WIDTH/HEIGHT\` (e.g. \`/seed/acme-hero/1600/800\`). NEVER use \`?random=N\` or unseeded picsum — those shuffle on every reload. All <img> tags MUST have explicit width and height attributes AND style="object-fit:cover;max-width:100%;height:auto;"
- BRAND FIDELITY: Match the visual tone of the original site. If the original uses full-color photography, do NOT apply grayscale filters. If the original uses soft/warm backgrounds, do NOT use stark black-and-white. The EXTRACTED DESIGN TOKENS colors are from the real site — use them faithfully.
- Modern design: clear hierarchy, hover effects, smooth transitions. Each section should have visual weight — use alternating background colors, cards, images, or patterns.
${typeScalePrompt}
${aakerTokensPrompt}
- Return ONLY raw HTML starting with <!DOCTYPE html> — no JSON, no markdown fences, no explanation`

    : `${personaPrefix}You are redesigning a webpage for "${brandGuess}" (${url}).
Since the site could not be directly fetched (bot protection), use your knowledge of the brand and the user's instructions to create a professional redesign.

RULES:
- The company name is "${brandGuess}". Use this EXACT name throughout.
- Research what you know about this company and create a realistic page with appropriate content.
- The page must include a hero, about, services, case studies/portfolio, team/testimonials, CTA, and footer (6+ sections). Keep sections compact and content-dense.
- LAYOUT: Every section MUST use full viewport width. Use full-bleed backgrounds (w-full) with max-w-7xl mx-auto for inner content. NEVER create a narrow centered column. Sections should have bg colors or images that span edge-to-edge.
- Include <script src="https://cdn.tailwindcss.com"></script>
- Include Google Fonts via <link> tags
- ANIMATIONS: Include GSAP and ScrollTrigger for scroll-driven animations. Add these script tags in <head>:
  <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js"></script>
  Use GSAP ScrollTrigger for fade-in on scroll, parallax, staggered reveals, and counter animations. Add a <script> block before </body>.
- IMAGES: Use SEEDED picsum URLs \`https://picsum.photos/seed/{brand-slug}-{context}/WIDTH/HEIGHT\` (e.g. \`/seed/${brandGuess.toLowerCase().replace(/\s+/g, "-")}-hero/1920/1080\`, \`/seed/${brandGuess.toLowerCase().replace(/\s+/g, "-")}-team/800/600\`). NEVER \`?random=N\` or unseeded picsum — those shuffle per reload. Include images in hero, features, about, and card sections
- Modern, polished design: clear hierarchy, hover effects, alternating section backgrounds for visual weight
${typeScalePrompt}
${aakerTokensPrompt}
- Return ONLY raw HTML starting with <!DOCTYPE html> — no JSON, no markdown fences, no explanation`;

  // Count only top-level sections (direct children of <body>) — not deeply nested ones
  // A rough heuristic: count section/header/footer/nav tags that appear at a shallow indent level
  const allSections = (stripped.match(/<(?:section|header|footer|nav|main|article)[^>]*>/gi) || []);
  // Cap at a reasonable number — the AI inflates page size when told to match 20+ sections
  const sectionCount = Math.min(allSections.length, 12);
  // Strip _brandData from tokens sent to model (it's huge raw extraction data)
  const tokensForPrompt = { ...extractedDesign };
  delete (tokensForPrompt as any)._brandData;

  const userMsg = fetchSucceeded
    ? `REDESIGN THIS PAGE: ${url}

The original page has roughly ${sectionCount || "8"} major sections. Create a well-structured redesign with a similar number of sections (8-12 is ideal). Quality over quantity — each section should be content-dense and compact.

=== ORIGINAL TEXT CONTENT (use EXACTLY) ===
${textContent.slice(0, 6000)}

=== ORIGINAL HTML STRUCTURE ===
${stripped.slice(0, 12000)}

=== EXTRACTED DESIGN TOKENS ===
${JSON.stringify(tokensForPrompt, null, 2)}${sourceAnimationSummary}${animationBriefSummary}

=== USER INSTRUCTIONS ===
${prompt}`
    : `Create a redesigned homepage for ${brandGuess} (${url}).

The site has bot protection so I couldn't fetch the HTML. Use your knowledge of this company/brand.
${prompt}`;

  onProgress?.("Generating redesign...", "This is the slow step — the AI is writing the full page");
  const result = await router.routeJSON<{
    html: string; componentTree?: ComponentNode; designTokens?: Record<string, unknown>;
  }>("layout_generate", [
    { role: "system", content: systemPrompt },
    { role: "user", content: userMsg },
  ]);
  onProgress?.("Complete!");

  // Inject data-why-* attributes into top-level sections for "Why" overlay
  result.html = injectWhyAttributes(result.html, persona?.id || "default");

  // Fix B: strip orphaned hidden-state CSS (safety net for when the model
  // writes opacity:0 / translate initial states but fails to write the JS
  // that reveals them).
  const orphanFix = fixOrphanedHiddenStates(result.html);
  if (orphanFix.strippedRules > 0) {
    log.warn(`Orphaned hidden-state fallback: neutralized ${orphanFix.strippedRules} rule(s) for classes [${[...new Set(orphanFix.strippedClasses)].join(", ")}]`);
    result.html = orphanFix.html;
  }

  // Phase 4: staged design-refine passes. Gated on CANVAS_REFINE_PASSES — unset
  // or `none` skips the orchestrator entirely and preserves the existing
  // single-shot behavior. `all` or a comma list enables specific passes.
  const refinePasses = getRefinePasses();
  if (refinePasses.length > 0) {
    onProgress?.("Polishing...", `Running ${refinePasses.length} staged refine pass(es)`);
    const refined = await stagedRefineHtml(result.html, { passes: refinePasses }, log);
    result.html = refined.html;
    log.info(`stagedRefine: completed ${refined.passesRun.length}/${refinePasses.length} passes [${refined.passesRun.join(", ")}]`);
  }

  result.designTokens = { ...extractedDesign, brandName: brandGuess };

  const id = `scr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const screen = new Screen({
    id, projectId: ctx.projectId, prompt, html: result.html, deviceType,
    componentTree: result.componentTree, designTokens: result.designTokens,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  });
  ctx.addScreen(screen);
  return screen;
}

/**
 * Plan a redesign: analyze the site and propose pages + design system name.
 * Returns a structured plan without generating any HTML.
 */
export async function planRedesign(
  ctx: RedesignContext,
  url: string,
  userPrompt?: string,
  onProgress?: ProgressCallback,
  logger?: PipelineRun,
): Promise<{
  brandName: string;
  designSystemName: string;
  analysis: string;
  proposedPages: Array<{ title: string; description: string }>;
  designTokens: Record<string, unknown>;
  fetchedContent: { textContent: string; stripped: string; fetchSucceeded: boolean; parsedSections?: ParsedSection[]; sourceImages?: string[]; sourceVideos?: string[]; businessInfo?: BusinessInfo | null };
}> {
  const log = logger || NOOP_RUN;
  const router = getRouter();
  log.phase("FETCH");
  onProgress?.("Capturing a reference...", url);
  const fetched = await fetchPage(url, logger);

  let fetchSucceeded = false;
  let textContent = "";
  let stripped = "";

  if (fetched.fromCrawl4ai && fetched.markdown) {
    fetchSucceeded = true;
    textContent = (typeof fetched.markdown === "string" ? fetched.markdown : "").slice(0, 6000);
    stripped = stripHtml(fetched.html);
  } else if (!isBlocked(fetched.html)) {
    fetchSucceeded = true;
    stripped = stripHtml(fetched.html);
    textContent = extractText(stripped);
  }

  const brandName = extractBrandName(fetched.html || "", url);
  onProgress?.("Extracting brand colors, fonts & logos...");

  // Business-info enrichment — same as redesignFromURL
  let businessInfo: BusinessInfo | null = null;
  if (fetchSucceeded && fetched.html) {
    try {
      businessInfo = await getOrCreateBusinessInfo(url, fetched.html, brandName, router, logger);
    } catch (err) {
      log.warn(`business-info enrichment failed: ${err instanceof Error ? err.message : err}`);
    }
  }

  // Extract brand data using real CSS/HTML parsing (no AI)
  let designTokens: Record<string, unknown> = {};
  if (fetchSucceeded && (fetched.html || stripped)) {
    try {
      const htmlForExtraction = fetched.html || stripped;
      const brandData = await extractBrandDataFull(htmlForExtraction, url, fetched.computedColors, getRouter().analytics);
      designTokens = {
        colors: {
          primary: brandData.colors.primary?.hex || null,
          secondary: brandData.colors.secondary?.hex || null,
          accent: brandData.colors.accent?.hex || null,
          background: brandData.colors.background?.hex || null,
          text: brandData.colors.text?.hex || null,
        },
        typography: {
          fontFamilies: {
            heading: brandData.fonts.heading?.family || null,
            body: brandData.fonts.body?.family || null,
          },
          googleFontsUrls: brandData.fonts.googleFontsUrls,
        },
        logos: brandData.logos.filter(l => l.data).slice(0, 4),
        _brandData: brandData,
      };
      log.info(`Brand data: ${brandData.colors.all.length} colors, ${brandData.fonts.all.length} fonts, ${brandData.logos.length} logos`);
    } catch (err) {
      log.warn(`Brand extraction failed: ${err instanceof Error ? err.message : err}`);
    }
  }

  onProgress?.("Mapping out the components...");

  // Auto-match a persona for the DESIGN.md metadata
  const brandDataForPersona = (designTokens as any)?._brandData;
  const persona = autoMatchPersona({
    url, brandName, userPrompt,
    colors: brandDataForPersona?.colors, fonts: brandDataForPersona?.fonts,
    businessInfo,
  });

  // RALF: retrieve layout examples for this industry
  let layoutHint = "";
  const ralfAnalytics = getRouter().analytics;
  if (ralfAnalytics) {
    const industry = classifyIndustry(url, brandName, "Homepage");
    try {
      const examples = await ralfAnalytics.getLayoutExamples(industry, "homepage", 2);
      if (examples.length > 0) {
        layoutHint = `\n\nHere are section sequences from successful ${industry} redesigns — use as reference for section planning:\n` +
          examples.map((ex, i) => `  ${i + 1}. ${ex.metadata.sourceUrl || "site"}: [${ex.sectionSequence.join(" → ")}] (${ex.sectionCount} sections, quality: ${ex.qualityScore})`).join("\n");
        log.debug(`RALF: ${examples.length} layout examples for ${industry}/homepage`);
      }
    } catch {}
  }

  // AI plans the redesign: analyzes the brand and proposes pages
  const plan = await router.routeJSON<{
    designSystemName: string;
    analysis: string;
    pages: Array<{ title: string; description: string }>;
  }>("intent_parse", [
    { role: "system", content: `You are a senior UI/UX designer planning a website redesign. Analyze the brand and propose a set of pages to redesign.

Return JSON:
{
  "designSystemName": "A creative 2-word theme name for the design system (e.g., 'Editorial Prestige', 'Bold Navigator', 'Minimal Luxe')",
  "analysis": "2-3 sentences analyzing the brand's current identity, tone, and audience",
  "pages": [
    { "title": "Homepage", "description": "A bold, high-impact hero section that clearly states their value proposition, followed by..." },
    { "title": "Services Overview", "description": "..." },
    ...
  ]
}

CRITICAL: The user's instructions take absolute priority over everything else.
- If the user mentions specific pages (e.g., "the homepage", "just the landing page", "only services"), propose ONLY those pages — do NOT add extra pages.
- If the user says "homepage" without mentioning other pages, return ONLY a single Homepage entry in the pages array.
- If the user gives style/branding instructions (e.g., "keep their colours", "keep logos"), note that in your analysis and respect it.
- ONLY propose 3-5 pages if the user gives NO specific page instructions (e.g., just provides a URL with no guidance).
Common pages when proposing multiple: Services, About, Case Studies, Blog/Insights, Contact, Portfolio.` },
    { role: "user", content: `Plan a redesign for ${brandName} (${url}).
${userPrompt ? `\nUser instructions: ${userPrompt}` : ""}
${fetchSucceeded ? `\nSite content:\n${textContent.slice(0, 3000)}` : "\nCould not fetch site content — use your knowledge of the brand."}${layoutHint}` },
  ]);

  return {
    brandName,
    designSystemName: plan.designSystemName || "Design System",
    analysis: plan.analysis || "",
    proposedPages: plan.pages || [{ title: "Homepage", description: "A complete homepage redesign" }],
    designTokens: {
      ...designTokens,
      brandName: plan.designSystemName || brandName,
      _meta: {
        analysis: plan.analysis,
        personaId: persona?.id || null,
        personaName: persona?.name || null,
        personaContent: persona?.content?.slice(0, 1500) || null,
        proposedPages: plan.pages,
        url,
        originalBrandName: brandName,
      },
    },
    fetchedContent: (() => {
      if (!fetchSucceeded) return { textContent, stripped, fetchSucceeded, parsedSections: [], businessInfo };
      const rawHtml = fetched.html || stripped;
      const isCine = /gsap|ScrollTrigger|scroll-trigger|data-scroll|locomotive|framer-motion|lottie/i.test(rawHtml);
      const assets = extractSourceAssets(rawHtml, url, { maxImages: 20, maxVideos: 6 });
      log.info(`Source assets mined: ${assets.images.length} images, ${assets.videos.length} videos`);
      return {
        textContent,
        stripped,
        fetchSucceeded,
        parsedSections: parseSectionsWithFallback(rawHtml, undefined, { maxSections: isCine ? 15 : 10 }),
        sourceImages: assets.images,
        sourceVideos: assets.videos,
        businessInfo,
      };
    })(),
  };
}

export async function extractDesignFromURL(url: string): Promise<Record<string, unknown>> {
  const fetched = await fetchPage(url);
  const html = fetched.html;
  if (!html || isBlocked(html)) {
    throw new Error(`Could not fetch content from ${url}. The site may have bot protection.`);
  }
  const brandData = await extractBrandDataFull(html, url, fetched.computedColors, getRouter().analytics);
  return {
    colors: {
      primary: brandData.colors.primary?.hex || null,
      secondary: brandData.colors.secondary?.hex || null,
      accent: brandData.colors.accent?.hex || null,
      background: brandData.colors.background?.hex || null,
      text: brandData.colors.text?.hex || null,
    },
    typography: {
      fontFamilies: {
        heading: brandData.fonts.heading?.family || null,
        body: brandData.fonts.body?.family || null,
      },
    },
    logos: brandData.logos.filter(l => l.data).slice(0, 4),
    _brandData: brandData,
  };
}
