# Source Component Selection — Visual Component Extraction from URLs

## Concept

Enter a URL, see the full rendered page in the UI, click on individual sections/components to extract their HTML + CSS, and save them as skeletons or directly into the component library.

```
User enters URL → Backend renders page → Screenshot + section map returned
→ User sees page with clickable section overlays → Clicks a section
→ Backend extracts that section's HTML + scoped CSS + assets
→ User can save as skeleton, enhance with CSS-only mode, or add to library
```

---

## Approach Comparison

### 1. Iframe with Overlay (Client-Side Only)

Load the target URL in an iframe, inject JS to detect sections, render clickable overlays.

| | |
|---|---|
| **Verdict** | **Not viable** |
| **Why** | ~70-80% of production websites block framing via `X-Frame-Options: DENY` or `CSP: frame-ancestors 'none'`. Cross-origin iframes block all DOM access — you cannot read elements, bounding boxes, or extract HTML. A CORS proxy workaround breaks relative URLs, cookies, auth, and any JS that checks `window.location`. |

### 2. Playwright Server-Side (Recommended)

Headless Chromium renders the page server-side. Full DOM access, no CORS issues.

| | |
|---|---|
| **Verdict** | **Best approach — recommended for Atelier** |
| **Works with** | Any URL, JS-rendered SPAs, scroll-triggered lazy content |
| **Resources** | ~100-300MB RAM per browser instance, 2-10s per page load |
| **Maturity** | Playwright has 70k+ stars, production-grade, active development |

**Key Playwright capabilities for this feature:**
- `page.screenshot({ fullPage: true })` — full-page screenshot
- `page.evaluate()` — run arbitrary JS in the page context (full DOM access)
- `element.boundingBox()` — pixel-precise coordinates of any element
- `element.evaluate(el => el.outerHTML)` — extract HTML of a specific section
- `page.evaluate(() => getComputedStyle(el))` — extract computed CSS
- Network interception for cataloging assets (fonts, images, SVGs)
- Can simulate scrolling to trigger lazy-loaded/animated content before capture

### 3. Crawl4ai as Proxy

Crawl4ai (63k+ stars) uses Playwright under the hood. Already in our stack.

| | |
|---|---|
| **Verdict** | **Good for HTML extraction, but not for the visual interaction layer** |
| **Why** | Crawl4ai returns rendered HTML and can take screenshots, but doesn't return bounding box coordinates. We'd need custom Playwright scripts anyway for the visual overlay. Adds an unnecessary abstraction layer for this use case. |
| **Where it fits** | Could be used as a fallback for the initial page fetch if Playwright isn't available directly. |

---

## Recommended Architecture

### Phase 1: Capture (Backend)

```
POST /api/engine/capture { url: "https://example.com" }
```

1. Playwright launches headless Chromium
2. Navigates to URL, waits for network idle + 2s for animations
3. Slow-scrolls the full page to trigger lazy content
4. Scrolls back to top
5. Takes full-page screenshot (`page.screenshot({ fullPage: true })`)
6. Runs `page.evaluate()` to:
   - Find all top-level semantic sections (`section, header, nav, main, footer, article, aside`)
   - Fall back to direct children of `<body>` with significant height (>100px)
   - For each: get `getBoundingClientRect()`, tag name, text preview, class names
   - Assign unique data-attribute IDs
7. Returns: `{ screenshot: base64PNG, pageHeight, sections: [{ id, tag, bbox: {x,y,w,h}, classes, textPreview }] }`

### Phase 2: Display (Frontend)

1. Render the screenshot as a scrollable image
2. Overlay transparent divs positioned at each section's bounding box
3. On hover: highlight with border + label (tag name, class hint)
4. On click: show section detail panel

### Phase 3: Extract (Backend, on-demand per section)

```
POST /api/engine/extract { url, sectionId }
```

1. Playwright re-loads the page (or reuses session)
2. Locates the element by the assigned ID
3. Extracts `outerHTML`
4. Extracts scoped CSS:
   - Walk `document.styleSheets`
   - For each rule, check if any element in the section subtree matches (`el.matches(selector)`)
   - Collect only matching rules
   - Rewrite selectors to be scoped (prefix with wrapper class)
5. Resolves all asset URLs to absolute paths
6. Detects animation libraries used (GSAP, ScrollTrigger, Swiper, CSS keyframes)
7. Returns: `{ html, css, animations: [], assets: [], libs: [] }`

### Phase 4: Save

