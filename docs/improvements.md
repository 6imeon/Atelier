# Atelier — Improvements Checklist

Comprehensive code review findings organized by severity. 31 issues identified across security, correctness, architecture, and developer experience.

---

## Critical

- [x] **Fix XSS vulnerability in ScreenCard iframe** — Switched from `doc.write()` to `iframe.srcdoc` with `sandbox=""` (no permissions). Injected styles are prepended into the HTML string instead of using DOM manipulation.

- [x] **Create missing Figma plugin `code.ts`** — Created `packages/figma-plugin/src/code.ts` with `figma.showUI()`, screen import (creates frames + text labels), and design system import (creates paint styles from hex colors).

- [ ] **Fix wildcard postMessage origin in Figma plugin** — `packages/figma-plugin/src/ui.html` uses `parent.postMessage({...}, '*')` in multiple places. The `'*'` target origin lets any embedding window intercept plugin messages. Note: Figma's plugin iframe requires `'*'` for the `pluginMessage` wrapper pattern, but the data payload should be validated on the `code.ts` side.

- [x] **Restrict CORS on API server** — Replaced wildcard `Access-Control-Allow-Origin: *` with an allowlist (`CORS_ORIGINS` env var, defaults to `localhost:5173,localhost:8080`). Origin is checked on every response including OPTIONS preflight.

- [x] **Fix SDK singleton race condition** — Added `getCanvasAI()` factory function with proper null-check initialization. The Proxy delegates through it instead of inlining the check.

---

## High

- [x] **Add input validation to API endpoints** — Added `validateRequired()` helper and `VALID_DEVICE_TYPES` / `VALID_CREATIVE_RANGES` enum checks. All POST endpoints now validate required fields and clamp variant counts. Returns 400 on bad input.

- [x] **Add retry limits to router fallback** — Added `retryCount` to route options, capped at 2. Logs which model failed and why before falling back. Throws `RouterError` with context on max retries.

- [x] **Fix undo/redo using `get()` outside `set()`** — Refactored `undo()` and `redo()` to use `set((st) => ...)` pattern so the guard check and state update are atomic.

- [x] **Add `pushHistory()` calls before mutations** — `addScreen` and `removeScreen` now call `pushHistory()` before mutating so undo/redo has snapshots to restore. `updateScreen` left without history (too noisy during drag).

- [x] **Add shutdown handler to API server** — Added `SIGINT`/`SIGTERM` handlers that close the server gracefully.

- [x] **Add rate limiting to API server** — Added per-IP in-memory rate limiter (30 req/min) on all generation endpoints. Returns 429 on exceeded limit.

- [x] **Validate `routeJSON` responses against schemas** — Added optional `schema?: z.ZodType<T>` parameter to `routeJSON()`. When provided, validates parsed JSON with `safeParse()` and throws `RouterError` with issue details on mismatch. Existing callers are unaffected (parameter is optional).

---

## Medium

- [x] **Add `tsconfig.json` to web-ui** — Created with `moduleResolution: "bundler"`, `jsx: "react-jsx"`, `lib: ["ES2022", "DOM", "DOM.Iterable"]`.

- [x] **Add Tailwind and PostCSS configs** — Created `tailwind.config.ts` with custom canvas theme colors and content paths, plus `postcss.config.ts` with tailwindcss + autoprefixer plugins.

- [x] **Add `.gitignore`** — Created at repo root covering `node_modules/`, `dist/`, `.env`, `.DS_Store`, `data/`, and SQLite files.

- [x] **Add fetch timeout to `extractDesignFromURL`** — Wrapped with `AbortController` and 10-second timeout in `packages/sdk/src/models/project.ts`.

- [x] **Persist `designTokens` in SQLite storage** — Added `design_tokens` to INSERT query and JSON.parse to SELECT result mapping in `packages/sdk/src/storage/sqlite.ts`.

- [x] **Add pagination to screen list endpoint** — `GET /api/projects/:pid/screens` now accepts `?page=0&limit=20` query params (limit capped at 100). Returns `{ screens, total, page, limit, hasMore }`.

