# Redesign Flow Upgrade — Cinematic Sites

Goal: take a URL like `https://report.adidas-group.com/2024/en/` and produce a
redesign that feels cinematic (pinned reveals, parallax, animated counters,
horizontal scroll storytelling) — not just a clean landing page.

Today we produce ~30–40% of the original quality. This doc tracks the work to
close the gap.

## Ground truth (current state)

- Redesign entry: [redesign.ts:262](../packages/sdk/src/models/redesign.ts#L262) (`redesignFromURL`)
- Section generation: [section-generator.ts:799-830](../packages/sdk/src/models/section-generator.ts#L799-L830) — parallel batches of 5, one LLM call per section
- Prompt: [prompts.ts:116-163](../packages/sdk/src/utils/prompts.ts#L116-L163) (`SECTION_GENERATE_SYSTEM`)
- `premiumScroll` hints: [section-generator.ts:252-273](../packages/sdk/src/models/section-generator.ts#L252-L273) — prompt hints only, no validation
- GSAP/ScrollTrigger injection: [section-parser.ts:678-720](../packages/sdk/src/utils/section-parser.ts#L678-L720)
- Animation brief pipeline: [section-classifier.ts:140](../packages/sdk/src/utils/section-classifier.ts#L140) (`generateAnimationBrief`) — **exists but only called from [scripts/component-engine.ts](../scripts/component-engine.ts), not from redesign flow**
- Screenshot capture: [screenshot/service.ts](../packages/sdk/src/screenshot/service.ts) (Playwright) — **not wired into redesign**
- Storage: `RawSectionDoc.animationBrief` field exists at [storage/interface.ts:206-217](../packages/sdk/src/storage/interface.ts#L206-L217), persisted via `updateRawSectionBrief`
- Component library: ~900 components in [scripts/components.json](../scripts/components.json), ~10 "cinematic" tier
- Seeding tool: [scripts/generate-components.ts](../scripts/generate-components.ts) — appends to components.json

## Target flow

```
URL in
  ↓
crawl4ai fetch (HTML + text) ──┬──→ section-extractor (HTML animation patterns)
                               └──→ screenshot capture (6 frames per section)
  ↓
brand + persona extraction
  ↓
per section:
  pattern hints (HTML) + brief (visual) → section-generator prompt
  ↓
Kimi K2.5 → HTML with GSAP/ScrollTrigger
  ↓
post-render validation (GSAP syntax, missing triggers)
  ↓
assemble → final HTML
```

## Implementation plan (4 tracks)

### Track 1 — Wire animation brief into redesign flow (highest leverage)

Adapts to *any* source site, not just pre-seeded ones. Two-phase:

**Phase 1A — HTML-only patterns (ship fast, no screenshots)**
- [x] In [redesign.ts](../packages/sdk/src/models/redesign.ts), after crawl4ai fetch, run [section-extractor.ts](../packages/sdk/src/utils/section-extractor.ts) on the source HTML to extract `AnimationPattern[]` per section
- [x] Inject detected patterns into the `redesignFromURL` system + user prompts as a `SOURCE ANIMATION PATTERNS` block; auto-detect cinematic mode (≥3 scroll patterns OR any gsap/scrolltrigger/lottie/three-js/framer-motion library)
- [x] When cinematic detected, append a CINEMATIC MODE directive to the system prompt with concrete pinned/scrub/parallax/counter requirements
- [x] Also wire patterns into `generatePageSectioned` path: extract once at top, map by section index, inject as `<source-animations>` XML block in `buildSectionPrompt`, and auto-upgrade `premiumScroll` when cinematic detected
- [x] Verify on strattoncraig.com (lightweight) and report.adidas-group.com (heavy)
  - strattoncraig: 3 sections, 8 patterns (three-js + scrolltrigger + css-keyframes), cinematic=ON, stats section classified `tier=cinematic`
  - adidas: 4 sections, 3 patterns (swiper + three-js), cinematic=ON via library detection. Only 4 top-level sections extracted vs ~20 visible — SPA HTML is shallow, pattern fidelity limited (closes with Tracks 2/3 + 1B visual briefs)
  - Verification script: [scripts/verify-track1a.ts](../scripts/verify-track1a.ts)

**Phase 1B — Visual brief (upgrade for high-value runs)**
- [x] Add `captureUrlScrollSequence(url, opts)` to [screenshot/service.ts](../packages/sdk/src/screenshot/service.ts) — 6 frames at load-t0, load-t2s, scroll 25/50/75/100. Cookie banner auto-dismiss. networkidle → domcontentloaded fallback for heavy SPAs.
- [x] In `redesignFromURL`, fire screenshot capture when cinematic auto-detected (gated by Track 1A's `cinematicDetected` flag), call `generateAnimationBrief` once per page, inject as `=== ANIMATION BRIEF ===` block in user prompt
- [x] Same wiring in `generatePageSectioned` — fires when `effectivePremiumScroll` is true; brief is shared across all per-section prompts via new `animationBrief` field on `buildSectionPrompt` ctx, rendered as `<animation-brief>` XML block
- [x] Buffers are in-memory only — never written to disk. Garbage-collected after the brief LLM call returns. No tmp dir cleanup needed.
- [x] Cost guard: only fires when `cinematicDetected || premiumScroll` is true; failures are caught and logged as warnings (pipeline continues with HTML-only patterns from Track 1A)
- [x] Playwright + chromium already installed in api-server Docker image ([Dockerfile:45](../packages/api-server/Dockerfile#L45))
- [~] Persist briefs to `RawSectionDoc.animationBrief` for reuse — deferred. RawSectionDoc is for component-engine crawled sections, not redesign sources. A URL-keyed brief cache can be added later if cost becomes a concern.

### Track 2 — Cinematic mode in section-generator

Upgrade the prompt infrastructure to produce reliable scroll-triggered output.

- [x] Add `SECTION_GENERATE_CINEMATIC_SYSTEM` prompt in [prompts.ts](../packages/sdk/src/utils/prompts.ts) — 3 worked examples (pinned hero+parallax+split-text, animated counters, horizontal scroll storytelling) + cinematic principles + safety rules (unique IDs, unique class prefixes, clearProps, parallax magnitude cap)
- [x] Branch in [section-generator.ts](../packages/sdk/src/models/section-generator.ts) — uses `SECTION_GENERATE_CINEMATIC_SYSTEM` when `effectivePremiumScroll` is true (auto-triggered by cinematic detection from Track 1A), otherwise uses regular `SECTION_GENERATE_SYSTEM`
- [x] Kimi K2.5 config already wired ([router.ts:81-83](../packages/sdk/src/utils/router.ts#L81-L83)): `top_p: 0.95`, `reasoning: { effort: "none" }`
- [x] GSAP init verified: page-level script at [section-parser.ts:717-720](../packages/sdk/src/utils/section-parser.ts#L717-L720) registers ScrollTrigger once globally; section-level `registerPlugin` calls are idempotent no-ops. `toggleActions → once: true` rewrite at line 707-709 doesn't touch `scrub` configs. `gsap.from` wrapper at line 725-737 doesn't intercept `tl.from(...)` inside `gsap.timeline({scrollTrigger})`.
- [~] `<scroll-choreography>` XML block for neighbor sync — deferred; cinematic principles in the prompt cover the per-section choreography. Cross-section sync isn't feasible without a second orchestration pass (out of scope for Track 2).

### Track 3 — Seed cinematic component library

Build ≥20 pre-validated cinematic components so the model has proven patterns to learn from (few-shot) and the library has real examples to surface.

- [x] Draft cinematic component spec list (target 25):
  - [ ] hero-parallax-split
  - [ ] hero-pinned-video
  - [ ] hero-text-split-reveal
  - [ ] stats-counter-pinned
  - [ ] stats-horizontal-scroll
  - [ ] features-scroll-stacked-cards
  - [ ] features-horizontal-pin
  - [ ] timeline-scroll-sync
  - [ ] timeline-chapter-nav
  - [ ] testimonials-parallax-quotes
  - [ ] gallery-pinned-reveal
  - [ ] gallery-horizontal-scrub
  - [ ] chart-animated-bar
  - [ ] chart-animated-line
  - [ ] chart-radial-progress
  - [ ] content-fullbleed-parallax
  - [ ] content-split-scroll
  - [ ] cta-pinned-reveal
  - [ ] footer-morph-in
  - [ ] nav-scroll-hide
  - [ ] section-divider-morph
  - [ ] backdrop-gradient-scrub
  - [ ] text-reveal-on-scroll
  - [ ] image-reveal-clip
  - [ ] card-grid-stagger
- [x] Created [scripts/generate-cinematic-components.ts](../scripts/generate-cinematic-components.ts) — Kimi K2.5 + `SECTION_GENERATE_CINEMATIC_SYSTEM`-style prompt, `temperature: 0.6`, `top_p: 0.95`, `reasoning: { effort: "none" }`, 12K max_tokens. Supports `--limit N` for pilot runs and `--only id` for single-component regeneration. Upsert to [scripts/components-cinematic.json](../scripts/components-cinematic.json).
- [x] Pilot (2 components) + full run (25 components) — all 25 passed sanity checks (has `<script>`, ≥1 gsap call, unique class prefix, unique ScrollTrigger id). Sizes: 2KB–18KB, zero warnings.
- [x] Each tagged with `tier:cinematic`, `cinematic`, `gsap`, `scrolltrigger`, category, and the specific GSAP pattern (`pinned-parallax-split`, `stacked-card-stack`, `svg-stroke-draw`, etc.)
- [x] Runtime loading: [api-server/src/index.ts](../packages/api-server/src/index.ts) now merges `components-cinematic.json` into `componentLibrary` on boot (alongside base seed). [Dockerfile:53](../packages/api-server/Dockerfile#L53) copies the file into the image. Verified: `[api] Loaded 978 components from seed file` + `[api] Loaded 25 cinematic components` = 1003 total.
- [x] Headless-browser smoke test via [scripts/verify-cinematic-components.ts](../scripts/verify-cinematic-components.ts): 25/25 PASS, 0 warnings, 0 failures. Every component loads cleanly, creates ScrollTrigger instances (range 1-12, total 80 across library), and survives scroll/reset without errors.

### Track 4 — Post-render GSAP validation

Stop relying on the model to produce valid code. Validate and auto-repair.

- [x] Created [gsap-validator.ts](../packages/sdk/src/utils/gsap-validator.ts) — uses `acorn` (added as SDK dep) to parse extracted `<script>` blocks. Walks the AST to collect `gsap.to/from/set/timeline/fromTo` calls, `ScrollTrigger.create`, inline `scrollTrigger: { id, pin, scrub }` options, and detect `toggleActions: reverse` + `once+scrub` conflicts. Exports: `validateGsapScript`, `validateGsapScriptBatch`, `computeAnimationQualityScore`.
- [x] Integrated into [section-parser.ts](../packages/sdk/src/utils/section-parser.ts) `assembleSections()` — extracts + validates scripts upfront (one pass, not two), applies legacy rewrites, then strips syntactically broken scripts with a warning before emission. Both sites where scripts were previously inlined (section body + page-level init) now reuse the pre-validated list. Logs `[section-parser] Animation quality: 0.XX (N triggers, N gsap calls, X/Y scripts stripped)`.
- [x] Cross-section duplicate ScrollTrigger ID detection via `validateGsapScriptBatch`. Duplicates logged as warnings.
- [x] Surface in [design-critique.ts](../packages/sdk/src/utils/design-critique.ts) — `CritiqueReport` now includes `animationQuality` (0-1) and `animationStats` (totalScripts, validScripts, scrollTriggers, gsapCalls, duplicateIds, warnings). Invalid scripts become `critical` issues in the critique stream; duplicate IDs become `warning` issues.
- [~] Retry-with-repair prompt — deferred. The strip-broken-and-continue strategy keeps the pipeline running without an extra LLM call; retries can be added later if stripping turns out to degrade quality materially.
- [x] Verified against all 25 cinematic components ([scripts/verify-gsap-validator.ts](../scripts/verify-gsap-validator.ts)): 25/25 valid, 51 ScrollTrigger instances, 67 gsap calls, 0 duplicate IDs, batch animation quality 0.940. 5 broken-input test cases (syntax error, invalid token, valid pinned timeline, valid simple to(), reverse toggleActions warning) all detected correctly.
- [x] End-to-end test via [scripts/verify-animation-quality.ts](../scripts/verify-animation-quality.ts): `critiqueHtml(cine-hero-parallax-split)` → score 10, animationQuality 1.0, stats `{ totalScripts: 1, validScripts: 1, scrollTriggers: 2, gsapCalls: 6, duplicateIds: [], warnings: 0 }`.

## Rollout order

1. **Track 1A** (HTML patterns) — ship first, unlocks immediate quality bump with no new infra
2. **Track 2** (cinematic prompt + tier) — pair with 1A so the model knows what to do with the patterns
3. **Track 3** (seed 25 components) — can run in parallel, informs 1A/2 via few-shot examples
4. **Track 4** (validation) — harden once 1A+2 are producing output
5. **Track 1B** (visual brief) — upgrade for high-value runs, gate behind `cinematic: true` flag to control cost

## Verification

- [ ] Run on [https://report.adidas-group.com/2024/en/](https://report.adidas-group.com/2024/en/) end-to-end with `cinematic: true`
- [ ] Side-by-side visual comparison: source vs. generated
- [ ] Check: hero has parallax, stats animate on scroll, at least 3 pinned sections, no broken GSAP in console
- [ ] UICrit score ≥ 8.5/10
- [ ] Cost per run logged (expect 2–3× base redesign cost for cinematic mode)

## Decisions

**Screenshot capture strategy** — full-page, 6 scroll positions, split into section regions by DOM offset. Rationale: animation state is driven by page-level scroll position (not section-level), so one navigation + 6 scroll states captures the real thing. Per-section navigation would miss scroll-triggered cross-section effects. Single Playwright session, ~6 screenshots total, split into per-section regions using `boundingBox` of each section after load. **Delete all screenshots from disk after generation completes** (use temp dir with cleanup in `finally` block).

**Cinematic mode trigger** — auto-detect by default, with user toggle override in NewProjectModal.
- Auto-detect rule: if `section-extractor` finds ≥3 animation patterns with triggers of `scroll`/`scrub`/`pin`, OR any pattern from `gsap`/`scrolltrigger`/`lottie`/`three-js` libraries → auto-enable cinematic mode
- Toggle: checkbox "Cinematic mode (slower, higher quality)" — three states: Auto (default) / Force on / Force off

**Cinematic component storage** — separate file `scripts/components-cinematic.json`, merged at runtime in `componentLibrary.load()`. Rationale: current `components.json` is 7.2MB; cinematic components with GSAP scripts will be larger per-entry; separate file allows lazy-load, independent versioning, and clearer tier boundaries. ComponentLibrary will load both files into the same in-memory Map, tagged by `tier` field.
