/**
 * Section Extractor — Component Engine
 *
 * Extracts, classifies, and analyses sections from crawled websites.
 * Builds on section-parser.ts (which handles generated page assembly)
 * but is purpose-built for *external site* extraction:
 *   - Richer classification (subType, features, tier)
 *   - Animation pattern detection (GSAP, ScrollTrigger, Swiper, CSS keyframes, Lottie, etc.)
 *   - Structural hashing for deduplication
 *   - Size validation and quality pre-filtering
 */

import { createHash } from "crypto";

// ─── Types ───────────────────────────────────────────────────────────────────

export type ComponentCategory =
  | "navbar" | "hero" | "features" | "cards" | "testimonials"
  | "pricing" | "cta" | "footer" | "forms" | "stats"
  | "team" | "gallery" | "faq" | "sidebar" | "modal" | "banner"
  | "carousel" | "contact" | "logos" | "content";

export type PremiumTier = "basic" | "interactive" | "animated" | "cinematic";

export type AnimationType =
  | "gsap" | "scrolltrigger" | "css-keyframes" | "css-transition"
  | "intersection-observer" | "lottie" | "three-js" | "swiper"
  | "framer-motion" | "anime-js" | "scroll-driven" | "view-transitions";

export type AnimationTrigger = "load" | "scroll" | "hover" | "click" | "viewport-enter";

export interface AnimationPattern {
  type: AnimationType;
  trigger: AnimationTrigger;
  /** CSS properties being animated */
  properties: string[];
  duration?: number;
  easing?: string;
  /** Human-readable description (filled by LLM later, placeholder here) */
  description: string;
}

export interface SectionClassification {
  category: ComponentCategory;
  confidence: number;           // 0-1
  subType?: string;             // "split-hero", "gradient-hero", "video-hero"
  method: "semantic" | "heuristic" | "llm";
  features: {
    hasAnimation: boolean;
    hasCta: boolean;
    hasImage: boolean;
    hasVideo: boolean;
    hasForm: boolean;
    hasCarousel: boolean;
    columnCount: number;
    isInteractive: boolean;
  };
}

export interface ExtractedSection {
  /** Source URL the section was extracted from */
  sourceUrl: string;
  /** Domain of the source */
  sourceDomain: string;
  /** Section index on the page (0-based) */
  index: number;
  /** Outer HTML tag (section, div, nav, footer, etc.) */
  tag: string;
  /** Human-readable label extracted from headings/classes */
  label: string;
  /** Raw HTML of the section */
  html: string;
  /** HTML byte length */
  htmlLength: number;
  /** Plain text content */
  textContent: string;
  /** Classification result */
  classification: SectionClassification;
  /** Detected animation patterns */
  animations: AnimationPattern[];
  /** Premium tier based on animation/interaction complexity */
  tier: PremiumTier;
  /** Structural hash for exact-duplicate detection */
  structuralHash: string;
  /** Extraction timestamp */
  extractedAt: string;
}

// ─── Section Name Dictionary ─────────────────────────────────────────────────

/** ~100 common section class/ID name patterns mapped to categories */
const SECTION_NAME_MAP: Record<string, ComponentCategory> = {
  // Navigation
  nav: "navbar", navbar: "navbar", navigation: "navbar", header: "navbar",
  "top-bar": "navbar", topbar: "navbar", "site-header": "navbar", "main-nav": "navbar",
  "mega-menu": "navbar", "mobile-menu": "navbar", "app-bar": "navbar",
  // Hero
  hero: "hero", banner: "hero", jumbotron: "hero", splash: "hero",
  masthead: "hero", "hero-banner": "hero", "hero-section": "hero",
  "page-header": "hero", intro: "hero", showcase: "hero", landing: "hero",
  // Features
  features: "features", benefits: "features", advantages: "features",
  services: "features", capabilities: "features", solutions: "features",
  offerings: "features", "value-prop": "features", "why-us": "features",
  // Cards
  cards: "cards", "card-grid": "cards", "card-section": "cards",
  // Testimonials
  testimonials: "testimonials", reviews: "testimonials", quotes: "testimonials",
  "customer-stories": "testimonials", "case-studies": "testimonials",
  "social-proof": "testimonials", endorsements: "testimonials",
  // Pricing
  pricing: "pricing", plans: "pricing", tiers: "pricing", packages: "pricing",
  subscription: "pricing", "pricing-table": "pricing",
  // CTA
  cta: "cta", "call-to-action": "cta", "sign-up": "cta", "get-started": "cta",
  "join-us": "cta", "try-free": "cta", "start-now": "cta",
  // Footer
  footer: "footer", "site-footer": "footer", "page-footer": "footer",
  // Forms
  forms: "forms", "contact-form": "forms", "signup-form": "forms",
  newsletter: "forms", subscribe: "forms",
  // Stats / Metrics
  stats: "stats", metrics: "stats", numbers: "stats", counters: "stats",
  kpi: "stats", achievements: "stats", "by-the-numbers": "stats",
  "key-figures": "stats", highlights: "stats",
  // Team
  team: "team", people: "team", "our-team": "team", leadership: "team",
  founders: "team", employees: "team", "about-us": "team",
  // Gallery
  gallery: "gallery", portfolio: "gallery", "image-grid": "gallery",
  "photo-gallery": "gallery", work: "gallery", projects: "gallery",
  // FAQ
  faq: "faq", faqs: "faq", "frequently-asked": "faq", questions: "faq",
  "help-center": "faq", accordion: "faq",
  // Contact
  contact: "contact", "contact-us": "contact", "get-in-touch": "contact",
  // Logos / Partners
  logos: "logos", partners: "logos", clients: "logos", brands: "logos",
  "trusted-by": "logos", "logo-cloud": "logos", "as-seen-in": "logos",
  integrations: "logos",
  // Carousel / Slider
  carousel: "carousel", slider: "carousel", swiper: "carousel",
  slideshow: "carousel", "image-slider": "carousel",
  // Sidebar
  sidebar: "sidebar", aside: "sidebar",
  // Banner
  announcement: "banner", alert: "banner", "info-bar": "banner",
  // Modal
  modal: "modal", dialog: "modal", popup: "modal", overlay: "modal",
};

