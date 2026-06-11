# Adidas Annual Report — Component Deep Dive

## Overview

The adidas interactive annual reports (2024, 2025) are built by **nexxar**, a Vienna-based agency specializing in digital corporate reporting (founded 2003, 1000+ HTML reports published). They use a proprietary platform called **nxr** with a CMS called **nxr.edit**.

---

## Tech Stack (confirmed from source analysis)

### JavaScript Libraries (vendor.js / main.js)

| Library | Purpose | Refs (2024) | Refs (2025) |
|---------|---------|-------------|-------------|
| **GSAP** | Core animation engine | 59 | 80 |
| **ScrollTrigger** (GSAP plugin) | Scroll-driven animations | 5 | 41 |
| **Swiper** | Carousels, sliders, galleries | 271 | 300 |
| **CountUp.js** | Animated number counters | 4 | 2 |
| **Lottie** (bodymovin) | JSON-based vector animations | 5 | 7 |
| **Highcharts** | Interactive SVG data charts | 9 | 11 |
| **Velocity.js** | DOM animation (legacy, alongside GSAP) | 18 | 18 |
| **Waypoints** | Scroll position triggers | 29 | 31 |
| **IntersectionObserver** | Viewport detection for lazy load/animation triggers | 7 | 24 |

### CSS Animation Techniques

- **`will-change: transform, opacity`** — GPU-accelerated compositor animations
- **Custom @keyframes**: `bounceXDesktop`, `wrongAnswer`, `wrongAnswerBeforeElement`, `pulse`, `grain`, `gradientDesktop/Tablet`, `text-highlighter-fade-out`, `marking`, `loader-contentremote`
- **307 `.swiper` CSS rules** — extensive carousel/slider styling
- **210 `.dashboard` CSS rules** — dedicated dashboard component styling

### Asset Architecture

```
_assets/
├── js/
│   ├── nxr-bridge.js      — Platform bridge/init
│   ├── nxr-site-structure.js — Navigation/structure
│   ├── vendor.js           — Third-party libs (2024 only, merged into main.js in 2025)
│   └── main.js             — Application code + components
├── css/
│   └── main.css            — All styles (single bundle)
└── gallery/
    └── *.webp              — Optimized images with cache-busting hashes (?h=xxx)
```

### Platform Architecture

- **`window.nxr`** — Global namespace for the platform
  - `window.nxr.page` — Page config (header, path, pageId, components)
  - `window.nxr.site` — Site-wide config (language, translations)
  - Components configured via JSON in inline `<script>` tags
- **No React/Vue/Angular** — vanilla JS with custom component system
- **Progressive enhancement** — `<html class="no-js">` pattern
- **WebP images** with hash-based cache busting

---

## Interactive Components Inventory

### 1. Animated Counter Cards (KPI Metrics)

**What it does:** Financial KPIs (Net Sales, Gross Margin, Operating Profit, Employees) with numbers that count up from 0 to their target value when scrolling into view. Each card shows current year, previous year, and delta percentage.

**How it works (technical):**
- **CountUp.js** for the number animation (easing, decimal formatting, duration)
- **IntersectionObserver** or **Waypoints** to trigger when cards enter viewport
- **GSAP** for the card entrance animation (fade-up, stagger between cards)
- Delta badges animated separately with delay after counter completes

**Key parameters to replicate:**
- Counter duration: ~2s with easeOutExpo
- Number formatting: locale-aware (€, %, M suffix)
- Stagger: 150ms between cards
- Cards: fade-up with 0.6s ease-out
- Delta badge: scale + fade after 1.5s delay
- Grid: 4 columns desktop, 2 tablet, 1 mobile

### 2. Dashboard

**What it does:** Tile-based overview of key report highlights. Instagram story-inspired "snackable content" with short facts, figures, and micro-animations linking to detailed report sections.

**How it works:**
- **210 CSS rules** dedicated to dashboard
- **Swiper** for horizontal tile navigation
- **GSAP + ScrollTrigger** for entrance animations
- **Lottie** for micro-animations on tiles
- Tile cards link to deeper report pages
- Management video embeds (Plyr video player based on @keyframes references)

**Key parameters to replicate:**
- Tile grid with Swiper navigation
- Each tile: icon/number, short text, CTA link
- Micro-animations on key numbers (pulse, count-up)
- Responsive: swipeable on mobile, grid on desktop

### 3. Parallax Sections

**What it does:** Layered depth effects — background and foreground images moving at different scroll speeds. Used on hero sections and section transitions.

**How it works:**
- **GSAP ScrollTrigger** with `scrub: true`
- Multiple layers with different scroll speed multipliers
- Background: 30% scroll speed (`y: -30%`)
- Foreground: 70% scroll speed
- **Waypoints** as fallback trigger mechanism
- `will-change: transform` for GPU acceleration

**Key parameters:**
- Background layer: `speed: 0.3`, translateY
- Foreground layer: `speed: 0.7`, translateY
- Headline: fade-up on load, 1s ease-out
- CTA: fade-in with 0.8s delay

### 4. Interactive Quiz

**What it does:** 3-question multiple-choice trivia about adidas. Answers reveal instant feedback with animations. Progress tracking. Final summary with contextual links.

**How it works:**
- **38 references in main.js** — substantial custom quiz component
- **CSS @keyframes**: `wrongAnswer`, `wrongAnswerBeforeElement` — shake/flash animations for incorrect answers
- **`bounceXDesktop`** — bounce animation for correct answer celebration
- State management: question index, score, answered state
- Answer buttons with click handlers
- Transition between questions with fade/slide

**Key parameters:**
- Correct answer: green highlight + bounce animation (elastic ease)
- Wrong answer: red highlight + shake animation (@keyframes wrongAnswer)
- Next question: slide-left transition
- Progress indicator: width expansion animation
- Final screen: score summary + contextual links to report sections

### 5. ESG Pillar Cards (Environment / Social / Governance)

