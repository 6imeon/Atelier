/**
 * Component Generator — Phase 3 & 4 of the Component Engine
 *
 * Generates premium components from animation briefs, scores quality,
 * normalizes HTML, deduplicates, and merges into the component library.
 */

import type { ModelRouter, ChatMessage } from "./router.js";
import type { RawSectionDoc } from "../storage/interface.js";
import { loadPersonas, getPersonaById } from "./personas.js";

// ─── Auto-Spec Generation ────────────────────────────────────────────────────

export interface AutoSpec {
  /** Source section ID (links back to raw_sections) */
  sourceSectionId: string;
  /** Animation brief from the source section */
  brief: NonNullable<RawSectionDoc["animationBrief"]>;
  /** Persona to apply */
  persona: string;
  /** Industry from crawl target */
  industry: string;
  /** Component category */
  category: string;
  /** LLM-generated creative prompt for Kimi K2.5 */
  prompt: string;
  /** Required animation libraries */
  requiredLibraries: string[];
  /** Expected features */
  requiredFeatures: string[];
  /** Minimum quality to accept */
  minimumQuality: number;
}

/** Fallback personas when persona files aren't found on disk */
const FALLBACK_PERSONAS: Array<{ id: string; label: string; style: string }> = [
  { id: "editorial-luxury", label: "Luxury editorial — Diageo, Burberry, premium brands", style: "refined, high-contrast, generous whitespace, serif headings, subtle gold/champagne accents" },
  { id: "tech-minimal", label: "Tech minimalism — Stripe, Linear, Vercel", style: "clean sans-serif, monochrome with one accent, sharp edges, code-inspired details" },
  { id: "bold-modern", label: "Bold modern — Nike, Adidas, Airbnb", style: "oversized type, strong colors, dynamic layouts, energetic, confident" },
];

/**
 * Get all available persona IDs.
 */
export function listAvailablePersonas(): string[] {
  const loaded = loadPersonas();
  if (loaded.length > 0) return loaded.map(p => p.id);
  return FALLBACK_PERSONAS.map(p => p.id);
}

/**
 * Resolve a persona by ID. Uses the full persona system (52 .md files)
 * with fallback to 3 hardcoded defaults if files aren't found.
 */
function resolvePersona(personaId?: string): { id: string; label: string; style: string } {
  // Try loading from the real persona system
  if (personaId) {
    const persona = getPersonaById(personaId);
    if (persona) {
      // Extract a style summary from the persona markdown (first 200 chars of content after the name)
      const content = persona.content || "";
      const styleLine = content.match(/\*\*(?:Style|Aesthetic|Visual|Look).*?\*\*[:\s]*(.+)/i)?.[1]?.trim()
        || content.split("\n").filter(l => l.trim() && !l.startsWith("#") && !l.startsWith("*")).slice(0, 2).join(". ").slice(0, 200)
        || persona.name;
      return { id: persona.id, label: persona.name, style: styleLine };
    }
  }

  // Try fallback
  const fallback = FALLBACK_PERSONAS.find(p => p.id === personaId);
  if (fallback) return fallback;

  // Random from loaded personas, or default fallback
  const loaded = loadPersonas();
  if (loaded.length > 0) {
    const random = loaded[Math.floor(Math.random() * loaded.length)];
    const content = random.content || "";
    const styleLine = content.match(/\*\*(?:Style|Aesthetic|Visual|Look).*?\*\*[:\s]*(.+)/i)?.[1]?.trim()
      || content.split("\n").filter(l => l.trim() && !l.startsWith("#") && !l.startsWith("*")).slice(0, 2).join(". ").slice(0, 200)
      || random.name;
    return { id: random.id, label: random.name, style: styleLine };
  }

  return FALLBACK_PERSONAS[0];
}

/**
 * Generate an auto-spec from a briefed raw section.
 * Combines the animation brief with a persona to create a creative prompt for Kimi K2.5.
 */
/** Brand-lock overrides persona with actual brand colors/fonts */
export interface BrandLock {
  /** e.g. "adidas" */
  name: string;
  /** e.g. "#000000, #FFFFFF, #00B140" */
  colors: string;
  /** e.g. "AdihausDIN, Georgia" */
  fonts?: string;
  /** e.g. "Dark background, bold athletic imagery" */
  style?: string;
}