// ─── Structural Hash ─────────────────────────────────────────────────────────

/**
 * Generate a structural hash from HTML — captures tag structure + nesting,
 * ignoring text content, attributes, and whitespace.
 *
 * Example: `section>div>h2+p+div>div*3>img+h3+p` → sha256 hash
 */
export function structuralHash(html: string): string {
  const skeleton = buildSkeleton(html);
  return createHash("sha256").update(skeleton).digest("hex").slice(0, 16);
}

/**
 * Build a compact skeleton string from HTML tag structure.
 * Only tracks structural tags, ignoring text/attributes.
 */
function buildSkeleton(html: string): string {
  const structural = new Set([
    "div", "section", "article", "aside", "main", "header", "footer", "nav",
    "h1", "h2", "h3", "h4", "h5", "h6", "p", "ul", "ol", "li",
    "img", "video", "svg", "canvas", "figure", "figcaption",
    "form", "input", "textarea", "select", "button", "a",
    "table", "thead", "tbody", "tr", "th", "td",
    "blockquote", "span", "strong", "em",
  ]);

  const parts: string[] = [];
  const tagRe = /<(\/?)(\w+)[^>]*?\/?>/g;
  let match: RegExpExecArray | null;
  const stack: string[] = [];

  while ((match = tagRe.exec(html)) !== null) {
    const isClosing = match[1] === "/";
    const tag = match[2].toLowerCase();
    const isSelfClosing = match[0].endsWith("/>") || ["img", "input", "br", "hr"].includes(tag);

    if (!structural.has(tag)) continue;

    if (isSelfClosing && !isClosing) {
      parts.push(tag);
    } else if (!isClosing) {
      parts.push(`${tag}>`);
      stack.push(tag);
    } else {
      // Pop matching tag from stack
      const idx = stack.lastIndexOf(tag);
      if (idx >= 0) {
        parts.push(`<${tag}`);
        stack.splice(idx, 1);
      }
    }
  }

  return parts.join("|");
}

// ─── Heuristic Classifier ────────────────────────────────────────────────────

/**
 * Classify a section using DOM structure + class/ID heuristics.
 * Returns null if confidence is too low (should fall through to LLM).
 */
export function classifySection(
  html: string,
  index: number,
  totalSections: number,
  textContent: string,
): SectionClassification {
  const lower = html.toLowerCase();
  const lowerText = textContent.toLowerCase();

  const features: SectionClassification["features"] = {
    hasAnimation: false,
    hasCta: false,
    hasImage: /<img\b/i.test(html),
    hasVideo: /<video\b/i.test(html) || /youtube|vimeo|wistia/i.test(html),
    hasForm: /<form\b/i.test(html),
    hasCarousel: /swiper|carousel|slider|slideshow/i.test(lower),
    columnCount: detectColumnCount(html),
    isInteractive: false,
  };

  features.hasCta = /\b(btn|button)\b/i.test(html) ||
    /<button\b/i.test(html) ||
    /<a\b[^>]*class="[^"]*btn/i.test(html);

  features.isInteractive = features.hasForm || features.hasCarousel || features.hasVideo ||
    /\btab\b|accordion|toggle|dropdown|modal/i.test(lower);

  // 1. Semantic HTML tags (highest confidence)
  const semanticResult = classifyBySemantic(html, index, totalSections);
  if (semanticResult) {
    return { ...semanticResult, features, method: "semantic" };
  }

  // 2. Class/ID name matching
  const nameResult = classifyByName(html);
  if (nameResult) {
    return { ...nameResult, features, method: "heuristic" };
  }

  // 3. Content-based heuristics
  const contentResult = classifyByContent(html, lowerText, index, totalSections);
  if (contentResult) {
    return { ...contentResult, features, method: "heuristic" };
  }

  // 4. Fallback: generic content
  return {
    category: "content",
    confidence: 0.3,
    method: "heuristic",
    features,
  };
}

