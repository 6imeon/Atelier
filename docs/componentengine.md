# Atelier — Component Engine

## 1. Problem Statement

The current component creation pipeline is **manual, slow, and brittle**:

- **3 separate generation scripts** with 2,800+ lines of hardcoded specs
- Adding a component type or industry requires editing source code
- No automated discovery of what components are popular/effective across the web
- No connection between the rating system (ELO, compositeScore) and what gets generated
- All 978 components loaded into memory at startup from a single JSON file
- Quality scores are hardcoded (3-4), not earned through usage or comparison

### Current Pipeline

```
Developer writes spec → Run script → AI generates HTML → Save to components.json → Docker rebuild
```

### Target Pipeline

```
Crawl top sites → Extract sections → Detect animation/interaction patterns
       ↓                                          ↓
  Classify (type + premium tier)     Reverse-engineer GSAP/scroll/SVG effects
       ↓                                          ↓
  Deduplicate ← ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┘
       ↓
  Normalize to Tailwind + animation spec
       ↓
  Quality score (visual fidelity, interactivity, accessibility)
       ↓
  Component Library ← Rating system feeds back (ELO, compositeScore)
```

**The goal is not basic section extraction.** We want premium, interactive, editorial-quality components — the kind found on Adidas annual reports, Nike product pages, Bloomberg data visualizations, Diageo luxury showcases. Components with GSAP animations, ScrollTrigger parallax, SVG data viz, cinematic scroll effects, and micro-interactions.

---

## 2. Current State Audit

### Generation Scripts

| Script | Specs | Lines | What it does |
|--------|-------|-------|-------------|
| `generate-components.ts` | 25 hardcoded | 400 | Generic AI components via OpenRouter |
| `generate-industry-components.ts` | 100+ hardcoded | 1,205 | Industry-specific (finance, fashion, auto, etc.) |
| `generate-premium-editorial.ts` | 50+ hardcoded | 1,581 | Annual-report quality with GSAP animations |
| `seed-components.ts` | N/A | ~300 | Scrapes HyperUI.dev, regex-based token inference |

### Pain Points

1. **Hardcoded specs everywhere** — adding a component requires code changes
2. **No quality signal loop** — generated components start at quality 3-4 regardless of actual performance
3. **Fragile token inference** — regex-based detection of colors/fonts/adaptability
4. **Empty metadata** — `slots` and `variants` almost always empty
5. **No deduplication** — similar components accumulate without pruning
6. **Memory-only storage** — all components loaded at startup, no pagination or lazy loading
7. **No admin UI** — management requires terminal access and code knowledge

---

## 3. Proposed Architecture

```
                    ┌─────────────────────────────────────────────┐
                    │            Component Engine                  │
                    │                                             │
  ┌──────────┐     │  ┌───────────┐   ┌──────────────────────┐  │
  │  Crawl   │────►│  │  Extract  │   │  Classify + Score    │  │
  │  Sites   │     │  │  Sections │   │  (LLM + heuristics)  │  │
  └──────────┘     │  └─────┬─────┘   └──────────┬───────────┘  │
                    │        │                     │              │
                    │        ▼                     ▼              │
                    │  ┌──────────────────────────────────────┐  │
                    │  │         Normalize + Deduplicate       │  │
                    │  │  (Tailwind conversion, structural     │  │
                    │  │   hashing, visual similarity)         │  │
                    │  └──────────────┬───────────────────────┘  │
                    │                 │                           │
                    │                 ▼                           │
                    │  ┌──────────────────────────────────────┐  │
                    │  │         Component Library              │  │
                    │  │   compositeScore, ELO, Thompson       │  │
                    │  │   Sampling → generation selection     │  │
                    │  └──────────────────────────────────────┘  │
                    └─────────────────────────────────────────────┘
                                      ▲
                                      │ Rating feedback
                                      │ (stars, thumbs, ELO, implicit)
                                      │
                              User generates pages
```

### Three Input Sources

| Source | Method | Volume | Quality |
|--------|--------|--------|---------|
| **Crawl + Extract** | Automated crawling of top company sites | High (1000s) | Variable, needs scoring |
| **AI Generation** | Prompt-driven generation from specs or inspiration | Medium | Controlled |
| **Community / Manual** | Curated hand-built components | Low | High (hand-verified) |

---

## 4. Crawl + Extract Pipeline

### 4.1 Target Site Selection

**Primary sources** — large companies with well-designed, professionally-built sites:

- **FTSE 100** — UK's top 100 public companies (BP, Unilever, AstraZeneca, Rolls-Royce, etc.)
- **S&P 500** — US top 500 (Apple, Microsoft, Nike, Airbnb, etc.)
- **Awwwards** — award-winning design sites (curated quality)
- **Dribbble/Behance featured** — design portfolio sites with strong UI
- **SaaS landing pages** — Stripe, Linear, Vercel, Notion, etc. (modern design patterns)

**Site list management:**
```typescript
interface CrawlTarget {
  url: string;
  industry: string;           // "finance" | "tech" | "healthcare" | ...
  tier: "ftse100" | "sp500" | "awwwards" | "saas" | "custom";
  lastCrawled?: string;
  pageCount?: number;
  sectionCount?: number;
}
```

### 4.2 Section Extraction Strategy

**Multi-signal section boundary detection** (inspired by VIPS algorithm):

1. **Semantic HTML landmarks** (highest confidence):
   - `<header>`, `<nav>`, `<main>`, `<section>`, `<article>`, `<footer>`, `<aside>`
   - Direct children of `<body>` or `<main>` at DOM depth 1-3