export function generateAutoSpec(
  section: RawSectionDoc & { _id: string },
  personaId?: string,
  brandLock?: BrandLock,
): AutoSpec {
  const brief = section.animationBrief!;

  const effectDescriptions = brief.effects.map((e, i) =>
    `${i + 1}. ${e.element}: ${e.animation} (${e.trigger}, ${e.timing}) — ${e.detail}`
  ).join("\n");

  const libraries = brief.libraries.length > 0 ? brief.libraries : ["gsap", "ScrollTrigger"];
  const libraryInstructions = libraries.map(lib => {
    switch (lib) {
      case "gsap": return "Use GSAP for all animations. Include gsap.from/to calls.";
      case "ScrollTrigger": return "Use GSAP ScrollTrigger for scroll-driven animations. Register the plugin.";
      case "swiper": return "Use Swiper.js for carousels. Include swiper-bundle CSS/JS.";
      case "lottie": return "Reference Lottie for vector animations (use CSS fallback for standalone).";
      default: return `Use ${lib} for animations.`;
    }
  }).join("\n");

  // Brand-lock: use exact brand colors/fonts instead of persona
  let styleBlock: string;
  let personaLabel: string;
  if (brandLock) {
    personaLabel = `brand:${brandLock.name}`;
    styleBlock = `BRAND: ${brandLock.name}
COLOR PALETTE (use these EXACT colors, do NOT invent new ones):
${brandLock.colors}
${brandLock.fonts ? `FONTS: ${brandLock.fonts}` : ""}
${brandLock.style ? `BRAND STYLE: ${brandLock.style}` : ""}

CRITICAL: This component must look like it belongs on the ${brandLock.name} website.
Do NOT use random color schemes. Stick to the brand palette above.`;
  } else {
    const persona = resolvePersona(personaId);
    personaLabel = persona.id;
    styleBlock = `PERSONA: ${persona.label}
STYLE: ${persona.style}`;
  }

  const prompt = `Create a premium ${section.classification.category} section for a ${section.industry || "corporate"} website.

${styleBlock}

ANIMATION STYLE: ${brief.animationStyle} (${brief.complexity} complexity)

EFFECTS TO IMPLEMENT:
${effectDescriptions}

ANIMATION LIBRARIES:
${libraryInstructions}

REQUIREMENTS:
- Section-level HTML only (no <!DOCTYPE>, no <html>, no CDN links)
- Use Tailwind CSS for layout and styling
- Use semantic HTML (<section>, <h2>, headings hierarchy)
- All images: use https://picsum.photos/WIDTH/HEIGHT with unique seeds
- Make it responsive (mobile-first, md: and lg: breakpoints)
- Include all animation code in a <script> tag at the end of the section
- Animations should use GSAP ScrollTrigger with once:true (don't reverse on scroll back)
- Use opacity-0 on animated elements so they're hidden until animation fires
- Add data-animate attributes on animated elements
- Respect prefers-reduced-motion: wrap animations in a media query check
- Use GPU-accelerated properties (transform, opacity) not layout-triggering ones (top, left, width)
- Minimum 300 chars of realistic placeholder content

Return ONLY the component HTML. No explanation, no markdown fences.`;

  return {
    sourceSectionId: section._id,
    brief,
    persona: personaLabel,
    industry: section.industry,
    category: section.classification.category,
    prompt,
    requiredLibraries: libraries,
    requiredFeatures: [
      "scroll-animation",
      "responsive",
      ...(brief.effects.some(e => e.animation.includes("counter")) ? ["counter"] : []),
      ...(brief.effects.some(e => e.animation.includes("parallax")) ? ["parallax"] : []),
    ],
    minimumQuality: 7,
  };
}

/**
 * Generate a premium component from an auto-spec using Kimi K2.5.
 */