function classifyBySemantic(html: string, index: number, total: number): Pick<SectionClassification, "category" | "confidence" | "subType"> | null {
  const tag = html.match(/^<(\w+)/)?.[1]?.toLowerCase();

  if (tag === "nav") return { category: "navbar", confidence: 0.95 };
  if (tag === "footer") return { category: "footer", confidence: 0.95 };
  if (tag === "aside") return { category: "sidebar", confidence: 0.8 };

  // Header tag with nav inside = navbar
  if (tag === "header" && /<nav\b/i.test(html)) return { category: "navbar", confidence: 0.9 };

  // First section with h1 = hero (if near the top)
  if (index <= 1 && /<h1\b/i.test(html)) return { category: "hero", confidence: 0.85 };

  // Last or second-to-last with copyright = footer
  if (index >= total - 2 && /©|copyright|all rights reserved/i.test(html)) {
    return { category: "footer", confidence: 0.85 };
  }

  return null;
}

function classifyByName(html: string): Pick<SectionClassification, "category" | "confidence" | "subType"> | null {
  // Extract class and id values from the outer tag
  const outerTag = html.match(/^<\w+[^>]*>/)?.[0] || "";
  const classAttr = outerTag.match(/class="([^"]+)"/i)?.[1] || "";
  const idAttr = outerTag.match(/id="([^"]+)"/i)?.[1] || "";
  const combined = `${classAttr} ${idAttr}`.toLowerCase();

  // Split into tokens and match against dictionary
  const tokens = combined.split(/[\s_-]+/).filter(Boolean);

  for (const token of tokens) {
    if (SECTION_NAME_MAP[token]) {
      const category = SECTION_NAME_MAP[token];
      const subType = deriveSubType(category, html);
      return { category, confidence: 0.75, subType };
    }
  }

  // Try compound matches (e.g., "hero-section" as a single class)
  for (const [pattern, category] of Object.entries(SECTION_NAME_MAP)) {
    if (combined.includes(pattern)) {
      const subType = deriveSubType(category, html);
      return { category, confidence: 0.7, subType };
    }
  }

  return null;
}

function classifyByContent(
  html: string,
  lowerText: string,
  index: number,
  _total: number,
): Pick<SectionClassification, "category" | "confidence" | "subType"> | null {
  const lower = html.toLowerCase();

  // Form with email/phone → contact
  if (/<form\b/i.test(html) && /email|phone|message|subject/i.test(html)) {
    return { category: "contact", confidence: 0.7, subType: "contact-form" };
  }

  // Repeated cards with headings → features or pricing
  const cardCount = (lower.match(/<(?:div|article)\b[^>]*class="[^"]*card/gi) || []).length;
  if (cardCount >= 3) {
    if (/\$|€|£|\/month|\/year|pricing|plan/i.test(lowerText)) {
      return { category: "pricing", confidence: 0.7, subType: "pricing-cards" };
    }
    return { category: "cards", confidence: 0.65 };
  }

  // Blockquote or avatar + quote pattern → testimonials
  if (/<blockquote\b/i.test(html) || (/avatar|portrait|headshot/i.test(lower) && /"|"|&quot;|said/i.test(lowerText))) {
    return { category: "testimonials", confidence: 0.7 };
  }

  // Counter/number + label pattern → stats
  const numberLabels = lowerText.match(/\d+[%+kKmMbB]?\s+\w+/g) || [];
  if (numberLabels.length >= 3) {
    return { category: "stats", confidence: 0.65, subType: "counter-stats" };
  }

  // Pricing signals
  if (/\$\d|€\d|£\d|\/month|\/year|per month|per year|free tier|enterprise/i.test(lowerText)) {
    return { category: "pricing", confidence: 0.7 };
  }

  // FAQ / accordion
  if (/<details\b/i.test(html) || /accordion/i.test(lower) ||
      (lowerText.match(/\?\s/g) || []).length >= 3) {
    return { category: "faq", confidence: 0.65 };
  }

  // Logo cloud (multiple small images)
  const imgCount = (html.match(/<img\b/gi) || []).length;
  if (imgCount >= 4 && lowerText.length < 200 && /client|partner|trusted|logo/i.test(lower)) {
    return { category: "logos", confidence: 0.7 };
  }

  // Gallery (many images, minimal text)
  if (imgCount >= 6 && lowerText.length < imgCount * 50) {
    return { category: "gallery", confidence: 0.6 };
  }

  // Team (multiple person cards)
  if (/team|member|founder|ceo|cto|director|manager/i.test(lowerText) && imgCount >= 2) {
    return { category: "team", confidence: 0.6 };
  }

  // CTA (short section with strong call-to-action)
  if (lowerText.length < 500 && /get started|sign up|start free|try now|join|subscribe/i.test(lowerText)) {
    return { category: "cta", confidence: 0.6 };
  }

  // Hero fallback: early section with h1 and CTA
  if (index <= 2 && /<h1\b/i.test(html) && /<(?:a|button)\b/i.test(html)) {
    return { category: "hero", confidence: 0.6, subType: "cta-hero" };
  }

  // Features (uses common feature patterns)
  if (/feature|benefit|advantage|why choose|what we offer/i.test(lowerText)) {
    return { category: "features", confidence: 0.6 };
  }

  return null;
}