User can:
- **Save as skeleton** → writes to `scripts/skeletons/<name>.html` with the extracted HTML + CSS + detected animation scripts
- **Enhance immediately** → sends to CSS-only enhance with brand colors
- **Add to generated_components** → saves to MongoDB for review in `#/review`

---

## Technical Challenges and Solutions

### CSS Isolation (Medium difficulty)

**Problem:** A section's appearance depends on inherited styles, global resets, and cascading rules.

**Solution — Used CSS extraction:**
1. Walk all `document.styleSheets` in the page context
2. For each CSS rule, check if any element in the section subtree matches using `el.matches(selector)`
3. Collect only those rules
4. Rewrite selectors to scope them (e.g., prefix with `.extracted-component`)
5. Include `@font-face` declarations for fonts used by the section

**Fallback:** `getComputedStyle()` on every element and inline as `style=""`. Works but produces bloated output and loses media queries. Use only as last resort.

**Libraries that help:** `css-tree`, `postcss` for selector parsing and rewriting.

### JS/Animation Extraction (Hard — defer to v2)

**Problem:** Event listeners, scroll handlers, framework state, and animation timelines cannot be reliably serialized out of a running page.

**V1 approach (practical):**
- Extract raw `<script>` tags within the section's HTML
- Detect which animation libraries are loaded (GSAP, ScrollTrigger, Swiper, Lottie) — report these so the user knows what to include
- Extract CSS `@keyframes` and `transition` declarations (these ARE in stylesheets)
- For GSAP/ScrollTrigger: search for script tags containing `gsap.` or `ScrollTrigger` and include them, rewriting selectors if possible
- Accept that complex JS behavior will need manual adaptation — the skeleton is a starting point

**V2 approach (ambitious):**
- Use Chrome DevTools Protocol to capture `getEventListeners()` (CDP-only API)
- Record scroll-driven animation states using `Animation.getAnimations()` (Web Animations API)
- Build a GSAP timeline from observed animation property changes during scroll

### External Assets (Easy)

| Asset Type | Strategy |
|-----------|----------|
| Images (`<img>`, `background-image`) | Convert to absolute URLs. Optionally proxy/inline as base64. |
| SVGs (inline) | Already in the DOM, extracted automatically. |
| SVGs (external `<img src="x.svg">`) | Convert to absolute URL. |
| Fonts (`@font-face`) | Extract declarations, keep original URLs. |
| Icons (icon fonts) | Extract the `@font-face` + relevant CSS classes. |

### Resource Management

**Browser pooling:** Don't launch a new Chromium per request. Use a browser pool:
```typescript
// Reuse browser, create new contexts per request
const browser = await playwright.chromium.launch();
// Per request:
const context = await browser.newContext();
const page = await context.newPage();
// ... do work ...
await context.close(); // cleanup, browser stays alive
```

**Timeout:** Cap page load at 30s, screenshot at 10s. If the page doesn't settle, return what we have.

**Caching:** Cache the screenshot + section map for 5 minutes so clicking multiple sections doesn't re-render the page.

---

## What Exists in Our Codebase Already

| Capability | Where | Reusable? |
|-----------|-------|-----------|
| Playwright page loading | `capture-adidas.ts`, `capture-filmstrip.ts` | Yes — slow-scroll + screenshot pattern |
| crawl4ai page fetching | `redesign.ts:fetchPage()` | Partial — returns HTML but no bounding boxes |
| Section detection from HTML | `section-extractor.ts:extractSections()` | Yes — classification, animation detection, tier assignment |
| Section parsing | `section-parser.ts:parseSections()` | Yes — lightweight parse + role assignment |
| iframe preview | `ReviewPage.tsx` wrappedHtml pattern | Yes — same pattern for preview |
| Skeleton enhancement | `component-generator.ts:enhanceFromSkeleton()` | Yes — CSS-only mode works with any HTML |
| Quality scoring | `component-generator.ts:scoreQualityStatic()` | Yes — score extracted sections immediately |

**Key gap:** No existing code does bounding-box extraction or scoped CSS extraction. These are the two new pieces needed.

---

## Existing Tools to Study

| Tool | Stars | What it does | Useful for |
|------|-------|-------------|------------|
| SingleFile | 15k+ | Saves entire page as single HTML with inlined CSS/images | Asset inlining strategy |
| rrweb | 17k+ | Records/replays web sessions (DOM snapshots) | DOM serialization approach |
| html2canvas | 31k+ | Renders DOM to canvas | Client-side screenshot (same-origin only) |
| screenshot-to-code | 60k+ | AI converts screenshots to code | Different goal but similar UX pattern |
| Browserless | 1.8k | Headless Chrome as a service | Deployment model for production |