2. **Class/ID heuristics** (medium confidence):
   - Match against dictionary of ~100 common section names: `hero`, `features`, `testimonials`, `pricing`, `cta`, `faq`, `team`, `stats`, `logo-cloud`, `contact`, etc.
   - Look for BEM-style naming: `section__*`, `block--*`

3. **Visual segmentation** (fallback):
   - Full-width block elements (`width >= viewport width`)
   - Large vertical spacing between sibling elements (padding/margin > 40px)
   - Background color changes between adjacent blocks
   - Horizontal rule elements or visual separators

4. **Validation**:
   - Extracted sections should tile vertically to cover the full page
   - Minimum size threshold (> 100px height, > 200 chars text content)
   - Maximum size threshold (< 50% of total page height — avoid capturing the entire page as one section)

### 4.3 Section Classification

**LLM-based classification** with structured output:

```typescript
interface SectionClassification {
  category: ComponentCategory;    // hero, nav, features, testimonials, ...
  confidence: number;             // 0-1
  subType?: string;               // "split-hero", "gradient-hero", "video-hero"
  features: {
    hasAnimation: boolean;
    hasCta: boolean;
    hasImage: boolean;
    hasVideo: boolean;
    hasForm: boolean;
    columnCount: number;
    isInteractive: boolean;
  };
  contentSummary: string;         // "3-column feature grid with icons and descriptions"
}
```

**Two-tier approach to manage LLM costs:**
1. **Cheap classifier** (regex + heuristics) for initial filtering — fast, free, handles 70% of cases
2. **LLM classifier** (DeepSeek/Claude) for ambiguous sections — slower, costs money, handles remaining 30%

**Heuristic classification rules:**
- Contains `<nav>` → `nav`
- First section with `<h1>` → `hero`
- Last section or `<footer>` → `footer`
- Contains `<form>` with email/phone fields → `contact`
- Repeated 3-6 child cards with headings → `features` or `pricing`
- Contains `<blockquote>` or avatar + quote pattern → `testimonials`
- Contains counter/number + label pattern → `stats`

### 4.4 HTML Normalization

Transform site-specific HTML into reusable, framework-agnostic components:

1. **Strip non-portable elements:**
   - Remove `<script>` tags (except animation libraries)
   - Remove tracking pixels, analytics snippets
   - Remove site-specific IDs and data attributes
   - Remove inline event handlers

2. **Normalize CSS:**
   - Convert inline styles to Tailwind utilities where possible
   - Replace site-specific class names with semantic equivalents
   - Preserve animation-related classes (GSAP, ScrollTrigger)

3. **Templatize content:**
   - Replace brand-specific text with descriptive placeholders
   - Replace specific image URLs with `picsum.photos` or placeholder service
   - Preserve structural content (headings, paragraphs, lists) but genericize wording

4. **Self-containment check:**
   - Verify the section renders correctly in isolation
   - Bundle required CSS (inline or Tailwind CDN)
   - Flag external dependencies (custom fonts, JS libraries)

### 4.5 Deduplication

**Three-level dedup pipeline:**

1. **Structural hash** (fast, exact duplicates):
   - Serialize DOM tree as tag-name + nesting sequence, ignoring text/attributes
   - Identical hashes → exact structural duplicate → keep highest quality
   ```
   section>div>h2+p+div>div*3>img+h3+p  →  hash: "a7f3c2..."
   ```

2. **Tree edit distance** (medium, near-duplicates):
   - Zhang-Shasha or APTED algorithm on DOM trees
   - Similarity > 0.85 within same category → likely variant, keep best
   - Complexity: O(n^2) but sections are small (< 500 nodes typically)

3. **Visual similarity** (thorough, cross-structural dedup):
   - Render each section in headless browser at 1440px width
   - Compute CLIP embedding of the screenshot
   - Cosine similarity > 0.92 within same category → visual duplicate
   - Alternatively: perceptual hash (pHash) with hamming distance < 8

**Dedup output:** For each cluster of similar components, keep the one with:
- Highest quality score
- Best accessibility (alt tags, ARIA labels, semantic HTML)
- Cleanest code (lowest nesting depth, fewest inline styles)

---

## 5. Premium Component Extraction

Basic section extraction (hero div, footer div) is table stakes. The engine's real value is extracting and reverse-engineering **premium interactive patterns** — the kind of components that currently require 50+ lines of handwritten GSAP/ScrollTrigger specs in `generate-premium-editorial.ts`.

### 5.1 What Makes a Component "Premium"

| Tier | Characteristics | Examples | Current source |
|------|----------------|----------|---------------|
| **Basic** | Static HTML + Tailwind, no JS | Simple hero, text grid, basic footer | `generate-components.ts`, HyperUI scraping |
| **Interactive** | JS-driven state (tabs, accordions, dropdowns) | Tabbed showcase, FAQ accordion, filter grid | `generate-industry-components.ts` |
| **Animated** | GSAP/ScrollTrigger/CSS animations | Scroll-reveal sections, parallax heroes, counter animations | `generate-premium-editorial.ts` |
| **Cinematic** | Complex scroll narratives, data viz, particle effects | Pinned scroll sequences, SVG ring charts, video-like backgrounds | `generate-premium-editorial.ts` (top tier) |

The engine should primarily target **Animated** and **Cinematic** tiers — these are what differentiate Atelier from v0/Builder.io.

### 5.2 Animation Pattern Detection

When crawling a site, detect and catalogue the animation techniques used:

```typescript
interface AnimationPattern {
  type: "gsap" | "scrolltrigger" | "css-keyframes" | "css-transition" |
        "intersection-observer" | "lottie" | "three-js" | "swiper" | "framer-motion";
  trigger: "load" | "scroll" | "hover" | "click" | "viewport-enter";
  properties: string[];        // ["opacity", "transform", "clip-path", "stroke-dashoffset"]
  duration?: number;           // ms
  easing?: string;             // "power4.out", "ease-in-out"
  description: string;         // LLM-generated: "Hero headline reveals letter-by-letter on load"
}
```