function deriveSubType(category: ComponentCategory, html: string): string | undefined {
  const lower = html.toLowerCase();

  switch (category) {
    case "hero":
      if (/<video\b/i.test(html)) return "video-hero";
      if (/split|two-col|grid-cols-2/i.test(lower)) return "split-hero";
      if (/gradient/i.test(lower)) return "gradient-hero";
      if (/parallax/i.test(lower)) return "parallax-hero";
      if (/fullscreen|h-screen|min-h-screen/i.test(lower)) return "fullscreen-hero";
      return undefined;
    case "testimonials":
      if (/carousel|slider|swiper/i.test(lower)) return "testimonial-carousel";
      if (/grid/i.test(lower)) return "testimonial-grid";
      return undefined;
    case "pricing":
      if (/toggle|switch|annual|monthly/i.test(lower)) return "pricing-toggle";
      if (/comparison|compare/i.test(lower)) return "pricing-comparison";
      return undefined;
    case "features":
      if (/grid/i.test(lower)) return "feature-grid";
      if (/icon/i.test(lower) || /<svg\b/i.test(html)) return "feature-icons";
      if (/tab/i.test(lower)) return "feature-tabs";
      return undefined;
    case "navbar":
      if (/mega-menu|megamenu/i.test(lower)) return "mega-nav";
      if (/sticky|fixed/i.test(lower)) return "sticky-nav";
      if (/transparent/i.test(lower)) return "transparent-nav";
      return undefined;
    default:
      return undefined;
  }
}