**What it does:** Three large image-driven cards. Full-bleed photography with overlay gradient, large typographic pillar letter (E/S/G), description, and CTA link. Hover effects lift cards.

**How it works:**
- **GSAP + ScrollTrigger** for staggered entrance
- **IntersectionObserver** for viewport detection
- CSS transforms for hover lift effect
- Background images with WebP format, mobile/desktop variants
- Gradient overlays via CSS

**Key parameters:**
- Cards: stagger fade-up, 0.8s ease-out, 200ms stagger
- Image: slight zoom (1.05x) scaling down to 1x on scroll
- Pillar letter: fade + scale-in with 0.3s delay
- Hover: translateY(-8px) + box-shadow increase, 0.3s ease
- Responsive: 3-col desktop, stacked mobile

### 6. Stage Animations (Hero/Landing)

**What it does:** Full-screen animated headers that introduce sections. Can be SVG animations, Lottie animations, or CSS gradient animations.

**How it works:**
- **Lottie** for complex vector animations (SVG-based, small file size)
- **CSS @keyframes**: `gradientDesktop`, `gradientTablet` — animated gradient backgrounds
- **@keyframes grain** — film grain texture overlay effect
- GSAP for orchestrating multi-element entrance sequences

**Key parameters:**
- Lottie animations: loaded from JSON, play on viewport enter
- Gradient animation: slow color shift, 8-15s loop
- Grain overlay: subtle noise texture via CSS animation
- Elements stagger in over 1-2s

### 7. Swiper Carousels / Galleries

**What it does:** Multiple carousel types — image galleries (12+ slides for brand highlights), content teasers, dashboard tiles.

**How it works:**
- **Swiper** (307 CSS rules, 271+ JS references)
- Multiple Swiper instances per page
- Navigation dots, arrows, autoplay
- Responsive breakpoints
- Lazy loading images

### 8. Interactive SVG Charts (Highcharts)

**What it does:** Financial data visualizations — net sales breakdowns, employee distributions, sustainability metrics. SVG-based with tooltips on hover.

**How it works:**
- **Highcharts** library (9-11 references)
- Chart types: pie, bar, line, stacked
- Interactive tooltips on hover
- Responsive sizing
- Color-coded by category
- Chart IDs follow pattern: `fr-net-sales-category-white`, `sus-employee-split-white`

### 9. Text Highlighter / Mark & Share

**What it does:** Users can select any text, then copy, mark, or share it. Context menu appears at selection point.

**How it works:**
- **`document.getSelection()` API** for text capture
- Positioned absolutely at selection coordinates
- **@keyframes text-highlighter-fade-out** — dismissal animation
- **@keyframes marking** — highlight color animation
- Self-dismissing tooltip with instruction text

### 10. Search with Power Features

**What it does:** Advanced search with operators, pagination, and animated panel transitions.

**How it works:**
- **6 custom @keyframes** for search panel: expand, shrink, fade-in, fade-out (desktop + mobile variants)
- Supports exact phrase matching (`"phrase"`)
- Chapter-based filtering
- Result navigation (next/previous hit)

---

## Why Our Crawler Misses These Components

### Problem 1: Components are JavaScript-rendered
The nxr platform renders components client-side. Crawl4ai executes JS but our **section parser** looks for semantic HTML landmarks (`<section>`, `<nav>`, `<footer>`, `<article>`). The adidas report uses deeply nested `<div>` structures with class-based component identification, not semantic tags.

### Problem 2: Interactive state isn't captured
Quiz questions, dashboard tiles, chart tooltips, and carousel slides are all **stateful components**. A static HTML snapshot only captures the initial state — not the interaction patterns, transitions, or animation behaviors.

### Problem 3: Animation definitions live in JS/CSS bundles
The actual animation behavior (GSAP timelines, ScrollTrigger configs, CountUp parameters, Lottie JSON) lives in `vendor.js`/`main.js`, not in the HTML. Our crawler extracts HTML sections but doesn't analyze the JS/CSS that powers them.

### Problem 4: Bundled architecture
Everything is in two files (`vendor.js` + `main.js` or just `main.js` in 2025). There are no per-component script tags or inline animation definitions to extract.

---

## How to Generate Faithful Recreations

### Approach: Detailed Specification Prompts

Since we can't extract these components automatically from the HTML, we need to provide **highly specific prompts** to the generation model that describe:

1. **Exact visual layout** (grid, spacing, typography hierarchy)
2. **Exact animation library and method** (GSAP ScrollTrigger with scrub, CountUp.js with easeOutExpo)
3. **Exact timing parameters** (durations, delays, stagger values, easing functions)
4. **Exact interaction states** (hover transforms, click feedback, active states)
5. **Exact responsive behavior** (breakpoints, mobile layout changes)

### Component Specifications for Generation

#### Spec 1: Animated KPI Counter Cards
```
Libraries: GSAP, ScrollTrigger, CountUp.js (or manual requestAnimationFrame counter)
Layout: 4-column CSS Grid, gap 24px, max-width 1200px centered
Each card: white bg, rounded-lg, shadow-md, padding 32px
  - Label: text-sm uppercase tracking-wide text-gray-500
  - Current value: text-4xl font-bold, animated count-up from 0
  - Previous year: text-sm text-gray-400 below
  - Delta badge: inline-flex pill, green bg for positive, red for negative
    - Shows percentage change with arrow icon
Animation:
  - Cards: gsap.from(cards, { y: 40, opacity: 0, stagger: 0.15, duration: 0.6, ease: "power2.out", scrollTrigger: { trigger: section, start: "top 80%" } })
  - Counters: start on scrollTrigger enter, duration 2s, easeOutExpo
  - Delta badges: gsap.from(badges, { scale: 0.5, opacity: 0, delay: 1.5, duration: 0.5, ease: "back.out(1.7)" })
Responsive: 4 cols → 2 cols (768px) → 1 col (480px)
```