**Detection methods:**

1. **Script tag scanning:**
   - `gsap` / `ScrollTrigger` / `ScrollSmoother` → GSAP ecosystem
   - `Swiper` → carousel/slider interactions
   - `lottie` / `bodymovin` → Lottie vector animations
   - `THREE` / `three.js` → 3D/WebGL effects
   - `framer-motion` / `motion` → React animation library
   - `anime` / `animejs` → Anime.js animations

2. **CSS analysis:**
   - `@keyframes` declarations → CSS animations (extract name, properties, duration)
   - `transition` properties → hover/state transitions
   - `will-change` / `transform: translate3d(0,0,0)` → GPU-accelerated layers (indicates animation intent)
   - `clip-path` animations → reveal/mask effects
   - `stroke-dasharray` / `stroke-dashoffset` → SVG line drawing effects

3. **DOM attribute patterns:**
   - `data-animate`, `data-aos`, `data-scroll` → animation trigger attributes
   - `data-speed`, `data-parallax` → parallax configuration
   - `data-swiper-*` → Swiper configuration
   - `style="--progress:"` or CSS custom properties with JS → scroll-linked animations

4. **Computed style diffing** (advanced):
   - Snapshot computed styles at page load vs after 2s vs after scroll
   - Elements that changed `opacity`, `transform`, `clip-path` → animated elements
   - Requires headless browser with scroll simulation

### 5.3 Interaction Pattern Reverse-Engineering

Beyond detecting *that* animations exist, reverse-engineer *what they do*:

**Screenshot sequence capture:**
1. Render page at load (t=0)
2. Render after 2s (initial animations complete)
3. Scroll to 25%, 50%, 75%, 100% — capture at each position
4. LLM analyzes the 6 screenshots: "What changed between each frame?"

**Output: Animation Brief** (structured spec, like what `generate-premium-editorial.ts` uses):

```typescript
interface AnimationBrief {
  sectionType: string;           // "hero", "stats", "features"
  animationStyle: string;        // "cinematic-reveal", "scroll-parallax", "data-viz"
  effects: Array<{
    element: string;             // "headline", "background-image", "stat-counter"
    animation: string;           // "fade-up", "scale-in", "counter-increment", "parallax"
    trigger: string;             // "on-load", "on-scroll-enter", "on-scroll-scrub"
    timing: string;              // "0.8s power4.out", "scrub: true"
    detail: string;              // "Text splits into words, each fades up with 0.05s stagger"
  }>;
  libraries: string[];           // ["gsap", "ScrollTrigger"]
  complexity: "basic" | "intermediate" | "advanced" | "cinematic";
}
```

### 5.4 Premium Pattern Catalogue

Build a reference catalogue of premium patterns observed across FTSE 100 / S&P 500:

| Pattern | Where seen | Frequency | Complexity |
|---------|-----------|-----------|------------|
| **Scroll-pinned hero with scale-down** | Apple, Nike, Stripe | High | Advanced |
| **Counter animation on viewport enter** | Annual reports, SaaS | Very high | Intermediate |
| **SVG donut/ring chart with stroke animation** | Financial reports, dashboards | High | Advanced |
| **Horizontal scroll section** | Adidas AR, editorial sites | Medium | Cinematic |
| **Text split + stagger reveal** | Luxury brands, agencies | Very high | Intermediate |
| **Parallax image layers** | Nike, Airbnb, travel | Very high | Intermediate |
| **Accordion with media crossfade** | Corporate, product pages | High | Intermediate |
| **Sticky nav with scroll transform** | Almost all premium sites | Very high | Intermediate |
| **Product image with glow/bloom effect** | Luxury, spirits, automotive | Medium | Advanced |
| **Film grain / noise texture overlay** | Editorial, luxury, fashion | Medium | Basic (CSS only) |
| **Scroll-linked progress bar** | Long-form articles, annual reports | High | Intermediate |
| **Masonry/staggered grid with scroll reveal** | Portfolio, gallery, retail | High | Intermediate |
| **Tab panels with crossfade** | SaaS features, product pages | Very high | Intermediate |
| **Comparison slider (before/after)** | Product, real estate, design | Medium | Advanced |
| **Lottie icon animations** | SaaS, fintech, tech | High | Advanced |

### 5.5 Generation-from-Inspiration Pipeline

The most valuable output isn't a copied component — it's an **animation brief** that drives AI generation of an original component inspired by what was observed:

```
Crawl site → Detect animation patterns → Generate animation brief
                                               ↓
                    Combine with persona + brand tokens + section type
                                               ↓
                    AI generates original component (Kimi K2.5)
                                               ↓
                    Automated quality check (renders, animations work, accessible)
                                               ↓
                    Component library (with animation brief as metadata)
```

**Example flow:**

1. Crawl `report.adidas-group.com` → detect: scroll-pinned hero, scale-down on scroll, counter animations, SVG ring charts, horizontal scroll showcase
2. Generate animation briefs for each pattern
3. For each brief, generate 3 variants:
   - Same pattern + luxury persona (Diageo style)
   - Same pattern + tech persona (Stripe style)
   - Same pattern + editorial persona (Bloomberg style)
4. Score all variants, best enters library
5. When a user generates a page, Thompson Sampling selects from these premium components

This avoids legal concerns about copying HTML while capturing the *technique* — which is not copyrightable.

### 5.6 Component Spec Auto-Generation

Replace hardcoded specs with auto-generated ones from the pattern catalogue:

```typescript
interface AutoSpec {
  // Derived from crawl analysis
  pattern: AnimationBrief;
  sourceInspiration: string[];    // ["adidas-ar-2024", "nike-product-page"]
  
  // Combined with existing systems
  persona: string;                // from persona library
  industry: string;               // from crawl target industry
  category: ComponentCategory;
  
  // Generated prompt (replaces hardcoded prompts in generate-premium-editorial.ts)
  prompt: string;                 // LLM-generated creative brief based on pattern + persona
  
  // Quality expectations
  requiredLibraries: string[];    // ["gsap", "ScrollTrigger"]
  requiredFeatures: string[];     // ["scroll-animation", "responsive", "counter"]
  minimumQuality: number;         // 7/10
}
```

This means new premium components can be generated by:
1. Discovering a new pattern on a crawled site
2. Auto-generating specs for each persona/industry combination
3. Running generation without any code changes

---

## 6. Automated Quality Scoring

Every extracted component gets scored across multiple dimensions:

### 6.1 Quality Dimensions

| Dimension | Weight | How measured |
|-----------|--------|-------------|
| **Semantic HTML** | 0.10 | Uses `<section>`, `<nav>`, proper heading hierarchy, landmark roles |
| **Accessibility** | 0.15 | alt text on images, ARIA labels, color contrast (APCA), keyboard navigability |
| **Responsiveness** | 0.15 | Renders without overflow at 375px, 768px, 1440px |
| **Code quality** | 0.05 | Nesting depth < 8, no inline styles, no deprecated elements |
| **Self-containment** | 0.10 | Works in isolation with only CDN deps (Tailwind, GSAP, Swiper) |
| **Visual fidelity** | 0.10 | Renders correctly when isolated from parent page context |
| **Content completeness** | 0.05 | Has meaningful content, not empty/placeholder-only |
| **Animation quality** | 0.15 | Animations execute correctly, use GPU-accelerated properties, respect prefers-reduced-motion |
| **Interactivity** | 0.10 | Interactive elements (tabs, accordions, sliders) work without errors |
| **Premium tier** | 0.05 | Has scroll-driven effects, data viz, or cinematic animations (bonus) |

### 6.2 Premium-Specific Checks

```typescript
interface QualityReport {
  // Basic dimensions
  semantic: number;        // 0-1
  accessibility: number;   // 0-1
  responsiveness: number;  // 0-1
  codeQuality: number;     // 0-1
  selfContained: number;   // 0-1
  visualFidelity: number;  // 0-1
  contentComplete: number; // 0-1
  
  // Premium dimensions
  animationQuality: number;  // 0-1: animations run, no JS errors, GPU-optimized
  interactivity: number;     // 0-1: interactive elements function correctly
  premiumTier: number;       // 0-1: presence of scroll effects, data viz, cinematic patterns
  
  // Computed
  overall: number;           // weighted sum, mapped to 1-10
  tier: "basic" | "interactive" | "animated" | "cinematic";
}
```

**Animation quality checks (headless browser):**
- Load component in Playwright
- Verify no JS console errors after 3s
- Verify GSAP/ScrollTrigger initialized (check `gsap.globalTimeline.getChildren().length > 0`)
- Simulate scroll and verify `transform`/`opacity` changes occur on animated elements
- Check `prefers-reduced-motion` media query is respected
- Verify animations use `transform`/`opacity` (GPU-composited) not `top`/`left`/`width` (layout-triggering)

### 6.3 Quality Gate

- **Score >= 7/10** → auto-accept into library
- **Score 4-7** → queue for LLM normalization/cleanup, re-score
- **Score < 4** → reject (broken, inaccessible, or non-portable)

---

## 7. Integration with Rating System

The component engine feeds into the existing rating system (see `docs/ratingsystem.md`):

```
Extract → Score (automated) → Library → Used in generation → User rates → compositeScore updates
                                                                             ↓
                                                              ELO comparisons on /rank page
                                                                             ↓
                                                              Thompson Sampling selects
                                                              higher-rated components
```

### Lifecycle

1. **New component enters library** with `quality` from automated scoring, `compositeScore = quality`, `elo = {rating: 1500, matches: 0, wins: 0, sigma: 350}`
2. **Used in generation** → implicit signals (exported/edited/deleted) update compositeScore
3. **User rates sections** → thumbs up/down update positiveRatings/negativeRatings
4. **ELO comparisons on /rank** → pairwise ranking refines true quality
5. **Thompson Sampling** explores uncertain components, exploits proven ones
6. **Low-performing components** (compositeScore < 2 after 10+ signals) get flagged for removal or regeneration

### Regeneration Loop

When a component category has consistently low ratings:
1. Identify the top 3 highest-ELO components in that category
2. Use them as style references for `generateComponent()`
3. New components enter the library and compete via ELO
4. Old low-scoring components decay naturally

---

## 8. Implementation Plan

### Phase 1: Crawl Infrastructure + Animation Detection
1. Create `CrawlTarget` interface and seed list (FTSE 100 + S&P 500 + Awwwards URLs)
2. Build crawl script using existing crawl4ai integration
3. Section extraction with multi-signal boundary detection
4. Animation pattern detection (scan for GSAP, ScrollTrigger, Swiper, CSS keyframes, Lottie)
5. Screenshot sequence capture (load, 2s, scroll 25/50/75/100%) per section
6. Save to MongoDB: `raw_sections` (HTML + screenshots) and `animation_patterns` (detected techniques)

### Phase 2: Classification + Animation Brief Generation
7. Heuristic classifier for section type (regex + DOM patterns for 70%)
8. LLM classifier for ambiguous sections + premium tier assessment
9. LLM-powered animation brief generation from screenshot sequences ("what effects does this section use?")
10. Build animation pattern catalogue (which patterns appear on which sites, frequency)