function detectColumnCount(html: string): number {
  // Tailwind grid columns
  const gridMatch = html.match(/grid-cols-(\d)/i);
  if (gridMatch) return parseInt(gridMatch[1]);

  // Tailwind flex with repeated children (approximate)
  const flexMatch = html.match(/md:w-1\/(\d)/i);
  if (flexMatch) return parseInt(flexMatch[1]);

  // CSS grid
  const cssGridMatch = html.match(/grid-template-columns:\s*repeat\((\d)/i);
  if (cssGridMatch) return parseInt(cssGridMatch[1]);

  return 0;
}

// ─── Animation Pattern Detection ─────────────────────────────────────────────

/**
 * Detect animation patterns in a section's HTML.
 * Scans script tags, CSS, class names, and data attributes.
 */
export function detectAnimations(html: string): AnimationPattern[] {
  const patterns: AnimationPattern[] = [];
  const lower = html.toLowerCase();

  // ── Script-based detection ──
  detectScriptAnimations(html, lower, patterns);

  // ── CSS animation detection ──
  detectCSSAnimations(html, lower, patterns);

  // ── Data attribute detection ──
  detectDataAttributeAnimations(html, lower, patterns);

  // ── Class-based detection ──
  detectClassAnimations(lower, patterns);

  // Deduplicate by type+trigger
  const seen = new Set<string>();
  return patterns.filter(p => {
    const key = `${p.type}:${p.trigger}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function detectScriptAnimations(html: string, lower: string, patterns: AnimationPattern[]): void {
  // GSAP core
  if (/\bgsap\b/i.test(html) || /gsap\.min\.js|gsap\.js/i.test(lower)) {
    // Determine what GSAP methods are used
    const methods = new Set<string>();
    if (/gsap\.(to|from|fromTo|set)\b/i.test(html)) {
      const m = html.match(/gsap\.(to|from|fromTo|set)\b/gi) || [];
      m.forEach(x => methods.add(x.split(".")[1].toLowerCase()));
    }

    // Extract animated properties from gsap calls
    const props = extractGSAPProperties(html);

    patterns.push({
      type: "gsap",
      trigger: /scrolltrigger/i.test(lower) ? "scroll" : "load",
      properties: props.length > 0 ? props : ["opacity", "transform"],
      description: `GSAP ${[...methods].join("/")} animation`,
    });
  }

  // ScrollTrigger specifically
  if (/scrolltrigger/i.test(lower) && !patterns.some(p => p.type === "scrolltrigger")) {
    const hasScrub = /scrub:\s*true|scrub:\s*\d/i.test(html);
    const hasPin = /pin:\s*true|pin:\s*['"]|pin:\s*\./i.test(html);

    patterns.push({
      type: "scrolltrigger",
      trigger: "scroll",
      properties: [
        ...(hasScrub ? ["scrub"] : []),
        ...(hasPin ? ["pin"] : []),
        "opacity", "transform",
      ],
      description: `ScrollTrigger${hasPin ? " with pinning" : ""}${hasScrub ? " with scrub" : ""}`,
    });
  }

  // Swiper
  if (/\bswiper\b/i.test(lower) || /swiper-bundle|swiper\.min/i.test(lower)) {
    patterns.push({
      type: "swiper",
      trigger: "load",
      properties: ["transform", "opacity"],
      description: "Swiper carousel/slider",
    });
  }

  // Lottie / Bodymovin
  if (/\blottie\b|bodymovin/i.test(lower)) {
    patterns.push({
      type: "lottie",
      trigger: "load",
      properties: ["svg-animation"],
      description: "Lottie vector animation",
    });
  }

  // Three.js / WebGL
  if (/\bTHREE\b|three\.js|three\.min/i.test(html)) {
    patterns.push({
      type: "three-js",
      trigger: "load",
      properties: ["webgl", "3d"],
      description: "Three.js 3D/WebGL rendering",
    });
  }

  // Framer Motion
  if (/framer-motion|motion\./i.test(lower)) {
    patterns.push({
      type: "framer-motion",
      trigger: "load",
      properties: ["opacity", "transform"],
      description: "Framer Motion animation",
    });
  }

  // Anime.js
  if (/\banime\b.*\.js|animejs/i.test(lower)) {
    patterns.push({
      type: "anime-js",
      trigger: "load",
      properties: ["opacity", "transform"],
      description: "Anime.js animation",
    });
  }

  // IntersectionObserver (not a library but a technique)
  if (/intersectionobserver/i.test(html)) {
    patterns.push({
      type: "intersection-observer",
      trigger: "viewport-enter",
      properties: ["opacity", "transform"],
      description: "IntersectionObserver-based reveal animation",
    });
  }
}

function detectCSSAnimations(html: string, lower: string, patterns: AnimationPattern[]): void {
  // @keyframes declarations
  const keyframeMatches = html.match(/@keyframes\s+([\w-]+)/gi) || [];
  if (keyframeMatches.length > 0) {
    const names = keyframeMatches.map(m => m.replace(/@keyframes\s+/i, ""));
    const props = extractKeyframeProperties(html);

    patterns.push({
      type: "css-keyframes",
      trigger: "load",
      properties: props.length > 0 ? props : ["opacity", "transform"],
      description: `CSS @keyframes: ${names.slice(0, 3).join(", ")}${names.length > 3 ? ` (+${names.length - 3} more)` : ""}`,
    });
  }

  // CSS transitions
  if (/transition\s*:/i.test(html) && !/transition\s*:\s*none/i.test(html)) {
    const transProps = extractTransitionProperties(html);
    if (transProps.length > 0) {
      patterns.push({
        type: "css-transition",
        trigger: "hover",
        properties: transProps,
        description: `CSS transitions on ${transProps.slice(0, 3).join(", ")}`,
      });
    }
  }

  // clip-path animations (reveal/mask effects)
  if (/clip-path/i.test(lower) && /@keyframes/i.test(lower)) {
    // Already captured by keyframes, but note it
    const existing = patterns.find(p => p.type === "css-keyframes");
    if (existing && !existing.properties.includes("clip-path")) {
      existing.properties.push("clip-path");
    }
  }

  // SVG stroke animations
  if (/stroke-dasharray|stroke-dashoffset/i.test(lower)) {
    const existing = patterns.find(p => p.type === "css-keyframes");
    if (existing) {
      if (!existing.properties.includes("stroke-dashoffset")) {
        existing.properties.push("stroke-dashoffset");
        existing.description += ", SVG line drawing";
      }
    } else {
      patterns.push({
        type: "css-keyframes",
        trigger: "load",
        properties: ["stroke-dasharray", "stroke-dashoffset"],
        description: "SVG stroke/line drawing animation",
      });
    }
  }

  // Scroll-driven animations (CSS scroll-timeline)
  if (/scroll-timeline|animation-timeline|view-timeline/i.test(lower)) {
    patterns.push({
      type: "scroll-driven",
      trigger: "scroll",
      properties: ["transform", "opacity"],
      description: "CSS scroll-driven animation (scroll-timeline)",
    });
  }

  // View Transitions API
  if (/view-transition|::view-transition/i.test(lower)) {
    patterns.push({
      type: "view-transitions",
      trigger: "click",
      properties: ["opacity", "transform"],
      description: "View Transitions API",
    });
  }
}

function detectDataAttributeAnimations(_html: string, lower: string, patterns: AnimationPattern[]): void {
  // AOS (Animate On Scroll)
  if (/data-aos\b/i.test(lower)) {
    const aosTypes = lower.match(/data-aos="([^"]+)"/g) || [];
    const effects = aosTypes.map(a => a.match(/"([^"]+)"/)?.[1] || "").filter(Boolean);
    patterns.push({
      type: "intersection-observer",
      trigger: "viewport-enter",
      properties: [...new Set(effects)].slice(0, 5),
      description: `AOS scroll animations: ${[...new Set(effects)].slice(0, 3).join(", ")}`,
    });
  }

  // Generic data-animate / data-scroll attributes
  if (/data-animate\b|data-scroll\b/i.test(lower)) {
    patterns.push({
      type: "intersection-observer",
      trigger: "viewport-enter",
      properties: ["opacity", "transform"],
      description: "Custom data-attribute scroll animation",
    });
  }

  // Parallax data attributes
  if (/data-parallax|data-speed|data-rellax/i.test(lower)) {
    patterns.push({
      type: "scrolltrigger",
      trigger: "scroll",
      properties: ["transform", "background-position"],
      description: "Parallax scroll effect",
    });
  }
}

function detectClassAnimations(lower: string, patterns: AnimationPattern[]): void {
  // will-change or translate3d (GPU acceleration hints → animation intent)
  if (/will-change|translate3d\(0|translateZ\(0/i.test(lower)) {
    // Don't add a pattern — this is just a signal, not a standalone animation
    // But flag existing patterns as GPU-accelerated
    for (const p of patterns) {
      if (!p.properties.includes("gpu-accelerated")) {
        p.properties.push("gpu-accelerated");
      }
    }
  }

  // Common animation utility classes
  if (/\banimate-/i.test(lower)) {
    const animClasses = lower.match(/animate-[\w-]+/g) || [];
    if (animClasses.length > 0 && !patterns.some(p => p.type === "css-keyframes")) {
      patterns.push({
        type: "css-keyframes",
        trigger: "load",
        properties: animClasses.slice(0, 5),
        description: `Tailwind/utility animation classes: ${animClasses.slice(0, 3).join(", ")}`,
      });
    }
  }
}

/** Extract CSS properties from GSAP calls like gsap.to('.el', { opacity: 0, x: 100 }) */
function extractGSAPProperties(html: string): string[] {
  const props = new Set<string>();
  // Match property names in gsap call objects
  const gsapCalls = html.match(/gsap\.\w+\([^)]*\{([^}]+)\}/g) || [];
  const cssProps = [
    "opacity", "x", "y", "scale", "scaleX", "scaleY", "rotation", "rotationX", "rotationY",
    "skewX", "skewY", "xPercent", "yPercent", "width", "height",
    "backgroundColor", "color", "borderRadius", "clipPath",
    "backgroundPosition", "fontSize", "letterSpacing", "lineHeight",
    "strokeDashoffset", "strokeDasharray", "fill", "stroke",
  ];

  for (const call of gsapCalls) {
    for (const prop of cssProps) {
      if (new RegExp(`\\b${prop}\\s*:`).test(call)) {
        // Normalize GSAP shorthand to CSS property names
        const cssName = prop === "x" || prop === "y" || prop === "scale" || prop === "rotation"
          ? "transform" : prop;
        props.add(cssName);
      }
    }
  }
  return [...props];
}

/** Extract properties from @keyframes blocks */
function extractKeyframeProperties(html: string): string[] {
  const props = new Set<string>();
  const keyframeBlocks = html.match(/@keyframes\s+[\w-]+\s*\{[^}]*\{([^}]+)\}/g) || [];

  const cssAnimProps = [
    "opacity", "transform", "clip-path", "background-color", "color",
    "width", "height", "top", "left", "right", "bottom",
    "border-radius", "box-shadow", "filter", "backdrop-filter",
    "stroke-dashoffset", "stroke-dasharray", "fill",
  ];

  for (const block of keyframeBlocks) {
    for (const prop of cssAnimProps) {
      if (block.includes(prop)) props.add(prop);
    }
  }
  return [...props];
}

/** Extract properties from CSS transition declarations */
function extractTransitionProperties(html: string): string[] {
  const props = new Set<string>();
  const transMatches = html.match(/transition\s*:\s*([^;}{]+)/gi) || [];

  for (const trans of transMatches) {
    const value = trans.replace(/transition\s*:\s*/i, "").trim();
    if (value === "none" || value === "all") continue;

    // Parse "opacity 0.3s ease, transform 0.5s"
    const parts = value.split(",");
    for (const part of parts) {
      const prop = part.trim().split(/\s+/)[0];
      if (prop && prop !== "all" && !prop.match(/^\d/)) {
        props.add(prop);
      }
    }
  }
  return [...props];
}

// ─── Premium Tier Classification ─────────────────────────────────────────────

/**
 * Determine premium tier based on detected animation patterns and interactivity.
 */
export function classifyTier(
  animations: AnimationPattern[],
  features: SectionClassification["features"],
): PremiumTier {
  if (animations.length === 0 && !features.isInteractive) return "basic";

  // Cinematic: pinned scroll, scrub, three.js, or complex multi-effect
  const hasPinOrScrub = animations.some(a =>
    a.properties.includes("pin") || a.properties.includes("scrub"));
  const hasThreeJs = animations.some(a => a.type === "three-js");
  const hasLottie = animations.some(a => a.type === "lottie");
  const complexEffectCount = animations.filter(a =>
    a.type === "gsap" || a.type === "scrolltrigger" || a.type === "scroll-driven").length;

  if (hasPinOrScrub || hasThreeJs || complexEffectCount >= 3) return "cinematic";

  // Animated: GSAP, ScrollTrigger, CSS keyframes, Lottie
  const hasGSAP = animations.some(a => a.type === "gsap" || a.type === "scrolltrigger");
  const hasKeyframes = animations.some(a => a.type === "css-keyframes" && a.properties.length >= 2);
  if (hasGSAP || hasLottie || hasKeyframes) return "animated";

  // Interactive: carousels, forms, tabs, accordions
  if (features.isInteractive || animations.some(a => a.type === "swiper")) return "interactive";

  // Has some CSS transitions but nothing more
  if (animations.some(a => a.type === "css-transition")) return "basic";

  return "basic";
}

// ─── Main Extraction Pipeline ────────────────────────────────────────────────

/**
 * Strip non-content elements from crawled HTML.
 */
function stripBoilerplate(html: string): string {
  return html
    // Remove script tags (except animation libraries we want to detect)
    .replace(/<script\b[^>]*src="[^"]*(?:analytics|gtag|gtm|facebook|pixel|hotjar|segment|mixpanel|intercom|drift|hubspot|marketo)[^"]*"[^>]*>[\s\S]*?<\/script>/gi, "")
    // Remove tracking pixels
    .replace(/<img\b[^>]*(?:pixel|tracking|beacon|1x1)[^>]*\/?>/gi, "")
    // Remove noscript
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, "")
    // Remove comments
    .replace(/<!--[\s\S]*?-->/g, "")
    // Remove style-only blocks with no structural content
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, (match) => {
      // Keep styles that contain animation definitions
      if (/@keyframes|animation|transition/i.test(match)) return match;
      return "";
    });
}

/**
 * Strip HTML tags to get plain text.
 */
function stripTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Find top-level structural elements in HTML using depth counting.
 */
function findTopLevelElements(html: string): Array<{ tag: string; html: string }> {
  const sectionTags = ["nav", "header", "section", "main", "article", "footer", "div", "aside"];
  const tagPattern = sectionTags.join("|");
  const allTags = new RegExp(`<(/?)(${tagPattern})\\b[^>]*/?>`, "gi");

  const elements: Array<{ tag: string; html: string }> = [];
  let tagMatch: RegExpExecArray | null;
  let currentDepth = 0;
  let elementStart = -1;
  let elementTag = "";

  while ((tagMatch = allTags.exec(html)) !== null) {
    const isClosing = tagMatch[1] === "/";
    const isSelfClosing = tagMatch[0].endsWith("/>");
    if (isSelfClosing) continue;

    if (!isClosing) {
      if (currentDepth === 0) {
        elementStart = tagMatch.index;
        elementTag = tagMatch[2].toLowerCase();
      }
      currentDepth++;
    } else {
      currentDepth--;
      if (currentDepth === 0 && elementStart >= 0) {
        const elementHtml = html.slice(elementStart, tagMatch.index + tagMatch[0].length);
        if (elementHtml.length > 50) {
          elements.push({ tag: elementTag, html: elementHtml });
        }
        elementStart = -1;
      }
      if (currentDepth < 0) currentDepth = 0;
    }
  }

  return elements;
}

/**
 * Recursively unwrap container elements (<main>, <div id="app">, etc.)
 * to find actual content sections.
 */
function unwrapContainers(
  elements: Array<{ tag: string; html: string }>,
  bodyLength: number,
  depth = 0,
): Array<{ tag: string; html: string }> {
  if (depth > 6) return elements;

  const expanded: Array<{ tag: string; html: string }> = [];

  for (const el of elements) {
    const isWrapper =
      el.tag === "main" ||
      ((el.tag === "div" || el.tag === "article" || el.tag === "header") &&
        el.html.length > bodyLength * 0.25);

    if (isWrapper) {
      // Extract inner content
      const openEnd = el.html.indexOf(">") + 1;
      const closeStart = el.html.lastIndexOf("</");
      if (openEnd > 0 && closeStart > openEnd) {
        const inner = el.html.slice(openEnd, closeStart).trim();
        const children = findTopLevelElements(inner);
        if (children.length >= 2) {
          expanded.push(...unwrapContainers(children, bodyLength, depth + 1));
          continue;
        }
      }
    }

    expanded.push(el);
  }

  return expanded;
}

/** Check if a section is structural boilerplate (cookie consent, language switcher, etc.) */
function isBoilerplate(html: string, text: string): boolean {
  const lowerText = text.toLowerCase();
  const lower = html.toLowerCase();

  return (
    // Cookie/GDPR
    (/cookie|gdpr|consent|cookie.?policy|accept.?all/i.test(lowerText) && text.length < 500) ||
    // Language/region switchers
    (/language.switch|region.select|locale/i.test(lower) && text.length < 100) ||
    // Search bars as standalone sections
    (/^search\b/i.test(lowerText.trim()) && text.length < 300) ||
    // Newsletter popups / modals (very short)
    ((lower.includes("modal") || lower.includes("popup") || lower.includes("overlay")) && text.length < 200) ||
    // Skip to content links
    (/skip.to.content|skip.to.main/i.test(lowerText) && text.length < 100)
  );
}

export interface ExtractSectionsOptions {
  /** Source URL for metadata */
  sourceUrl: string;
  /** Minimum text content length to keep a section */
  minTextLength?: number;
  /** Minimum HTML length to keep a section */
  minHtmlLength?: number;
  /** Maximum sections to extract (0 = unlimited) */
  maxSections?: number;
}

/**
 * Extract, classify, and analyse sections from a crawled HTML page.
 *
 * This is the main entry point for the component engine extraction pipeline.
 * Unlike `parseSections()` in section-parser.ts (which prepares sections for
 * generation), this extracts sections for *cataloguing*: richer classification,
 * animation detection, structural hashing, and premium tier assessment.
 */
export function extractSections(html: string, opts: ExtractSectionsOptions): ExtractedSection[] {
  const {
    sourceUrl,
    minTextLength = 50,
    minHtmlLength = 100,
    maxSections = 0,
  } = opts;

  const domain = extractDomain(sourceUrl);

  // Strip tracking/analytics boilerplate but keep animation scripts/styles
  const cleaned = stripBoilerplate(html);

  // Extract body content
  const bodyMatch = cleaned.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  const bodyContent = bodyMatch ? bodyMatch[1] : cleaned;

  // Find top-level elements and unwrap containers
  let elements = findTopLevelElements(bodyContent);
  elements = unwrapContainers(elements, bodyContent.length);

  // Extract global animation context (styles/scripts outside sections)
  const globalAnimationContext = extractGlobalAnimationContext(cleaned);

  const sections: ExtractedSection[] = [];
  const now = new Date().toISOString();

  for (let i = 0; i < elements.length; i++) {
    const el = elements[i];
    const text = stripTags(el.html);

    // Size filters
    if (text.length < minTextLength && !/<img\b/i.test(el.html) && !/<svg\b/i.test(el.html) &&
        el.tag !== "nav" && el.tag !== "footer") continue;
    if (el.html.length < minHtmlLength && el.tag !== "nav") continue;

    // Skip boilerplate
    if (isBoilerplate(el.html, text)) continue;

    // Classify
    const classification = classifySection(el.html, i, elements.length, text);

    // Skip duplicate navs
    if (classification.category === "navbar" && sections.some(s => s.classification.category === "navbar")) continue;

    // Detect animations (section-level + global context)
    const sectionHtml = el.html + "\n" + globalAnimationContext;
    const animations = detectAnimations(sectionHtml);

    // Update classification features with animation info
    classification.features.hasAnimation = animations.length > 0;

    // Determine premium tier
    const tier = classifyTier(animations, classification.features);

    // Generate structural hash
    const hash = structuralHash(el.html);

    // Extract label
    const label = extractLabel(el.html, classification.category, sections.length + 1);

    sections.push({
      sourceUrl,
      sourceDomain: domain,
      index: sections.length,
      tag: el.tag,
      label,
      html: el.html,
      htmlLength: el.html.length,
      textContent: text.slice(0, 5000),
      classification,
      animations,
      tier,
      structuralHash: hash,
      extractedAt: now,
    });
  }

  // Apply max sections limit
  if (maxSections > 0 && sections.length > maxSections) {
    // Prioritise: navbar, hero, footer, then by tier (cinematic > animated > interactive > basic)
    const tierOrder: Record<PremiumTier, number> = { cinematic: 0, animated: 1, interactive: 2, basic: 3 };
    const catOrder: Record<string, number> = { navbar: 0, hero: 1, footer: 2 };

    sections.sort((a, b) => {
      const aCat = catOrder[a.classification.category] ?? 99;
      const bCat = catOrder[b.classification.category] ?? 99;
      if (aCat !== bCat) return aCat - bCat;
      return tierOrder[a.tier] - tierOrder[b.tier];
    });

    return sections.slice(0, maxSections);
  }

  return sections;
}

/**
 * Extract global animation context — styles and scripts in <head> or outside sections
 * that define animations used by sections.
 */
function extractGlobalAnimationContext(html: string): string {
  const parts: string[] = [];

  // Collect <style> blocks with animation definitions
  const styleBlocks = html.match(/<style\b[^>]*>[\s\S]*?<\/style>/gi) || [];
  for (const block of styleBlocks) {
    if (/@keyframes|animation|transition/i.test(block)) {
      parts.push(block);
    }
  }

  // Collect <script> tags that reference animation libraries
  const scriptTags = html.match(/<script\b[^>]*src="[^"]*(?:gsap|scrolltrigger|swiper|lottie|anime|three|motion)[^"]*"[^>]*>/gi) || [];
  for (const tag of scriptTags) {
    parts.push(tag);
  }

  return parts.join("\n");
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function extractLabel(html: string, category: ComponentCategory, fallbackIndex: number): string {
  // Use category name as fallback base
  const categoryLabel = category.charAt(0).toUpperCase() + category.slice(1);

  // Try h1-h4
  const headingMatch = html.match(/<h[1-4][^>]*>([\s\S]*?)<\/h[1-4]>/i);
  if (headingMatch) {
    const text = stripTags(headingMatch[1]).trim();
    if (text.length > 2 && text.length < 80) return text;
  }

  // Try aria-label
  const ariaMatch = html.match(/aria-label="([^"]+)"/i);
  if (ariaMatch && ariaMatch[1].length > 2) return ariaMatch[1].slice(0, 60);

  return `${categoryLabel} ${fallbackIndex}`;
}

// ─── Summary Helpers ─────────────────────────────────────────────────────────

/** Quick summary of extraction results for logging */
export function summarizeExtraction(sections: ExtractedSection[]): string {
  const tierCounts: Record<PremiumTier, number> = { basic: 0, interactive: 0, animated: 0, cinematic: 0 };
  const catCounts: Record<string, number> = {};

  for (const s of sections) {
    tierCounts[s.tier]++;
    catCounts[s.classification.category] = (catCounts[s.classification.category] || 0) + 1;
  }

  const tierStr = Object.entries(tierCounts)
    .filter(([_, c]) => c > 0)
    .map(([t, c]) => `${c} ${t}`)
    .join(", ");

  const catStr = Object.entries(catCounts)
    .sort(([, a], [, b]) => b - a)
    .map(([c, n]) => `${n} ${c}`)
    .join(", ");

  return `${sections.length} sections (${tierStr}) — ${catStr}`;
}