#### Spec 2: Parallax Hero with Dual Layers
```
Libraries: GSAP, ScrollTrigger
Layout: full viewport height (100vh), overflow hidden, position relative
Layers:
  - Background: absolute, full cover, z-index 0
    - img with object-fit: cover, will-change: transform
    - gsap.to(bg, { y: "30%", ease: "none", scrollTrigger: { trigger: hero, start: "top top", end: "bottom top", scrub: true } })
  - Foreground: absolute, z-index 1, contains semi-transparent card or graphic
    - gsap.to(fg, { y: "-20%", ease: "none", scrollTrigger: { trigger: hero, start: "top top", end: "bottom top", scrub: true } })
  - Content: relative, z-index 2, centered vertically
    - Headline: text-5xl font-bold, gsap.from({ y: 30, opacity: 0, duration: 1, ease: "power3.out" })
    - Subtitle: text-xl, gsap.from({ y: 20, opacity: 0, delay: 0.3, duration: 0.8 })
    - CTA button: gsap.from({ y: 15, opacity: 0, delay: 0.6, duration: 0.6 })
Gradient overlay between bg image and content for text readability
```

#### Spec 3: Interactive Quiz Component
```
Libraries: GSAP (no external quiz lib — custom state management)
Layout: max-width 700px, centered, card-based
State: { currentQuestion: 0, score: 0, answered: false, selectedAnswer: null }
Structure:
  - Progress bar: h-1 bg-gray-200, inner div with width transition (33% → 66% → 100%)
  - Question card: bg-white rounded-xl shadow-lg p-8
    - Question number: "Question 1 of 3"
    - Question text: text-2xl font-semibold
    - Answer buttons (3): full-width, border, rounded-lg, p-4, hover:bg-gray-50
  - Feedback: appears after click
    - Correct: green bg, checkmark icon, "Correct!" text, bounce animation
    - Wrong: red bg, X icon, shake animation (@keyframes: translateX -10px → 10px → 0)
  - "Next Question" button: appears after answering, accent color
  - Final screen: score display, contextual links to related content
Animations:
  - Question entrance: gsap.from(card, { y: 30, opacity: 0, duration: 0.5 })
  - Answer buttons: stagger fade-in, 100ms apart
  - Correct feedback: gsap.from(feedback, { scale: 0.5, duration: 0.4, ease: "elastic.out(1, 0.5)" })
  - Wrong feedback: CSS @keyframes shake { 0%,100% { transform: translateX(0) } 25% { translateX(-10px) } 75% { translateX(10px) } }
  - Progress bar: transition width 0.5s ease-in-out
```

#### Spec 4: ESG Pillar Cards
```
Libraries: GSAP, ScrollTrigger
Layout: 3-column CSS Grid, gap 24px, max-width 1200px
Each card: position relative, overflow hidden, rounded-xl, min-height 500px
  - Background image: absolute, full cover, object-fit cover
    - gsap.from(img, { scale: 1.1, duration: 1.2, ease: "power2.out", scrollTrigger })
  - Gradient overlay: absolute, linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 60%)
  - Content (bottom-positioned): relative, z-index 2, padding 32px
    - Pillar letter: text-8xl font-black opacity-20, absolute top-right
      - gsap.from({ scale: 0.5, opacity: 0, delay: 0.3, duration: 0.6 })
    - Heading: text-2xl font-bold text-white
    - Description: text-sm text-gray-200, 2-3 lines
    - CTA link: text-white underline, hover:opacity-80
  - Hover effect: transform translateY(-8px), shadow-2xl, image brightness(1.1)
    - transition: all 0.3s ease
Scroll animation:
  - gsap.from(cards, { y: 60, opacity: 0, stagger: 0.2, duration: 0.8, ease: "power2.out", scrollTrigger: { trigger: section, start: "top 75%" } })
Responsive: 3 cols → 1 col stacked (768px)
```

#### Spec 5: Dashboard Tiles
```
Libraries: Swiper, GSAP, Lottie (optional)
Layout: Swiper carousel, 3 slides visible desktop, 1.2 mobile (peek effect)
Each tile: bg-white rounded-xl shadow-md p-6, min-height 250px
  - Icon or Lottie animation: 48x48, top of card
  - Metric number: text-3xl font-bold, optional CountUp animation
  - Label: text-sm text-gray-500
  - Short insight: text-sm, 2 lines max
  - CTA: "Read more →" link at bottom
Swiper config:
  - slidesPerView: 3, spaceBetween: 24, pagination: true
  - breakpoints: { 768: { slidesPerView: 2 }, 480: { slidesPerView: 1.2 } }
  - autoplay: { delay: 5000, disableOnInteraction: true }
Animations:
  - Tiles entrance: stagger fade-up on scroll
  - Numbers: CountUp on viewport enter
  - Micro-animation: subtle pulse on icon (CSS @keyframes pulse)
```

#### Spec 6: Lottie Stage Animation
```
Libraries: Lottie (bodymovin)
Layout: full-width section, min-height 60vh, centered content
  - Lottie container: max-width 600px, centered
    - Load JSON animation file
    - Play when section enters viewport (IntersectionObserver)
    - Loop: false (play once) or true for ambient
  - Heading below animation: text-4xl font-bold
  - Subtitle: text-lg text-gray-600
Alternative (no Lottie): CSS gradient animation
  - @keyframes gradientShift { 0% { background-position: 0% 50% } 50% { background-position: 100% 50% } 100% { background-position: 0% 50% } }
  - background-size: 200% 200%, animation: gradientShift 8s ease infinite
  - Optional: grain overlay with @keyframes grain for texture
```

---

## Generation Review — What Went Wrong (April 11, 2026)

### Problem 1: Persona Style Pollution

The component engine assigns a **random persona** (e.g. "gothic-revival", "cottagecore-digital", "organic-biomorphic") to each component. These personas inject their own color palettes and aesthetic rules that completely override the adidas brand identity.

**Generated components had:**
- Stats section: amber/gold palette (Gothic persona)
- Hero 1: rose/purple/teal palette (Organic persona)
- Hero 2: cyan/violet palette (Cyberpunk persona)
- Features: slate/nautical palette with "Nautical" text references
- Cards: random organic/nature themes