### Phase 3: Premium Component Generation from Briefs
11. Auto-generate component specs from animation briefs + persona + industry combinations
12. Generate premium components via Kimi K2.5 using the auto-specs (replaces hardcoded specs)
13. Automated quality scoring with premium checks (animation execution, GPU optimization, reduced-motion)
14. Quality gate: accept (>= 7/10) → library, normalize (4-7) → retry, reject (< 4)

### Phase 4: Normalization + Dedup
15. HTML normalization (strip site-specific code, convert to Tailwind, templatize content)
16. Structural hash deduplication (exact)
17. Visual similarity dedup (CLIP embeddings or pHash for near-duplicates)
18. Merge into component library with full metadata (animation brief, source inspiration, tier)

### Phase 5: Continuous Pipeline + Rating Loop
19. Scheduled re-crawl (monthly) to discover new animation patterns and design trends
20. Rating-driven regeneration: low-ELO components get replaced by new variants inspired by high-ELO ones
21. Admin API endpoints for managing crawl targets and reviewing extracted patterns
22. Gap analysis: identify categories/tiers with low coverage or low quality
23. "Generate 5 cinematic heroes inspired by the top S&P 500 hero patterns" — single command

### Phase 6: Smart Selection + Style Transfer
24. Use animation briefs as few-shot examples: "Generate a hero section using this scroll-pinned scale-down pattern"
25. Style transfer: take a high-rated animation pattern + apply different brand tokens/persona
26. Cross-industry inspiration: "Apply luxury brand animation patterns to a SaaS pricing page"
27. Trend detection: identify emerging animation patterns (new CSS features, View Transitions API, scroll-driven animations)

---

## 9. Data Model

### New MongoDB Collections

```typescript
// Crawl targets — sites to crawl for component extraction
interface CrawlTarget {
  url: string;
  domain: string;
  industry: string;
  tier: "ftse100" | "sp500" | "awwwards" | "saas" | "custom";
  lastCrawled?: string;
  crawlCount: number;
  pagesCrawled: string[];
  sectionsExtracted: number;
  status: "pending" | "crawled" | "failed";
}

// Raw extracted sections — before normalization
interface RawSection {
  sourceUrl: string;
  sourceDomain: string;
  industry: string;
  html: string;
  htmlLength: number;
  // Screenshots are ephemeral — captured during crawl, used for animation
  // analysis + visual dedup, then deleted. Only derived data is persisted.
  visualHash?: string;            // perceptual hash computed from screenshots (persisted)
  clipEmbeddingSource?: string;   // "scroll50" — which frame was used for CLIP
  classification: {
    category: ComponentCategory;
    confidence: number;
    subType?: string;
    method: "semantic" | "heuristic" | "llm";
    tier: "basic" | "interactive" | "animated" | "cinematic";
  };
  animations: AnimationPattern[];   // detected animation techniques
  animationBrief?: AnimationBrief;  // LLM-generated reverse-engineered brief
  quality: QualityReport;
  structuralHash: string;
  clipEmbedding?: number[];
  status: "raw" | "normalized" | "accepted" | "rejected";
  extractedAt: string;
}

// Animation patterns detected on a site
interface AnimationPatternRecord {
  domain: string;
  url: string;
  industry: string;
  pattern: AnimationPattern;
  brief: AnimationBrief;
  frequency: number;           // how many sites use this pattern
  firstSeen: string;
  lastSeen: string;
  exampleSections: string[];   // RawSection IDs
}

// Auto-generated component specs (replaces hardcoded PREMIUM_SPECS)
interface AutoSpec {
  pattern: AnimationBrief;
  sourceInspiration: string[];
  persona: string;
  industry: string;
  category: ComponentCategory;
  prompt: string;              // LLM-generated creative brief
  requiredLibraries: string[];
  requiredFeatures: string[];
  minimumQuality: number;
  generatedComponentId?: string;  // links to UIComponentData once generated
  status: "pending" | "generating" | "accepted" | "rejected";
}
```

### Updated Component Flow

```
CrawlTarget → crawl → RawSection
                          ↓
              Detect animations + capture screenshots
                          ↓
              Classify (type + tier) + generate AnimationBrief
                          ↓
              AnimationPatternRecord (catalogue)
                          ↓
         AutoSpec (brief + persona + industry)
                          ↓
         AI generates premium component (Kimi K2.5)
                          ↓
         Quality gate (incl. animation execution check)
                          ↓
         UIComponentData (library) ← ELO + compositeScore from rating system
                          ↓
         Used in page generation → user feedback → rating loop
```

---

## 10. Site Lists

### FTSE 100 Sample (by industry)

| Industry | Companies | Expected component patterns |
|----------|-----------|---------------------------|
| Finance | HSBC, Barclays, Lloyds, Aviva, Prudential | Data tables, trust badges, calculators, regulatory footers |
| Pharma/Health | AstraZeneca, GSK, Haleon | Pipeline visualizations, research grids, patient resources |
| Consumer | Unilever, Diageo, Reckitt | Product showcases, brand carousels, sustainability sections |
| Energy | Shell, BP, SSE, National Grid | ESG dashboards, operations maps, investor sections |
| Tech | Sage, Aveva, Darktrace | SaaS pricing, feature comparisons, integration grids |
| Retail | Tesco, JD Sports, Burberry | Product grids, store locators, loyalty sections |

### S&P 500 Sample (by industry)