export async function generateComponent(
  router: ModelRouter,
  spec: AutoSpec,
): Promise<{ html: string; tokensUsed?: number }> {
  const messages: ChatMessage[] = [
    {
      role: "system",
      content: `You are a world-class frontend developer specializing in premium, animated web sections.
You create production-quality HTML components with GSAP/ScrollTrigger animations, Tailwind CSS,
and semantic markup. Your output is always a single complete <section> element with embedded <script>.
No <!DOCTYPE>, no <html>, no CDN script tags. The section must work in isolation when those libraries
are loaded externally.`,
    },
    { role: "user", content: spec.prompt },
  ];

  // Retry Kimi up to 3 times, no fallback to weaker models
  let data: any;
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await router.route("section_generate", messages, { stream: false, timeoutMs: 5 * 60 * 1000, useFallback: false });
      data = await res.json();
      if (data.choices?.[0]?.message?.content) break;
      // Empty response — retry
      if (attempt < 2) await new Promise(r => setTimeout(r, 3000));
    } catch (err) {
      lastErr = err;
      if (attempt < 2) await new Promise(r => setTimeout(r, 3000));
    }
  }
  if (!data?.choices?.[0]?.message?.content) {
    throw lastErr || new Error("Kimi returned empty after 3 attempts");
  }
  const text = data.choices[0].message.content ?? "";
  const tokensUsed = data.usage?.total_tokens;

  // Clean up the response
  let html = text
    .replace(/```html\n?|```\s*$/g, "")
    .replace(/```\s*$/g, "")
    .trim();

  // Strip leading prose before HTML
  const firstTag = html.match(/<(?:section|div|nav|header|footer|article)\b/i);
  if (firstTag && firstTag.index && firstTag.index > 0) {
    html = html.slice(firstTag.index).trim();
  }

  // Remove any trailing </html>, </body> from truncated output
  html = html.replace(/<\/body>\s*<\/html>\s*$/i, "").trim();

  return { html, tokensUsed };
}

/**
 * Enhance a skeleton component — send working HTML to Kimi for visual styling
 * while preserving the animation logic exactly as-is.
 *
 * Use this when you have a hand-written component with correct scroll/animation
 * behavior that needs visual polish (images, colors, typography, spacing).
 */
export async function enhanceFromSkeleton(
  router: ModelRouter,
  skeletonHtml: string,
  opts: {
    category?: string;
    description?: string;
    colorPalette?: string;
    imageStyle?: string;
    /** When true, Kimi returns ONLY a <style> block — skeleton HTML stays untouched */
    cssOnly?: boolean;
  } = {},
): Promise<{ html: string; tokensUsed?: number }> {
  const cssOnly = opts.cssOnly !== false; // default true — safe mode

  const systemPrompt = cssOnly
    ? `You are a world-class CSS designer. You are given a WORKING HTML component with correct GSAP/ScrollTrigger animations.

YOUR JOB: Write ONLY a <style> block that enhances the visual appearance of the component.
You must NOT return any HTML or JavaScript — ONLY CSS inside a single <style>...</style> tag.

The CSS should target existing classes and selectors in the HTML. You may add new class-based styles
but the HTML structure will NOT change — your styles must work with the markup as-is.

IMPROVE with CSS only:
- Typography: font-family, font-size, font-weight, letter-spacing, line-height
- Colors: background, color, gradients, text-shadow, box-shadow
- Spacing: padding, margin, gap adjustments
- Hover/focus states via CSS transitions
- Responsive breakpoints via @media queries
- Overlays and readability (e.g. linear-gradient overlays on image containers)
- Subtle animations via CSS (transition, @keyframes) that complement the existing GSAP ones

DO NOT:
- Return any HTML tags (no <section>, <div>, etc.)
- Return any <script> tags or JavaScript
- Override transform, opacity, or translateY on animated elements (GSAP controls those)
- Use !important on animation-related properties

Output ONLY: <style>...your CSS...</style>`
    : `You are a world-class frontend developer. You are given a WORKING HTML component with correct GSAP/ScrollTrigger animations.

YOUR JOB: Enhance the visual styling ONLY. Do NOT change:
- The animation timeline or ScrollTrigger configuration
- The scroll behavior or pinning logic
- The data-col, data-idx, data-section attributes
- The JavaScript logic structure
- The overall HTML structure (wrapper, sticky, columns, panels)

YOU SHOULD improve:
- Add real images using https://picsum.photos/WIDTH/HEIGHT?random=N (use different N for each)
- Improve typography (font sizes, weights, letter-spacing)
- Add subtle CSS enhancements (text-shadow, gradients, transitions on hover)
- Improve spacing and padding
- Make text more readable over images (gradient overlays if needed)
- Ensure responsive behavior works on mobile

Output the COMPLETE enhanced component as a single <section> with embedded <style> and <script>.
No <!DOCTYPE>, no <html>, no <head>, no <body>, no CDN script tags.
Keep ALL animation code exactly as provided — just wrap it in the same structure.`;

  const userPrompt = cssOnly
    ? `Here is the HTML component (READ ONLY — do not reproduce it, only write CSS for it):

\`\`\`html
${skeletonHtml}
\`\`\`

${opts.description ? `DESCRIPTION: ${opts.description}` : ""}
${opts.colorPalette ? `COLOR PALETTE: ${opts.colorPalette}` : "COLOR PALETTE: Dark theme — black (#000, #1b1c1c) background, white (#fff) text, minimal accent colors."}
${opts.imageStyle ? `IMAGE STYLE: ${opts.imageStyle}` : "IMAGE STYLE: Sports/athletic photography. Use CSS background-image with picsum.photos URLs (different ?random=N for each)."}

Return ONLY a single <style>...</style> block. No HTML, no JS.`
    : `Here is the skeleton component to enhance:

\`\`\`html
${skeletonHtml}
\`\`\`

${opts.description ? `DESCRIPTION: ${opts.description}` : ""}
${opts.colorPalette ? `COLOR PALETTE: ${opts.colorPalette}` : "COLOR PALETTE: Dark theme — black (#000, #1b1c1c) background, white (#fff) text, minimal accent colors."}
${opts.imageStyle ? `IMAGE STYLE: ${opts.imageStyle}` : "IMAGE STYLE: Sports/athletic photography from picsum.photos. Use different seeds for each image."}

CRITICAL: Keep the GSAP timeline and ScrollTrigger code EXACTLY as-is. Only improve the visual presentation.
Return the full enhanced HTML component.`;

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];

  let data: any;
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await router.route("section_generate", messages, { stream: false, timeoutMs: 5 * 60 * 1000, useFallback: false });
      data = await res.json();
      if (data.choices?.[0]?.message?.content) break;
      if (attempt < 2) await new Promise(r => setTimeout(r, 3000));
    } catch (err) {
      lastErr = err;
      if (attempt < 2) await new Promise(r => setTimeout(r, 3000));
    }
  }
  if (!data?.choices?.[0]?.message?.content) {
    throw lastErr || new Error("Kimi returned empty after 3 attempts");
  }
  const text = data.choices[0].message.content ?? "";
  const tokensUsed = data.usage?.total_tokens;

  if (cssOnly) {
    // Extract the <style> block from response
    const styleMatch = text.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
    const cssBlock = styleMatch ? `<style>${styleMatch[1]}</style>` : "";
    if (!cssBlock) {
      throw new Error("CSS-only enhance: Kimi did not return a <style> block");
    }

    // Validate: reject if response contains HTML structure (Kimi ignored instructions)
    const hasHtmlTags = /<(?:section|div|nav|header|footer|article|script)\b/i.test(
      text.replace(/<style[\s\S]*?<\/style>/gi, ""), // ignore inside style
    );
    if (hasHtmlTags) {
      console.warn("  WARN: CSS-only mode — Kimi returned HTML tags, stripping to style block only");
    }

    // Inject the <style> block into the skeleton right after the first tag
    const firstTagEnd = skeletonHtml.indexOf(">");
    if (firstTagEnd === -1) {
      return { html: cssBlock + "\n" + skeletonHtml, tokensUsed };
    }
    const html = skeletonHtml.slice(0, firstTagEnd + 1) + "\n" + cssBlock + "\n" + skeletonHtml.slice(firstTagEnd + 1);
    return { html, tokensUsed };
  }

  // Legacy full-HTML mode
  let html = text
    .replace(/```html\n?|```\s*$/g, "")
    .replace(/```\s*$/g, "")
    .trim();

  const firstTag = html.match(/<(?:section|div|nav|header|footer|article)\b/i);
  if (firstTag && firstTag.index && firstTag.index > 0) {
    html = html.slice(firstTag.index).trim();
  }
  html = html.replace(/<\/body>\s*<\/html>\s*$/i, "").trim();

  // Structural validation: check Kimi didn't break the DOM
  const validation = validateEnhanceStructure(skeletonHtml, html);
  if (!validation.valid) {
    console.warn(`  WARN: Enhance broke structure — ${validation.issues.length} issues:`);
    for (const issue of validation.issues.slice(0, 5)) {
      console.warn(`    - ${issue}`);
    }
    // If critical structure is broken, fall back to CSS-only approach
    if (validation.issues.some(i => i.includes("JS selector") || i.includes("ScrollTrigger") || i.includes("GSAP"))) {
      console.warn("  FALLBACK: Critical animation code broken — re-running in CSS-only mode");
      return enhanceFromSkeleton(router, skeletonHtml, { ...opts, cssOnly: true });
    }
  }

  return { html, tokensUsed };
}

// ─── Structural Validation ──────────────────────────────────────────────────

/**
 * Extract a simplified DOM skeleton from HTML: just tag names + data attributes,
 * ignoring style/class/text differences. Used to verify enhance didn't break structure.
 */
function extractDomSkeleton(html: string): string[] {
  const nodes: string[] = [];
  // Match opening tags with data-* attributes
  const tagRe = /<(\w+)([^>]*?)>/g;
  let m: RegExpExecArray | null;
  while ((m = tagRe.exec(html)) !== null) {
    const tag = m[1].toLowerCase();
    if (["style", "script", "link", "meta"].includes(tag)) continue;
    // Extract data attributes
    const dataAttrs: string[] = [];
    const attrRe = /(data-[\w-]+)(?:="([^"]*)")?/g;
    let a: RegExpExecArray | null;
    while ((a = attrRe.exec(m[2])) !== null) {
      dataAttrs.push(a[2] ? `${a[1]}=${a[2]}` : a[1]);
    }
    nodes.push(dataAttrs.length > 0 ? `${tag}[${dataAttrs.join(",")}]` : tag);
  }
  return nodes;
}

/**
 * Validate that enhanced HTML preserves the skeleton's critical structure.
 * Returns { valid, issues } — issues list what's missing or changed.
 */
export function validateEnhanceStructure(
  skeletonHtml: string,
  enhancedHtml: string,
): { valid: boolean; issues: string[] } {
  const issues: string[] = [];

  const skeletonNodes = extractDomSkeleton(skeletonHtml);
  const enhancedNodes = extractDomSkeleton(enhancedHtml);

  // Check critical data attributes are preserved
  const skeletonDataNodes = skeletonNodes.filter(n => n.includes("["));
  const enhancedDataNodes = new Set(enhancedNodes.filter(n => n.includes("[")));

  for (const node of skeletonDataNodes) {
    if (!enhancedDataNodes.has(node)) {
      issues.push(`Missing: ${node}`);
    }
  }

  // Check script content preserved (GSAP selectors)
  const skeletonSelectors = new Set<string>();
  const selectorRe = /querySelector(?:All)?\(\s*['"`]([^'"`]+)['"`]\s*\)/g;
  let sm: RegExpExecArray | null;
  while ((sm = selectorRe.exec(skeletonHtml)) !== null) {
    skeletonSelectors.add(sm[1]);
  }
  for (const sel of skeletonSelectors) {
    if (!enhancedHtml.includes(sel)) {
      issues.push(`JS selector missing in output: ${sel}`);
    }
  }

  // Check ScrollTrigger/gsap preserved
  if (/ScrollTrigger/i.test(skeletonHtml) && !/ScrollTrigger/i.test(enhancedHtml)) {
    issues.push("ScrollTrigger code removed");
  }
  if (/gsap\./i.test(skeletonHtml) && !/gsap\./i.test(enhancedHtml)) {
    issues.push("GSAP code removed");
  }

  return { valid: issues.length === 0, issues };
}

// ─── Quality Scoring ─────────────────────────────────────────────────────────

export interface QualityReport {
  semantic: number;         // 0-1: uses semantic HTML tags
  accessibility: number;    // 0-1: alt text, ARIA labels
  responsiveness: number;   // 0-1: has responsive breakpoints
  codeQuality: number;      // 0-1: nesting depth, inline styles
  selfContained: number;    // 0-1: works in isolation
  contentComplete: number;  // 0-1: has meaningful content
  animationQuality: number; // 0-1: animations present and correct
  interactivity: number;    // 0-1: interactive elements work
  premiumTier: number;      // 0-1: scroll effects, data viz
  overall: number;          // weighted sum, 1-10 scale
  tier: "basic" | "interactive" | "animated" | "cinematic";
  issues: string[];         // problems found
  jsErrors: string[];       // JS console errors from Playwright
}

/**
 * Score a generated component's quality using static analysis.
 * Does NOT require Playwright — pure HTML inspection.
 */
export function scoreQualityStatic(html: string): Omit<QualityReport, "jsErrors"> {
  const lower = html.toLowerCase();
  const issues: string[] = [];

  // Semantic HTML (0.10)
  const hasSection = /<section\b/i.test(html);
  const hasHeading = /<h[1-3]\b/i.test(html);
  const hasNav = /<nav\b/i.test(html);
  const hasSemantic = hasSection || hasNav;
  const semantic = (hasSemantic ? 0.5 : 0) + (hasHeading ? 0.5 : 0);
  if (!hasSemantic) issues.push("No semantic HTML tags (<section>, <nav>)");
  if (!hasHeading) issues.push("No heading tags (h1-h3)");

  // Accessibility (0.15)
  const imgCount = (html.match(/<img\b/gi) || []).length;
  const altCount = (html.match(/<img\b[^>]*alt="/gi) || []).length;
  const hasAriaLabels = /aria-label/i.test(html);
  const imgAccessibility = imgCount > 0 ? altCount / imgCount : 1;
  const accessibility = imgAccessibility * 0.7 + (hasAriaLabels ? 0.3 : 0);
  if (imgCount > 0 && altCount < imgCount) issues.push(`${imgCount - altCount} images missing alt text`);

  // Responsiveness (0.15)
  const hasMdBreakpoint = /\bmd:/i.test(html);
  const hasLgBreakpoint = /\blg:/i.test(html);
  const hasFlexOrGrid = /\b(flex|grid)\b/i.test(html);
  const responsiveness = (hasMdBreakpoint ? 0.4 : 0) + (hasLgBreakpoint ? 0.3 : 0) + (hasFlexOrGrid ? 0.3 : 0);
  if (!hasMdBreakpoint) issues.push("No responsive breakpoints (md:)");

  // Code quality (0.05)
  const maxNestingDepth = measureNestingDepth(html);
  const inlineStyleCount = (html.match(/style="/gi) || []).length;
  const nestingScore = maxNestingDepth <= 8 ? 1 : maxNestingDepth <= 12 ? 0.5 : 0;
  const inlineScore = inlineStyleCount <= 3 ? 1 : inlineStyleCount <= 8 ? 0.5 : 0;
  const codeQuality = nestingScore * 0.6 + inlineScore * 0.4;
  if (maxNestingDepth > 12) issues.push(`Deep nesting: ${maxNestingDepth} levels`);
  if (inlineStyleCount > 8) issues.push(`${inlineStyleCount} inline styles`);

  // Self-containment (0.10)
  const hasExternalCSS = /<link\b[^>]*stylesheet/i.test(html);
  const hasRequireImport = /\brequire\(|import\s+/i.test(html);
  const selfContained = (!hasExternalCSS ? 0.5 : 0) + (!hasRequireImport ? 0.5 : 0);

  // Content completeness (0.05)
  const textContent = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const contentLength = textContent.length;
  const contentComplete = contentLength > 300 ? 1 : contentLength > 100 ? 0.5 : 0;
  if (contentLength < 100) issues.push(`Very little content: ${contentLength} chars`);

  // Animation quality (0.15)
  const hasGSAP = /gsap\.(to|from|fromTo|set)\b/i.test(html);
  const hasScrollTrigger = /scrolltrigger/i.test(lower);
  const hasKeyframes = /@keyframes/i.test(html);
  const hasOpacity0 = /opacity-0/i.test(html);
  const hasReducedMotion = /prefers-reduced-motion/i.test(html);
  const hasGPUProps = /transform|opacity/i.test(html);
  const usesLayoutProps = /\b(top|left|right|bottom|width|height)\s*:/i.test(
    // Only check inside gsap calls, not CSS
    (html.match(/gsap\.\w+\([^)]*\{[^}]+\}/g) || []).join(" ")
  );

  let animationQuality = 0;
  if (hasGSAP) animationQuality += 0.3;
  if (hasScrollTrigger) animationQuality += 0.2;
  if (hasKeyframes) animationQuality += 0.1;
  if (hasOpacity0) animationQuality += 0.1;
  if (hasReducedMotion) animationQuality += 0.15;
  if (hasGPUProps && !usesLayoutProps) animationQuality += 0.15;
  if (!hasGSAP && !hasKeyframes) issues.push("No animations detected");
  if (!hasReducedMotion) issues.push("Missing prefers-reduced-motion check");
  if (usesLayoutProps) issues.push("Animates layout-triggering properties (use transform instead)");

  // Interactivity (0.10)
  const hasSwiper = /swiper/i.test(lower);
  const hasTabs = /tab|accordion|toggle/i.test(lower);
  const hasButtons = /<button\b/i.test(html);
  const interactivity = (hasSwiper ? 0.4 : 0) + (hasTabs ? 0.3 : 0) + (hasButtons ? 0.3 : 0);

  // Premium tier (0.05)
  const hasPin = /pin:\s*true/i.test(html);
  const hasScrub = /scrub/i.test(html);
  const hasSVGAnimation = /stroke-dashoffset|stroke-dasharray/i.test(html);
  const hasParallax = /parallax|data-speed/i.test(lower);
  const premiumTier = (hasPin ? 0.3 : 0) + (hasScrub ? 0.2 : 0) + (hasSVGAnimation ? 0.25 : 0) + (hasParallax ? 0.25 : 0);

  // Determine tier
  let tier: QualityReport["tier"] = "basic";
  if (hasPin || hasScrub || premiumTier > 0.5) tier = "cinematic";
  else if (hasGSAP || hasScrollTrigger || hasKeyframes) tier = "animated";
  else if (hasSwiper || hasTabs || interactivity > 0.3) tier = "interactive";

  // Weighted overall (0-10 scale)
  const overall = Math.round((
    semantic * 0.10 +
    accessibility * 0.15 +
    responsiveness * 0.15 +
    codeQuality * 0.05 +
    selfContained * 0.10 +
    contentComplete * 0.05 +
    animationQuality * 0.15 +
    interactivity * 0.10 +
    premiumTier * 0.15
  ) * 100) / 10;

  return {
    semantic, accessibility, responsiveness, codeQuality, selfContained,
    contentComplete, animationQuality, interactivity, premiumTier,
    overall, tier, issues,
  };
}

/**
 * Score quality including Playwright runtime checks.
 * Renders the component in a headless browser, checks for JS errors,
 * and verifies animations fire.
 */
export async function scoreQualityFull(html: string): Promise<QualityReport> {
  const staticReport = scoreQualityStatic(html);
  const jsErrors: string[] = [];

  try {
    const { chromium } = await import("playwright");
    const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();

    // Capture JS errors
    page.on("pageerror", (err) => jsErrors.push(err.message));
    page.on("console", (msg) => {
      if (msg.type() === "error") jsErrors.push(msg.text());
    });

    const fullHtml = `<!DOCTYPE html><html><head>
      <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
      <script src="https://cdn.tailwindcss.com"></script>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"></script>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js"></script>
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.css">
      <script src="https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.js"></script>
    </head><body>${html}</body></html>`;

    await page.setContent(fullHtml, { waitUntil: "networkidle", timeout: 20_000 });
    await page.waitForTimeout(3000); // Wait for animations

    // Check if GSAP loaded and has animations
    const gsapCheck = await page.evaluate(() => {
      if (typeof (window as any).gsap === "undefined") return { loaded: false, animations: 0 };
      const timeline = (window as any).gsap.globalTimeline;
      return { loaded: true, animations: timeline?.getChildren?.()?.length || 0 };
    });

    // Verify scroll-triggered elements changed
    const scrollCheck = await page.evaluate(async () => {
      const before = document.querySelectorAll("[data-animate], .opacity-0");
      const beforeCount = before.length;

      // Scroll down
      window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" });
      await new Promise(r => setTimeout(r, 1500));

      const after = document.querySelectorAll(".opacity-0");
      return { animateTargets: beforeCount, remainingHidden: after.length };
    });

    // Check responsive rendering (no horizontal overflow at 375px)
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(500);
    const mobileOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > 375;
    });

    await ctx.close();
    await browser.close();

    // Adjust scores based on runtime checks
    let adjustedAnimation = staticReport.animationQuality;
    if (gsapCheck.loaded && gsapCheck.animations > 0) adjustedAnimation = Math.min(1, adjustedAnimation + 0.2);
    if (jsErrors.length > 0) {
      adjustedAnimation *= 0.5;
      staticReport.issues.push(`${jsErrors.length} JS error(s) in browser`);
    }

    let adjustedResponsive = staticReport.responsiveness;
    if (mobileOverflow) {
      adjustedResponsive *= 0.5;
      staticReport.issues.push("Horizontal overflow at 375px mobile viewport");
    }

    // Recalculate overall
    const overall = Math.round((
      staticReport.semantic * 0.10 +
      staticReport.accessibility * 0.15 +
      adjustedResponsive * 0.15 +
      staticReport.codeQuality * 0.05 +
      staticReport.selfContained * 0.10 +
      staticReport.contentComplete * 0.05 +
      adjustedAnimation * 0.15 +
      staticReport.interactivity * 0.10 +
      staticReport.premiumTier * 0.15
    ) * 100) / 10;

    return {
      ...staticReport,
      animationQuality: adjustedAnimation,
      responsiveness: adjustedResponsive,
      overall,
      jsErrors,
    };
  } catch {
    // Playwright not available — return static-only report
    return { ...staticReport, jsErrors };
  }
}

function measureNestingDepth(html: string): number {
  let max = 0;
  let depth = 0;
  const tagRe = /<(\/?)(\w+)[^>]*?\/?>/g;
  let m: RegExpExecArray | null;
  const voidTags = new Set(["img", "input", "br", "hr", "meta", "link"]);

  while ((m = tagRe.exec(html)) !== null) {
    if (m[0].endsWith("/>") || voidTags.has(m[2].toLowerCase())) continue;
    if (m[1] === "/") { depth--; }
    else { depth++; if (depth > max) max = depth; }
  }
  return max;
}

// ─── HTML Normalization ──────────────────────────────────────────────────────

/**
 * Normalize generated HTML for library storage:
 * - Strip site-specific IDs and data attributes
 * - Remove tracking/analytics
 * - Replace specific brand text with generic placeholders
 * - Clean up formatting
 */
export function normalizeHtml(html: string): string {
  let normalized = html;

  // Remove tracking/analytics scripts
  normalized = normalized.replace(
    /<script\b[^>]*src="[^"]*(?:analytics|gtag|gtm|facebook|pixel|hotjar)[^"]*"[^>]*>[\s\S]*?<\/script>/gi,
    ""
  );

  // Remove tracking pixels
  normalized = normalized.replace(/<img\b[^>]*(?:pixel|tracking|beacon|1x1)[^>]*\/?>/gi, "");

  // Remove site-specific data attributes (keep data-animate, data-scroll, data-swiper)
  normalized = normalized.replace(
    /\s+data-(?!animate|scroll|swiper|aos|speed|parallax)[\w-]+="[^"]*"/gi,
    ""
  );

  // Remove site-specific IDs (keep IDs that look functional)
  normalized = normalized.replace(
    /\s+id="(?!swiper|carousel|tab|accordion|modal|nav)[\w-]+"/gi,
    ""
  );

  // Clean up empty class attributes
  normalized = normalized.replace(/\s+class="\s*"/g, "");

  // Remove excessive whitespace
  normalized = normalized.replace(/\n{3,}/g, "\n\n");

  // Ensure images use picsum.photos
  normalized = normalized.replace(
    /<img\b([^>]*?)src="(?!https:\/\/picsum\.photos)[^"]+"/gi,
    (match, pre) => {
      // Generate a random picsum URL
      const seed = Math.floor(Math.random() * 1000);
      return `<img${pre}src="https://picsum.photos/seed/${seed}/800/600"`;
    }
  );

  return normalized.trim();
}

// ─── Quality Gate ────────────────────────────────────────────────────────────

export type QualityDecision = "accept" | "normalize" | "reject";

/**
 * Apply quality gate to a scored component.
 * - Score >= 7/10 → accept (enter library directly)
 * - Score 4-7   → normalize (attempt cleanup and re-score)
 * - Score < 4   → reject
 */
export function qualityGate(report: QualityReport): QualityDecision {
  if (report.overall >= 7) return "accept";
  if (report.overall >= 4) return "normalize";
  return "reject";
}

// ─── Visual Dedup (pHash) ────────────────────────────────────────────────────

/**
 * Compute a simple perceptual hash from a screenshot buffer.
 * Uses average-hash approach: resize to 8x8, grayscale, threshold at mean.
 * Returns a 64-bit hex string. Hamming distance < 8 = visually similar.
 *
 * Note: This is a simplified implementation. For production,
 * consider using a proper pHash library.
 */
export function computeVisualHash(buffer: Buffer): string {
  // Simple hash based on buffer content (pixel sampling)
  // This is a fallback when canvas/sharp isn't available.
  // For real pHash we'd need sharp or canvas to resize + grayscale.
  // Instead, we sample evenly-spaced bytes and create a fingerprint.
  const sampleSize = 64;
  const step = Math.max(1, Math.floor(buffer.length / sampleSize));
  const samples: number[] = [];

  for (let i = 0; i < sampleSize && i * step < buffer.length; i++) {
    samples.push(buffer[i * step]);
  }

  const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
  let hash = "";
  for (const s of samples) {
    hash += s >= mean ? "1" : "0";
  }

  // Convert binary string to hex
  let hex = "";
  for (let i = 0; i < hash.length; i += 4) {
    hex += parseInt(hash.slice(i, i + 4), 2).toString(16);
  }
  return hex;
}

/**
 * Compute Hamming distance between two hex hash strings.
 */
export function hammingDistance(hash1: string, hash2: string): number {
  if (hash1.length !== hash2.length) return Infinity;
  let distance = 0;
  for (let i = 0; i < hash1.length; i++) {
    const bits1 = parseInt(hash1[i], 16);
    const bits2 = parseInt(hash2[i], 16);
    // Count differing bits
    let xor = bits1 ^ bits2;
    while (xor > 0) {
      distance += xor & 1;
      xor >>= 1;
    }
  }
  return distance;
}

/**
 * Check if a component is a visual duplicate of any existing component
 * in the given hash set. Returns the matching hash if duplicate, null otherwise.
 */
export function isVisualDuplicate(
  newHash: string,
  existingHashes: string[],
  threshold = 8,
): string | null {
  for (const existing of existingHashes) {
    if (hammingDistance(newHash, existing) < threshold) {
      return existing;
    }
  }
  return null;
}

// ─── Library Merge ───────────────────────────────────────────────────────────

export interface ComponentEntry {
  id: string;
  category: string;
  name: string;
  description: string;
  html: string;
  tokens: { colors: string[]; fonts: string[]; radius: boolean };
  slots: never[];
  variants: never[];
  tags: string[];
  source: string;
  adaptability: string;
  quality: number;
  positiveRatings: number;
  negativeRatings: number;
  compositeScore: number;
  elo: { rating: number; matches: number; wins: number; sigma: number };
  usageCount: number;
  createdAt: string;
  updatedAt: string;
  /** Visual hash for dedup */
  visualHash?: string;
  /** Source inspiration */
  sourceInspiration?: string;
  /** Quality report */
  qualityReport?: QualityReport;
}

/**
 * Build a component library entry from a generated component.
 */
export function buildComponentEntry(
  html: string,
  spec: AutoSpec,
  qualityReport: QualityReport,
  visualHash?: string,
): ComponentEntry {
  const uid = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const now = new Date().toISOString();

  return {
    id: `${spec.category}-engine-${uid}`,
    category: spec.category,
    name: `Premium ${spec.category.charAt(0).toUpperCase() + spec.category.slice(1)} — ${spec.brief.animationStyle}`,
    description: `Auto-generated ${spec.brief.complexity} ${spec.category} inspired by ${spec.industry} sites. Effects: ${spec.brief.effects.map(e => e.animation).join(", ")}`,
    html,
    tokens: { colors: ["primary", "surface", "text", "accent"], fonts: ["headline", "body"], radius: false },
    slots: [],
    variants: [],
    tags: [
      "tailwind", "responsive", "premium", "engine-generated",
      spec.category, `persona:${spec.persona}`, `industry:${spec.industry}`,
      `tier:${qualityReport.tier}`,
      ...spec.requiredLibraries.map(l => `lib:${l}`),
      ...(qualityReport.tier === "cinematic" ? ["cinematic"] : []),
      ...(qualityReport.tier === "animated" ? ["animated"] : []),
    ],
    source: `engine:${spec.persona}:${spec.industry}`,
    adaptability: "flexible",
    quality: Math.round(qualityReport.overall) / 2, // Convert 0-10 to 0-5 scale
    positiveRatings: 0,
    negativeRatings: 0,
    compositeScore: qualityReport.overall / 2,
    elo: { rating: 1500, matches: 0, wins: 0, sigma: 350 },
    usageCount: 0,
    createdAt: now,
    updatedAt: now,
    visualHash,
    sourceInspiration: spec.sourceSectionId,
    qualityReport,
  };
}