**No existing open-source tool does exactly this** (URL → visual page → click to extract section HTML/CSS). This would be a novel feature.

---

## Estimated Effort

| Phase | Scope | Effort |
|-------|-------|--------|
| **MVP** | Screenshot + bounding boxes + basic HTML extraction | 2-3 days |
| **V1** | + Scoped CSS extraction + asset resolution + save as skeleton | 2-3 days |
| **V1.5** | + Animation library detection + script tag extraction | 1-2 days |
| **V2** | + JS behavior recording + GSAP timeline extraction | 5-10 days |

### MVP API Shape

```typescript
// Capture a page
POST /api/engine/capture
Body: { url: string }
Response: {
  captureId: string,
  screenshot: string,        // base64 PNG
  pageHeight: number,
  sections: Array<{
    id: string,
    tag: string,             // "section", "nav", "header", etc.
    bbox: { x: number, y: number, width: number, height: number },
    classes: string[],
    textPreview: string,     // first 100 chars
    hasAnimation: boolean,
  }>
}

// Extract a section
POST /api/engine/extract
Body: { captureId: string, sectionId: string }
Response: {
  html: string,              // scoped outerHTML
  css: string,               // scoped CSS rules
  assets: string[],          // absolute URLs of images/fonts
  libs: string[],            // detected: ["gsap", "ScrollTrigger", "swiper"]
  animations: Array<{ type: string, trigger: string }>,
}

// Save as skeleton
POST /api/engine/save-skeleton
Body: { name: string, html: string, css: string, description: string }
```

### MVP Frontend

```
┌─────────────────────────────────────────────────────┐
│  URL: [https://stripe.com_______________] [Capture] │
├───────────────────────────────────┬──────────────────┤
│                                   │ Section Detail   │
│   [Full-page screenshot]          │                  │
│   with hoverable/clickable        │ <nav> .site-nav  │
│   overlay boxes on each           │ 120 x 80px       │
│   detected section                │ Animation: none  │
│                                   │                  │
│   ┌───────────────────────┐       │ [View HTML]      │
│   │  nav  (hover = blue)  │       │ [Save Skeleton]  │
│   ├───────────────────────┤       │ [Enhance + Save] │
│   │                       │       │                  │
│   │  hero section         │       │                  │
│   │  (click = selected)   │       │                  │
│   │                       │       │                  │
│   ├───────────────────────┤       │                  │
│   │  features grid        │       │                  │
│   ├───────────────────────┤       │                  │
│   │  testimonials          │       │                  │
│   ├───────────────────────┤       │                  │
│   │  footer               │       │                  │
│   └───────────────────────┘       │                  │
└───────────────────────────────────┴──────────────────┘
```

---

## Implementation Checklist

This feature lives in the **Playground** page (`#/playground`) — a dedicated space for experimental tools.

### Phase 0: Playground Page Shell --- DONE
- [x] Add `{ view: "playground" }` route type to `App.tsx`
- [x] Add `#/playground` to `parseRoute()` in `App.tsx`
- [x] Create `PlaygroundPage.tsx` with tab layout for experimental features
- [x] Add "Playground" nav item to `ProjectLibrary.tsx` sidebar (diamond icon)
- [x] First tab: "Component Extractor" (this feature)

### Phase 1: Capture API (Backend) --- DONE
- [x] Add `POST /api/engine/capture` endpoint in `engine.ts`
  - Accepts `{ url: string }`
  - Launches Playwright headless Chromium
  - Navigates to URL, waits for `networkidle` + 2s
  - Slow-scrolls full page (300px increments) to trigger lazy content
  - Scrolls back to top
  - Takes full-page screenshot (`page.screenshot({ fullPage: true })`)
  - Runs `page.evaluate()` to detect sections:
    - Query `section, header, nav, main, footer, article, aside, [role="banner"], [role="main"]`
    - Fallback: direct `<body>` children with height > 50px
    - For each: `getBoundingClientRect()`, tag name, classes, text preview (120 chars)
    - Detect animation presence (GSAP, ScrollTrigger, Swiper, CSS keyframes, data-aos)
  - Returns `{ captureId, screenshot (base64), pageHeight, viewportWidth, sections[] }`
- [x] Cache capture results in memory (5 min TTL) keyed by `captureId`
- [x] Add timeout: 30s page load, 15s screenshot
- [x] Graceful 501 error when Playwright not available (Docker)