| Industry | Companies | Expected component patterns |
|----------|-----------|---------------------------|
| Tech | Apple, Microsoft, Google, Meta, Nvidia | Product heroes, developer docs, spec tables |
| Finance | JPMorgan, Goldman Sachs, Visa, PayPal | Security badges, rate calculators, account features |
| Healthcare | UnitedHealth, J&J, Pfizer, Abbott | Clinical data, patient portals, research sections |
| Consumer | Amazon, Nike, Starbucks, McDonald's | Product cards, store finders, rewards programs |
| Industrial | Boeing, Caterpillar, 3M, Honeywell | Technical specs, portfolio grids, careers sections |
| Media | Disney, Netflix, Comcast, Warner Bros | Content carousels, subscription tiers, streaming heroes |

---

## 11. Research References

### Web Page Segmentation
- **VIPS** (Cai, Yu, Wen, Ma, 2003) — Vision-based page segmentation. Combines DOM structure with visual cues (font size, color, spacing) to build a semantic content tree. Granularity controlled by "permitted degree of coherence" parameter. Key finding: visual cues dramatically improve segmentation over DOM-only approaches.
- **Block-o-Matic / BOM** (Sanoja & Gancarski, 2014) — Extended VIPS for modern CSS (flexbox, grid, responsive). Composite segmentation combining DOM, visual rendering, and text density.
- **Gestalt-based Segmentation** (Akpinar & Yesilada, 2013) — Applied Gestalt psychology (proximity, similarity, closure) to identify visually coherent component groups.
- **Text Density Segmentation** (Sun, Lin, Fei, 2011) — Uses text/tag density ratios to distinguish content blocks from boilerplate.

### UI Detection and Reverse Engineering
- **pix2code** (Beltramelli, 2018) — CNN encodes screenshot, RNN decodes to DSL that maps to code. High accuracy on constrained UI vocabularies.
- **Design2Code** (Si, Wu, Zhang et al., Stanford/Google, ICML 2024) — Benchmarked GPT-4V, Gemini on screenshot-to-HTML. GPT-4V achieves ~77% visual similarity. Dataset of 484 real web pages. Key finding: LLMs can already produce reasonable component-level code from visual input.
- **ReDraw** (Moran, Bernal-Cardenas et al., 2018) — CNN-based object detection for mobile UI elements, generates structured code from screenshots.
- **REMAUI** (Nguyen & Csallner, 2015) — Combines OCR, CV, and UI element detection for mobile UI reverse engineering.
- **Screen Recognition** (Zhang, de Greef et al., Apple, 2021) — Detects UI components from pixels to build accessibility metadata.

### Design Pattern Mining
- **Webzeitgeist** (Kumar, Talton et al., Stanford, 2013) — Crawled ~100K web pages, extracted design patterns at scale. DOM subtree comparison + visual feature extraction for clustering. Key finding: enormous redundancy in web design — small number of structural patterns covers majority of real sites.
- **Learning Design Semantics** (Liu, Chen et al., 2018) — Deep learning to classify UI components into semantic categories, trained on Rico dataset.
- **Swire** (Huang et al., 2019) — Sketch-based UI retrieval using learned embeddings. Underlying representation learning relevant for component clustering.

### Visual Similarity and Clustering
- **GUIComp** (Lee et al., 2020) — Compares GUI designs using pixel-level + widget-tree structural similarity. Relevant for deduplication.
- **Screen Similarity** (Deka et al., 2016) — View hierarchy comparison + visual features for mobile UI similarity.
- **FaceNet-style UI Embeddings** (Various, 2019-2023) — Contrastive/triplet loss for UI component embeddings enabling nearest-neighbor search and clustering.

### Component-Level Extraction
- **WebUI2Code** (Wu et al., 2023) — Segmentation to isolate web components, multimodal models to generate code. Directly relevant.
- **UIBert** (Bai et al., Google, 2021) — Multimodal transformer pre-trained on UI data. Understands visual + structural features. Fine-tunable for component classification.
- **ActionBert** (He et al., 2021) — Pre-trained for UI element relationships. Useful for understanding component semantics and boundaries.

### Datasets
- **Rico** (Deka et al., 2017) — 72K mobile UI screens, 9.7K apps, 27 categories. Screenshots, view hierarchies, bounding boxes. Extended by Rico-SCA and CLAY.
- **CLAY** (Li et al., 2022) — Cleaned Rico subset, 59K screens with denoised view hierarchies.
- **Design2Code Benchmark** (Si et al., 2024) — 484 real web pages with ground truth HTML/CSS.
- **WebUI** (Wu et al., 2023) — ~5K web page screenshots paired with HTML/CSS code.
- **Enrico** (Leiva et al., 2020) — 1,460 mobile UIs manually categorized into 20 design topics. Small but high-quality.
- **Screen2Words** (Wang et al., 2021) — 112K mobile UI screenshots with natural language descriptions.

### Industry Tools
- **Sketchmine** (Dynatrace, open-source) — Extracts design systems from live websites. Crawls pages, extracts colors, typography, spacing, component patterns. Closest existing tool to the proposed system.
- **Builder.io Visual Copilot** (2023-present) — GPT-4V to convert designs to code. Key insight: pure AI generation needs post-processing via "design token mapping" step.
- **TeleportHQ UIDL** — JSON-based intermediate representation for framework-agnostic components. Tree diffing to detect repeating subtree patterns.
- **Mozilla Readability** — DOM node scoring heuristics (tag names, class names, text density) relevant for section detection.
- **css-analyzer / Project Wallace** — Analyzes CSS usage patterns to identify recurring style patterns suggesting component boundaries.

### Gap in Existing Research
No publicly available large-scale dataset of **web components extracted from real websites**, categorized by type (hero, nav, footer, etc.), with quality annotations currently exists. Building such a dataset through this engine would be a contribution to the field.

---

## 12. Model Selection

Each pipeline step has different requirements (speed, cost, multimodal, code quality). No single model is optimal for all.

### Per-Task Model Assignment

