/**
 * Section-by-section page generation: parse source HTML into sections,
 * generate each independently, and assemble into a complete page.
 */

import { Screen, DeviceType } from "./screen.js";
import { DesignSystem } from "./design-system.js";
import { ComponentLibrary, type ComponentCategory, type UIComponentData } from "./component.js";
import { getRouter } from "../utils/router.js";
import { PROMPTS } from "../utils/prompts.js";
import { assembleSections, type ParsedSection } from "../utils/section-parser.js";
import { syncPinRevealAnimations } from "../utils/pin-reveal-sync.js";
import { stripPinnedContentFades } from "../utils/content-fade-guard.js";
import { stripConflictingTransitions } from "../utils/transition-guard.js";
import { validateAndFixFit } from "../utils/fit-validator.js";
import { parseSectionsWithFallback } from "../utils/spa-section-parser.js";
import { extractSections as extractSourceSections, type AnimationPattern } from "../utils/section-extractor.js";
import { generateAnimationBrief, type AnimationBrief } from "../utils/section-classifier.js";
import { getScreenshotService } from "../screenshot/service.js";
import { autoMatchPersona, buildPersonaPrompt, PERSONA_AAKER_VECTORS, type AakerVector } from "../utils/personas.js";
import { formatCompanyBlock, type BusinessInfo } from "../utils/business-info.js";
import { computeTypographicScale, formatScaleForPrompt } from "../utils/typographic-scale.js";
import { validateDesignTokenContrast } from "../utils/contrast.js";
import { generatePalette, formatPaletteForPrompt } from "../utils/color-scale.js";
import { validatePairing } from "../utils/font-pairing.js";
import { critiqueHtml } from "../utils/design-critique.js";
import { computeDesignTokens, formatDesignTokensForPrompt } from "../utils/aaker-tokens.js";
import { fromCanvasDesignSystem, exportTailwind, promptDsFormat, formatDialsForPrompt } from "../utils/design-md.js";
import { NOOP_RUN, type PipelineRun } from "../utils/logger.js";

import type { ConsistencyConstraints } from "./consistency.js";
import type { ProgressCallback } from "./project.js";
import { classifyIndustry, detectPageType } from "./industry.js";

/** Generate content-type-specific hints based on section label */
export function detectContentHint(labelLower: string, index: number): string {
  if (labelLower.match(/stat|metric|number|highlight|financial|revenue|performance|kpi|dashboard/)) {
    return `This is a DATA/STATS section. Include:
- Large animated counter numbers (data-counter="VALUE" data-prefix="€" data-suffix="B")
- SVG ring/donut charts or animated progress bars
- Dark background with glowing accent-colored numbers (text-shadow)
- Grid layout: 3-4 large KPIs with trend indicators (+/-%)
- GSAP ScrollTrigger for counter and bar animations`;
  }
  if (labelLower.match(/interview|ceo|quote|chairman|director|executive/)) {
    return `This is a CEO/EXECUTIVE INTERVIEW section. Include:
- Large portrait image (600x800, portrait orientation) on one side
- Pull quote with oversized decorative quotation mark SVG (accent color, opacity 0.1)
- Quote text: text-3xl or larger, serif font (Playfair Display)
- Name and title below quote
- Video play button overlay on the portrait (circular, white/90, hover: accent color)
- GSAP: portrait slides in from left, quote reveals from right`;
  }
  if (labelLower.match(/chapter|report|navigation|glance|overview|filter|topic/)) {
    return `This is a CHAPTER NAVIGATION section. Include:
- Grid or Swiper carousel of chapter cards
- Each card: large background image, chapter number overlay, title, description
- Hover: image zooms, overlay darkens, arrow appears
- For carousels: include Swiper initialization in <script>
- GSAP: staggered card reveal on scroll`;
  }
  if (labelLower.match(/team|employee|people|workforce|board/)) {
    return `This is a TEAM/EMPLOYEES section. Include:
- Large hero stat (employee count with counter animation)
- Portrait images or team grid
- Key workforce metrics with progress bars or comparison bars
- GSAP: counters and bars animate on scroll`;
  }
  if (labelLower.match(/carousel|slider|highlight|swiper/)) {
    return `This is a CAROUSEL/SLIDER section. Include:
- Swiper carousel with large cards or fullscreen slides
- Custom navigation arrows and pagination dots
- Initialize Swiper in the <script> tag
- GSAP: content within each slide staggers in on slide change`;
  }
  if (labelLower.match(/quiz|knowledge|test|engage|interactive/)) {
    return `This is an INTERACTIVE/QUIZ section. Include:
- Card-based quiz or interactive element
- Multiple choice options with click handlers
- Score tracking and progress indicator
- GSAP transitions between states (card slide/fade)
- All interactivity in the <script> tag`;
  }
  if (labelLower.match(/sustain|esg|environment|climate|social|governance/)) {
    return `This is a SUSTAINABILITY/ESG section. Include:
- SVG circular progress indicators for ESG metrics
- Progress bars with target vs actual
- Green/blue/purple color coding for E/S/G
- GSAP: stroke-dashoffset animation for circles, width animation for bars`;
  }
  if (labelLower.match(/region|map|geograph|segment|market|country|emea|america|asia/)) {
    return `This is a REGIONAL PERFORMANCE section. Include:
- Grid of region cards (EMEA, North America, Asia-Pacific, etc.)
- Each card: region name, revenue figure, growth indicator, progress bar
- Hover: card elevates, reveals additional stats
- GSAP: staggered card reveal, bar animations`;
  }
  if (labelLower.match(/timeline|milestone|history|journey/)) {
    return `This is a TIMELINE/MILESTONES section. Include:
- Vertical timeline with central line that grows with scroll
- Alternating left/right content blocks with images
- Milestone dots that pulse when active
- GSAP ScrollTrigger scrub for the timeline line growth`;
  }
  if (labelLower.match(/value|creation|model|business|strategy|roadmap/)) {
    return `This is a BUSINESS MODEL/STRATEGY section. Include:
- Editorial magazine-style layout with large drop cap on first paragraph
- Two-column text on desktop
- Full-bleed image breaking between text
- Pull quote with accent border-left
- GSAP: paragraphs fade in on scroll`;
  }
  // Default: generic but still premium
  return `- Make this section visually rich and interactive
- Include at least one large image (800x500 or larger)
- Add GSAP scroll-triggered animations in a <script> tag
- Alternate background color from surrounding sections`;
}

/** Map section roles/labels to component library categories */
export function matchComponentsForSection(
  lib: ComponentLibrary,
  section: ParsedSection,
  brandCtx?: { brandName?: string; domain?: string },
): string | null {
  const roleToCategories: Record<string, ComponentCategory[]> = {
    nav: ["navbar"],
    hero: ["hero"],
    footer: ["footer"],
    content: [], // determined by label below
  };

  // For content sections, infer category from label
  const labelLower = section.label.toLowerCase();
  let categories = roleToCategories[section.role] || [];

  if (section.role === "content") {
    if (labelLower.match(/stat|metric|number|highlight|financial|revenue|performance|kpi/)) categories = ["stats"];
    else if (labelLower.match(/team|employee|people|board|executive|ceo/)) categories = ["team"];
    else if (labelLower.match(/interview|quote|testimonial|review/)) categories = ["testimonials"];
    else if (labelLower.match(/feature|service|offering|capability|model/)) categories = ["features"];
    else if (labelLower.match(/card|chapter|report|overview|glance/)) categories = ["cards"];
    else if (labelLower.match(/gallery|image|photo|portfolio/)) categories = ["gallery"];
    else if (labelLower.match(/carousel|slider|highlight|swiper/)) categories = ["carousel"];
    else if (labelLower.match(/cta|call|action|download|contact/)) categories = ["cta"];
    else if (labelLower.match(/faq|question|quiz/)) categories = ["faq"];
    else if (labelLower.match(/dashboard|chart|data|value/)) categories = ["stats", "cards"];
    else if (labelLower.match(/banner|announce/)) categories = ["banner"];
    else if (labelLower.match(/timeline|milestone|history/)) categories = ["timeline" as ComponentCategory];
    else categories = ["features", "cards"]; // generic fallback
  }

  if (categories.length === 0) return null;

  // Get best matching components (highest quality, prefer flexible/fluid)
  const candidates: UIComponentData[] = [];
  for (const cat of categories) {
    candidates.push(...lib.getByCategory(cat));
  }

  if (candidates.length === 0) return null;

  // Sort: brand-matched approved templates first (when redesigning a known
  // brand we want to reuse its own approved components), then hand-crafted
  // premium, then quality, then animation/interactivity.
  const brandLower = brandCtx?.brandName?.toLowerCase();
  const domainLower = brandCtx?.domain?.toLowerCase();
  candidates.sort((a, b) => {
    const brandScore = (c: UIComponentData) => {
      if (!brandLower && !domainLower) return 0;
      const tagsLower = c.tags.map(t => t.toLowerCase());
      const brandHit = brandLower && tagsLower.some(t => t === brandLower || t.includes(brandLower));
      const domainHit = domainLower && tagsLower.some(t => t === domainLower || t.includes(domainLower));
      return brandHit || domainHit ? 100 : 0;
    };
    const approvedScore = (c: UIComponentData) => c.source === "approved" ? 5 : 0;
    const premiumScore = (c: UIComponentData) => c.source === "hand-crafted:premium" ? 10 : 0;
    const animScore = (c: UIComponentData) => (c.tags.includes("animated") || c.tags.includes("interactive")) ? 2 : 0;
    const adaptScore = (c: UIComponentData) => c.adaptability === "fluid" ? 1 : c.adaptability === "flexible" ? 2 : 0;
    return (brandScore(b) - brandScore(a))
      || (premiumScore(b) - premiumScore(a))
      || (approvedScore(b) - approvedScore(a))
      || (b.quality - a.quality)
      || (animScore(b) - animScore(a))
      || (adaptScore(b) - adaptScore(a));
  });

  // Pick top 2 components, truncate their HTML
  const picked = candidates.slice(0, 2);
  const parts = picked.map(c => {
    const html = c.html.length > 2500 ? c.html.slice(0, 2500) + "\n<!-- truncated -->" : c.html;
    return `[${c.id}] ${c.name} (${c.adaptability})\n${html}`;
  });

  return parts.join("\n\n---\n\n");
}