- [x] **Use relative API URL in ChatPanel** — Changed `const API = "http://localhost:8080"` to `const API = ""` so requests go through Vite's proxy in dev and work in production without hardcoded hosts.

- [x] **Implement `parseDesignMd()`** — Full regex-based parser that reverses `toDesignMd()`. Parses all sections: colors, typography (with scale), spacing (unit + scale array), border radius, shadows, and component patterns. Verified with round-trip tests.

---

## Low

- [x] **Add `aria-label` attributes to icon buttons** — Added to ScreenCard action buttons and Toolbar `ToolBtn` component.

- [x] **Add keyboard navigation for screen selection** — Added `cycleScreen()` helper and arrow key handlers (Up/Left = prev, Down/Right = next) that wrap around. Escape deselects. Delete/Backspace removes the selected screen.

- [x] **Sanitize error messages shown to users** — ChatPanel now shows generic "Generation failed. Please try again." instead of raw `err.message`.

- [x] **Add missing `/api/assets/:key` endpoint** — Implemented `GET /api/assets/:key` that serves files from the `data/assets/` directory with proper MIME types (png, jpg) and cache headers. Sanitizes the key to prevent path traversal.

- [ ] **Consider CSS modules or Tailwind over inline styles** — All web-ui components use inline `style={{}}` objects (50+ in ChatPanel alone). This duplicates color values, prevents hover/focus pseudo-class styling, and makes theming difficult. Since Tailwind is already a dependency, consider migrating to utility classes for consistency with the generated screen HTML.

- [x] **Add `manifest.json` for Figma plugin** — Created with `id`, `name`, `main` (dist/code.js), `ui` (dist/ui.html), and `editorType` fields.

---

## Developer Experience

- [x] **Add ESLint and Prettier** — Created `eslint.config.js` (flat config with typescript-eslint), `.prettierrc`, and added `eslint`/`prettier`/`typescript-eslint` to root devDependencies. Added `"lint"` and `"format"` scripts to root `package.json`.

- [x] **Add test infrastructure** — Created `packages/sdk/src/__tests__/router.test.ts` (8 tests: API key validation, primary routing, fallback behavior, max retries, JSON parsing, code fence stripping, invalid JSON) and `design-system.test.ts` (7 tests: toDesignMd output, full round-trip parsing for all sections, empty input handling).

- [x] **Add GitHub Actions CI** — Created `.github/workflows/ci.yml` running on push/PR to main: checkout, Node 20 setup with npm cache, `npm ci`, `npm run build`, `npm run lint`, `npm test`.

- [x] **Implement skill scripts** — Created all three:
  - `skills/enhance-prompt/scripts/enhance.ts` — expands prompts via intent_parse pipeline, returns enhanced prompt + components + layout hint
  - `skills/react-components/scripts/export.ts` — exports screens as React/TSX with optional `--split` mode for multi-component detection
  - `skills/design-md/scripts/extract.ts` — four actions: `extract` (URL → DESIGN.md), `from-screen`, `merge` (combine multiple DESIGN.md files), `validate` (schema completeness check)

---

## Bonus fixes applied

- [x] **Fix `router.json()` → `router.routeJSON()` call mismatch** — `packages/sdk/src/models/project.ts` called `router.json()` which doesn't exist on `ModelRouter`. Fixed all 6 occurrences to `router.routeJSON()`.

- [x] **Remove invalid `RouteOptions` export** — `packages/sdk/src/index.ts` exported `RouteOptions` from `router.ts` but no such type was defined. Removed the dead export.

---

**Total: 31 items + 3 bonus** - 30 fixed, 4 remaining (postMessage origin, inline styles migration are by-design/large refactor scope)

---
---

# Research-Backed Improvements

Deep dive into academic research, algorithms, and techniques that could materially improve Atelier's output quality. Each item references specific papers or established techniques, with implementation notes.

Full research catalogue: `docs/deep-research.md`

---

## Tier 1 - High Impact, Moderate Effort

### 1. OKLCH Colour Palette Generation - IMPLEMENTED