| Task | Model | Why | Cost/call |
|------|-------|-----|-----------|
| **Section classification** (70%) | Heuristics / regex | Free, instant. Handles obvious cases (`<nav>` → nav, `<footer>` → footer, first `<h1>` → hero) | $0 |
| **Section classification** (30%) | DeepSeek V3 | Cheap, fast, good structured output. Already in our router | ~$0.005 |
| **Animation brief generation** | **Qwen3-VL-235B Instruct** | Best open-source VLM, explicit GUI/spatial understanding, 262K context, rivals GPT-4o at 15x lower cost | ~$0.014 |
| **Animation brief** (fallback) | Gemini 2.5 Flash | Near-frontier UI understanding, 1M context, native multi-image | ~$0.023 |
| **HTML normalization** | DeepSeek V3 | Code-focused task (strip site-specific code, convert to Tailwind). DeepSeek excels at code transforms | ~$0.02 |
| **Premium component generation** | Kimi K2.5 | Already proven in our pipeline. Best at generating long, production-quality HTML with GSAP/ScrollTrigger | ~$0.05 |
| **Quality check** (render test) | No LLM — Playwright | Headless browser: render, check JS errors, simulate scroll, verify animations fire | $0 |
| **Visual dedup** (CLIP embedding) | CLIP ViT-L/14 (local) | Runs locally, no API cost. Or OpenAI embeddings API (~$0.001) | $0 |

### Multimodal Model Comparison (Animation Brief Task)

The animation brief step is the most demanding — it analyzes 6 screenshots of a section at different scroll/time positions and reverse-engineers what effects are happening. Requires strong spatial reasoning + multi-image support.

| Model | Input $/M tok | Output $/M tok | Cost per 6-screenshot call | Context | Quality |
|-------|-------------|---------------|---------------------------|---------|---------|
| **Qwen3-VL-235B Instruct** | $0.20 | $0.88 | **~$0.014** | 262K | Rivals GPT-4o on vision benchmarks |
| **Qwen3-VL-32B Instruct** | $0.10 | $0.42 | ~$0.007 | 131K | ~85-90% of 235B quality |
| Gemini 2.5 Flash | $0.30 | $2.50 | ~$0.023 | 1M | Top UI/diagram benchmark scores |
| Gemini 2.0 Flash | $0.10 | $0.40 | ~$0.008 | 1M | Cheap but older architecture |
| Kimi K2.5 (current vision) | $0.20 | $0.80 | ~$0.014 | 128K | Already in our router |
| GPT-4o | $2.50 | $10.00 | ~$0.17 | 128K | Great but 12x more expensive |
| Claude Sonnet 4.6 | $3.00 | $15.00 | ~$0.21 | 1M | Best quality but 15x more expensive |

**Free tier for prototyping:** `qwen/qwen3-vl-235b-a22b-thinking:free` on OpenRouter — full 235B quality, rate-limited, $0.

### Recommendation

```
Animation brief:     qwen/qwen3-vl-235b-a22b-instruct  (primary)
                     google/gemini-2.5-flash             (fallback)

Classification:      deepseek/deepseek-chat-v3-0324     (ambiguous sections only)

HTML normalization:  deepseek/deepseek-chat-v3-0324

Component generation: moonshotai/kimi-k2.5              (already proven)
```

### Revised Cost Estimate per Crawl Cycle

| Step | Volume | Model | Cost |
|------|--------|-------|------|
| Section classification (heuristic) | 7,000 sections | Regex | $0 |
| Section classification (LLM) | 3,000 sections | DeepSeek V3 | $15 |
| Animation brief generation | 10,000 sections | Qwen3-VL-235B | $140 |
| HTML normalization | 2,000 accepted | DeepSeek V3 | $40 |
| Premium component generation | 500 components | Kimi K2.5 | $25 |
| Quality checks | 500 components | Playwright | $0 |
| Visual dedup | 10,000 sections | CLIP (local) | $0 |
| **Total per crawl cycle** | | | **~$220** |

At monthly crawl cycles: **~$220/month** for a continuously updated premium component library sourced from the world's top company websites.

---

## 13. Open Questions

1. **Legal / robots.txt compliance?** Crawling public websites for design inspiration is common practice, but storing and reusing substantial HTML portions needs careful handling. Approach: extract structural patterns and re-generate inspired components rather than copying verbatim.

2. **Crawl frequency?** Sites redesign every 1-3 years on average. Monthly re-crawl is sufficient for most; Awwwards/Dribbble could be weekly for trending patterns.

3. **LLM cost at scale?** See Section 12 for full breakdown. ~$220/month using Qwen3-VL-235B + DeepSeek V3 + Kimi K2.5. Could be halved by using Qwen3-VL-32B for animation briefs ($0.007/call instead of $0.014).

4. **Component granularity?** Should the engine extract full sections only, or also sub-components (individual cards, buttons, form elements)? Recommendation: start with sections, add sub-component extraction in Phase 5.

5. **Framework lock-in?** Currently Tailwind-only. Should normalized components support multiple CSS frameworks? Recommendation: Tailwind-first, with a future "Tailwind → vanilla CSS" converter.

6. **Screenshots** — ephemeral, not stored. Captured during crawl, used to generate animation briefs + compute visual hashes/CLIP embeddings, then deleted. Only the derived data (brief, hash, embedding) is persisted. This avoids 2-5GB of image storage.

---

## 14. Implementation Checklist

### Phase 1: Crawl Infrastructure + Animation Detection