**adidas actual palette (from CSS analysis):**
- Primary: `#000` (black), `#fff` (white)
- Accent: `#6aabcf` (soft blue — 238 occurrences, dominant brand color)
- Secondary: `#00b2ff` / `hsl(198,100%,50%)` (bright blue)
- Grays: `#898a8d`, `#525355`, `#242424`, `#373738`, `#1b1c1c`
- Error: `#581616` (dark red)
- Overall: **monochrome + blue accent, corporate, clean**

**Root cause:** The `generateAutoSpec` function in the component engine randomly picks a persona. When we want faithful recreations, the persona system fights against the target brand.

### Problem 2: Generic Rather Than Specific

Despite the detailed specs, the LLM treated them as general guidance rather than exact instructions. The generated components look like "a stats section" or "a hero section" with some animations — not specifically like the adidas Annual Report components.

**What's missing vs the real adidas site:**
- No year-over-year comparison layout in stats (just generic numbers)
- Quiz doesn't match the specific 3-question adidas trivia format
- ESG cards don't have the distinctive large E/S/G letterforms
- No adidas-specific typography (the report uses a clean sans-serif, likely their corporate font)
- Dashboard tiles don't have the Instagram-story snackable feel

### Problem 3: `source.domain` Not Saved

The generated components have `source.domain: "unknown"` instead of `"report.adidas-group.com"`. This is because the `buildComponentEntry` function in the SDK maps from the raw section's `sourceDomain` field, but our manually-seeded sections used a different field path than what the builder expects.

### adidas Actual Color Palette (extracted from main.css)

| Color | Hex | Usage |
|-------|-----|-------|
| Black | `#000` | Primary text, backgrounds (260 refs) |
| White | `#fff` | Cards, text on dark (453 refs) |
| Brand Blue | `#6aabcf` | Accent, links, highlights (238 refs) |
| Bright Blue | `#00b2ff` | CTA, interactive elements |
| Dark Gray | `#242424` / `#1b1c1c` | Section backgrounds |
| Mid Gray | `#525355` / `#898a8d` | Secondary text |
| Light Gray | `#c1c1c4` / `#d4d4d4` / `#d9d7da` | Borders, dividers |
| Error Red | `#581616` | Wrong answers, negative deltas |

---

## Next Actions

### Action 1: Force adidas brand colors in specs (no persona)