**Status:** Core implemented. 10-step perceptually uniform scales generated from brand colours and injected into all section generation prompts.

**What was implemented:**
- `packages/sdk/src/utils/color-scale.ts` — Full OKLCH palette generator (no dependencies)
  - `generateScale(hex, name)` — 11-step scale (50-950) from any hex colour, keeping hue constant, varying lightness (0.97→0.14) with bell-curve chroma modulation
  - `generatePalette({ primary, secondary?, accent? })` — generates 4 scales (primary, secondary, accent, brand-tinted neutral) + semantic tokens (background, surface, border, text, hover, foreground)
  - `formatPaletteForPrompt(palette)` — compact string for AI prompt injection
- Reuses `hexToOklch()` and `oklchToHex()` from `contrast.ts` (now exported)
- Integrated into `project.ts` `generatePageSectioned()` — palette generated from extracted brand colours, appended to every section's `<brand-tokens>` block
- Logs: `[sdk] OKLCH palette generated: primary=#cf0011, 11 steps`

**Semantic tokens generated:**
- `bg-page`, `bg-surface`, `bg-muted` — page backgrounds
- `border-default` — borders and dividers
- `text-primary`, `text-secondary`, `text-muted` — text hierarchy
- `brand-primary`, `brand-primary-hover`, `brand-primary-text` — brand CTA colours
- `brand-secondary`, `brand-accent` — supporting brand colours

**References:**
- Evil Martians OKLCH palette guide
- Stripe colour system
- Ant Design: single `colorPrimary` triggers full palette generation

---

### 2. APCA Contrast Validation - IMPLEMENTED

**Status:** Core implemented. Pre-generation validation of design token colour pairs with auto-fix.

**What was implemented:**
- `packages/sdk/src/utils/contrast.ts` - Pure-math APCA algorithm (no dependencies)
  - `calcAPCA(textHex, bgHex)` - returns Lc value (-106 to +106)
  - `meetsContrast(textHex, bgHex, level)` - checks body (Lc 75), large (Lc 60), nontext (Lc 30)
  - `adjustForContrast(textHex, bgHex, targetLc)` - binary search in OKLCH space, preserves hue/chroma, adjusts lightness
  - `validateDesignTokenContrast(tokens)` - validates text/bg, primary/bg, secondary/bg, accent/bg pairs
- Integrated into `project.ts` `generatePage()` and `redesignFromURL()` - runs before prompt assembly
- Auto-fixes failing pairs and logs adjustments: `[contrast] primary on background: Lc 42.1 FAIL -> adjusted to #XXXXXX`
- Full OKLCH colour space conversion pipeline: hex -> sRGB -> linear RGB -> XYZ (D65) -> Oklab -> OKLCH -> adjust L -> reverse