### Phase 2: Extract API (Backend) --- DONE
- [x] Add `POST /api/engine/extract` endpoint
  - Accepts `{ captureId: string, sectionIndex: number }`
  - Re-loads URL from cached capture
  - Extracts `outerHTML` of the selected section element
  - Extracts scoped CSS:
    - Walk `document.styleSheets`
    - For each rule, check `el.matches(selector)` against section subtree
    - Collect matching rules only
    - Include `@font-face`, `@keyframes`, and `@media` rules
  - Resolves asset URLs to absolute paths (images, SVGs, fonts)
  - Detects animation libraries (GSAP, ScrollTrigger, Swiper, Lottie, CSS Animations)
  - Returns `{ html, css, assets[], libs[] }`
- [x] Add `POST /api/engine/save-skeleton` endpoint
  - Accepts `{ name, html, css, description }`
  - Writes combined HTML+CSS to `scripts/skeletons/<name>.html`
  - Sanitizes filename, adds HTML comment description
  - Returns `{ saved: true, file }`

### Phase 3: Visual Selector UI (Frontend) --- DONE
- [x] Build `ComponentExtractor` component inside PlaygroundPage
- [x] Browser-style URL input bar with globe icon + "Capture" button
- [x] Loading state: spinner + "Rendering page in headless browser..."
- [x] Empty state: icon + explanation text
- [x] Screenshot display:
  - Scrollable container with full-page screenshot as `<img>`
  - Scales to fit panel width, maintains aspect ratio
  - Gray background, drop shadow
- [x] Section overlays:
  - Transparent `<div>`s positioned absolutely, scaled to match screenshot vs page dims
  - On hover: semi-transparent blue border + `<tag>` label + "animated" badge
  - On click: solid accent border + tinted background
- [x] Section detail panel (right sidebar, 320px):
  - Tag name (accent color), ANIMATED badge
  - Class list (monospace pills, max 5 + overflow count)
  - Dimensions (width x height)
  - Text preview (120 chars, truncated)
  - "Extract HTML + CSS" button with loading state
  - Extracted result: stat badges (HTML size, CSS size, detected libs)
  - "View Code" toggle with dark-theme code viewer
  - "Save as Skeleton" with name input + save button + success/error message
- [x] Section count badge (sticky bottom-left on screenshot)
- [x] Error display with dismiss button

### Phase 4: Polish --- DONE
- [x] Add re-capture button (refresh icon next to Capture, visible after first capture)
- [x] Keyboard navigation: Arrow Up/Down or j/k to cycle sections, Enter to extract
- [x] Add capture history (last 8 URLs) in localStorage dropdown — shows on focus when input is empty
- [x] Live preview: extracted component rendered in an iframe with GSAP/Tailwind/Swiper loaded, toggle button in detail panel

### Phase 5: Advanced (V2) --- DONE
- [x] Browser pooling: single shared Chromium instance, new BrowserContext per request — no launch/close overhead after first capture
- [x] CSS scoping: selectors rewritten with `.ext-<id>` prefix class, scope class added to root element — CSS won't leak between components
- [x] Script extraction: `<script>` tags extracted separately from section HTML, returned in `scripts[]` array, shown in code viewer
- [x] Multi-section selection: Shift+click / Cmd+click to select multiple sections, extract merges them into one HTML block with combined scoped CSS
- [x] Docker support: switched production image from `node:22-alpine` to `node:22-slim` (Debian), installed Playwright Chromium system deps + browser binary
- [ ] Asset proxying: download images/fonts and inline as base64 or save locally (deferred)
- [ ] GSAP timeline detection: parse script content for `gsap.to/from/timeline` calls (deferred)

---

## Current Status

**Phases 0-5 complete.** The Component Extractor is fully functional at `#/playground`:
- Enter any URL → full-page screenshot with clickable section overlays
- Click a section → extract its HTML + scoped CSS + scripts + detect animation libraries
- Shift+click to multi-select sections → merged extraction
- CSS automatically scoped with unique prefix class (no style leaking)
- Live preview of extracted component in an iframe
- Save as skeleton → ready for CSS-only enhancement in `#/review`
- Keyboard navigation (j/k/arrows + Enter), URL history, re-capture button
- Works in Docker (Playwright Chromium installed in image)
- Browser pooling: single Chromium instance reused across requests

**Deferred:** Asset proxying (inline images/fonts as base64), GSAP timeline detection from script content.