The generation prompt must explicitly specify:
- Use ONLY black (#000), white (#fff), brand blue (#6aabcf / #00b2ff), and grays
- NO random persona colors — override the persona system
- Typography: Inter or system sans-serif, clean corporate weight hierarchy
- The component engine needs a way to pass `persona: "none"` or a custom color override

### Action 2: Make specs even more prescriptive

Instead of describing what the component should be, provide near-complete HTML structure with only the animation JS left to generate. Include:
- Exact Tailwind classes for every element
- Exact hex colors where Tailwind doesn't match
- Exact content text (the actual adidas data)
- Let the LLM focus only on the GSAP/animation implementation

### Action 3: Fix source.domain tracking

Update `seed-adidas-components.ts` to ensure the `sourceDomain` field maps correctly to `source.domain` in the generated component entry.

### Action 4: Consider screenshot-guided generation

Capture screenshots of the actual adidas report components and use vision-capable models (Kimi K2.5 supports vision) to generate HTML that matches the visual reference. This would be the most faithful approach — "make it look exactly like this screenshot."

### Action 5: Skip persona system for manual specs

Add a `--no-persona` flag or `_persona: "none"` field in seeded sections that tells `generateAutoSpec` to skip persona assignment and use the colors/style from the spec directly.

---

## Screenshot-Guided Generation — Results (April 11, 2026)

### Approach

Used Kimi K2.5 vision: sent actual screenshots of the adidas report components + explicit prompts with adidas color palette constraints. Bypassed the persona system entirely. Components saved directly to `generated_components` via `scripts/generate-from-screenshots.ts`.

### Side-by-Side Comparison

| Component | Match Quality | What Works | What's Missing |
|-----------|-------------|------------|----------------|
| Dashboard Tiles | Good | 3-col layout, KPI overlay, CTA buttons, dark bg, correct colors | Gradients too flat vs real photography, bottom row cards empty |
| World Map Stats | Partial | Numbers + blue color correct, regional labels positioned, SEGMENTS button | Missing the SVG world map outline behind numbers, image cards are solid blocks |
| Split Panel Hero | Strong | 3-panel gaps, gold "ANNUAL REPORT 2025" title, bottom nav pills, top nav | Gradient placeholders (expected), very faithful overall |
| Interactive Quiz | Good | Layout matches (title top, Q right, image left), A/B/C dark bars correct | Missing "Q U I Z" spaced letters at top, pagination dots, wrong logo |
| SVG Line Chart | Strong | Two data series with markers, decorative circle, black bg, nav pills | Blue line solid instead of dashed, very close |
| Text Marquee | Good | "OUR BRAND" heading, "YOU GOT THIS" repeating marquee, teal gradient | Section too short, missing blurred photography feel, font style differs |

### Key Finding

Screenshot-guided generation produces **significantly better results** than text-only specs:
- Color palette is correct (no persona pollution)
- Layouts match the originals
- Component structure is faithful
- Main gaps are photographic fidelity (expected with placeholder gradients) and small detail misses

### Remaining Gaps

1. **Photography placeholders** — gradients can't replicate real photos, cards look flatter
2. **Missing fine details** — pagination dots, specific decorative elements, exact typography
3. **Scroll state not captured** — components have scroll-triggered animation states we're not seeing

---

## The Scroll State Capture Problem

The adidas report uses extensive **scroll-driven animations** (GSAP ScrollTrigger, Waypoints, IntersectionObserver). Components have multiple visual states:

1. **Pre-scroll (hidden)** — elements haven't entered viewport, may be invisible/off-screen
2. **Entry animation (transitioning)** — elements are mid-animation (fading in, counting up, sliding)  
3. **Resting state (complete)** — animation has finished, component is fully visible
4. **Interactive state** — hover effects, clicked quiz answers, active dashboard tiles
5. **Scroll-scrub state** — parallax positions that change continuously with scroll

A single screenshot only captures ONE of these states. The headless browser scroll-and-capture approach misses the animation journey.

### Proposed Solutions for Multi-State Capture

#### Solution 1: Sequential Scroll Capture (Filmstrip)

Capture 5-10 screenshots of the same component at different scroll positions to create a "filmstrip" showing the animation progression:

```
1. Scroll component to just below viewport (pre-entry state)
2. Scroll to trigger point (entry starts) — capture
3. Scroll 25% through animation — capture
4. Scroll 50% through — capture
5. Scroll to resting state — capture
6. Hover over interactive elements — capture
```

Pass ALL screenshots to the vision model as a sequence: "This component animates through these states as the user scrolls. Recreate the full animation cycle."

**Pros**: Captures the animation journey, LLM sees the before/during/after
**Cons**: More API tokens (multiple images), LLM needs to understand temporal sequence

#### Solution 2: Screen Recording → Keyframe Extraction

Use Playwright's `page.video()` to record a screen capture while scrolling past the component, then extract keyframes:

```typescript
const context = await browser.newContext({ recordVideo: { dir: outDir, size: { width: 1440, height: 900 } } });
const page = await context.newPage();
// ... scroll through component slowly ...
await context.close(); // saves video
// Use ffmpeg to extract frames at 1fps
// exec: ffmpeg -i video.webm -vf fps=1 frame-%03d.png
```

Then send the keyframes to the vision model as a sequence.

**Pros**: Captures exact animation timing and easing, no missed states
**Cons**: Requires ffmpeg, larger file processing, more complex pipeline

#### Solution 3: Programmatic Scroll Position Control

Instead of relying on CSS/JS animations triggering naturally, use Playwright to:
1. Pause all animations (`document.getAnimations().forEach(a => a.pause())`)
2. Manually set ScrollTrigger progress via `ScrollTrigger.getAll().forEach(st => st.scroll(position))`
3. Capture at specific progress values (0%, 25%, 50%, 75%, 100%)

```typescript
await page.evaluate(() => {
  // Pause and scrub ScrollTrigger animations
  const triggers = ScrollTrigger.getAll();
  triggers.forEach(st => { st.scroll(st.start); }); // beginning state
});
await page.screenshot({ path: "state-0.png" });

await page.evaluate(() => {
  ScrollTrigger.getAll().forEach(st => { st.scroll(st.start + (st.end - st.start) * 0.5); });
});
await page.screenshot({ path: "state-50.png" });
```

**Pros**: Precise control over animation state, reproducible
**Cons**: Requires ScrollTrigger to be accessible globally (may be scoped/bundled), brittle with different sites

#### Solution 4: CSS Computed Style Extraction

Instead of screenshots, extract the computed CSS of each animated element at different scroll positions:

```typescript
const styles = await page.evaluate(() => {
  const el = document.querySelector('.animated-card');
  const cs = getComputedStyle(el);
  return { opacity: cs.opacity, transform: cs.transform, color: cs.color };
});
```

Capture styles at pre-animation, mid-animation, and post-animation states. Feed these as text data alongside a single screenshot to tell the LLM exactly what properties animate and what the start/end values are.

**Pros**: Precise animation parameters, lightweight, works with any site
**Cons**: Need to identify which elements animate (complex on unknown sites)

#### Solution 5: Hybrid — Screenshot + Animation Metadata

Combine a resting-state screenshot with extracted animation data:

1. Take one high-quality screenshot of the completed state
2. Extract all GSAP ScrollTrigger instances and their config:
   ```typescript
   const triggers = await page.evaluate(() => {
     return ScrollTrigger.getAll().map(st => ({
       trigger: st.trigger?.className,
       start: st.start, end: st.end,
       animation: st.animation?.data, // GSAP timeline data
     }));
   });
   ```
3. Send screenshot + animation config JSON to the vision model

**Pros**: Best of both worlds — visual reference + exact animation parameters
**Cons**: GSAP internals may not be easily serializable, site-specific

### Recommended Approach

**Start with Solution 1 (Filmstrip)** — it's the simplest to implement and gives the LLM the most visual context. For each component:
- Take 3-5 screenshots at different scroll positions
- Pass all images to Kimi K2.5 vision in a single request
- Include a text description: "These screenshots show the animation sequence as the user scrolls. Image 1 is before entry, Image 2-3 are during animation, Image 4 is the resting state."

If filmstrip quality isn't enough, upgrade to **Solution 5 (Hybrid)** by adding extracted GSAP config data alongside the screenshots.

---

## Fidelity Gap Analysis — April 12, 2026

Measured `redesign-adidas-v6.html` against the live `report.adidas-group.com/2024/en/` to quantify where the pipeline currently stands.

### Structural metrics

| | Original | Generated (v6) |
|---|---|---|
| Page height | 29,726px | 9,210px (≈31%) |
| Sections | 13 | 7 |
| Images | 11 (curated brand) | 24 (Picsum random) |
| Videos | **12** | 0 |
| Animation engine | none visible (server-rendered) | GSAP — 23 ScrollTriggers, 2 pinned |
| Fonts | AdihausDIN, adineuePRO, adidasFG | Tailwind system defaults |
| Background / text | `#000` / `#000` editorial | `#fff` / `#000` corporate |

### Frame-by-frame

- **Hero (0%)** — Original: triptych of high-contrast athlete videos with "2024" floor-anchored typography. Ours: muted grey seagull stock photo, small header. Gap: no brand video assets, no editorial typography.
- **25%** — Original: full-bleed football huddle video. Ours: card grid + "Shareholder Information" heading. Ours is informational, theirs is cinematic storytelling.
- **50%** — Original: 3-up athlete montage (goalkeeper, runner, basketball). Ours: Financial Review header with counters stuck at 0 (pre-trigger state captured).
- **75%** — Original: sustainability manifesto in giant brand type on pure black. Ours: filled financial dashboard (€23.70B / €1.30B / €1.10B / €5.82 + regional split EMEA 42% / NA 28%) — **this is actually strong**, real extracted data, real chart components.

### What we nailed
- Real extracted financial data (€23.70B revenue, +12%, regional splits)
- Working stat/chart components at resting state
- 23 ScrollTriggers with adaptive pin gating (pin only when content fits viewport — see `section-parser.ts` fix, April 12)
- Section-level cinematic gating, once-on-entry animations

### What's missing
1. **No video assets** — original is 60% video storytelling; we don't fetch, serve, or reference source videos.
2. **Wrong color palette** — we extracted white bg; original is black editorial. Brand-color extractor picks wrong primary on image-dominated sites.
3. **Wrong typography** — original uses AdihausDIN/adineuePRO; we use Tailwind defaults. No brand font fetching.
4. **3× too short** — 9.2k vs 29.7k px; 7 vs 13 sections. Half the content depth.
5. **Stock imagery** — 24 Picsum-random vs 11 curated brand shots.
6. **Duplicated `<title>`** — stitches title N times across sections (cosmetic bug).

---

## Roadmap to Close the Gap

Ranked by impact per hour. Tiers 1+2 get us ~70% of the visual gap closed.

### Tier 1 — Ship first (1–2 days, biggest visual leverage)

| # | Task | Why | Effort | Status |
|---|---|---|---|---|
| T1.1 | **Asset passthrough** — keep top 10 source `<img>`/`<video>` URLs from crawl, pass into section prompt as `sourceAssets`, instruct model to use verbatim in hero/gallery/parallax slots | Eliminates the Picsum-random-image look. Single biggest visual win. | M | ✅ **Done 2026-04-13** |
| T1.2 | **Brand color extractor fix** — count occurrence frequency across all CSS rules, exclude reset/normalize, weight by selector specificity. Target: recover `#6aabcf` as dominant for Adidas. | Fixes the generic white-corporate look vs editorial black. | S | ✅ **Already correct** — verified in 2026-04-12 e2e (`primary=#6aabcf`, see Implementation Log) |
| T1.3 | **Font detection** — parse `@font-face { font-family }` from stripped CSS, inject as `extractedDesign.fonts`, reference by name in prompts. | Adds brand typography fingerprint even when fonts can't be self-hosted. | S | ⏳ Pending |
| T1.4 | **Persona bypass for URL redesigns** — add `persona: "brand-faithful"` that uses only the extracted palette and skips random aesthetic rules (already prescribed above, line 416). | Stops persona pollution fighting the brand identity. | S | ⏳ Pending |

### Tier 2 — Next (structural fidelity, ~3–5 days)

| # | Task | Why | Effort | Status |
|---|---|---|---|---|
| T2.1 | **Seed 5 missing cinematic components** via screenshot-guided generation: CountUp KPI cards, Interactive Quiz, ESG pillar cards with letterforms, Dashboard Swiper, Highcharts-style data panel | Closes specific component inventory gaps from sections 1–8 above. Becomes library-wide, not just Adidas. | M | ✅ **Done 2026-04-12** |
| T2.2 | **Raise section cap from 10 → 15 for cinematic mode**, let the model generate the full scroll journey | Recovers depth (9k → ~15k+ px). Cost: ~50% more Kimi calls per redesign. | S | ✅ **Done 2026-04-12** |
| T2.3 | **Fix duplicated `<title>` tag** in section assembly | Cosmetic but visible in browser tab / social shares. | XS | ✅ **Done 2026-04-12** |

### Tier 3 — Last 20% (high effort, diminishing returns)

| # | Task | Why | Effort |
|---|---|---|---|
| T3.1 | **Screenshot-guided per-section generation** (Solution 1 filmstrip above) — filmstrip each detected source section, send to Kimi vision, regenerate with visual reference | Currently we only do screenshot briefs at page level, not per section. Near-pixel fidelity. | L |
| T3.2 | **Video pipeline** — proxy source `<video>` through storage, generate sections with `<video>` elements, handle CORS | Original is 60% video; without this, editorial storytelling sections will always feel flat. | L |
| T3.3 | **Hybrid GSAP metadata extraction** (Solution 5) — serialize ScrollTrigger configs from the live site and pass as animation hints | Faithful animation timing, not just visual reference. | L |

### Recommended sequence

1. **T1.1 Asset passthrough** — validates fastest on the same Adidas URL, no pipeline rewiring
2. **T1.2 Color + T1.3 Font + T1.4 Persona bypass** — batch together, all touch the same extraction/prompt surface
3. Re-run E2E on Adidas, capture new frame comparison, measure delta
4. **T2.1 Component seeding** — parallel-izable, doesn't block anything
5. **T2.2 Depth** + **T2.3 Title fix** — quick cleanup
6. Re-measure. If still short of target, escalate to Tier 3.

**Estimated**: Tier 1 finished end-of-week → generated sites look recognizably adidas-shaped. Tier 2 finished next week → structural component match. Tier 3 only if stakeholder asks for pixel fidelity.

---

## Implementation Log — April 12–13, 2026

Tracks each roadmap item as it ships. Each entry: what changed, where, how it was verified.

### 2026-04-12 — Adaptive pin gating (post-Tier roadmap, blocking content-clip bug)

**Problem**: dense sections (Executive Board, Financial Statements, Shareholder Information) were rendering with content clipped below the fold because their pinned `h-screen` containers froze scroll before the user could reach the bottom of the section.

**Fix**: in [section-parser.ts:725](../packages/sdk/src/utils/section-parser.ts#L725), the post-processor that splits pin+scrub timelines now wraps each pin trigger in a runtime guard:

```js
(function(){var __el=document.querySelector(TRIGGER);if(__el&&__el.scrollHeight<=window.innerHeight*1.05){ScrollTrigger.create({...pin:true...});}})();
```

Sparse sections (hero, fin-highlights) still get cinematic pin gating; dense sections detect their own overflow at runtime and skip the pin entirely so natural scroll reveals all content.

**Verified**: patched the existing `redesign-adidas.html` and ran a screenshot test. 7 pin gates were guarded, 5 dense sections (leadership/shareholder/mgmt/glance/finrev) correctly skipped, 2 sparse sections (hero/fin-highlights) kept their pins. Executive Board cards and Shareholder data both visible across all scroll states.

### 2026-04-12 — T2.1 Seed 5 missing cinematic components

**Files**: [scripts/generate-cinematic-components.ts:272-302](../scripts/generate-cinematic-components.ts#L272-L302) (specs), [scripts/components-cinematic.json](../scripts/components-cinematic.json) (output)

**Added specs:**
- `kpi-countup-cards` — Animated KPI counter cards with year-over-year deltas (CountUp.js pattern via gsap.to onUpdate)
- `interactive-quiz` — 3-question multiple-choice trivia with progress bar, bounce/shake feedback, final score
- `esg-pillar-letterforms` — Three full-bleed image cards with oversized translucent E/S/G letterforms, staggered reveal, image zoom
- `dashboard-swiper-tiles` — Instagram-story dashboard Swiper with KPI tiles, peek-effect responsive
- `highcharts-data-panel` — Two-column financial dashboard with inline SVG donut chart and animated bar chart

**Generation**: ran `npx tsx scripts/generate-cinematic-components.ts --only $id` for each spec. All 5 succeeded with Kimi K2.5:

| Component | Size | Time |
|---|---|---|
| `cine-kpi-countup-cards` | 7 KB | 27s |
| `cine-interactive-quiz` | 16 KB | 84s |
| `cine-esg-pillar-letterforms` | 8 KB | 31s |
| `cine-dashboard-swiper-tiles` | 12 KB | 146s |
| `cine-highcharts-data-panel` | 10 KB | 32s |

**Library size**: 25 → 30 cinematic components.

### 2026-04-12 — T2.2 Raise section cap to 15 for cinematic mode

**Files**: [section-parser.ts:116-117](../packages/sdk/src/utils/section-parser.ts#L116-L117), [redesign.ts:767](../packages/sdk/src/models/redesign.ts#L767), [section-generator.ts:557](../packages/sdk/src/models/section-generator.ts#L557)

**Change**: `parseSections()` now accepts `{ maxSections?: number }`. Default stays at 10. Two call sites bump to 15:
- `redesign.ts:767` — quick text sniff on fetched HTML for cinematic library signals (`gsap|ScrollTrigger|locomotive|framer-motion|lottie`)
- `section-generator.ts:557` — uses the explicit `premiumScroll` flag

The content-budget calculation in the cap also became dynamic so nav/hero/footer slots aren't double-counted.

### 2026-04-12 — T2.3 Fix duplicated `<title>` tag

**Files**: [section-parser.ts:644](../packages/sdk/src/utils/section-parser.ts#L644)

**Bug observed**: Adidas redesign produced `<title>adidas Annual Report 2024 - adidas Annual Report 2024 - adidas Annual Report 2024 - adidas Annual Report 2024</title>` (4× repeat).

**Fix**: added `cleanPageTitle(title, brandName)` helper that splits on `-` / `|` / `—`, dedupes case-insensitively, and only appends `brandName` if it's not already present in the deduped result. Used in `assembleSections` at the `<title>` template line.

### 2026-04-12 — Brand color extractor verified working (T1.2 turned out to be a non-issue)

**Re-checked**: ran a fresh redesign of `report.adidas-group.com` (task `bik8j4xns`, 2026-04-12 23:02). Brand extractor correctly identified:

```
[brand-extractor] Brand colours (by freq): #6aabcf(494)
[brand-extractor] Primary: #6aabcf, Secondary: #581616, Accent: #00b2ff
```

Compared against the source-of-truth palette in this doc (Brand Blue `#6aabcf` 238 refs, Bright Blue `#00b2ff`, Error Red `#581616`) — **the extractor was already correct**. The "white background" finding from the original Fidelity Gap Analysis was against an older `/tmp/redesign-adidas.html` artifact generated before recent extractor improvements landed; the live pipeline has been picking the right palette for some time.

**T1.2 marked as already done** in the Roadmap table above.

### 2026-04-13 — T1.1 Source image / video passthrough

**New file**: [packages/sdk/src/utils/source-image-extractor.ts](../packages/sdk/src/utils/source-image-extractor.ts)

Mines `<img src>`, `<img srcset>`, `<video src>`, `<source src>`, and CSS `background-image: url(...)` from crawled HTML. Filters out:
- `data:` URIs
- Tracking pixels and 1×1 spacers
- Favicons, sprites, icons
- Tiny images (declared width/height < 100)
- HTML-encoded malformed quote URLs (`&quot;`-leaked)

Resolves relative paths to absolute via `URL(src, baseUrl)`. Decodes HTML entities. Ranks remaining candidates by:
- declared width ≥ 800 (+4) / ≥ 400 (+2) / < 100 (−5)
- declared height ≥ 600 (+3) / ≥ 300 (+1) / < 100 (−3)
- alt text length ≥ 8 (+2)
- path keyword hits (`/gallery/`, `/upload/`, `/asset/`, `/media/`, `/cms/`, `/photo/`, `/banner/`, `/hero/`, `/story/`) (+3)
- WebP/JPG/PNG file extension (+1)

Returns top 20 images and top 6 videos.

**Threading**: `fetchedContent.sourceImages` and `fetchedContent.sourceVideos` added to the type at all the boundary surfaces:
- [redesign.ts:640](../packages/sdk/src/models/redesign.ts#L640) — type
- [redesign.ts:767-784](../packages/sdk/src/models/redesign.ts#L767) — `planRedesign` populates via `extractSourceAssets(rawHtml, url)`
- [section-generator.ts:356, 535](../packages/sdk/src/models/section-generator.ts#L356) — accepts in `generatePage` / `generatePageSectioned`
- [project.ts:303, 313, 326](../packages/sdk/src/models/project.ts#L303) — type chain

**Distribution helper**: [section-generator.ts](../packages/sdk/src/models/section-generator.ts) `sectionSourceImages(pool, role, index)`:
- `nav` / `footer` → no images (those slots shouldn't use brand photography)
- `hero` → top 3 best-ranked images
- everything else → rotating window of 6, starting at `index*4 % pool.length`

**Prompt injection**: [section-generator.ts](../packages/sdk/src/models/section-generator.ts) `buildSectionPrompt`:
- `<source-images>` block added to the user message: `"Use these EXACT URLs in <img src='...'> attributes — do NOT replace them with picsum, do NOT modify them"`
- Hero and content `roleHints` conditionally swap their picsum lines for "use the source-images" pointers when assets are available

**System prompt update**: [prompts.ts:142-146](../packages/sdk/src/utils/prompts.ts#L142) — `<imagery>` block in `SECTION_GENERATE_CINEMATIC_SYSTEM` now teaches the model to prefer `<source-images>` URLs verbatim and only fall back to picsum when no block is present.

**Verified live on Adidas** — extracted 20 brand `.webp` images and 6 brand `.mp4` videos:

```
1. /_assets/gallery/home-dashboard-bg.webp
2. /_assets/gallery/home-dashboard-fg.webp
3-8. /_assets/gallery/home-purpose-{1,2,3}{,--mobile}.webp
9-14. /_assets/gallery/home-brand-{1,2,3}{,--mobile}.webp
15-20. /_assets/gallery/home-values-{1,2,3}{,--mobile}.webp

Videos:
1. /_assets/videos/hero-movie.mp4
2. /_assets/videos/hero-movie--mobile.mp4
3. /_assets/videos/home-ceo-short.mp4
4. /_assets/videos/home-ceo.mp4
5. /_assets/videos/home-our-results.mp4
6. /_assets/videos/home-people.mp4
```

These are the exact brand assets adidas uses for hero/dashboard/values storytelling — the "12 videos" gap from the Fidelity Gap Analysis is now wired (videos extracted; the model just needs to be taught to consume them, see Pending below).

**Bug fixed during verification**: extractor was leaking malformed URLs containing `&quot;` because some `<img>` tags in nexxar-built reports use HTML-encoded quotes inside src attributes. Added `decodeEntities()` and a hard-reject filter for any URL still containing quote chars after decoding. Re-tested and all 20 URLs are clean.

**Container**: rebuilt and recreated `canvas-ai-api-server` 2026-04-13 with all of the above. SDK typecheck clean.

### Pending verification

- **End-to-end**: a fresh Adidas redesign post-rebuild to confirm `<source-images>` block actually flows into Kimi prompts and the generated HTML uses real `home-dashboard-bg.webp` etc instead of picsum. The 5 e2e runs from 2026-04-12 (latest at 23:02) all completed before the rebuild, so none of them carry the new code.
- **Video consumption**: extractor populates `fetchedContent.sourceVideos`, but the prompt builder doesn't currently inject them. Hero `roleHint` should be taught to emit `<video autoplay muted loop>` when sourceVideos is non-empty and the section is a hero. Small follow-up.

### Updated roadmap status

| Tier | Item | Status |
|---|---|---|
| T1.1 | Asset passthrough | ✅ shipped 2026-04-13 (images), video injection still pending |
| T1.2 | Brand color extractor | ✅ already correct (verified 2026-04-12) |
| T1.3 | Font detection | ⏳ next |
| T1.4 | Persona bypass | ⏳ next |
| T2.1 | 5 missing components | ✅ shipped 2026-04-12 |
| T2.2 | Section cap 10→15 | ✅ shipped 2026-04-12 |
| T2.3 | Title dedup | ✅ shipped 2026-04-12 |
| T3.* | Tier 3 items | unscheduled |

**Net effect on the gap**: of the 6 ranked gaps in the Fidelity Gap Analysis (videos, colors, fonts, persona, components, depth), **3 are closed** (colors, components, depth), **1 is half-closed** (assets — images shipped, videos pending), **2 remain** (fonts, persona). Title bug fixed as a bonus. Adaptive pin gating bonus-fix shipped to address the content-clip regression discovered while iterating on the Tier 2 work.

---

## Sources

- [nexxar — expertise](https://www.nexxar.com/expertise.html)
- [nexxar — what we offer](https://nexxar.com/what-we-offer.html)
- [nexxar — adidas AR22 case study](https://nexxar.com/cases/adidas-ar22.html)
- [nexxar — Deutsche Telekom AR24](https://www.nexxar.com/cases/deutsche-telekom-ar24.html)
- [nexxar — HUGO BOSS AR23](https://nexxar.com/cases/hb-ar23.html)
- [nexxar lab — stage animations](https://lab.nexxar.com/stage-animations/)
- [nexxar lab — digital storytelling](https://lab.nexxar.com/digital-storytelling-in-online-reports/)
- [nexxar lab — technology archive](http://lab.nexxar.com/category/reporting-technology/)
- [Smashing Magazine — CSS Scroll-Driven Animations](https://www.smashingmagazine.com/2024/12/introduction-css-scroll-driven-animations/)
- [Codrops — Scroll-Driven Animations](https://tympanus.net/codrops/2024/01/17/a-practical-introduction-to-scroll-driven-animations-with-css-scroll-and-view/)
- [Chrome Dev — NRK Scroll-Driven Case Study](https://developer.chrome.com/blog/nrk-casestudy)
- Source analysis: `report.adidas-group.com/2024/en/_assets/js/vendor.js`, `main.js`, `main.css`
- Source analysis: `report.adidas-group.com/2025/en/_assets/js/main.js`, `main.css`