**Future optimal implementations (not yet done):**
- Post-generation HTML parsing: scan the generated HTML for all text/background pairs in the actual rendered output, not just the design tokens. Would catch cases where the AI uses arbitrary colours not in the token set.
- Font-size-aware thresholds: APCA supports different thresholds per font size+weight combination. Currently we use fixed thresholds (body=75, large=60). A full implementation would parse the HTML, detect font sizes, and apply the correct APCA lookup table per element.
- Integration with OKLCH palette generation (#1): if contrast validation generated a full OKLCH 10-step scale, every pair would be guaranteed accessible by construction, eliminating the need for post-hoc fixing.
- Background gradient handling: currently assumes solid backgrounds. Sites with gradient backgrounds need sampling at multiple points.

**References:**
- Somers, A. - APCA algorithm (github.com/Myndex/SAPC-APCA)
- Lalitha A R (2025) - Context-Adaptive Color Optimization, arXiv:2512.07623
- CM-Colors v0.5.0

**Files to modify:** New `packages/sdk/src/utils/contrast.ts`, `packages/sdk/src/utils/router.ts` (add validation step)

---

### 3. Retrieval-Augmented Layout Generation (RALF)

**Problem:** Each page generation starts from scratch. The AI has no reference for what good layouts look like for a given industry/page type.

**Research:** RALF (CVPR 2024 Oral) retrieves nearest-neighbour layout examples before generating. 3,000 samples with retrieval outperforms 7,734 without retrieval.

**Implementation:** Build a layout example database from Atelier's existing component library. Before generation, retrieve 2-3 relevant layout examples and include them in the prompt as few-shot references.

**Current state:** The component library already has `selectForPrompt()` which picks components. This would extend it to also provide full-page layout examples, not just individual components.

**References:**
- Horita et al. (2024) - RALF: Retrieval-Augmented Layout Transformer, CVPR 2024 Oral
- github.com/CyberAgentAILab/RALF

**Files to modify:** `packages/sdk/src/models/component.ts` (add layout example retrieval), `packages/sdk/src/utils/prompts.ts`

---

### 4. Automated Design Critique (UICrit) - IMPLEMENTED

**Status:** Core implemented. Rule-based post-generation quality gate with auto-fixes. Runs after page assembly, before delivery.

**What was implemented:**
- `packages/sdk/src/utils/design-critique.ts` — `critiqueHtml()` function (no dependencies, no AI call)
  - 13 rules across 5 categories:
    - **CRO**: missing CTA above fold, multiple competing CTAs, no social proof in first 2 sections
    - **Visual Hierarchy**: missing h1, multiple h1s
    - **Accessibility**: images without alt text (auto-fixed), images without dimensions
    - **Contrast**: white text on white background, low-contrast text classes (text-gray-100/200)
    - **Layout**: sections without max-width constraint, empty/placeholder sections
    - **Animation Safety**: ScrollTrigger reverse toggleActions (auto-fixed), opacity-0 on hero
  - Auto-fixes: adds missing `alt=""` to images, replaces `toggleActions: "play none none reverse"` with `once: true`
  - Scoring: 0-10 scale (critical=-3, warning=-1, info=-0.3), passes at ≥6
- Integrated into `project.ts` `generatePageSectioned()` — runs after `assembleSections()`, applies auto-fixes, logs all issues
- Logs: `[sdk] UICrit: score 8.7/10 (PASS), 2 issues, 1 auto-fixed`

**Future improvements (not yet done):**
- AI-powered critique: for ambiguous issues (subjective hierarchy, visual weight), run a cheap model (DeepSeek V3) with UICrit-style few-shot examples
- Auto-revise: if score < 6, re-generate the worst-scoring section

**References:**
- Google Research (2024) - UICrit, UIST 2024
- 11,344 professional design critiques dataset

---

### 5. Font Pairing Network - IMPLEMENTED

**Status:** Core implemented. Font pair validation with adjacency map and auto-suggestion for weak pairs.

**What was implemented:**
- `packages/sdk/src/utils/font-pairing.ts` — Font pairing validation network (no dependencies)
  - `PAIR_MAP` — adjacency map of ~60 common web fonts with ranked pairing partners
  - `validatePairing(heading, body, threshold?)` — scores a font pair (0-1). Checks direct pairing in map, reverse lookup, and category compatibility (serif+sans-serif = 0.6, same category = 0.5)
  - `suggestBody(heading)` — returns the top-rated body font for a heading font with reason
  - Category classifier: serif, sans-serif, monospace, display
- Integrated into `project.ts` `generatePageSectioned()` — validates extracted font pair before prompt assembly. If score < 0.4, auto-suggests a better body font
- Logs: `[sdk] Font pairing: "Playfair Display" + "Inter" scored 1.00 ✓` or `[sdk] Font pairing: "Bebas Neue" + "Comic Sans" scored 0.20. Suggesting: "Inter"`

**References:**
- Hanyang University (2024) - Typeface network and the principle of font pairing, Scientific Reports

---

## Tier 2 - Medium Impact, Variable Effort

### 6. Visual Hierarchy Validation via Saliency

**Problem:** No way to verify that the generated page has a clear visual hierarchy with the CTA as the most prominent element.

**Research:** TranSalNet (Neurocomputing, 2022) predicts attention heatmaps with high accuracy. Gender-aware variants (Brain Informatics, 2025) showed age/gender-based attention variations.

**Implementation:** Run a lightweight saliency model on a screenshot of the generated page. Verify that: (a) the hero/CTA area has the highest saliency, (b) attention flows in an F or Z pattern, (c) no distracting low-value elements dominate.

**Caveat:** Requires running a model on screenshots. Could be done client-side with a small ONNX model or server-side with Playwright + a saliency endpoint.

**References:**
- Lou et al. (2022) - TranSalNet, Neurocomputing
- Nielsen Norman Group (2006) - F-Pattern study (232 users)
- Attention Insight (commercial, 95% accuracy in first 3-5 seconds)

---

### 7. Modular Typographic Scale - IMPLEMENTED

**Status:** Core implemented. Aaker-driven scale generation injected into all generation prompts.

**What was implemented:**
- `packages/sdk/src/utils/typographic-scale.ts` - Scale generator
  - `computeTypographicScale(aakerVector, baseSizePx?)` - blends 5 musical-interval ratios weighted by personality dimensions:
    - Sincerity: 1.200 Minor Third (friendly, readable)
    - Excitement: 1.333 Perfect Fourth (dynamic, impactful)
    - Competence: 1.250 Major Third (balanced, professional)
    - Sophistication: 1.414 Augmented Fourth (elegant, spacious)
    - Ruggedness: 1.125 Major Second (dense, utilitarian)
  - Generates 8 concrete px sizes (xs through 4xl), per-size line-heights (tighter for large text, looser for small), personality-adjusted max line length in ch, and letter-spacing values
  - `formatScaleForPrompt(scale)` - formats as plain-text block for AI prompt injection
- Integrated into `project.ts` `generatePage()` and `redesignFromURL()` - persona Aaker vector drives the scale, injected into system prompt alongside design system constraints
- Logs: `[typescale] swiss-international: ratio=1.248, base=16px, measure=66ch`

**Future optimal implementations (not yet done):**
- Responsive scale variants: generate separate scales for mobile (tighter ratio, smaller base) and desktop (wider ratio, larger base). Currently one scale is used for all breakpoints.
- Fluid typography via CSS clamp(): instead of fixed px values, generate `clamp(min, preferred, max)` expressions for each step. The AI could output `font-size: clamp(1.25rem, 2.5vw, 2rem)` instead of `font-size: 32px`.
- Vertical rhythm enforcement: compute a baseline grid from the base line-height and enforce that all spacing (padding, margin, gaps) snaps to multiples of this value.
- Font-weight-aware scaling: heavier weights appear larger at the same px size. A full implementation would adjust sizes based on detected font weight to maintain visual consistency.
- Scale validation post-generation: parse the generated HTML and verify the AI actually used the specified sizes rather than inventing its own.

**References:**
- Spencer Mortensen - modularscale.com
- Baymard Institute (2005) - Optimal line length: 50-75 chars, sweet spot 66

---

### 8. Multi-Page Layout Consistency - IMPLEMENTED

**Status:** Core implemented. First page's nav, footer, button styles, and section padding are extracted and reused across subsequent pages.

**What was implemented:**
- `packages/sdk/src/models/project.ts` — `ConsistencyConstraints` interface and `extractConsistencyConstraints()` function
  - Extracts nav HTML (first `<nav>` or `<header>` block) from generated page
  - Extracts footer HTML (last `<footer>` block)
  - Extracts primary button class pattern (Tailwind visual classes: bg, text, rounded, padding, hover)
  - Extracts most common section padding pattern (py-* px-* md:px-*)
- `generatePageSectioned()` accepts optional `consistencyConstraints` parameter
  - Nav sections: reuses first page's nav HTML directly (no regeneration, saves API call)
  - Footer sections: reuses first page's footer HTML directly
  - Content sections: injects button style and padding patterns as consistency hints in prompt
- `packages/api-server/src/index.ts` — multi-page generation loop extracts constraints after first page, passes to all subsequent pages
- Logs: `[consistency] Extracted nav: 2450 chars`, `[api] Extracted consistency constraints from first page: nav=true, footer=true`

**References:**
- "Empowering LLMs for Multi-Page Layout Generation" (CIKM 2024) — consistency-oriented in-context learning

---

### 9. Design Token Generation from Aaker Vector - IMPLEMENTED

**Status:** Core implemented. Concrete design tokens (border-radius, spacing, shadows, animation, letter-spacing) generated from Aaker vector and injected into all generation prompts.

**What was implemented:**
- `packages/sdk/src/utils/aaker-tokens.ts` — Full Aaker-to-design-token generator (no dependencies)
  - `computeDesignTokens(aakerVector)` — maps 5D Aaker vector to concrete tokens:
    - **Border radius**: weighted blend (Sincerity=12px round, Excitement=16px bold, Competence=6px moderate, Sophistication=4px refined, Ruggedness=0px sharp). Scale: none/sm/md/lg/xl/full
    - **Spacing**: unit 3-8px based on personality (Sophistication=airy 7px, Ruggedness=dense 3px). Generates xs through 3xl + sectionPadding. Visual density label: compact/comfortable/spacious
    - **Shadows**: 4 personality-aware shadow styles — sophisticated (deep/subtle), exciting (vivid/punchy), rugged (none/hard), default (balanced). Opacity scaled by shadow depth weight
    - **Animation**: duration (fast/normal/slow), CSS easing + GSAP ease string. Sophistication=slow smooth (power2.out), Excitement=fast snappy (back.out), Ruggedness=minimal/none. Stagger on/off + delay
    - **Letter spacing**: tight/normal/wide/wider in em. Sophistication adds tracking, Ruggedness tightens
  - `formatDesignTokensForPrompt(tokens)` — compact plain-text block for AI prompt injection
- Integrated into all 3 generation paths in `project.ts`:
  - `redesignFromURL()` — both fetch-succeeded and fallback branches
  - `generatePage()` — appended to dsConstraint/typeScale
  - `generatePageSectioned()` — appended to baseTokenSummary for every section
- Logs: `[sdk] Aaker design tokens: density=spacious, radius=5px, spacing-unit=6px, ease=power2.out`

**References:**
- Aaker (1997) — Dimensions of Brand Personality
- Three-tier token architecture (primitive, semantic, component)

---

### 10. Canvas Viewport Culling - IMPLEMENTED

**Status:** Core implemented. Off-screen iframes are unmounted and replaced with lightweight placeholders.

**What was implemented:**
- `InfiniteCanvas.tsx` — `isScreenVisible()` function computes bounding box intersection between each screen and the viewport in pixel space, with a 1-screen-width/height buffer zone. `visibleIds` memoized set recalculates on viewport pan/zoom changes
- `ScreenCard.tsx` — accepts `isVisible` prop. When `false`, renders a lightweight `<div>` placeholder (screen title, grey background) instead of the live `<iframe>`. When the screen scrolls into view, the iframe mounts and loads
- No iframe is mounted for off-screen screens — saves memory, CPU, and prevents GSAP/ScrollTrigger from running in invisible iframes

**Future improvements (not yet done):**
- Static thumbnail caching: render visible iframes to a canvas/data URL when they scroll out of view, show the cached thumbnail instead of a plain placeholder
- Hysteresis: add a small delay before unmounting iframes that just scrolled off-screen to prevent flicker during fast panning

---

## Tier 3 - Speculative / Long-Term

### 11. Layout Diffusion Post-Processing (LACE)

Apply differentiable alignment and overlap constraints as a post-processing step on generated layouts. Could enforce grid alignment without changing the generation model.

**Reference:** Chen et al. (2024) - LACE, ICLR 2024

---

### 12. Uni-Layout Quality Evaluator

A dual-branch (visual + geometric) evaluator trained on 100,000 expert-annotated layouts. 85.5% accuracy vs GPT-4o's 61.6%. Could serve as an automated quality gate.

**Reference:** Shuo Lu et al. (2025) - Uni-Layout, ACM MM 2025

---

### 13. Saliency-Guided CTA Placement

Use a pre-trained saliency model to predict attention, then adjust CTA position/size to maximise attention capture. Closes the loop between generation and validation.

**Reference:** TranSalNet + eye-tracking validation (30 participants)

---

### 14. LayoutNUWA Mask-and-Complete

Treat layout generation as HTML code with strategic masks. LLM fills in masked portions. 50%+ improvement over baselines. Would require restructuring the generation prompt format.

**Reference:** LayoutNUWA, ICLR 2024

---

### 15. Collaborative Editing (Eg-walker)

State-of-the-art algorithm combining OT + CRDT benefits for real-time collaborative editing. Used by Figma for code layers. Order of magnitude less memory than pure CRDTs.

**Reference:** Gentle & Kleppmann (2024) - Eg-walker

---

### 16. Huemint-Style Palette Generation

Train a transformer or diffusion model on colour palettes with contrast-graph encoding. Generate palettes that satisfy all required contrast relationships simultaneously.

**Reference:** Huemint - trained on 1.2M flat-colour design images

---

### 17. AccessGuru Accessibility Validation

LLM + Axe-based violation detection pipeline. 84% reduction in accessibility violations. Could be integrated as a post-generation step.

**Reference:** AccessGuru, ASSETS 2025

---

## CRO Rules for Generated Pages - IMPLEMENTED

**Status:** Encoded into generation prompts. Rules injected as `<cro-rules>` block in `SECTION_GENERATE_SYSTEM` and as CRO-specific hints in `buildSectionPrompt()` nav/hero role prompts.

**What was implemented:**
- `packages/sdk/src/utils/prompts.ts` — `<cro-rules>` block added to `SECTION_GENERATE_SYSTEM` with 8 rules: single CTA above fold, high-contrast CTA button, hero ≤100vh, social proof within 2 viewports, form fields ≤4, sticky nav with CTA, compact sections, purposeful images
- `packages/sdk/src/models/project.ts` — nav role prompt: "include a CTA button on the right side of the nav"; hero role prompt: "ONE single primary CTA button — high contrast, large padding, clear action label. Do NOT add multiple equal CTAs"

Evidence-based rules encoded:

1. Single primary CTA above the fold (42% conversion lift - HubSpot) ✅
2. CTA button contrast >= APCA Lc 60 against background ✅
3. Hero section height <= 100vh (core message visible without scroll) ✅
4. Form fields <= 4 for conversion pages (20% drop in abandonment) ✅
5. Social proof within first 2 viewport heights ✅
6. Sticky nav with CTA after 300px scroll ✅
7. Loading target < 2.5s LCP (addressed by image size constraints)
8. 1-second delay = 7% conversion drop (Akamai, 2024)
9. Accessible sites: 12% revenue advantage (Forrester) (addressed by APCA + OKLCH)

---

## Reading List (Key Papers)

| Paper | Venue | Year | Relevance |
|-------|-------|------|-----------|
| RALF | CVPR (Oral) | 2024 | Retrieval-augmented layout generation |
| LayoutNUWA | ICLR | 2024 | Layout as HTML code generation |
| Uni-Layout | ACM MM | 2025 | Layout quality evaluation with human feedback |
| LACE | ICLR | 2024 | Diffusion with alignment/overlap constraints |
| UICrit | UIST | 2024 | 11,344 professional design critiques |
| TranSalNet | Neurocomputing | 2022 | Visual attention prediction |
| Font Pairing Networks | Scientific Reports | 2024 | NMF-based font pairing |
| CM-Colors | arXiv | 2025 | OKLCH accessibility auto-adjustment |
| APCA | WCAG 3.0 draft | 2024 | Font-size-aware contrast algorithm |
| Design2Code | NAACL | 2024 | Real-world web generation benchmark |
| DCGen | 2024 | Divide-and-conquer complex page generation |
| Multi-Page Layout | CIKM | 2024 | Cross-page layout consistency |
| AccessGuru | ASSETS | 2025 | LLM + Axe accessibility validation |
| Eg-walker | 2024 | Collaborative editing algorithm |