export function detectSectionTypeFromLabel(label: string): string {
  const lower = label.toLowerCase();
  if (/nav|menu|header/i.test(lower)) return "nav";
  if (/footer/i.test(lower)) return "footer";
  if (/hero|banner|main.*heading/i.test(lower)) return "hero";
  if (/pricing|plan|tier/i.test(lower)) return "pricing";
  if (/testimonial|review|client.*said/i.test(lower)) return "testimonials";
  if (/feature|benefit|advantage/i.test(lower)) return "features";
  if (/stat|metric|number|figure/i.test(lower)) return "stats";
  if (/team|people|member/i.test(lower)) return "team";
  if (/faq|question/i.test(lower)) return "faq";
  if (/cta|call.to.action|get.started/i.test(lower)) return "cta";
  if (/contact|form/i.test(lower)) return "contact";
  if (/gallery|portfolio|showcase/i.test(lower)) return "gallery";
  if (/partner|client|logo|trust/i.test(lower)) return "logos";
  return "content";
}

/** Build a focused prompt for generating a single section */
export function buildSectionPrompt(
  section: ParsedSection,
  ctx: {
    index: number;
    total: number;
    brandName: string;
    domain: string;
    personaStyle: string;
    tokenSummary: string;
    navItems: string;
    sectionPlan: string;
    prevLabel: string | null;
    nextLabel: string | null;
    componentHtml: string;
    templateExample?: string;
    premiumScroll?: boolean;
    sourceAnimations?: string;
    animationBrief?: string;
    sourceImages?: string[];
    sourceVideos?: string[];
    companyBlock?: string;
  },
): string {
  // Detect content type from label for smarter hints
  const labelLower = section.label.toLowerCase();
  const contentTypeHint = section.role === "content" ? detectContentHint(labelLower, ctx.index) : "";

  const roleHints: Record<string, string> = {
    nav: `Generate a PREMIUM NAVIGATION BAR for "${ctx.brandName}".
- Sticky header (fixed top-0 w-full z-40 bg-white border-b)
- Nav bar height is \`h-[72px]\` — every element inside MUST fit within it. The logo image needs \`h-8 md:h-10\` (never larger) AND must NOT emit inline \`height:auto\` — that overrides the height class and the logo renders at intrinsic height (often 100-150px) and bleeds into the hero below. Use \`style="max-width:100%;object-fit:contain;"\` only on nav logos.
- Every nav \`<a>\` and \`<button>\` MUST have \`whitespace-nowrap\` — without it, multi-word items like "Spark positive change" wrap onto 2 lines and break the bar height.
- Include the brand logo on the left (see LOGO in design tokens)
- Navigation links from the source: ${ctx.navItems}
- CRO: include a CTA button (e.g. "Get Started", "Contact Us") on the right side of the nav — visible at all times
- Language switcher and search icon on the right
- Dropdown menus for main categories
- GSAP: nav should transform on scroll — shrink height, add shadow
- Include a <script> tag with the scroll-transform animation`,

    hero: `Generate a CINEMATIC HERO SECTION for "${ctx.brandName}".
- Full viewport height (h-screen or min-h-[700px]) — core message must be visible without scrolling
- Full-bleed background image: ${ctx.sourceImages && ctx.sourceImages.length > 0 ? `use the FIRST URL from <source-images> below verbatim — do NOT use picsum` : `https://picsum.photos/seed/${ctx.brandName.toLowerCase().replace(/\s+/g, "-")}-hero/1920/1080`} with data-parallax
- Dark gradient overlay (bg-gradient-to-t from-black via-black/50 to-black/30)
- Film grain texture overlay (CSS animated noise pattern, opacity 0.04-0.06)
- Large headline: text-6xl to text-[8rem], font-black, white, stacked on 2 lines
- Second line or year in the brand accent color
- Eyebrow label above headline with thin accent-colored line
- Subtitle: text-lg, white/70, max-w-xl
- CRO: ONE single primary CTA button with brand accent color — high contrast, large padding (px-8 py-4), clear action label. Do NOT add multiple equal CTAs that split attention
- Scroll indicator at bottom (thin line with bounce animation)
- Add mt-20 if there's a fixed nav above
- Include a <script> tag with GSAP timeline: staggered text reveal (each line slides up from hidden overflow), parallax background on scroll, fade out on scroll past 70%
- Include a <style> tag with @keyframes for film grain animation`,

    footer: `Generate a PREMIUM EDITORIAL FOOTER for "${ctx.brandName}".
- Dark background (bg-[#0a0a0a] or black) with accent-colored top border
- 4-column link grid: About, Report Sections, Downloads, Legal
- Newsletter signup row with email input
- Social media icons (SVG: LinkedIn, Twitter/X, Instagram)
- Bottom bar: copyright, language switcher, back-to-top button
- Include a <script> for smooth-scroll back-to-top`,

    content: `Generate the "${section.label}" content section for "${ctx.brandName}".
${contentTypeHint}
- Full-width section with appropriate background color (alternate: white, #f5f5f5, dark #0a0a0f)
- Rich, detailed, visually impactful — NOT a sparse summary
- Include large images: ${ctx.sourceImages && ctx.sourceImages.length > 0 ? `use URLs from <source-images> below verbatim — do NOT use picsum` : `https://picsum.photos/seed/${ctx.brandName.toLowerCase().replace(/\s+/g, "-")}-${section.label.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 24)}/WIDTH/HEIGHT`}
- Include a <script> tag with GSAP ScrollTrigger animations for this section
- Include a <style> tag if the section needs custom CSS (@keyframes, etc.)`,
  };

  // Premium Scroll: add pin/scrub instructions for eligible sections
  const premiumScrollHint = ctx.premiumScroll && (section.role === "hero" || section.role === "content")
    ? `\n\nPREMIUM SCROLL ANIMATION — This section uses scroll-locked pinning:
- Add min-height: 100vh to the section root element
- Use GSAP ScrollTrigger with pin: true and scrub: 1
- Wrap ALL animated elements in a gsap.timeline() tied to the pinned ScrollTrigger
- Set end: "+=150%" so the section stays pinned for 1.5x viewport of scrolling
- Animate elements sequentially: fade/slide in one after another as the user scrolls
- Do NOT use once: true — scrub ties animation progress to scroll position
- Example pattern:
  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: ".section-class",
      pin: true,
      scrub: 1,
      start: "top top",
      end: "+=150%"
    }
  });
  tl.from(".headline", { opacity: 0, y: 60 })
    .from(".subtitle", { opacity: 0, y: 40 }, "-=0.3")
    .from(".cta", { opacity: 0, scale: 0.9 }, "-=0.2");`
    : "";

  const componentRef = ctx.componentHtml
    ? `\n=== REFERENCE COMPONENT(S) FROM LIBRARY — adapt this design to fit the section ===
Use these pre-built components as your FOUNDATION. Adapt the structure, colors, and content to match the brand and source content. Keep the component's layout patterns, spacing, and visual approach — just swap in the real content and brand colors.

${ctx.componentHtml}
`
    : "";

  const templateRef = ctx.templateExample
    ? `\n<example-section>
Here is a high-quality example of a "${section.role}" section from a previous generation. Use it as style/structure inspiration — do NOT copy it verbatim. Adapt to this brand's content and tokens.

${ctx.templateExample}
</example-section>
`
    : "";

  // Deterministic per-section class prefix. Stops the model from inventing a
  // label-derived prefix (e.g. two "Text Block Content" sections both picking
  // `textblock-cine`), which collides CSS, @keyframes, and GSAP selectors
  // across sections.
  const namespacePrefix = `sec-${ctx.index + 1}${ctx.premiumScroll ? "-cine" : ""}`;

  return `${roleHints[section.role] || roleHints.content}${premiumScrollHint}
${componentRef}${templateRef}
<section-namespace>
Use "${namespacePrefix}" as the class-name prefix for EVERY custom CSS class, @keyframes name, GSAP ScrollTrigger id, and JS querySelector in this section. Example: .${namespacePrefix}__headline, .${namespacePrefix}__card, .${namespacePrefix}__cta, @keyframes ${namespacePrefix}-pulse, id: "${namespacePrefix}-main". Do NOT derive a prefix from the section label — other sections may share the same label and collide. Do NOT reuse a prefix from a sibling section. This namespace is unique to this section and this section only.
</section-namespace>

<page-context>
Page: "${ctx.brandName}" — Section ${ctx.index + 1} of ${ctx.total}
${ctx.personaStyle}
${ctx.prevLabel ? `Previous: "${ctx.prevLabel}" — use a different background color` : "First section on the page."}
${ctx.nextLabel ? `Next: "${ctx.nextLabel}"` : "Last section on the page."}
</page-context>
${ctx.companyBlock ? `\n${ctx.companyBlock}\n` : ""}
<page-plan>
${ctx.sectionPlan}
</page-plan>

<brand-tokens>
${ctx.tokenSummary}
</brand-tokens>

<source-content>
${section.textContent}
</source-content>
${ctx.sourceImages && ctx.sourceImages.length > 0 ? `
<source-images>
The following image URLs were extracted from the original site. Use these EXACT URLs in <img src="..."> attributes — do NOT replace them with picsum, do NOT modify them, do NOT use placeholders. Pick the URLs that best fit each image slot in this section. If a section needs more images than provided, you may reuse URLs from this list. **Logo selection**: when rendering a card about a specific company, client, partner, or group member, prefer the URL whose filename matches the company name (e.g. a card titled "Black Sun Global" → \`.../logos/blacksun.svg\`). Do NOT replace company/partner logos with generic inline SVG icons — the real logo is right here in the list.
${ctx.sourceImages.map((u, i) => `${i + 1}. ${u}`).join("\n")}
</source-images>
` : ""}${ctx.sourceVideos && ctx.sourceVideos.length > 0 ? `
<source-videos>
The following video URLs were extracted from the original site. When this section calls for motion/video content (hero background video, feature showcase, testimonial, product demo), prefer a <video autoplay muted loop playsinline> element with one of these EXACT URLs as the src — do NOT invent video URLs, do NOT use placeholders. If no video fits the section purpose, ignore this block.
${ctx.sourceVideos.map((u, i) => `${i + 1}. ${u}`).join("\n")}
</source-videos>
` : ""}${ctx.sourceAnimations ? `
<source-animations>
${ctx.sourceAnimations}
Recreate these animation effects faithfully — do not downgrade pinned/scrub/parallax to simple fades.
</source-animations>
` : ""}${ctx.animationBrief ? `
<animation-brief>
The following effects were reverse-engineered from screenshots of the live source site. Match this visual feel:
${ctx.animationBrief}
</animation-brief>
` : ""}
<original-html>
${section.rawHtml.slice(0, 4000)}
</original-html>

Return ONLY the section HTML.`;
}

// Distribute the source-image pool across sections so each one gets a small,
// relevant slice instead of the whole list (token bloat) or nothing.
// - nav/footer: skip — they shouldn't use brand photography
// - hero: top 3 (best-ranked imagery)
// - content/other: full pool capped at 12 — sections like "Our group companies"
//   need to see ALL logos to pick the right ones per card; a rotating window
//   of 6 starting at index*4 often missed half the logo set. Token cost at
//   10-12 URLs is trivial (~1.2K chars) and the model picks what fits the slot.
function sectionSourceImages(pool: string[] | undefined, role: string, _index: number): string[] | undefined {
  if (!pool || pool.length === 0) return undefined;
  if (role === "nav" || role === "footer") return undefined;
  if (role === "hero") return pool.slice(0, Math.min(3, pool.length));
  return pool.slice(0, Math.min(12, pool.length));
}

// Videos are scarcer than images and more expensive to load, so distribute
// more conservatively: hero gets the first 2, content sections rotate one at
// a time, nav/footer get none.
function sectionSourceVideos(pool: string[] | undefined, role: string, index: number): string[] | undefined {
  if (!pool || pool.length === 0) return undefined;
  if (role === "nav" || role === "footer") return undefined;
  if (role === "hero") return pool.slice(0, Math.min(2, pool.length));
  return [pool[index % pool.length]];
}

/**
 * Context object passed to generatePage / generatePageSectioned so they
 * can access the project's state without needing a full Project reference.
 */
export interface PageGenerationContext {
  projectId: string;
  designSystem: DesignSystem | null;
  componentLibrary: ComponentLibrary | null;
  addScreen: (screen: Screen) => void;
  /** Phase 2: DESIGN.md contrast-ratio findings from post-extract lint, forwarded into UICrit. */
  dsLintFindings?: Array<{ rule: string; severity: string; message: string; component?: string; ratio?: number }>;
}

/**
 * Generate a single page as part of a multi-page redesign.
 * Uses pre-fetched content from planRedesign() to avoid re-crawling.
 */
export async function generatePage(
  ctx: PageGenerationContext,
  url: string,
  pageTitle: string,
  pageDescription: string,
  brandName: string,
  fetchedContent: { textContent: string; stripped: string; fetchSucceeded: boolean; parsedSections?: ParsedSection[]; sourceImages?: string[]; sourceVideos?: string[] },
  designTokens: Record<string, unknown>,
  deviceType: DeviceType = "DESKTOP",
  onProgress?: ProgressCallback,
  logger?: PipelineRun,
): Promise<Screen> {
  const log = logger || NOOP_RUN;
  const router = getRouter();
  const domain = new URL(url).hostname.replace("www.", "");
  const { textContent, stripped, fetchSucceeded } = fetchedContent;

  onProgress?.(`Generating ${pageTitle}...`);

  // Auto-match persona for this page generation
  const persona = autoMatchPersona({
    url, brandName, userPrompt: pageDescription,
    colors: (designTokens as any)?._brandData?.colors,
  });
  const personaPrefix = persona ? buildPersonaPrompt(persona, { isRedesign: true }) : "";

  // Typographic scale from persona's Aaker vector
  const aakerVec: AakerVector = persona ? (PERSONA_AAKER_VECTORS[persona.id] || [0.3, 0.3, 0.5, 0.4, 0.2]) : [0.3, 0.3, 0.5, 0.4, 0.2];
  const typeScale = computeTypographicScale(aakerVec);
  const typeScalePrompt = formatScaleForPrompt(typeScale);
  log.debug(`typescale ${persona?.id || "default"}: ratio=${typeScale.ratio}, base=${typeScale.basePx}px, measure=${typeScale.measureCh}ch`);

  // Aaker-driven design tokens (border-radius, spacing, shadows, animation)
  const aakerDesignTokens = computeDesignTokens(aakerVec);
  const aakerTokensPrompt = formatDesignTokensForPrompt(aakerDesignTokens);
  log.debug(`Aaker tokens: density=${aakerDesignTokens.density}, radius=${aakerDesignTokens.borderRadius.md}px, spacing=${aakerDesignTokens.spacing.unit}px, ease=${aakerDesignTokens.animation.gsapEase}`);

  // APCA contrast validation — log but do NOT mutate brand colors for redesigns
  // The model should use the real extracted brand colors, not darkened versions
  const contrastReport = validateDesignTokenContrast(designTokens as any);
  if (contrastReport.pairs.length > 0) {
    for (const pair of contrastReport.pairs) {
      const status = pair.passes ? "PASS" : "FAIL";
      log.debug(`contrast ${pair.name}: Lc ${pair.lc} ${status} (required: ${pair.required})`);
      if (!pair.passes && pair.suggestedFix) {
        log.debug(`  -> suggestion: ${pair.suggestedFix} (not applied — preserving brand colors)`);
      }
    }
  }

  // Phase 5: dial guidance is opt-in. We render the bands only when the user
  // has explicitly set `ds.dials` — injecting defaults on every generation
  // was a regression: the "asymmetric / GSAP ScrollTrigger / cockpit-density"
  // band text reads as extra must-hit requirements and pushes Kimi past the
  // 16K section_generate budget on content-heavy sites like PCG.
  const userDials = (ctx.designSystem as any)?.dials;
  const dialsBlock = userDials ? `\n${formatDialsForPrompt(userDials)}` : "";

  // Build design system constraint if frontend has set one. Phase 3:
  // `CANVAS_PROMPT_DS_FORMAT=tailwind` swaps the bullet block for a Tailwind
  // `theme.extend` snippet — syntax the model has strong priors on. Default
  // stays JSON/bullets until the A/B is green on the canonical sites.
  const ds = ctx.designSystem;
  let dsConstraint: string;
  if (ds && promptDsFormat() === "tailwind") {
    const tokens = fromCanvasDesignSystem(ds as any, brandName);
    const tailwindCfg = exportTailwind(tokens);
    const radius = (ds as any).cornerRadius || "8px";
    dsConstraint = `
MANDATORY DESIGN SYSTEM — USE THESE EXACT VALUES (Tailwind theme):
\`\`\`js
${tailwindCfg}
\`\`\`
- Reference tokens via arbitrary values: bg-[#hex], text-[#hex], rounded-[${radius}].
- Load the heading + body fonts via Google Fonts <link> tags.
- Do NOT substitute colors; the hex values above are extracted from the real brand.
${typeScalePrompt}
${aakerTokensPrompt}
${dialsBlock}`;
  } else if (ds) {
    dsConstraint = `
MANDATORY DESIGN SYSTEM — USE THESE EXACT VALUES:
- Primary color: ${(ds as any).colors?.primary || (ds as any).palette?.primary || ""} (use for CTAs, links, key accents, buttons)
- Secondary color: ${(ds as any).colors?.secondary || (ds as any).palette?.secondary || ""} (use for supporting elements)
- Heading font: "${(ds as any).fonts?.headline || ""}" (load via Google Fonts <link> tag)
- Body font: "${(ds as any).fonts?.body || ""}" (load via Google Fonts <link> tag)
- Corner radius: ${(ds as any).cornerRadius || "8px"} (apply to cards, buttons, images)
Use these colors as hex values in inline styles or Tailwind arbitrary values like bg-[#hex], text-[#hex].
${typeScalePrompt}
${aakerTokensPrompt}
${dialsBlock}`;
  } else {
    dsConstraint = `${typeScalePrompt}\n${aakerTokensPrompt}\n${dialsBlock}`;
  }

  // Build logo instruction — prefer inline SVGs from header/nav, skip favicons
  const tokenLogos = (designTokens as any)?.logos;
  let logoInstruction = "";
  if (Array.isArray(tokenLogos) && tokenLogos.length > 0) {
    // 1. Inline SVGs captured from header/nav (best — they're the actual logo)
    const inlineSvg = tokenLogos.find((l: any) => l.type === "semantic-logo" && l.data?.startsWith("data:image/svg"));
    // 2. Semantic logo URLs (images with "logo"/"brand" in attrs) — skip favicons
    const semanticUrl = tokenLogos.find((l: any) => l.type === "semantic-logo" && l.url && !l.url.includes("favicon") && !l.url.includes("icon") && !l.url.startsWith("data:"));
    // 3. SVG icon as last resort (better than raster favicon)
    const svgIcon = tokenLogos.find((l: any) => l.type === "svg-icon");

    if (inlineSvg) {
      logoInstruction = `\n- LOGO (CRITICAL): The brand logo MUST appear in the navigation bar. Use this exact SVG logo as an <img> src: ${inlineSvg.data}. Example: <img src="${inlineSvg.data}" alt="${brandName} logo" class="h-8 w-auto">. Place at left side of nav. Do NOT use text-only branding or a favicon.`;
      log.debug(`Logo: using inline SVG (${inlineSvg.data.length} chars)`);
    } else if (semanticUrl) {
      logoInstruction = `\n- LOGO (CRITICAL): The brand logo MUST appear in the navigation bar. Use: <img src="${semanticUrl.url}" alt="${brandName} logo" class="h-8 w-auto">. Place at left side of nav. Do NOT use text-only branding or a favicon.`;
      log.debug(`Logo: using semantic URL ${semanticUrl.url}`);
    } else if (svgIcon) {
      logoInstruction = `\n- LOGO (CRITICAL): Use this SVG icon in the nav: <img src="${svgIcon.url}" alt="${brandName} logo" class="h-8 w-auto">. Do NOT use a raster favicon.`;
      log.debug(`Logo: using SVG icon ${svgIcon.url}`);
    } else {
      log.debug(`Logo: no suitable logo found, using text branding`);
    }
  }

  const systemPrompt = fetchSucceeded
    ? `${personaPrefix}You are redesigning the "${pageTitle}" page for "${brandName}" (${domain}).
${dsConstraint}
RULES:
- The company name is "${brandName}". Use this EXACT name.
- REAL CONTENT (CRITICAL): You MUST use the ACTUAL text, headings, numbers, statistics, names, and quotes from the SOURCE CONTENT provided below. Do NOT invent placeholder text like "Significant", "Strong", or "Enhanced". If the source says "€23.7 billion revenue", use that exact figure. If it names a CEO, use that name. Every heading, navigation item, and data point should come from the source. Do NOT genericize real content into vague descriptions.
- This is the ${pageTitle} page: ${pageDescription}
- Create a COMPLETE page with ALL sections appropriate for a ${pageTitle.toLowerCase()} page. For a homepage: include nav, hero, services/features, about, portfolio/case studies, testimonials, CTA, and footer (8+ sections minimum). For other pages: include at least 6 sections. Every section from the source content must be represented.
- EXACT COLORS (CRITICAL): You MUST use the EXACT hex color values from the DESIGN TOKENS below. Do NOT approximate or substitute colors. If the design tokens say primary is "#6aabcf", use exactly "#6aabcf" — not "#0094d8" or any other blue. Use Tailwind arbitrary values like bg-[#6aabcf], text-[#6aabcf], border-[#6aabcf] for precise control.${logoInstruction}
- LAYOUT: Every section MUST use full viewport width. Use full-bleed backgrounds (w-full) with max-w-7xl mx-auto for inner content. NEVER create a narrow centered column for the entire page. Sections should have bg colors or images that span edge-to-edge.
- SPACING: Keep sections COMPACT. Use py-12 to py-20 for section padding — NEVER py-24 or larger. Total page height should be 4000-6000px. Do NOT add excessive whitespace.
- HERO (CRITICAL): The hero section MUST be visually impactful. Use a full-width background image (w-full, min-h-[500px] or min-h-[600px]) with a dark overlay gradient, large bold typography centered or left-aligned over the image, and a clear CTA. The hero should feel like a magazine cover — dramatic, high-contrast, with the brand's accent color used for highlights. Do NOT make a small/timid hero.
- Include <script src="https://cdn.tailwindcss.com"></script>
- Include Google Fonts via <link> tags
- ANIMATIONS: Include GSAP, ScrollTrigger, and Swiper for interactive elements. Add these in <head>:
  <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js"></script>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.css">
  <script src="https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.js"></script>
  Use GSAP ScrollTrigger for: fade-in on scroll, parallax on hero images, staggered card reveals, counter animations for numbers/statistics. Use Swiper for any carousels or highlight sliders. Add a <script> block before </body>.
- FULL-BLEED IMAGERY: Use large, dramatic images throughout — not just small thumbnails. Hero images should span the full viewport width. Feature sections should have large images (at least 50% of the section width). Use SEEDED picsum URLs in the form \`https://picsum.photos/seed/{brand-slug}-{context}/WIDTH/HEIGHT\` (e.g. \`/seed/${brandName.toLowerCase().replace(/\s+/g, "-")}-hero/1600/800\`). NEVER use \`?random=N\` or unseeded picsum — those shuffle per deployment. All <img> tags MUST have explicit width and height attributes AND style="object-fit:cover;max-width:100%;height:auto;"
- BRAND FIDELITY: Match the visual tone of the original site. If the original uses full-color photography, do NOT apply grayscale filters. If the original uses soft/warm backgrounds, do NOT use stark black-and-white. The DESIGN TOKENS colors are extracted from the real site — use them faithfully.
- Modern design: clear hierarchy, hover effects, smooth transitions. Keep sections compact and content-dense. Each section should have visual weight — use alternating background colors, cards, images, or patterns to fill the width.
- Return ONLY raw HTML starting with <!DOCTYPE html>`
    : `${personaPrefix}You are designing the "${pageTitle}" page for "${brandName}" (${url}).
The site couldn't be fetched. Use your knowledge of the brand.
${dsConstraint}
RULES:
- Company name: "${brandName}". Use this EXACT name.
- This is the ${pageTitle} page: ${pageDescription}
- Well-proportioned page with appropriate sections for ${pageTitle.toLowerCase()}. Avoid excessive white space.
- Include <script src="https://cdn.tailwindcss.com"></script>
- Include Google Fonts via <link> tags
- ANIMATIONS: Include GSAP and ScrollTrigger for scroll-driven animations. Add these script tags in <head>:
  <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js"></script>
  Use GSAP ScrollTrigger for fade-in on scroll, parallax, staggered reveals, and counter animations. Add a <script> block before </body>.
- Use SEEDED picsum URLs: \`https://picsum.photos/seed/{brand-slug}-{context}/WIDTH/HEIGHT\` — never \`?random=N\` or unseeded
- Modern, polished, compact design — content-dense, no filler
- Return ONLY raw HTML starting with <!DOCTYPE html>`;

  // Strip large fields from tokens sent to model
  const tokensForPrompt = { ...designTokens };
  delete (tokensForPrompt as any)._brandData;
  delete (tokensForPrompt as any)._meta;
  // Strip large base64 raster logo data but keep inline SVG data URIs (they're small and the model needs them)
  if (Array.isArray((tokensForPrompt as any).logos)) {
    (tokensForPrompt as any).logos = (tokensForPrompt as any).logos.map((l: any) => {
      if (l.url?.startsWith("data:image/svg")) return { url: l.url, type: l.type };
      return { url: l.url, type: l.type };
    });
  }

  const userMsg = fetchSucceeded
    ? `Create the ${pageTitle} page for ${brandName}.

=== SOURCE CONTENT (USE THIS REAL TEXT — do NOT replace with generic placeholders) ===
${textContent.slice(0, 6000)}

=== DESIGN TOKENS (EXTRACTED FROM THE REAL SITE — use these exact colors and fonts) ===
${JSON.stringify(tokensForPrompt, null, 2)}

Page description: ${pageDescription}`
    : `Create the ${pageTitle} page for ${brandName} (${url}).
${pageDescription}`;

  log.info(`generatePage prompt: ${Math.round((systemPrompt.length + userMsg.length) / 1000)}K chars`);
  const result = await router.routeJSON<{ html: string }>("layout_generate", [
    { role: "system", content: systemPrompt },
    { role: "user", content: userMsg },
  ]);

  // Inject data-why-* attributes for "Why" overlay
  const { injectWhyAttributes } = await import("./consistency.js");
  result.html = injectWhyAttributes(result.html, persona?.id || "default");

  const id = `scr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const screen = new Screen({
    id, projectId: ctx.projectId, prompt: `${brandName} — ${pageTitle}`,
    html: result.html, deviceType,
    designTokens,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  });
  ctx.addScreen(screen);
  return screen;
}

/**
 * Generate a page section-by-section for higher fidelity redesigns.
 * Parses the source HTML into sections, generates each independently, then assembles.
 */
export async function generatePageSectioned(
  ctx: PageGenerationContext,
  url: string,
  pageTitle: string,
  pageDescription: string,
  brandName: string,
  fetchedContent: { textContent: string; stripped: string; fetchSucceeded: boolean; parsedSections?: ParsedSection[]; sourceImages?: string[]; sourceVideos?: string[]; businessInfo?: BusinessInfo | null },
  designTokens: Record<string, unknown>,
  deviceType: DeviceType = "DESKTOP",
  onProgress?: ProgressCallback,
  consistencyConstraints?: ConsistencyConstraints,
  premiumScroll?: boolean,
  logger?: PipelineRun,
  businessInfo?: BusinessInfo | null,
): Promise<Screen> {
  const log = logger || NOOP_RUN;
  const router = getRouter();
  const domain = new URL(url).hostname.replace("www.", "");
  const { textContent, stripped, fetchSucceeded } = fetchedContent;
  // Fall back to fetchedContent.businessInfo if the explicit param is absent
  businessInfo = businessInfo ?? fetchedContent.businessInfo ?? null;

  if (!fetchSucceeded) {
    log.warn(`No HTML to parse — falling back to single-call generation`);
    return generatePage(ctx, url, pageTitle, pageDescription, brandName, fetchedContent, designTokens, deviceType, onProgress, logger);
  }

  // Use pre-parsed sections from planRedesign (parsed from raw HTML before it was stripped)
  onProgress?.("Analyzing page structure...", "Parsing sections from source HTML");
  let sections = fetchedContent.parsedSections && fetchedContent.parsedSections.length > 0
    ? fetchedContent.parsedSections
    : parseSectionsWithFallback(stripped, logger, { maxSections: premiumScroll ? 15 : 10 });

  // Quality check: if parsed sections are too few or have poor labels, use
  // AI to plan sections. Short real labels ("Hero", "Quiz", "FAQ", "CTA")
  // are valid and no longer flagged — the old `length < 5` rule was trigger-
  // happy. Threshold loosened from 40% → 60% so that a couple of weak
  // labels among otherwise-valid output don't throw everything away.
  const poorLabels = sections.filter(s => /^section\s+\d+$/i.test(s.label) || /^close$/i.test(s.label) || /^content block\s+\d+$/i.test(s.label) || s.label.length < 3);
  const poorQuality = sections.length < 4 || poorLabels.length > sections.length * 0.6;

  if (poorQuality) {
    log.info(`Section parsing quality too low (${sections.length} sections, ${poorLabels.length} poor labels) — using AI`);
    onProgress?.("Planning sections with AI...", "Source HTML structure was too complex for parsing");
    try {
      const planResult = await router.routeJSON<{ sections: Array<{ type: string; label: string; description: string }> }>("intent_parse", [
        { role: "system", content: `You are a web page structure planner. Given the text content of a website and its page description, output a JSON object with a "sections" array. Each section has:
- "type": one of "navbar", "hero", "features", "cards", "testimonials", "pricing", "cta", "footer", "stats", "team", "gallery", "faq", "forms", "banner"
- "label": a short descriptive label (e.g. "Hero with CTA", "Service Cards Grid")
- "description": what content this section should contain, referencing the actual content from the source site

Create one section for every distinct content block on the original page. Do NOT combine unrelated content — each block (navigation, hero, stats, about, ESG/sustainability, dashboards, interactive elements, quotes, team/leadership, footer, etc.) should be its own section. Aim for ${sections.length >= 6 ? sections.length : "6-10"} sections to match the original page's complexity. Always start with navbar and end with footer. Use the actual content from the source text to inform each section. If the source content is rich, plan more sections (up to 16) rather than fewer.

NEVER create sections for: cookie consent banners, GDPR notices, privacy preference modals, cookie settings, "accept all cookies" dialogs, analytics opt-in/out, or any data privacy UI. These are site chrome, not page content — skip them entirely.` },
        { role: "user", content: `Page: ${pageTitle} — ${pageDescription}\nBrand: ${brandName}\nSource URL: ${url}\n\nSource text content (first 5000 chars):\n${textContent.slice(0, 5000)}` },
      ]);
      if (planResult.sections && planResult.sections.length >= 4) {
        sections = planResult.sections.map((s, i) => ({
          index: i,
          tag: s.type === "navbar" ? "nav" : s.type === "footer" ? "footer" : "section",
          label: s.label,
          rawHtml: "",
          textContent: s.description,
          role: s.type === "navbar" ? "nav" as const : s.type === "footer" ? "footer" as const : s.type === "hero" ? "hero" as const : "content" as const,
        }));
        log.info(`AI planned ${sections.length} sections: ${sections.map(s => s.label).join(", ")}`);
      }
    } catch (err) {
      log.warn(`AI section planning failed, proceeding with parsed sections`);
    }
  }

  // ─── Strip cookie/consent/GDPR sections ──────────────────────────────
  // These are site chrome, not page content. The AI planner and parser
  // both try to skip them, but cookie banners with detailed toggle
  // descriptions can slip through. Belt-and-suspenders filter here.
  // Never strip nav/footer — they legitimately link to privacy/cookie
  // policies as standard site chrome without being consent banners.
  const chromeRe = /\bcookie\b|consent|gdpr|\bprivacy\s+(preference|setting|choice|control|banner|notice)/i;
  const beforeChromeStrip = sections.length;
  sections = sections.filter(s => {
    if (s.role === "nav" || s.role === "footer") return true;
    const isCookieChrome = chromeRe.test(s.label) || chromeRe.test(s.textContent.slice(0, 300));
    if (isCookieChrome) log.debug(`Stripped chrome section: "${s.label}"`);
    return !isCookieChrome;
  });
  if (sections.length < beforeChromeStrip) {
    // Re-index after stripping
    sections.forEach((s, i) => s.index = i);
  }

  // ─── Source animation pattern extraction (Track 1A) ───────────────────
  // Extract animation patterns from source HTML once, then map per-section
  // by ordinal index for per-section prompt injection.
  const sourceAnimationsByIndex = new Map<number, string>();
  let cinematicAutoDetected = false;
  try {
    const extracted = extractSourceSections(stripped, { sourceUrl: url, maxSections: 20 });
    const allPatterns: AnimationPattern[] = extracted.flatMap(s => s.animations);
    const cinematicLibs = new Set(["gsap", "scrolltrigger", "lottie", "three-js", "framer-motion"]);
    const scrollTriggers = new Set(["scroll", "viewport-enter"]);
    const hasCinematicLib = allPatterns.some(p => cinematicLibs.has(p.type));
    const scrollPatternCount = allPatterns.filter(p => scrollTriggers.has(p.trigger)).length;
    cinematicAutoDetected = hasCinematicLib || scrollPatternCount >= 3;

    for (const ex of extracted) {
      if (ex.animations.length === 0) continue;
      const lines = ex.animations
        .slice(0, 6)
        .map(a => `- ${a.type}/${a.trigger}${a.properties.length ? ` on [${a.properties.slice(0, 4).join(", ")}]` : ""}${a.duration ? ` ${a.duration}ms` : ""}`)
        .join("\n");
      sourceAnimationsByIndex.set(ex.index, lines);
    }
    log.info(`Source animations: ${allPatterns.length} patterns in ${sourceAnimationsByIndex.size} sections, cinematic=${cinematicAutoDetected}`);
  } catch (err) {
    log.warn(`Source animation extraction failed: ${err instanceof Error ? err.message : err}`);
  }

  // Auto-upgrade to premium scroll when cinematic mode is detected
  const effectivePremiumScroll = premiumScroll || cinematicAutoDetected;

  // ─── Visual animation brief (Track 1B) ────────────────────────────────
  // When cinematic mode fires, capture 6 scroll-state screenshots from the
  // live source URL and feed them to a multimodal LLM. The resulting brief
  // is shared across all section prompts. Buffers are in-memory only and
  // GC'd after the brief returns — never written to disk.
  let animationBriefBlock = "";
  if (effectivePremiumScroll && url.startsWith("http")) {
    onProgress?.("Capturing animation reference...", "Headless browser scrolling source site");
    try {
      const svc = getScreenshotService();
      log.info("Capturing 6-frame scroll sequence for animation brief");
      const seq = await svc.captureUrlScrollSequence(url, { width: 1440, scale: 1, delayMs: 2000 });
      log.info(`Captured ${seq.buffers.length} frames (${seq.width}x${seq.height})`);

      const brief: AnimationBrief = await generateAnimationBrief(
        router, seq.buffers, seq.labels, "page", [],
      );
      const effectLines = brief.effects.slice(0, 12)
        .map(e => `- ${e.element}: ${e.animation} (${e.trigger}, ${e.timing}) — ${e.detail}`)
        .join("\n");
      animationBriefBlock = `Style: ${brief.animationStyle}\nComplexity: ${brief.complexity}\nLibraries: ${brief.libraries.join(", ") || "none"}\nEffects:\n${effectLines}`;
      log.info(`Animation brief: ${brief.effects.length} effects, complexity=${brief.complexity}`);
    } catch (err) {
      log.warn(`Animation brief generation failed: ${err instanceof Error ? err.message : err}`);
    }
  }

  log.phase("PARSE");
  log.info(`${sections.length} sections, ${poorLabels.length} poor labels, poorQuality=${poorQuality}`);
  log.debug(`Labels: ${sections.map(s => `"${s.label}" (${s.role}, ${s.rawHtml.length}ch)`).join(", ")}`);

  if (sections.length < 3) {
    log.warn(`Only ${sections.length} sections — falling back to single-call generation`);
    return generatePage(ctx, url, pageTitle, pageDescription, brandName, fetchedContent, designTokens, deviceType, onProgress, logger);
  }

  // Auto-match persona
  const persona = autoMatchPersona({
    url, brandName, userPrompt: pageDescription,
    colors: (designTokens as any)?._brandData?.colors,
    businessInfo,
  });

  // Pre-format the company block once — injected into every section prompt
  // so copy grounds to sector terminology/voice. Suppressed when confidence
  // is low to avoid misleading Kimi with a weak classification.
  const companyBlock = businessInfo && businessInfo.confidence >= 0.5
    ? formatCompanyBlock(businessInfo)
    : undefined;
  if (businessInfo) {
    log.info(`business-info: ${businessInfo.sector}/${businessInfo.tone} conf=${businessInfo.confidence.toFixed(2)}${companyBlock ? " (injected)" : " (suppressed, low-conf)"}`);
  }
  const personaStyle = persona
    ? `Design style: ${persona.name}. Use this persona's layout philosophy, spacing, and hierarchy — but use the EXTRACTED brand colors from the design tokens, not the persona's defaults.`
    : "Modern, professional corporate design.";

  // Aaker-driven design tokens (border-radius, spacing, shadows, animation)
  const aakerVec: AakerVector = persona ? (PERSONA_AAKER_VECTORS[persona.id] || [0.3, 0.3, 0.5, 0.4, 0.2]) : [0.3, 0.3, 0.5, 0.4, 0.2];
  const aakerDesignTokens = computeDesignTokens(aakerVec);
  const aakerTokensPrompt = formatDesignTokensForPrompt(aakerDesignTokens);
  log.debug(`Aaker tokens: density=${aakerDesignTokens.density}, radius=${aakerDesignTokens.borderRadius.md}px, spacing=${aakerDesignTokens.spacing.unit}px`);

  // Build logo instruction (same logic as generatePage)
  const tokenLogos = (designTokens as any)?.logos;
  let logoInstruction = "";
  if (Array.isArray(tokenLogos) && tokenLogos.length > 0) {
    const inlineSvg = tokenLogos.find((l: any) => l.type === "semantic-logo" && l.data?.startsWith("data:image/svg"));
    const semanticUrl = tokenLogos.find((l: any) => l.type === "semantic-logo" && l.url && !l.url.includes("favicon") && !l.url.includes("icon") && !l.url.startsWith("data:"));
    if (inlineSvg) {
      logoInstruction = `LOGO: Use this SVG as an <img>: <img src="${inlineSvg.data}" alt="${brandName} logo" class="h-8 w-auto">`;
    } else if (semanticUrl) {
      logoInstruction = `LOGO: Use <img src="${semanticUrl.url}" alt="${brandName} logo" class="h-8 w-auto">`;
    }
  }

  // Build design tokens summary (compact, shared across all sections)
  // Logo instruction only included for nav sections to save ~2K tokens on other sections
  const colors = (designTokens as any)?.colors || {};
  const fonts = (designTokens as any)?.typography || (designTokens as any)?.fonts || {};

  // Generate OKLCH palette from brand colors
  let paletteBlock = "";
  try {
    const palette = generatePalette({
      primary: colors.primary || "#6aabcf",
      secondary: colors.secondary || undefined,
      accent: colors.accent || undefined,
    });
    paletteBlock = "\n" + formatPaletteForPrompt(palette);
    log.debug(`OKLCH palette: primary=${palette.primary.source}, ${palette.primary.steps.length} steps`);
  } catch (err) {
    log.warn(`OKLCH palette failed: ${err instanceof Error ? err.message : err}`);
  }

  // Validate font pairing — suggest better body font if pair is weak
  const headingFont = fonts.heading || fonts.headline || "Inter";
  let bodyFont = fonts.body || "Inter";
  try {
    const pairing = validatePairing(headingFont, bodyFont);
    if (!pairing.isValid && pairing.suggestion) {
      log.info(`Font pairing: "${headingFont}" + "${bodyFont}" weak (${pairing.score.toFixed(2)}), suggesting: "${pairing.suggestion.body}"`);
      bodyFont = pairing.suggestion.body;
    } else {
      log.debug(`Font pairing: "${headingFont}" + "${bodyFont}" OK (${pairing.score.toFixed(2)})`);
    }
  } catch {}

  const baseTokenSummary = `EXACT COLORS — use these hex values with Tailwind arbitrary values:
- Primary: ${colors.primary || "#6aabcf"} → bg-[${colors.primary || "#6aabcf"}], text-[${colors.primary || "#6aabcf"}]
- Secondary: ${colors.secondary || "#333"} → bg-[${colors.secondary || "#333"}], text-[${colors.secondary || "#333"}]
- Accent: ${colors.accent || "#495463"}
- Background: ${colors.background || "#ffffff"}
- Text: ${colors.text || "#000000"}
Heading font: "${headingFont}"
Body font: "${bodyFont}"
Brand: "${brandName}" (${domain})${paletteBlock}
${aakerTokensPrompt}`;

  // Extract nav items for consistency across sections
  const navSection = sections.find(s => s.role === "nav");
  const navItems = navSection ? navSection.textContent.slice(0, 500) : "";

  // Generate all section labels for context
  const sectionPlan = sections.map((s, i) => `${i + 1}. [${s.role}] ${s.label}`).join("\n");

  // Match components from library for each section
  const lib = ctx.componentLibrary;
  const sectionComponents = new Map<number, string>();
  if (lib && lib.all().length > 0) {
    log.debug(`Matching components from library (${lib.all().length} available)`);
    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];
      const matched = matchComponentsForSection(lib, section, { brandName, domain });
      if (matched) {
        sectionComponents.set(i, matched);
        log.debug(`Section ${i + 1} ("${section.label}"): matched component(s)`);
      }
    }
  }

  // Detect a truncated section response — the model hit its max-tokens
  // budget mid-generation and returned HTML with no closing tag. Observed
  // on people-made.com where sec-4 returned 1929 chars with no `</section>`,
  // no GSAP script, and an empty rationale. A truncated response breaks
  // DOM parsing: subsequent sections nest inside the unclosed one.
  //
  // Signals (any one trips it):
  //   - Empty or near-empty html (< 400 chars): model bailed immediately.
  //   - No matching closing tag within the last 300 chars of the html.
  //   - Closing tag `</section|nav|header|footer>` missing entirely.
  //   - Suspiciously short for a content/hero section (<800 chars) AND no
  //     closing tag.
  const isSectionTruncated = (html: string, role: string): boolean => {
    if (!html || html.length < 400) return true;
    // Scan the whole response, not just the trailing 300 chars — cinematic
    // sections frequently end with a long inline `<script>` block pushing the
    // `</section>` outside any trailing window, producing false-positive
    // truncation flags. What we actually care about is: did the model emit a
    // closing wrapper tag at all?
    const hasClose = /<\/(section|nav|header|footer|main|article|aside)\s*>/i.test(html);
    if (!hasClose) return true;
    // Content/hero sections under 800 chars with a close tag are borderline —
    // the close tag is often an auto-emitted stub when the model gave up.
    if ((role === "content" || role === "hero") && html.length < 800) return true;
    return false;
  };

  log.phase("GENERATE", `${sections.length} sections for "${pageTitle}"`);
  onProgress?.(`Generating ${sections.length} sections...`, `0/${sections.length} complete`);

  // Pre-fetch section templates from analytics for few-shot examples (parallel)
  const sectionTemplateCache = new Map<string, string>();
  const analytics = getRouter().analytics;
  if (analytics) {
    const roles = [...new Set(sections.map(s => s.role))];
    const templateResults = await Promise.all(roles.map(async (role) => {
      try {
        const templates = await analytics.getSectionTemplates(role, undefined, 1);
        if (templates.length > 0 && templates[0].html.length > 200) {
          return { role, html: templates[0].html.slice(0, 3000), fullLength: templates[0].html.length, quality: templates[0].qualityScore };
        }
      } catch {}
      return null;
    }));
    for (const result of templateResults) {
      if (result) {
        sectionTemplateCache.set(result.role, result.html);
        log.debug(`Template for "${result.role}": ${result.fullLength} chars, quality=${result.quality}`);
      }
    }
  }

  // Generate each section — track metadata for "Why" overlay
  interface SectionMeta {
    type: string;
    label: string;
    role: string;
    rationale: string;
    persona: string;
    componentSource: string;
    croRules: string[];
  }
  const generatedSections: (string | null)[] = new Array(sections.length).fill(null);
  const sectionMetas: (SectionMeta | null)[] = new Array(sections.length).fill(null);

  // Prepare all section tasks — resolve reused sections immediately, queue the rest for parallel generation
  interface SectionTask {
    index: number;
    section: ParsedSection;
    prompt: string;
    componentHtml: string;
    croRules: string[];
  }
  const pendingTasks: SectionTask[] = [];

  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];

    // Multi-page consistency: reuse nav/footer from first page if available
    if (consistencyConstraints?.navHtml && section.role === "nav") {
      log.info(`Section ${i + 1} ("${section.label}"): reusing nav (${consistencyConstraints.navHtml.length} chars)`);
      generatedSections[i] = consistencyConstraints.navHtml;
      sectionMetas[i] = { type: "nav", label: section.label, role: "nav", rationale: "Reused from first page for cross-page consistency.", persona: persona?.id || "default", componentSource: "", croRules: ["sticky-nav-cta"] };
      continue;
    }
    if (consistencyConstraints?.footerHtml && section.role === "footer") {
      log.info(`Section ${i + 1} ("${section.label}"): reusing footer (${consistencyConstraints.footerHtml.length} chars)`);
      generatedSections[i] = consistencyConstraints.footerHtml;
      sectionMetas[i] = { type: "footer", label: section.label, role: "footer", rationale: "Reused from first page for cross-page consistency.", persona: persona?.id || "default", componentSource: "", croRules: [] };
      continue;
    }

    const componentHtml = sectionComponents.get(i) || "";
    let tokenSummary = section.role === "nav" && logoInstruction
      ? `${baseTokenSummary}\n${logoInstruction}`
      : baseTokenSummary;

    // Inject consistency hints for content sections (button styles, spacing)
    if (consistencyConstraints && section.role === "content") {
      let consistencyHints = "\nCONSISTENCY (match these patterns from other pages on this site):";
      if (consistencyConstraints.buttonClasses) {
        consistencyHints += `\n- Button style: ${consistencyConstraints.buttonClasses}`;
      }
      if (consistencyConstraints.sectionPadding) {
        consistencyHints += `\n- Section padding: ${consistencyConstraints.sectionPadding}`;
      }
      tokenSummary += consistencyHints;
    }

    const sectionPrompt = buildSectionPrompt(section, {
      index: i,
      total: sections.length,
      brandName,
      domain,
      personaStyle,
      tokenSummary,
      navItems,
      sectionPlan,
      prevLabel: sections[i - 1]?.label || null,
      nextLabel: sections[i + 1]?.label || null,
      componentHtml,
      templateExample: sectionTemplateCache.get(section.role),
      premiumScroll: effectivePremiumScroll,
      sourceAnimations: sourceAnimationsByIndex.get(i),
      animationBrief: animationBriefBlock || undefined,
      sourceImages: sectionSourceImages(fetchedContent.sourceImages, section.role, i),
      sourceVideos: sectionSourceVideos(fetchedContent.sourceVideos, section.role, i),
      companyBlock,
    });

    // Determine CRO rules applicable to this section
    const sectionLabelLower = section.label.toLowerCase();
    const croRulesForSection: string[] = [];
    if (section.role === "nav") croRulesForSection.push("sticky-nav-cta");
    if (section.role === "hero") croRulesForSection.push("single-cta-above-fold", "hero-max-100vh", "high-contrast-cta");
    if (sectionLabelLower.match(/testimonial|review|client|social/)) croRulesForSection.push("social-proof-2-viewports");
    if (sectionLabelLower.match(/form|contact|signup|subscribe/)) croRulesForSection.push("form-fields-max-4");

    pendingTasks.push({ index: i, section, prompt: sectionPrompt, componentHtml, croRules: croRulesForSection });
  }

  // Generate sections in parallel batches of 4
  const BATCH_SIZE = 4;
  log.info(`${pendingTasks.length} sections to generate (batch size: ${BATCH_SIZE}), ${sections.length - pendingTasks.length} reused`);

  for (let batchStart = 0; batchStart < pendingTasks.length; batchStart += BATCH_SIZE) {
    const batch = pendingTasks.slice(batchStart, batchStart + BATCH_SIZE);
    const batchNum = Math.floor(batchStart / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(pendingTasks.length / BATCH_SIZE);
    const completedSoFar = generatedSections.filter(s => s !== null).length;
    onProgress?.(`Generating batch ${batchNum}/${totalBatches}: ${batch.map(t => t.section.label).join(", ")}`, `${completedSoFar}/${sections.length} complete`);

    const batchResults = await Promise.all(batch.map(async (task) => {
      const { index: i, section, prompt: sectionPrompt, componentHtml, croRules: croRulesForSection } = task;
      log.task(i + 1, `${section.label} (${section.role}) ${Math.round(sectionPrompt.length / 1000)}K prompt${componentHtml ? " +component" : ""}`);

      try {
        const result = await router.routeJSON<{ html: string; rationale?: string }>("section_generate", [
          { role: "system", content: effectivePremiumScroll ? PROMPTS.SECTION_GENERATE_CINEMATIC_SYSTEM : PROMPTS.SECTION_GENERATE_SYSTEM },
          { role: "user", content: sectionPrompt },
        ]);

        let sectionHtml = result.html || "";
        if (!sectionHtml && typeof result === "string") sectionHtml = result as unknown as string;

        const rationale = result.rationale || "";
        const sectionType = section.role === "content" ? detectSectionTypeFromLabel(section.label) : section.role;

        // Truncation guard: if the model hit its token budget and returned
        // incomplete HTML, flag as a failure so the retry loop below picks it
        // up. Also treat an empty rationale + short html as a strong signal
        // (empty rationale means the JSON response was cut before the
        // rationale field ever landed).
        if (isSectionTruncated(sectionHtml, section.role) || (!rationale && sectionHtml.length < 1200)) {
          log.warn(`[${i + 1}] "${section.label}" truncated (${sectionHtml.length} chars${!rationale ? ", empty rationale" : ""}) — flagging for retry`);
          return {
            index: i,
            html: `<section class="w-full py-16 bg-gray-50"><div class="max-w-7xl mx-auto px-8 md:px-16"><h2 class="text-2xl font-bold">${section.label}</h2><p class="text-gray-500 mt-2">Section content</p></div></section>`,
            meta: { type: "content", label: section.label, role: section.role, rationale: "Generation failed — placeholder inserted.", persona: persona?.id || "default", componentSource: "", croRules: [] } as SectionMeta,
          };
        }

        log.taskDone(i + 1, section.label, `${sectionHtml.length} chars`);
        return {
          index: i,
          html: sectionHtml,
          meta: {
            type: sectionType,
            label: section.label,
            role: section.role,
            rationale,
            persona: persona?.id || "default",
            componentSource: componentHtml ? "library" : (sectionTemplateCache.has(section.role) ? "template" : "generated"),
            croRules: croRulesForSection,
          } as SectionMeta,
        };
      } catch (err) {
        log.taskError(i + 1, section.label, `${err instanceof Error ? err.message : err}`);
        return {
          index: i,
          html: `<section class="w-full py-16 bg-gray-50"><div class="max-w-7xl mx-auto px-8 md:px-16"><h2 class="text-2xl font-bold">${section.label}</h2><p class="text-gray-500 mt-2">Section content</p></div></section>`,
          meta: { type: "content", label: section.label, role: section.role, rationale: "Generation failed — placeholder inserted.", persona: persona?.id || "default", componentSource: "", croRules: [] } as SectionMeta,
        };
      }
    }));

    // Place results back in order
    for (const result of batchResults) {
      generatedSections[result.index] = result.html;
      sectionMetas[result.index] = result.meta;
    }
  }

  // Retry failed sections (those with placeholder rationale) one at a time
  const failedIndices = sectionMetas
    .map((m, i) => m?.rationale === "Generation failed — placeholder inserted." ? i : -1)
    .filter(i => i >= 0);

  if (failedIndices.length > 0) {
    log.info(`Retrying ${failedIndices.length} failed sections: ${failedIndices.map(i => sections[i].label).join(", ")}`);
    onProgress?.(`Retrying ${failedIndices.length} failed sections...`);

    for (const i of failedIndices) {
      const task = pendingTasks.find(t => t.index === i);
      if (!task) continue;
      const { section, prompt: sectionPrompt, componentHtml, croRules: croRulesForSection } = task;
      log.task(i + 1, `RETRY ${section.label}`);
      try {
        // Pause briefly to avoid hitting rate limits again
        await new Promise(r => setTimeout(r, 2000));
        const result = await router.routeJSON<{ html: string; rationale?: string }>("section_generate", [
          { role: "system", content: effectivePremiumScroll ? PROMPTS.SECTION_GENERATE_CINEMATIC_SYSTEM : PROMPTS.SECTION_GENERATE_SYSTEM },
          { role: "user", content: sectionPrompt },
        ]);
        let sectionHtml = result.html || "";
        if (!sectionHtml && typeof result === "string") sectionHtml = result as unknown as string;
        if (sectionHtml && sectionHtml.length > 50 && !isSectionTruncated(sectionHtml, section.role)) {
          const sectionType = section.role === "content" ? detectSectionTypeFromLabel(section.label) : section.role;
          generatedSections[i] = sectionHtml;
          sectionMetas[i] = {
            type: sectionType,
            label: section.label,
            role: section.role,
            rationale: result.rationale || "(retry succeeded)",
            persona: persona?.id || "default",
            componentSource: componentHtml ? "library" : "generated",
            croRules: croRulesForSection,
          } as SectionMeta;
          log.taskDone(i + 1, section.label, `RETRY OK ${sectionHtml.length} chars`);
        } else {
          log.taskError(i + 1, section.label, "RETRY produced empty response");
        }
      } catch (err) {
        log.taskError(i + 1, section.label, `RETRY failed: ${err instanceof Error ? err.message : err}`);
      }
    }
  }

  onProgress?.("Assembling page...", `${sections.length}/${sections.length} sections complete`);

  // Flatten nullable arrays to concrete arrays (all slots filled by now)
  const finalSections: string[] = generatedSections.map(s => s || "");
  const finalMetas: SectionMeta[] = sectionMetas.map(m => m || { type: "content", label: "", role: "content", rationale: "", persona: "default", componentSource: "", croRules: [] });

  log.phase("ASSEMBLE");
  log.info(`${finalSections.length} sections, sizes: ${finalSections.map((s, i) => `${i + 1}:${s.length}ch`).join(", ")}`);
  const opacityZeroCount = finalSections.filter(s => /opacity-0/.test(s)).length;
  if (opacityZeroCount > 0) log.warn(`${opacityZeroCount}/${finalSections.length} sections contain opacity-0 classes`);

  // Inject data-* attributes for "Why" overlay into each section's root element
  for (let i = 0; i < finalSections.length; i++) {
    const meta = finalMetas[i];
    if (!meta) continue;
    // Escape attribute values: quotes and special chars
    const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
    const attrs = ` data-why-type="${esc(meta.type)}" data-why-label="${esc(meta.label)}" data-why-persona="${esc(meta.persona)}" data-why-rationale="${esc(meta.rationale)}" data-why-source="${esc(meta.componentSource)}"${meta.croRules.length > 0 ? ` data-why-cro="${meta.croRules.join(",")}"` : ""}`;
    // Insert attributes into the first <section|nav|header|footer> tag (not <style> or comments that may precede it)
    finalSections[i] = finalSections[i].replace(/(<(?:section|nav|header|footer)\b)/i, (match) => match + attrs);
  }

  // Ensure footer is always the last section (fix ordering when fallback sections get appended after footer)
  const footerIdx = sections.findIndex(s => s.role === "footer");
  if (footerIdx >= 0 && footerIdx < finalSections.length - 1) {
    const footerHtml = finalSections.splice(footerIdx, 1)[0];
    finalSections.push(footerHtml);
  }

  // Detect Google Fonts URL from design tokens
  const googleFontsUrl = (designTokens as any)?.typography?.googleFontsUrl
    || (designTokens as any)?.googleFontsUrl
    || null;

  // Assemble into complete HTML
  const fullHtml = assembleSections(finalSections, {
    title: pageTitle,
    brandName,
    googleFontsUrl,
    primaryColor: colors.primary,
    secondaryColor: colors.secondary,
    analytics: getRouter().analytics,
  });

  log.info(`assembleSections: ${fullHtml.length} chars`);

  // UICrit: post-generation design critique + auto-fix
  const { report, fixedHtml: critiquedHtml } = critiqueHtml(fullHtml);
  // Phase 2: fold DESIGN.md contrast-ratio findings from post-extract lint
  // into UICrit's issue stream so the a11y score reflects palette hazards
  // the HTML-level rules can't see (e.g. a defined token pair under AA).
  if (ctx.dsLintFindings && ctx.dsLintFindings.length > 0) {
    for (const f of ctx.dsLintFindings) {
      const label = f.component ? `"${f.component}" ` : "";
      const ratio = typeof f.ratio === "number" ? ` (ratio ${f.ratio.toFixed(2)})` : "";
      report.issues.push({
        severity: "warning",
        rule: "ds-contrast-ratio",
        message: `Accessibility: ${label}color pair${ratio} below WCAG AA 4.5:1 — ${f.message}`,
      });
    }
    log.info(`UICrit: +${ctx.dsLintFindings.length} DS contrast findings forwarded from design-system lint`);
  }
  // Pin-reveal sync: merge pin + reveal timelines into one ScrollTrigger per
  // pinned section so the pin only releases once every element has scrubbed
  // through the timeline. Without this, Kimi's output lets users blow past
  // pinned chapters before the reveal has played.
  const pinSync = syncPinRevealAnimations(critiquedHtml);
  if (pinSync.rewrittenTimelines > 0 || pinSync.deletedPinCreators > 0) {
    log.info(`Pin-reveal sync: merged ${pinSync.rewrittenTimelines} timelines, removed ${pinSync.deletedPinCreators} standalone pin creators across ${pinSync.pinnedSelectors.length} sections`);
  }
  // Content-fade guard: strip Kimi's recurring `.to(".X__content", {opacity:0})`
  // tweens inside pinned scrub timelines. Those fade the main content to
  // invisible at the end of the pin, leaving the user staring at blank
  // background for the last 30% of scroll through the section.
  const fadeGuard = stripPinnedContentFades(pinSync.html);
  if (fadeGuard.strippedTweens > 0) {
    log.info(`Content-fade guard: stripped ${fadeGuard.strippedTweens} end-of-pin content fades`);
  }
  // Transition guard: strip `transition-all`/`transition-opacity`/
  // `transition-transform` from elements targeted by GSAP tweens. Those
  // broad Tailwind utilities fight GSAP every frame and cause KPI cards
  // to never reveal in scrub timelines.
  const transGuard = stripConflictingTransitions(fadeGuard.html);
  if (transGuard.strippedTransitions > 0) {
    log.info(`Transition guard: softened ${transGuard.strippedTransitions} conflicting transitions on ${transGuard.touchedSelectors.length} GSAP-targeted selectors`);
  }
  // Fit validator: render at desktop+mobile viewports, catch text/container
  // overflow that Kimi's output keeps producing, and surgically patch the
  // offending classes. Remaining issues are logged as warnings.
  const fit = await validateAndFixFit(transGuard.html, log);
  const finalHtml = fit.html;
  if (fit.issues.length > 0) {
    log.info(`Fit validator: ${fit.appliedFixes}/${fit.issues.length} issues auto-fixed${fit.remainingIssues > 0 ? `, ${fit.remainingIssues} remaining` : ""}`);
    for (const issue of fit.issues) {
      const detail = issue.type === "text-overflow"
        ? `${issue.measurements.scrollW}w>${issue.measurements.clientW}w "${issue.text}"`
        : `${issue.measurements.scrollH}h>${issue.measurements.clientH}h`;
      log.debug(`  [${issue.fixed ? "FIX" : "WARN"}] ${issue.type} on <${issue.tag}> (${issue.viewport}): ${detail}`);
    }
  }
  log.info(`UICrit: ${report.score}/10 (${report.passed ? "PASS" : "FAIL"}), ${report.issues.length} issues, ${report.autoFixed} auto-fixed`);
  if (report.issues.length > 0) {
    for (const issue of report.issues) {
      log.debug(`  [${issue.severity}] ${issue.rule}: ${issue.message}`);
    }
  }

  // Save layout example to analytics (RALF)
  if (analytics) {
    const sectionSequence = sections.map(s => s.role === "content" ? detectSectionTypeFromLabel(s.label) : s.role);
    const industry = classifyIndustry(url, brandName, pageTitle);
    analytics.saveLayoutExample({
      industry,
      pageType: detectPageType(pageTitle),
      sectionSequence,
      sectionCount: sections.length,
      metadata: {
        sourceUrl: domain,
        personaId: (designTokens as any)?._meta?.personaId,
        aakerVector: (designTokens as any)?._meta?.aakerVector,
        deviceType,
        colorScheme: "light",
      },
      sections: sections.map((s, i) => ({
        type: sectionSequence[i],
        htmlSnippet: finalSections[i]?.slice(0, 200) || "",
        hasAnimation: /gsap|scrolltrigger/i.test(finalSections[i] || ""),
      })),
      qualityScore: 3,
      positiveRatings: 0,
      negativeRatings: 0,
      compositeScore: 3,
    }).catch(err => log.warn(`Layout example save failed: ${err instanceof Error ? err.message : err}`));
    log.debug(`Saved RALF layout: ${industry}/${detectPageType(pageTitle)}, ${sectionSequence.length} sections`);
  }

  log.done();

  const id = `scr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const screen = new Screen({
    id, projectId: ctx.projectId, prompt: `${brandName} — ${pageTitle}`,
    html: finalHtml, deviceType,
    designTokens,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  });
  ctx.addScreen(screen);
  return screen;
}