- [x] Create `CrawlTarget` interface and seed list (FTSE 100 + S&P 500 + Awwwards URLs) *(Done 2026-04-10 — `CrawlTarget` in interface.ts, 31 seed targets in component-engine.ts)*
- [x] Build crawl script using existing crawl4ai integration *(Done 2026-04-10 — `scripts/component-engine.ts` with --crawl, --crawl-pending)*
- [x] Section extraction with multi-signal boundary detection *(Done 2026-04-10 — `packages/sdk/src/utils/section-extractor.ts`)*
- [x] Heuristic section classifier (~100 class/ID name patterns + semantic HTML + content rules) *(Done 2026-04-10 — `classifySection()` in section-extractor.ts)*
- [x] Animation pattern detection (GSAP, ScrollTrigger, Swiper, CSS keyframes, Lottie, Three.js, Framer Motion, Anime.js, data attributes, scroll-driven, View Transitions) *(Done 2026-04-10 — `detectAnimations()` in section-extractor.ts)*
- [x] Premium tier classification (basic/interactive/animated/cinematic) *(Done 2026-04-10 — `classifyTier()` in section-extractor.ts)*
- [x] Structural hash for exact-duplicate dedup *(Done 2026-04-10 — `structuralHash()` in section-extractor.ts, dedup on insert in crawl script)*
- [x] Screenshot sequence capture (load, 2s, scroll 25/50/75/100%) *(Done 2026-04-10 — `captureScrollSequence()` in screenshot/service.ts)*
- [x] Save to MongoDB: `crawl_targets`, `raw_sections`, `animation_patterns` collections *(Done 2026-04-10 — mongodb.ts + component-engine.ts)*

### Phase 2: Classification + Animation Brief Generation

- [x] Heuristic classifier for section type (handles ~70% of cases) *(Done 2026-04-10 — included in Phase 1)*
- [x] LLM classifier for ambiguous sections (confidence < 0.5) via DeepSeek V3 *(Done 2026-04-10 — `classifySectionLLM()` in section-classifier.ts, `--classify` CLI command)*
- [x] LLM-powered animation brief generation from screenshot sequences (Qwen3-VL-235B) *(Done 2026-04-10 — `generateAnimationBrief()` in section-classifier.ts, `--brief` CLI command)*
- [x] Build animation pattern catalogue (frequency tracking per pattern per site) *(Done 2026-04-10 — `animation_patterns` collection with upsert + `--catalogue` CLI command)*
- [x] Router pipeline stages for `section_classify` (DeepSeek V3) and `animation_brief` (Qwen3-VL-235B) *(Done 2026-04-10 — router.ts)*

### Phase 3: Premium Component Generation from Briefs

- [x] Auto-generate component specs from animation briefs + persona + industry *(Done 2026-04-10 — `generateAutoSpec()` in component-generator.ts, 3 personas: editorial-luxury, tech-minimal, bold-modern)*
- [x] Generate premium components via Kimi K2.5 using auto-specs *(Done 2026-04-10 — `generateComponent()` in component-generator.ts, `--generate` CLI command)*
- [x] Automated quality scoring — static analysis (10 dimensions) + Playwright runtime checks (JS errors, scroll animation, responsive) *(Done 2026-04-10 — `scoreQualityStatic()` + `scoreQualityFull()` in component-generator.ts, `--score` CLI command)*
- [x] Quality gate: accept (>= 7/10), normalize (4-7), reject (< 4) *(Done 2026-04-10 — `qualityGate()` in component-generator.ts)*

### Phase 4: Normalization + Dedup

- [x] HTML normalization (strip site-specific code, templatize images to picsum, clean data attributes) *(Done 2026-04-10 — `normalizeHtml()` in component-generator.ts)*
- [x] Structural hash deduplication (exact) *(Done 2026-04-10 — dedup on insert in --crawl + dedup on merge in --merge)*
- [x] Visual similarity dedup (pHash with hamming distance < 8) *(Done 2026-04-10 — `computeVisualHash()` + `hammingDistance()` + `isVisualDuplicate()` in component-generator.ts)*
- [x] Merge into component library with full metadata *(Done 2026-04-10 — `--merge` CLI command, writes to components.json with structural + visual dedup)*

### Phase 5: Continuous Pipeline + Rating Loop

- [x] Scheduled re-crawl for stale targets *(Done 2026-04-10 — `--refresh [--days N]` re-crawls targets older than N days)*
- [x] Rating-driven regeneration (low-ELO → replace with variants inspired by high-ELO) *(Done 2026-04-10 — `--regenerate-low` removes bottom 10%, queues replacements from top-rated)*
- [x] Admin API endpoints for crawl targets and pattern review *(Done 2026-04-10 — `routes/engine.ts` with GET /api/engine/targets, /sections, /patterns, /catalogue, /generated, /stats)*
- [x] Gap analysis (categories/tiers with low coverage or quality) *(Done 2026-04-10 — `--gap-analysis` shows coverage matrix + identifies missing animated/cinematic tiers)*
- [x] Single-command generation from top patterns *(Done 2026-04-10 — `--inspire --category hero --tier cinematic --count 5` queues sections from top patterns)*

### Phase 6: Smart Selection + Style Transfer

- [x] Animation briefs as few-shot examples for generation *(Done 2026-04-10 — `--inspire` uses top briefs from matching category as few-shot examples for new generation)*
- [x] Style transfer (high-rated pattern + different brand tokens/persona) *(Done 2026-04-10 — `--style-transfer --category hero --persona tech-minimal` applies different persona to top animation patterns)*
- [x] Cross-industry inspiration ("luxury brand animations → SaaS pricing page") *(Done 2026-04-10 — `--cross-industry --from fashion --to pricing --persona tech-minimal`)*
- [x] Trend detection (emerging CSS features, View Transitions API, scroll-driven animations) *(Done 2026-04-10 — `--trends` shows pattern frequency, domain spread, emerging techniques like scroll-driven/view-transitions)*
