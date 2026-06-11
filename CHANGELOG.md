# Changelog

All notable changes to this repository are recorded here.

Format roughly follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
For detailed per-commit history, run `git log`.

## Rules for updating this file

1. **Always include the date** the change took place in `YYYY-MM-DD` format. Put it in the section heading, e.g. `### Added — Foo pipeline (2026-04-14)`. If a change spans multiple days, use the date it shipped.
2. **New entries go at the top** of the `## Unreleased` section. Newest first. When a release is cut, the entire `## Unreleased` block is renamed to `## [x.y.z] — YYYY-MM-DD` and a fresh empty `## Unreleased` is added above it.
3. **Group by change type.** Use these buckets, in this order when present: `### Added`, `### Changed`, `### Fixed`, `### Removed`, `### Deprecated`, `### Security`, `### Known issues / open items`. Don't invent new bucket names.
4. **Lead each entry with the file(s) touched**, as markdown links with repo-relative paths: `[packages/sdk/src/utils/foo.ts](packages/sdk/src/utils/foo.ts)`. A reader should be able to click through to the code.
5. **Write the "why", not just the "what".** Anyone can read a diff. The changelog is for the motivation, the tradeoff, the thing you wish you'd known going in. One or two sentences per entry is usually enough.
6. **Link supporting docs** where they exist — design plans like [businessinfo.md](docs/businessinfo.md), issue numbers, related commits. Keep links relative to the repo root.
7. **Record reverts as history notes**, not deletions. If an approach was tried and abandoned, leave a short "**History note:**" paragraph under the entry explaining what was tried and why it was replaced. Future-you will want to know.
8. **Never rewrite or delete shipped entries.** If a prior entry turns out to be wrong, add a new `### Fixed` entry correcting it — don't mutate the old one.
9. **Don't dump changes you don't understand.** If you don't know why a change was made, go find out or leave it out. A blank line is better than a misleading entry.
10. **Keep it readable.** Avoid emojis unless the user explicitly asks for them. Full sentences. No trailing "etc.". No "various fixes" — list them.

## Unreleased

### Added — Skeletons S2 second batch: 6 premium patterns — S2 complete (2026-04-23)

[scripts/skeletons/card-stack-to-grid.html](scripts/skeletons/card-stack-to-grid.html),
[scripts/skeletons/pricing-sticky-column.html](scripts/skeletons/pricing-sticky-column.html),
[scripts/skeletons/faq-motion-accordion.html](scripts/skeletons/faq-motion-accordion.html),
[scripts/skeletons/logo-wall-rotator.html](scripts/skeletons/logo-wall-rotator.html),
[scripts/skeletons/quote-pull-serif.html](scripts/skeletons/quote-pull-serif.html),
[scripts/skeletons/full-bleed-clip-wipe.html](scripts/skeletons/full-bleed-clip-wipe.html)

Closes S2 per [skeletons.md](docs/skeletons.md) — library now at 25 skeletons (5 S0 + 7 S1 + 13 S2). Second batch covers conversion/content-page real estate that the priority batch didn't: pricing tables, FAQs, customer logo strips, testimonial pull-quotes, and two cinematic-entry patterns (stack-to-grid + clip-wipe). All six pass the §6 rubric: bracket-token placeholders only, `data-*` attributes on animated/interactive nodes, unique root-class prefix (`cstg-` / `psc-` / `fma-` / `lwr-` / `qps-` / `fbcw-`), 2-3 `Ref:` URLs per comment header. Reduced-motion guards: stack-to-grid falls back to a static 2-col grid; faq-accordion drops the grid-row transition; logo-wall halts animation + removes mask + wraps to multi-line; clip-wipe jumps to fully-open state with content visible. No CDN `<script src>`. Deferred (same S0.1 batch): regenerate [scripts/components-cinematic.json](scripts/components-cinematic.json) variants for all 25 skeletons × ≥3 persona palettes.

### Added — Skeletons S2 priority batch: 7 non-adidas premium patterns (2026-04-23)

[scripts/skeletons/bento-grid-hover.html](scripts/skeletons/bento-grid-hover.html),
[scripts/skeletons/sticky-feature-list.html](scripts/skeletons/sticky-feature-list.html),
[scripts/skeletons/spotlight-border-card.html](scripts/skeletons/spotlight-border-card.html),
[scripts/skeletons/comparison-slider.html](scripts/skeletons/comparison-slider.html),
[scripts/skeletons/magnetic-cta.html](scripts/skeletons/magnetic-cta.html),
[scripts/skeletons/image-sequence-canvas.html](scripts/skeletons/image-sequence-canvas.html),
[scripts/skeletons/text-mask-video.html](scripts/skeletons/text-mask-video.html)

Diversifies the skeleton library beyond the annual-report aesthetic. Patterns mined from Apple, Stripe, Linear, Vercel, Framer, Nike, Figma, Rivian — each skeleton carries 2-3 `Ref:` URLs in its comment header to confirm the pattern is industry-generic, not site-specific (per §7.2 / rubric criterion of [skeletons.md](docs/skeletons.md)). All pass the S0 admission rubric: bracket-token placeholders only (zero brand literals), `data-*` attributes on every animated node, unique root class prefix (`bgh-` / `sfl-` / `sbc-` / `cms-` / `mcta-` / `isc-` / `tmv-`), prefers-reduced-motion guards (CSS media query + JS `window.matchMedia` short-circuit where needed), no CDN `<script src>`. Adds coverage for hover-interaction grids, sticky two-column feature swaps, pointer-tracked card glow, draggable before/after compare, magnetic CTA, canvas frame sequences, and video-in-text masks — all absent from the prior 12-skeleton library. See [skeletons.md](docs/skeletons.md) S2 for the remaining 6 (card-stack-to-grid, pricing-sticky-column, faq-motion-accordion, logo-wall-rotator, quote-pull-serif, full-bleed-clip-wipe) in the second-priority batch. Deferred: regenerating [scripts/components-cinematic.json](scripts/components-cinematic.json) variants — same S0.1 runtime batch as S0 + S1.

### Added — Skeletons S1: 7 new adidas-report-genre patterns (2026-04-22)

[scripts/skeletons/pinned-key-message.html](scripts/skeletons/pinned-key-message.html),
[scripts/skeletons/animated-bar-chart.html](scripts/skeletons/animated-bar-chart.html),
[scripts/skeletons/sticky-sidebar-toc.html](scripts/skeletons/sticky-sidebar-toc.html),
[scripts/skeletons/horizontal-scroll-strip.html](scripts/skeletons/horizontal-scroll-strip.html),
[scripts/skeletons/scrub-counter-locked.html](scripts/skeletons/scrub-counter-locked.html),
[scripts/skeletons/panel-peel-reveal.html](scripts/skeletons/panel-peel-reveal.html),
[scripts/skeletons/timeline-year-scrubber.html](scripts/skeletons/timeline-year-scrubber.html),
[skeletons.md](docs/skeletons.md)

Phase S1 of the skeleton-library expansion (see
[skeletons.md](docs/skeletons.md) §8). Library count grows from 5 → 12. Seven
patterns mined from adidas annual reports 2020/2022/2023/2024 — each
addresses a genre gap the existing 5 skeletons don't cover:

- **pinned-key-message** — word-by-word scrub-locked headline reveal
  over a parallax background. Chapter openers on every adidas report.
- **animated-bar-chart** — horizontal bars draw in from 0% to
  `data-target` on viewport entry. Financial comparisons, percentage
  data. `tabular-nums` on values, respects reduced-motion.
- **sticky-sidebar-toc** — left-rail section navigation with
  scroll-synced active state + click-to-scroll smoothing. Report
  navigation convention.
- **horizontal-scroll-strip** — vertical scroll drives horizontal
  translate of a milestone track pinned inside a sticky viewport.
  `invalidateOnRefresh` so recalculation survives resize.
- **scrub-counter-locked** — numbers count scrub-locked to scroll
  position. Explicitly distinct from the existing
  counter-dashboard (viewport-once trigger).
- **panel-peel-reveal** — two stacked full-bleed panels; top peels back
  via `clip-path: inset()` scrubbed to scroll. Chapter transitions.
- **timeline-year-scrubber** — horizontal year-dot rail with
  click-to-crossfade between milestone panels. Pure CSS + minimal JS
  (click handlers only); no scroll dependency.

All 7 follow the §4 skeleton rules and §6 admission rubric from
[skeletons.md](docs/skeletons.md):

- 4-line comment header (PATTERN / problem / Requires / Ref URL).
- Tokenised placeholders: `[EYEBROW]`, `[HEADLINE]`, `[BODY]`,
  `[LABEL_N]`, `[YEAR_N]`, etc. Zero brand text.
- `data-*` attributes on every animated node so the structural
  validator at
  [component-generator.ts:446](packages/sdk/src/utils/component-generator.ts#L446)
  can fingerprint preservation.
- Scoped JS queries under a unique root class (`.pkm-section`,
  `.bar-section`, `.toc-section`, etc) — no bare `.card` selectors that
  collide across sections.
- CSS `prefers-reduced-motion` media query + JS `matchMedia` guard that
  short-circuits expensive scrub timelines. For CSS-driven components
  (timeline-year-scrubber, sticky-sidebar-toc) the CSS guard alone is
  sufficient.
- No CDN `<script src>` tags; relies on globally-loaded GSAP +
  ScrollTrigger per the engine contract.
- Structural geometry inline (position, flex, grid, sticky, height);
  typography / color / spacing / elevation left for Kimi's `<style>`
  slot.

**Deferred**: regenerate
[scripts/components-cinematic.json](scripts/components-cinematic.json)
entries by running
`scripts/component-engine.ts --enhance-skeleton <name>` per new
skeleton per persona (≥3 personas). Same runtime step deferred from S0
for the existing 5; will bundle into a single S0.1 batch.

### Changed — Skeletons S0 cleanup: tokenised all 5, removed brand bias (2026-04-22)

[scripts/skeletons/counter-dashboard.html](scripts/skeletons/counter-dashboard.html),
[scripts/skeletons/image-carousel.html](scripts/skeletons/image-carousel.html),
[scripts/skeletons/split-panel-hero.html](scripts/skeletons/split-panel-hero.html),
[scripts/skeletons/scrollytelling-panels.html](scripts/skeletons/scrollytelling-panels.html),
[scripts/skeletons/text-marquee.html](scripts/skeletons/text-marquee.html),
[skeletons.md](docs/skeletons.md)

Phase S0 of the skeleton library cleanup (see [skeletons.md](docs/skeletons.md)).
The existing 5 skeletons were mined in one pass over
report.adidas-group.com/2024 and carried three classes of bleed that
`enhanceFromSkeleton` preserves verbatim in CSS-only mode
([component-generator.ts:289](packages/sdk/src/utils/component-generator.ts#L289)):

1. **Uppercase-styled eyebrow literals** — "KEY FIGURES", "CHAPTER
   01/02/03", "FEATURED STORY" — the upstream source of the "— THE
   SYSTEM / — OUR PURPOSE / — OUR GROUP" AI-tell visible on PCG and
   Linear regression runs. Now `[EYEBROW]` / `[EYEBROW_N]` tokens with
   `data-eyebrow="optional"` attributes so the consumer can omit them.
2. **Adidas brand text** — "Impossible Is Nothing" (adidas slogan) in
   split-panel-hero, "At a Glance" in counter-dashboard, "Building the
   Future / Innovation at Scale / Global Impact" in image-carousel.
   Replaced with `[HEADLINE]` / `[HEADLINE_N]` tokens.
3. **Missing accessibility guards** — 3 of 5 skipped
   `prefers-reduced-motion`. All 5 now have a CSS media query; the 4
   GSAP-driven ones also carry a JS guard that short-circuits the
   expensive scrub/timeline logic when the OS flag is set.

Other changes in the same pass:

- Every file now has a `<!-- Ref: <url> -->` comment line for audit
  provenance (all 5 currently point at adidas 2024).
- Inline `font-family:Georgia,serif` in scrollytelling-panels removed
  so Kimi owns typography via the `<style>` slot.
- `data-target` values in counter-dashboard reset to `0` so Kimi writes
  real numbers per brand rather than inheriting adidas's 23.7B / 59K /
  1.3B revenue figures.

**Deferred to S0.1**: column-count loop in scrollytelling-panels
(currently hardcodes 3×3); re-enhance pass against 3 persona palettes
to regenerate populated entries in
[scripts/components-cinematic.json](scripts/components-cinematic.json)
with clean token text. Both require runtime engine work, not
source-file edits.

### Fixed — Section-eyebrow template bleed from cinematic worked-example (2026-04-22)

[packages/sdk/src/utils/prompts.ts](packages/sdk/src/utils/prompts.ts)

The cinematic worked-example (Example A — pinned hero reveal) included
a `.hero-cine__eyebrow` block: a short `w-12 h-px` horizontal line next
to uppercase tracked text ("Annual Report 2024"). Kimi was generalising
this from a one-shot hero pattern into a **section template**, pasting
a line+uppercase kicker at the top of every section with invented
category labels — "THE SYSTEM", "OUR GROUP", "OUR PURPOSE", "TRUSTED BY
INDUSTRY LEADERS". Classic AI-annual-report tell, visible on both PCG
and Linear regression outputs.

- **Example A cleaned up**: dropped the `.hero-cine__eyebrow` + `.hero-cine__line`
  block from the hero HTML and removed its `.from(".hero-cine__eyebrow", …)`
  line from the GSAP timeline. Example now opens directly on the
  split-text headline — the pattern it was always meant to demonstrate.
- **New anti-pattern rule** added to both `<anti-patterns>` blocks
  (cinematic + non-cinematic): bans the line+uppercase kicker as a
  recurring section opener. Allowed at most once per page, and only
  when the eyebrow text maps verbatim to <source-content>. Never
  invent category labels. Suggests numeric meta (01/07) as an
  alternative orientation device when a section genuinely needs one.

Verified in running container: rule present ×2 (both prompt blocks),
`hero-cine__eyebrow` references removed (0 occurrences). Regression
run needed to confirm the kill on generated HTML.

### Added — Phase 5.1 microdetail rules in generation prompts (2026-04-22)

[packages/sdk/src/utils/prompts.ts](packages/sdk/src/utils/prompts.ts), [upgrades.md](docs/upgrades.md)

Ten "small decisions" rules added as a new `<microdetail-rules>` block
inside both section-generate prompts (cinematic + non-cinematic). Source:
[jakubkrehel/make-interfaces-feel-better](https://github.com/jakubkrehel/make-interfaces-feel-better)
— a 11-rule polish skill; 7 were genuinely net-new to Atelier, the
others overlap the existing anti-slop layer but were worth stating
concretely. These are the small decisions that separate "polished" from
"AI-ish" — none is load-bearing, but skipping them compounds.

Rules added:

- **Concentric border radius**: child radius = parent − padding.
  Mismatched nested radii are the most common "off" tell.
- **Optical vs geometric alignment**: icons, play-triangles, asymmetric
  glyphs need 1–2px manual nudges. Concrete Tailwind examples inline.
- **Stacked shadows over solid borders** for card elevation, with a
  concrete 2-layer shadow example.
- **Interruptible animations**: CSS `transition` for interactive state,
  `@keyframes` only for staged sequences that run once.
- **Stagger = ~100ms**: concrete delta (GSAP `stagger: 0.1`, Framer
  `staggerChildren: 0.1`). Tightens the existing "stagger" guidance.
- **Exits softer than enters**: `translateY(8px)` + opacity, never full
  height/width or viewport-height offsets.
- **Icon-swap recipe**: exact values — `scale 0.25→1`, `opacity 0→1`,
  `blur 4px→0`, spring `duration: 0.3, bounce: 0`, cubic-bezier
  fallback `(0.2, 0, 0, 1)`.
- **Image outlines**: `1px rgba(0,0,0,0.1)` light / `rgba(255,255,255,0.1)`
  dark — pure black or pure white, NEVER tinted. Tinted outlines read
  as dirt on image edges.
- **Root font smoothing**: `-webkit-font-smoothing: antialiased` +
  `-moz-osx-font-smoothing: grayscale` on root / section wrapper.

Also added Phase 5.1 to [upgrades.md](docs/upgrades.md) between Phase 5 and
Phase 6. Pure prompt additions — no storage, no UI, no tests required.

### Changed — section_generate maxTokens bumped 12K → 24K + per-stage env override (2026-04-21)

[packages/sdk/src/utils/router.ts](packages/sdk/src/utils/router.ts)

Lifts the Phase 1.2 deferred item. The `section_generate` stage's 12K
`maxTokens` ceiling was causing Kimi to cut off mid-section on
content-heavy sites (PCG's hero + vision + purpose + proposition all
exceeded 12K, triggering the Phase 1.2 truncation detector → retry
loop → empty-retry storm when Kimi exhausted its reasoning budget on
the sequential retries).

- **Default bumped**: `section_generate.maxTokens` 12000 → 24000.
  Matches the `layout_generate` and `design_refine` defaults.
- **New env override**: `CANVAS_MAXTOKENS_<STAGE>=<number>` sets the
  token ceiling for any pipeline stage at startup. Example:
  `CANVAS_MAXTOKENS_SECTION_GENERATE=32000`. Invalid values (NaN,
  negative) are ignored and the default holds.
- Pairs with the existing `CANVAS_MODEL_<STAGE>=<model>` override —
  same naming convention, same override site inside `loadModelConfig`.

**Why now:** Phase 1 (~14 rules) and Phase 1.1 (~7 rules) added
always-on anti-slop content to prompts.ts. Kimi honours each as a
must-hit requirement and writes more markup per section, pushing
output size above the old 12K ceiling. The ceiling was tight even
before — but the new rules tipped it over for PCG-class content.

**Risk/rollback:** pure additive; no API contract change. Existing
callers see a higher ceiling (never a lower one). If Kimi's provider
rate-limits by completion tokens, longer responses cost more — override
back to 12K via env if that becomes a concern.

### Fixed — dial injection caused Kimi section truncation on PCG (2026-04-21)

[packages/sdk/src/models/section-generator.ts](packages/sdk/src/models/section-generator.ts)

Phase 5 originally appended a `DIAL GUIDANCE` block to every section
prompt (unconditional, using defaults when `ds.dials` was unset). The
band text — "asymmetric CSS grid, broken grids, scroll-pinned
choreography, magnetic cursors, GSAP ScrollTrigger sequences, parallax,
horizontal hijack, cockpit density, tabular-nums, border-t/divide-y"
— reads as extra must-hit requirements and pushed Kimi past the 16K
`section_generate` ceiling on content-heavy sites. The
Phase 5 orthogonality harness on PCG confirmed: 6/7 sections truncated
first-pass, all 6 retries returned empty, final assembly was a broken
stub (29K chars vs ~100K baseline).

Patched: the dial block now renders only when the user has explicitly
set `ctx.designSystem.dials`. Unset → empty string, restoring the
pre-Phase-5 prompt shape exactly. Power users who want dial bands
still get them by setting dials in DesignPanel or via DESIGN.md upload.

**Risk/rollback:** trivial — one conditional. Pre-Phase-5 projects
regain their 9.7/10 baseline behaviour.

### Added — 3-dial parameterisation (Phase 5) (2026-04-21)

[packages/sdk/src/utils/design-md.ts](packages/sdk/src/utils/design-md.ts), [packages/sdk/src/models/section-generator.ts](packages/sdk/src/models/section-generator.ts), [packages/sdk/src/index.ts](packages/sdk/src/index.ts), [packages/web-ui/src/stores/canvas-store.ts](packages/web-ui/src/stores/canvas-store.ts), [packages/web-ui/src/components/DesignPanel.tsx](packages/web-ui/src/components/DesignPanel.tsx), [packages/sdk/src/__tests__/design-md.test.ts](packages/sdk/src/__tests__/design-md.test.ts)

Phase 5 of [upgrades.md](docs/upgrades.md). Introduces three orthogonal
dials the user can tune per project without picking a new persona:
`DESIGN_VARIANCE`, `MOTION_INTENSITY`, `VISUAL_DENSITY`. Each is an
integer 1–10; defaults `(8, 6, 4)` match the taste-skill baseline.

- **Types + helpers** in [design-md.ts](packages/sdk/src/utils/design-md.ts):
  `DialValues`, `DEFAULT_DIALS`, `normaliseDials()` (clamps to 1–10
  integers with fallback), `formatDialsForPrompt()` (renders each dial
  as a LOW/MEDIUM/HIGH concrete-guidance band — numbers alone are
  meaningless to the model; bands map to real layout/motion/density
  instructions).
- **Storage round-trip**: `CanvasDesignSystemInput.dials` and
  `DesignTokens.dials` survive through both `fromCanvasDesignSystem` /
  `toCanvasDesignSystem` adapters and the YAML `dials:` front-matter
  block in `serialize` / `parse`. Reuses the Phase 3 `PUT /design-system`
  dual-write so the frontend's existing save path picks up the new
  field with no endpoint changes.
- **Prompt injection**: the section-generator's `dsConstraint` block
  now appends a `DIAL GUIDANCE` section in all three branches
  (tailwind, JSON/bullets, no-DS). Dials are unconditional — if a
  project hasn't set them, defaults render so the model sees
  consistent framing.
- **UI**: three range sliders in
  [DesignPanel.tsx](packages/web-ui/src/components/DesignPanel.tsx)
  under the Corner Radius section. Each dial shows value, one-line
  hint, and live updates. No screen mutation — dials affect future
  generations only. Reuses the existing debounced `updateDesignSystem`
  → server PUT path.
- **CanvasDesignSystem default**: `{ variance: 8, motion: 6, density: 4 }`.
- 6 new vitest cases covering clamp, defaults, band breakpoints,
  markdown round-trip, and canvas-adapter round-trip. 26/26 passing.

**Verify orthogonality:** `CANVAS_PROMPT_DS_FORMAT=tailwind` + extreme
dial settings (e.g. variance=10/motion=10/density=10 vs
variance=1/motion=1/density=1) on the same persona should produce
visibly different output; this is the canary for whether dial bands
are actually reaching the model.

**Risk/rollback:** pure additive. Unset dials → defaults render. Field
is optional on the interface; frontend gracefully falls back when
loading pre-Phase-5 rows. No prompt branch is unconditionally longer —
dial block is ~150 chars regardless of values.

### Added — staged design-refine pipeline (Phase 4) (2026-04-21)

[packages/sdk/src/utils/staged-refine.ts](packages/sdk/src/utils/staged-refine.ts), [packages/sdk/src/utils/prompts.ts](packages/sdk/src/utils/prompts.ts), [packages/sdk/src/models/redesign.ts](packages/sdk/src/models/redesign.ts), [packages/sdk/src/index.ts](packages/sdk/src/index.ts), [packages/sdk/src/__tests__/staged-refine.test.ts](packages/sdk/src/__tests__/staged-refine.test.ts)

Phase 4 of [upgrades.md](docs/upgrades.md). Replaces the old single-shot
monolithic refine with a 5-pass pipeline that applies the fix-priority
order from the taste-skill research: font → palette → interaction
states → components → typography polish. Each pass is a focused LLM
call that sees the previous pass's output and changes only one
dimension.

- **Five new prompts** in [prompts.ts](packages/sdk/src/utils/prompts.ts)
  — `REFINE_FONT_SYSTEM`, `REFINE_PALETTE_SYSTEM`,
  `REFINE_STATES_SYSTEM`, `REFINE_COMPONENTS_SYSTEM`,
  `REFINE_TYPOGRAPHY_SYSTEM`. Each encodes a single-focus brief with
  the same "return the complete HTML document, change only this
  dimension" contract.
- **Orchestrator** `stagedRefineHtml(html, opts, log)` in
  [staged-refine.ts](packages/sdk/src/utils/staged-refine.ts). Runs
  passes sequentially; each pass gets a per-stage PipelineRun log line
  with char-count delta and duration so we can see which pass
  regressed quality. A pass that returns a suspiciously-short response
  (<30% of prior or <800 chars) is dropped and the prior HTML is
  kept — truncation safety net.
- **Env-flag configuration** via `CANVAS_REFINE_PASSES`:
  - unset / `none` / empty → orchestrator skipped (opt-in default).
  - `all` → all five passes in canonical order.
  - `font,palette` → subset. Input order is normalized to canonical
    order; unknown names are dropped.
  - `CANVAS_REFINE_PASSES=font,palette` enables the "draft mode"
    fast-iteration flow called for in the upgrades plan.
- **Pipeline wiring**: non-cinematic redesign path in
  [redesign.ts](packages/sdk/src/models/redesign.ts) calls the
  orchestrator after orphan-hidden-state fixup and before the Screen
  is constructed. Cinematic sections keep using their own per-section
  UICrit loop (they already do focused polish at the section level).
- 12 new vitest cases (pass parsing, env-flag reading, chaining
  between passes, truncation guard, failure recovery). All passing.
- SDK exports: `stagedRefineHtml`, `parseRefinePasses`,
  `getRefinePasses`, `REFINE_PASS_ORDER` + types.

**Risk/rollback:** default unset → no behavior change, the existing
single-shot flow ships unchanged. Flipping the env flag on turns the
refine on globally; any pass that misbehaves can be removed from the
comma list without re-deploying. The truncation guard prevents a
broken refine from destroying an otherwise-good generation.

**Benchmark deferred:** will compare UICrit scores on the 4 canonical
sites (Adidas, PCG, people-made, Stratton Craig) with
`CANVAS_REFINE_PASSES=all` vs unset in a follow-up; the infrastructure
is ready but a single full run takes ~13 min per site so it lives
outside the PR.

### Added — DESIGN.md as storage + prompt context (Phase 3) (2026-04-21)

[packages/sdk/src/utils/design-md.ts](packages/sdk/src/utils/design-md.ts), [packages/sdk/src/models/section-generator.ts](packages/sdk/src/models/section-generator.ts), [packages/sdk/src/index.ts](packages/sdk/src/index.ts), [packages/api-server/src/routes/analytics.ts](packages/api-server/src/routes/analytics.ts), [packages/sdk/src/__tests__/design-md.test.ts](packages/sdk/src/__tests__/design-md.test.ts)

Phase 3 of [upgrades.md](docs/upgrades.md). Builds on the Phase 2 module to
unlock hand-editable DESIGN.md files, a cheaper prompt format, and a
round-trippable storage shape.

- **Adapters**: `fromCanvasDesignSystem(ds, name)` and
  `toCanvasDesignSystem(tokens)` in design-md.ts map between the
  web-ui's `CanvasDesignSystem` shape (palette/fonts/cornerRadius) and
  canonical `DesignTokens`. Used by both storage and prompt paths.
- **Dual-write on `PUT /api/projects/:pid/design-system`**: the server
  now generates a DESIGN.md string from the incoming palette/fonts and
  stores it alongside the JSON blob under a `markdown` field on the
  same row. Pre-existing rows keep working — GET .md regenerates on
  demand if the field is missing.
- **New endpoint `GET /api/projects/:pid/design-system.md`**: streams
  `text/markdown` of the project's design system for power-user export.
- **New endpoint `PUT /api/projects/:pid/design-system.md`**: accepts
  `text/markdown`, parses via the Phase 2 spec, adapts back to the
  CanvasDesignSystem shape so the frontend store hydrates unchanged,
  and persists both representations.
- **Prompt format A/B via `CANVAS_PROMPT_DS_FORMAT=tailwind|json`**:
  when set to `tailwind`, the mandatory-design-system block in
  [section-generator.ts](packages/sdk/src/models/section-generator.ts)
  renders as a Tailwind `theme.extend` config (syntax the model has
  stronger priors on) instead of the bullet list. Default stays `json`
  — flip the env flag to evaluate on canonical sites before changing
  the default. Measured: tailwind block 474 chars vs bullet 461 — token
  cost is a wash, so no compact variant needed.
- Six new vitest cases covering the canvas-DS round-trip, the
  `promptDsFormat` env flag, and edge cases (empty palette, missing
  fonts). 20/20 passing.

**Risk/rollback:** the storage wrapper adds one optional field; frontend
ignores it. The Tailwind prompt format is opt-in via env flag — removing
the flag reverts to the existing bullet block. The new .md endpoints
are additive; neither existing client code nor the `/design-system`
JSON endpoint is affected.

### Added — DESIGN.md linter as a quality gate (Phase 2) (2026-04-21)

[packages/sdk/src/utils/design-md.ts](packages/sdk/src/utils/design-md.ts), [packages/sdk/src/__tests__/design-md.test.ts](packages/sdk/src/__tests__/design-md.test.ts), [packages/sdk/src/models/redesign.ts](packages/sdk/src/models/redesign.ts), [packages/sdk/src/models/section-generator.ts](packages/sdk/src/models/section-generator.ts), [packages/sdk/src/index.ts](packages/sdk/src/index.ts)

Phase 2 of [upgrades.md](docs/upgrades.md). Implemented a home-grown
DESIGN.md module rather than pulling in `@google/design.md` — the
upstream package is `v0.1.1` alpha with "expect changes" framing, the
surface is only ~500 LOC (YAML-subset front-matter parse, token-ref
resolve, sRGB→luminance contrast math, seven lint rules, canonical
serializer, Tailwind theme export), and owning it in-tree avoids
Apache-2.0 NOTICE tracking and lets us fold Atelier-specific anti-slop
checks in as additional lint rules in later phases.

Four exports in [design-md.ts](packages/sdk/src/utils/design-md.ts):
`serialize(ds, name)`, `parse(md)`, `lint(md)`, `exportTailwind(ds)`,
plus a `fromExtractedDesign(extracted)` adapter that maps the SDK's
brand-extractor output shape into canonical `DesignTokens`. Seven
lint rules implemented: `broken-ref` (error), `contrast-ratio`
(warning, WCAG AA 4.5:1), `orphaned-tokens` (warning),
`missing-primary` (warning), `missing-typography` (warning),
`missing-sections` (info), `section-order` (warning).

Pipeline wiring:

1. Post-extract hook in [redesign.ts](packages/sdk/src/models/redesign.ts)
   — after brand extraction, the extracted design tokens are
   serialised to DESIGN.md, linted, and findings are logged via the
   existing `PipelineRun` logger (`[time] DS lint: 0E / 2W / 0I`
   followed by per-finding lines).
2. `contrast-ratio` findings are stashed on `PageGenerationContext.dsLintFindings`
   and forwarded into UICrit's `report.issues` stream inside
   [section-generator.ts](packages/sdk/src/models/section-generator.ts)
   as `ds-contrast-ratio` warnings. A palette pair below WCAG AA now
   drags the UICrit score the same way an HTML-level a11y issue
   does.
3. Gate env `CANVAS_DESIGN_MD_LINT` — defaults on; set to `0` or
   `false` to disable. No UI surfacing yet; telemetry-only for the
   first week to validate signal quality.

Round-trip unit tests cover serialize → parse equivalence, broken-ref
and contrast-ratio detection, missing-primary/typography coverage,
orphaned-tokens detection, and contrast math spot-checks
(`#000` on `#FFF` = 21.0; `#777` on `#FFF` ≈ 4.48, fails AA).

Deferred to Phase 7: diff mode (for history UI), DTCG export
(`tokens.json`), and the `spec` command (we describe our DS in
prompts directly, no grounding text needed).

### Fixed — Section generation truncation silently produced broken HTML (2026-04-21)

[packages/sdk/src/models/section-generator.ts](packages/sdk/src/models/section-generator.ts)

Phase 1.2 of the upgrade plan. Cause surfaced in the people-made.com
regression run: section 4 ("Currys / Meta / InterContinental") hit the
LLM's max-tokens budget mid-generation and returned 1929 characters of
HTML with no closing `</section>` tag, no GSAP script, and an empty
`data-why-rationale` (the JSON response was cut before the rationale
field landed). The generator took that output at face value and
assembled it into the page, which broke DOM parsing — the browser tried
to recover the unclosed section by nesting every subsequent section
inside it, collapsing visible layout into what looked like "only 3
sections" instead of 7.

Added an `isSectionTruncated(html, role)` detector in
[section-generator.ts](packages/sdk/src/models/section-generator.ts)
that trips on any of:

- HTML under 400 chars (model bailed immediately).
- No matching closing tag (`</section|nav|header|footer>`) in the
  trailing 300 chars of the HTML.
- Closing tag absent entirely.
- Content/hero sections under 800 chars even with a close tag (the stub
  is usually auto-emitted when the model gave up).

Hooked the detector into:

1. **Primary batch loop** ([section-generator.ts:1017-1026](packages/sdk/src/models/section-generator.ts#L1017-L1026)) —
   if the first attempt returns truncated HTML (or has empty rationale
   under 1200 chars), the task now returns the same placeholder +
   "Generation failed" marker that a thrown exception would. That flows
   straight into the existing retry loop without any new plumbing.

2. **Retry loop** ([section-generator.ts:1079](packages/sdk/src/models/section-generator.ts#L1079)) —
   the "retry succeeded" branch now also checks `isSectionTruncated`. A
   retry that comes back truncated keeps the placeholder instead of
   silently replacing a bad response with another bad response.

Log lines now show `[N] "Label" truncated (1929 chars, empty rationale)
— flagging for retry` when the detector trips, so the failure mode is
visible in the run log instead of silent.

Deferred (next pass): actually bump max-tokens on the retry call. The
current router API doesn't expose per-call `maxTokens` overrides — all
stages share the `MODEL_CONFIG` default. Adding an override option is a
~10-line router change; parked here until we see retries also getting
truncated (they usually don't on people-made because the retry
happens one-at-a-time so there's no head-of-line contention).

### Added — Phase 1 regression findings: GSAP conflict + scope + nav rules (2026-04-21)

[packages/sdk/src/utils/prompts.ts](packages/sdk/src/utils/prompts.ts)

Follow-up to the Phase 1 rollout below. Ran two E2E redesigns
(Positive Change Group + people-made.com) with the new ruleset, then
reviewed the generated HTML. Every new rule in this entry was prompted
by a real visible bug in one of those two outputs.

**From the PCG "Our Positive Change companies" section — cards floated
off-grid during scroll:**

- **Never attach two separate scroll timelines to the same property on
  the same element.** The model wrote a pinned reveal timeline that
  animated each card's `y: 0`, then added a second per-card
  `gsap.to(card, { y: …, scrollTrigger: … })` parallax. Both scrubs
  fight — one says `y: 0`, the other `y: -800`, GSAP last-writer-wins
  frame-by-frame, cards drift off-screen mid-scroll. Added to both the
  non-cinematic `<animations>` block and the cinematic `<safety-rules>`.

- **Never multiply raw `y` by `window.innerHeight`.** Same section had
  `y: () => -30 * depth * window.innerHeight` where `depth` was 0.02–0.05
  — resolved to ~540–1350 px of translate, far larger than card height.
  The prompt already capped `yPercent` at ±30 but nothing covered raw
  `y`. Rule: use `yPercent` (element-relative) capped ±30, or raw `y`
  capped ±200 px with no viewport multipliers.

**From the PCG "Our vision" section — body paragraphs overflowed:**

- **`whitespace-nowrap` is scoped to nav links / short pill buttons
  only.** The model applied `whitespace-nowrap` to a section's inner
  content wrapper. It cascaded to every descendant, so two body
  paragraphs rendered on single lines and overflowed the viewport —
  defeating their `max-w-[52ch]` constraint. Added explicit scope rule:
  `whitespace-nowrap` never belongs on a section wrapper, paragraph
  parent, or block containing body copy.

**From the people-made.com nav — cluttered and unreadable:**

- **Prefer a wordmark over a tiny detailed logo SVG.** The generator
  traced the People Made stamp/badge as 20+ distinct path glyphs in a
  107×108 viewBox, rendered at `h-8 md:h-10` (32–40 px). At that size
  detail collapsed into visual noise, and the actual brand name sat
  hidden in `<span class="sr-only">`. Rule: if the brand logo is a
  complex stamp/seal (≥ 15 path glyphs), use a text wordmark instead.
  Never hide the visible wordmark while showing an illegible SVG.

- **Do NOT invent nav items that aren't on the source site.** The
  generated nav had a "Search" icon button and a "Get Started" CTA pill
  — neither exists on people-made.com's actual navigation. Inventing
  extras bloats the bar and signals template. Match the source's menu
  set; cap primary nav at 5–7 visible items.

- **Region / locale switchers stay subtle.** The model rendered a
  prominent "Region: UK/Worldwide" pill (label + dropdown) in the
  primary nav row. It ate horizontal space and wrapped to a second row
  on standard viewports. Rule: if the source has a region switcher,
  use a small globe-icon button or move to footer/utility row — never
  a coloured pill occupying 180 px+ of the main bar.

No new storage or pipeline changes, just prompt edits. Re-ran SDK
build; the next generation on either site will pick these up.

### Added — Taste-skill anti-slop rules + seeded Picsum + premium font defaults (2026-04-21)

[packages/sdk/src/utils/prompts.ts](packages/sdk/src/utils/prompts.ts), [packages/sdk/src/models/section-generator.ts](packages/sdk/src/models/section-generator.ts), [packages/sdk/src/models/redesign.ts](packages/sdk/src/models/redesign.ts), [packages/web-ui/src/stores/canvas-store.ts](packages/web-ui/src/stores/canvas-store.ts), [upgrades.md](docs/upgrades.md)

Phase 1 of the upgrade plan from [upgrades.md](docs/upgrades.md). Imports the
anti-slop rules from Leonxlnx/taste-skill that Atelier wasn't enforcing
yet, locks down image determinism, and fixes the default font stack.

**Prompt additions** (both `SECTION_GENERATE_SYSTEM` and
`SECTION_GENERATE_CINEMATIC_SYSTEM`):

- Expanded `<anti-patterns>` with:
  - The "Lila Ban" — no purple/blue AI-gradient aesthetic
    (`from-purple-500 to-blue-500`, violet→indigo combos)
  - Pure `#000000` backgrounds banned — use off-black `#0a0a0a` / `#101014`
    / zinc-950
  - Three-equal-card feature rows banned — force 2-col zig-zag, asymmetric
    grid, or dominant + supporting composition
  - Sudden dark-in-light (or light-in-dark) section arc banned
  - AI copywriting cliché ban: Elevate / Seamless / Unleash / Next-Gen /
    Game-changer / Delve / Tapestry / "In the world of…" / Revolutionize /
    Empower
  - Exclamation marks in success / confirmation messages
  - Lucide / Feather as default icon pack — prefer Phosphor or Heroicons
    with standardised stroke width
  - Cliché icon metaphors (rocketship=launch, shield=security)

- New `<color-rules>` block: one accent maximum, saturation < 80, tint
  shadows to surface hue (no pure-black low-opacity), warm-vs-cool grey
  family consistency.

- New `<typography-rules>` block: `text-wrap: balance` on headings,
  `font-variant-numeric: tabular-nums` in data blocks, sentence case over
  Title Case, `max-w-[65ch]` on body paragraphs, serif-on-dashboards
  banned.

- Extended `<layout-rules>` / `<fit-rules>`: anti-centre bias for hero
  and editorial blocks, bottom-align CTAs in card groups (`mt-auto`),
  baseline-align feature lists across pricing/comparison columns, prefer
  CSS Grid over flexbox percentage math.

**Image determinism** — replaced every `picsum.photos/WIDTH/HEIGHT?random=N`
reference across
[section-generator.ts](packages/sdk/src/models/section-generator.ts),
[redesign.ts](packages/sdk/src/models/redesign.ts), and
[prompts.ts](packages/sdk/src/utils/prompts.ts) (including the worked
example) with seeded URLs (`/seed/{brand-slug}-{context}/WIDTH/HEIGHT`).
`?random=N` re-shuffles on every page reload so deployments looked
different each time — seeded URLs are deterministic per project+context.

**Font defaults** — swapped
[`DEFAULT_DESIGN`](packages/web-ui/src/stores/canvas-store.ts#L148-L156) from
`Noto Serif` / `Inter` / `Work Sans` to `Cabinet Grotesk` / `Geist` /
`JetBrains Mono`. Inter is the single most ubiquitous AI-default font and
instantly signals generic output. Brand extraction still overrides these
per-project when real fonts are detected on the source site.

**Why:** taste-skill's research showed LLMs have statistical biases
toward these specific UI clichés — centred hero text, three equal cards,
purple-blue gradients, pure black backgrounds, Inter everywhere,
exclamation-mark confirmations. Each rule above counters one of those
biases. The fix-priority ordering (fonts → palette → states → layout →
components → states → typography) from redesign-skill will land in
Phase 4's staged-refine split.

Verified: SDK and web-ui typecheck clean, section-parser regression
confirms no impact on parsing output (people-made.com still 7 sections).

### Fixed — Section parser over-split card grids into one section per card (2026-04-20)

[packages/sdk/src/utils/section-parser.ts](packages/sdk/src/utils/section-parser.ts), [packages/sdk/src/utils/spa-section-parser.ts](packages/sdk/src/utils/spa-section-parser.ts)

Follow-up to the earlier parser relaxations. After the previous pass
kept more visual-heavy sections alive, the parser swung the other way on
agency/portfolio sites: every case-study card in a grid became its own
fullscreen cinematic section. people-made.com generated 4 separate
scroll-pinned sections for the Currys/Meta/InterContinental/Wendy's
cards when the live site shows them as one 2×2 grid.

Added a new `coalesceCardGrids` pass that runs **before**
`mergeTinySections`. It groups content sections by their root element's
first-two-token class signature; every group with ≥3 same-class
siblings becomes one merged section. A middle-expansion step pulls in
any content section sandwiched between first and last group members
that carries a heading (h1–h3) — that catches the odd case where one
card in the grid wears a slightly different wrapper class.

Supporting changes:

- Captured `fullHtmlMediaCount` and `fullHtmlHadHeading` on
  `ParsedSection` at parse time, from the untruncated element HTML.
  `rawHtml` is capped at 8000 chars so downstream checks for
  image-heavy / heading-bearing sections were missing media tags and
  headings that lived past the cap on 30 KB case-study cards.
- New `dedupeByTextFingerprint` drops content sections whose first
  60 chars of text match another section's — the walker sometimes
  surfaces both an outer wrapper and its inner content.
- Tightened `isVisuallyRich`: plain `flex\s` / `grid\s` utility
  classes no longer count as a "preserve this section" signal on
  their own (too common to be meaningful). Concrete layout signals
  like `grid-cols-`, `logo-grid`, `card-grid`, `client-logos` still
  preserve, as do ≥3 media tags combined with ≥30 chars of text.
- `parseSectionsWithFallback` now prefers legacy whenever it finds
  strictly more sections than SPA (was `spa.length + 1`). Legacy's
  new card-grid coalesce lands a more faithful structure on agency
  sites where SPA's containment resolution collapses everything
  into one wrapper.

**Measured impact** on people-made.com HTML (crawl4ai, post-rebuild):
12 → 7 sections. The 4 case-study cards collapse into one "Currys /
Meta / InterContinental Hotels & Resorts" grid (Wendy's lands in a
sibling "Featured Work" block that also picks up the logo wall).
Nav, Hero, Agenda CTA, "How can we help?", and Footer all preserved.

### Fixed — Section parser collapsed visual-heavy marketing sections (2026-04-20)

[packages/sdk/src/utils/section-parser.ts](packages/sdk/src/utils/section-parser.ts), [packages/sdk/src/utils/spa-section-parser.ts](packages/sdk/src/utils/spa-section-parser.ts)

On modern agency/marketing sites (people-made.com, Positive Change Group)
the parser was returning 4–5 sections out of ~11 real ones. Case-study
grids, client-logo walls, single-line CTA banners, office-locations blocks
and the second half of split footers were all being dropped. The pipeline
still generated a passable page, but the redesign lost structural fidelity
with the source.

Four compounding filters were over-aggressive:

1. **`mergeTinySections` in `section-parser.ts`** collapsed any content
   section under 100 text chars into its neighbour — killing card grids,
   logo walls, and CTAs that are visually distinct but terse. Now exempt
   when the section has ≥3 `<img>`/`<svg>` tags, a grid/flex class, a
   heading (h1–h3), or matches a CTA-banner pattern (button + short
   headline or CTA copy like "view more", "get in touch").

2. **`parseSectionsSPA` acceptance threshold in `spa-section-parser.ts`**
   required 120 chars for non-footer candidates. Lowered to 40 for
   image-heavy (≥3 imgs/svgs) and CTA-banner blocks.

3. **`mergeTinyAdjacent` in `spa-section-parser.ts`** used the same
   across-the-board threshold — applied the same visual-distinct
   exemption.

4. **`parseSectionsWithFallback` SPA-first path** always returned the SPA
   parser's result when SPA-detect confidence ≥ 0.60, even when the legacy
   parser found materially more sections. people-made.com hit exactly 0.60
   confidence: SPA produced 5, legacy produced 12 (with all 4 case
   studies). Now always races both parsers and uses legacy when it finds
   noticeably more (>+1) than SPA. SPA's stricter filtering still wins on
   hydration-shell sites where legacy under-delivers.

Also in `section-parser.ts`: the single-match footer rule was replaced so
sibling footer blocks (nav vs. legal/copyright) both survive; second and
subsequent footers are labelled "Footer Legal" when they carry ©/privacy
language, otherwise "Footer N".

**Measured impact** on people-made.com HTML (crawl4ai, post-rebuild):
4 → 12 sections (Nav, Hero "For the change ahead", 2026 People Agenda,
Currys, Meta, InterContinental, Wendy's, "How can we help your brand?",
Footer — plus three untitled content blocks covering the logo grid and
offices). No regressions on static-site fixtures in the SPA.md set
(Adidas, IKEA, Linear, Stratton Craig all clear the ≥6 threshold the
same way they did before).

### Fixed — Design system card leaked across projects (2026-04-20)

[packages/sdk/src/storage/interface.ts](packages/sdk/src/storage/interface.ts), [packages/sdk/src/storage/sqlite.ts](packages/sdk/src/storage/sqlite.ts), [packages/sdk/src/storage/memory.ts](packages/sdk/src/storage/memory.ts), [packages/api-server/src/routes/analytics.ts](packages/api-server/src/routes/analytics.ts), [packages/web-ui/src/utils/api.ts](packages/web-ui/src/utils/api.ts), [packages/web-ui/src/stores/canvas-store.ts](packages/web-ui/src/stores/canvas-store.ts), [packages/web-ui/src/App.tsx](packages/web-ui/src/App.tsx), [designsystemrefresh.md](docs/designsystemrefresh.md)

Switching projects in the web UI left Project A's extracted-design-system
card on the canvas for Project B, and Project B's own card never rendered.
Two compounding root causes:

1. `designSystem` and `extractedTokens` lived in a single global Zustand
   slice with no project key, and `designSystem` was persisted to a single
   `localStorage` key (`atelier-design-system`) shared by every project.

2. The card-restore block in `handleOpenProject` was guarded by
   `if (!extractedTokens)`, so once Project A populated the card, loading
   Project B short-circuited and reused A's tokens.

Made the server the source of truth for the user-facing design system:

- **Storage layer**: added `setCanvasDesignSystem` / `getCanvasDesignSystem`
  on `StorageAdapter`, implemented in `SQLiteStorage` (new
  `canvas_design_system TEXT` column with PRAGMA-based migration for
  existing dbs) and `MemoryStorage`. Kept separate from the SDK's
  `setDesignSystem` (which backs screen generation) so the two concerns
  don't drift.

- **HTTP**: added `GET` and `PUT /api/projects/:pid/design-system` with the
  same ownership check used by `GET /api/projects/:pid`, plus a 256 KB
  payload cap on PUT.

- **Web-ui API**: `fetchDesignSystem` / `saveDesignSystem` helpers in
  `utils/api.ts`.

- **Store**: per-project `localStorage` key `atelier-design-system:<pid>`,
  reset of `designSystem` / `extractedTokens` / `marks` /
  `selectedScreenId` / `editingScreenId` whenever `setProject` sees a new
  pid, and a 400 ms trailing-edge debounced server PUT from
  `updateDesignSystem` (cancelled on project switch to prevent
  cross-project writes).

- **Loader**: `handleOpenProject` now fetches the design system in parallel
  with screens, seeds fast from the per-project `localStorage` cache,
  reconciles on server response, and re-derives the canvas card
  unconditionally (guard dropped — the store reset handles stale state).
  On null server response it one-shot seeds from the legacy global
  localStorage blob and saves it to the server for that project, so users
  don't lose their single "saved" design system on upgrade.

**Why:** cross-project state leaks are a trust bug — users assume each
project is its own container. Making the server the source of truth also
unlocks multi-device sync and survives cache clears. Flat store shape
matches how `screens` are already handled.

Full design doc: [designsystemrefresh.md](docs/designsystemrefresh.md).

### Changed — Default generation model bumped to Kimi K2.6 (2026-04-20)

[packages/sdk/src/utils/router.ts](packages/sdk/src/utils/router.ts), [.env.example](.env.example)

Flipped `vision_interpret`, `layout_generate`, `design_refine`, and
`section_generate` primaries from `moonshotai/kimi-k2.5` to
`moonshotai/kimi-k2.6`, with K2.5 now the fallback for each stage.

**Why:** K2.6 released 2026-04-20 and was validated across four E2E runs
(Adidas 2024 + 2025, Stratton Craig, Positive Change Group) — the final
Positive Change Group run hit 10/10 UICrit with 0 issues, cleanly
applying all stacked prompt fixes (nav clearance, unique `sec-N-cine`
namespaces, logo selection, etc.). Quality uplift is real on our
pipeline.

**Cost impact:** K2.6 is ~2.3× input ($0.95 vs $0.42 per M) and ~1.8×
output ($4.00 vs $2.20 per M) vs K2.5. With 4 stages switched and
typical per-redesign output, expect roughly a 2× model-spend increase on
generation stages. DeepSeek-backed stages (intent_parse, code_render,
design_extract) are unchanged.

**Fallback strategy:** K2.5 is still a proven-good model, so keeping it
as the per-stage fallback means OpenRouter quality/availability dips
degrade gracefully to the previous-known-good default instead of
jumping across vendors.

### Fixed — Company/partner logos filtered out of source-image pool (2026-04-20)

[packages/sdk/src/utils/source-image-extractor.ts](packages/sdk/src/utils/source-image-extractor.ts), [packages/sdk/src/models/section-generator.ts](packages/sdk/src/models/section-generator.ts)

Positive Change Group "Our group companies" section rendered generic inline
SVG icons (globe, people, pencil, tablet) next to Black Sun / People Made /
Stratton Craig / GoCo cards instead of the real company logos that live at
`/images/logos/blacksun.svg`, `.../peoplemade.svg`, `.../goco.svg`, and
`.../stratton-craig.png` on the source site. Three compounding root causes:

1. **`source-image-extractor.ts` blacklisted any URL containing "logo"** —
   originally meant to drop tiny nav favicons, but it also killed legitimate
   content logos (client/partner/portfolio/group-company logos). Removed
   "logo" from `SKIP_URL_FRAGMENTS`. Tiny chrome logos without width/height
   still score negatively via `scoreCandidate` and drop off.

2. **No positive signal for `/logos/`, `/clients/`, `/partners/` folders** —
   added these to `CONTENT_PATH_HINTS` so logo galleries score positively
   rather than competing with hero photos for a threshold they couldn't win.

3. **Per-section rotating image window was too narrow** — each content
   section got only 6 images starting at `index*4`. With 10 images on the
   page including 4 logos, section 6 often didn't see all 4 logos. Switched
   content-section distribution to the full pool capped at 12 — token cost
   of ~12 × 100-char URLs is trivial (<1.5K chars) and the model can pick
   the right asset per slot. Hero still gets top-3 ranked, nav/footer still
   skip imagery.

Also tightened the `<source-images>` prompt: when rendering a card about a
specific company/client/partner, prefer the URL whose filename matches the
company name (e.g. card titled "Black Sun Global" → `.../logos/blacksun.svg`).
Explicit ban on replacing company logos with generic inline SVG icons when
the real logo is in the pool.

### Fixed — Nav logo bleed, wrapping nav links, hallucinated per-card KPIs (2026-04-20)

[packages/sdk/src/utils/prompts.ts](packages/sdk/src/utils/prompts.ts), [packages/sdk/src/models/section-generator.ts](packages/sdk/src/models/section-generator.ts)

Positive Change Group redesign surfaced three recurring issues that the
existing prompt guardrails didn't catch:

1. **Nav logo overflowed the 72px bar and bled into the hero**. Root cause:
   the blanket `<imagery>` rule requires every `<img>` to emit
   `style="object-fit:cover;max-width:100%;height:auto;"`. Inline styles
   beat Tailwind height classes, so `height:auto` made the logo render at
   its natural 129px height even though the class said `h-10` (40px).
   Fixed by splitting the imagery rule — content images still need
   `height:auto`, but nav/header logos get `style="max-width:100%;
   object-fit:contain;"` (no `height:auto`) so the Tailwind height class
   governs. Also added an explicit "nav bar height is h-[72px]; logo must
   fit" rule to the nav role hint in `buildSectionPrompt`.

2. **Nav links wrapped to 2 lines** ("Spark positive change", "for our
   group companies") because they lacked `whitespace-nowrap`. Added
   `whitespace-nowrap` requirement to both the `<layout-rules>` block
   (non-cinematic) and the `<fit-rules>` block (cinematic), plus the nav
   role hint.

3. **Tightened "no invented numbers" guardrail (prophylactic, not in
   response to a real failure)**. Initial review of the Positive Change
   Group output thought the GoCo card's 70/120/98% stats were fabricated;
   crawl4ai-backed diff against the live site showed they ARE real ("GoCo
   proudly serves over 70 global clients, with more than 120 live jobs...
   a 98% customer satisfaction score"). No hallucination actually occurred
   on this run. The stricter rule stays in the prompt as insurance — it
   requires the exact number to appear verbatim in `<source-content>`
   before any `data-counter`/`data-target` is emitted. Worth keeping given
   the Adidas 2024 `dashboard` section did invent KPIs in a prior run,
   even if this specific output was correct.

### Fixed — Animation brief captured twice per cinematic run (2026-04-20)

[packages/sdk/src/models/redesign.ts](packages/sdk/src/models/redesign.ts)

Every cinematic run showed two "Capturing 6-frame scroll sequence" log lines
~40s apart — and was doing the full screenshot + Qwen3-VL brief twice. Root
cause: `redesign.ts` captured the brief for its single-call prompt at ~L380,
then delegated to `generatePageSectioned` which re-captured the same brief
for per-section prompt injection. Worse, the single-call path couldn't even
use the brief — the capture gate was `cinematicDetected && fetchSucceeded`,
but `cinematicDetected === true` also triggers the sectioning delegation,
so the single-call path was unreachable whenever the brief existed. Dead
capture for ~9s + one Qwen3-VL call per run, wasted. Removed the capture
from `redesign.ts` entirely — `generatePageSectioned` is now the sole owner
of the screenshot + brief work, called once per sectioned run. Single-call
path now always sees an empty brief string (which was its real state under
the old code too — the brief was dead code there).

### Fixed — Pinned-section content clipped by fixed navbar (2026-04-20)

[packages/sdk/src/utils/prompts.ts](packages/sdk/src/utils/prompts.ts)

Stratton Craig preview showed "OUR STORY" eyebrow (and every pinned
section's first element) half-clipped at the top by the fixed 72px navbar.
Root cause: inner containers emitted `py-12 py-[80px]` — two conflicting
padding-y utilities that one silently loses depending on Tailwind's CSS
output order. Even when `py-[80px]` won, 80px-72px = only 8px of clearance
below the nav, which gets eaten by font-metric variance. Fixed by adding
two new rules to both section prompts:
1. **Fixed-nav clearance**: require `pt-[120px]` on `justify-start`
   containers of pinned sections (48px breathing room below the 72px nav).
2. **No conflicting padding shorthand**: explicit ban on `py-12 py-[80px]`,
   `px-8 px-[40px]`, `p-4 p-[20px]`, etc. Use a single shorthand or
   direction-specific utilities (`pt-[120px] pb-[80px]`), never both.
Cinematic and non-cinematic prompts both got the rules. The rule lives in
`<layout-rules>` for the non-cinematic prompt and `<fit-rules>` for the
cinematic prompt.

### Fixed — Duplicate class-prefix collisions across sibling sections (2026-04-20)

[packages/sdk/src/models/section-generator.ts](packages/sdk/src/models/section-generator.ts), [packages/sdk/src/utils/prompts.ts](packages/sdk/src/utils/prompts.ts)

Stratton Craig run produced two sections that both used `textblock-cine`
as their CSS/JS namespace prefix — because both were labeled "Text Block
Content" (a generic Webflow class name) and the model derived the prefix
from the label. Result: 38 class refs split across two sections competing
for the same `.textblock-cine__*` selectors, so GSAP ScrollTriggers and
CSS @keyframes fired on both sections at once, timelines merged
incorrectly, and content layouts overlapped. Fix: `buildSectionPrompt()`
now injects a deterministic `<section-namespace>` block giving the model
an explicit prefix derived from section index (`sec-1-cine`, `sec-2-cine`,
etc.) — the model never has to invent one from the label. Both system
prompts were updated to reference `<section-namespace>` instead of
"section prefix (e.g. .hero-cine__)". Cinematic prompt's `<safety-rules>`
now points ScrollTrigger id derivation at the namespace block too.

### Fixed — `premiumScroll` param ignored by sectioning gate (2026-04-20)

[packages/sdk/src/models/redesign.ts](packages/sdk/src/models/redesign.ts)

`redesignFromURL` accepted a `premiumScroll` parameter but the sectioning
gate only checked `cinematicDetected`, so callers passing `premiumScroll: true`
for a site without GSAP/ScrollTrigger patterns (e.g. strattoncraig.com — a
plain Webflow agency site) silently dropped into the single-call
`generatePage` path with no sections. Also line 498 was hardcoding `true`
for the forwarded premiumScroll flag, which would force the CINEMATIC prompt
variant even if cinematic wasn't actually auto-detected. Fixed by honouring
`premiumScroll === true` as a force-cinematic override alongside
`cinematicDetected`, and passing the resolved flag through to
`generatePageSectioned` instead of a hardcoded `true`. Callers can now opt
into sectioned cinematic generation for any fetchable site.

### Fixed — Sites with reCAPTCHA falsely flagged as blocked (2026-04-20)

[packages/sdk/src/models/redesign.ts](packages/sdk/src/models/redesign.ts)

strattoncraig.com (and any site with a Google reCAPTCHA contact form) was
having `fetchSucceeded` set to false because `isBlocked()` uses
`html.includes("captcha")` to detect challenge pages — which also matches
legit reCAPTCHA script tags like `src="https://www.google.com/recaptcha/
api.js"` and copy like "Disconnecting from reCAPTCHA". With
`fetchSucceeded=false`, cinematic detection, section parsing, business-info
enrichment, and the sectioned generation flow were all gated out, forcing
the single-call fallback path and losing all structural awareness of the
page. Fix: switched `captcha` to a word-boundary regex (`/\bcaptcha\b/i`)
so it matches bare "captcha" (what real challenge pages show) but not
"recaptcha" or "reCAPTCHA" (legitimate form widgets). Other block markers
("Challenge Validation", "cf-browser-verification", "Just a moment",
"Checking your browser") remain substring-matched since they're specific
enough to not false-positive.

### Fixed — Brand extraction skipped on hydration-shell SPAs (2026-04-20)

[packages/sdk/src/models/redesign.ts](packages/sdk/src/models/redesign.ts)

Sites like strattoncraig.com (Webflow-hosted copywriting agency) fetched 150K
chars of HTML but `fetchSucceeded` was flipped to false because `isBlocked()`
treats HTML whose stripped-text length is < 200 as blocked — a signal meant
to catch Cloudflare challenge pages that also mistriggers on JS-hydrated
SPAs with minimal pre-rendered body copy. The `fetchSucceeded` flag gated
brand extraction, so colors/fonts/logos were silently skipped even though
all the brand CSS was present in the HTML. Root fix would be to loosen
`isBlocked` but that flag cascades into business-info, text content, and
sectioning, so it's scope-risky to touch. Narrow fix instead: decouple brand
extraction from `fetchSucceeded`. Extractor only needs raw HTML (reads CSS
`<link>` tags, inline styles, Google Fonts URLs) — gate now just requires
HTML presence > 500 chars. Hydration-shell SPAs will regain colors/fonts/
logos while still falling through to the fetchSucceeded-gated paths for
text-dependent work (business-info, sectioning, persona matching).

### Fixed — Footer/nav sections stripped by cookie-chrome filter (2026-04-20)

[packages/sdk/src/models/section-generator.ts](packages/sdk/src/models/section-generator.ts)

Adidas 2025 report parsed 9 sections including a footer, but the GENERATE
phase only saw 8 — the footer was being dropped silently. Root cause: the
cookie-chrome filter added in the earlier cookie-banner fix checks the first
300 chars of `textContent` against `/\bcookie\b|consent|gdpr|\bprivacy.../`.
Most site footers list "Privacy Policy", "Cookie Policy", "Cookie Settings"
as standard footer links — exactly the strings designed to catch cookie
consent banners. Same trap applies to navs that link to these pages. Fixed by
short-circuiting the filter for `role === "nav"` and `role === "footer"` —
structural sections can't be consent banners regardless of their content.
Keep the filter active for content-role sections where cookie dialogs still
need stripping.

### Fixed — Anti-pattern rules to kill "AI-generated" look (2026-04-20)

[packages/sdk/src/utils/prompts.ts](packages/sdk/src/utils/prompts.ts)

Nike redesign produced glassmorphism stat cards with invented KPIs (€2.4B
revenue, 47% digital share, donut charts, gradient progress bars) on a product
page that has none of these in the source. This is the most common "AI look"
failure — the model defaults to dark dashboard widgets when told to be
"premium". Added `<anti-patterns>` block to both `SECTION_GENERATE_SYSTEM` and
`SECTION_GENERATE_CINEMATIC_SYSTEM` banning: glassmorphism cards, decorative
progress bars, donut/pie SVGs, fake KPI grids, glow text-shadows, green
percentage badges, gratuitous micro-gradients, and transparency stacking. Also
strengthened the `<quality>` block to explicitly prohibit inventing numeric data
not present in the source content. Removed `report.adidas-group.com` as the
quality anchor for the non-cinematic prompt (it steered the model toward annual
report patterns on product pages).

### Fixed — Cookie consent / GDPR banners generated as full sections (2026-04-20)

Nike redesign generated a full-screen cinematic cookie consent section as the
first section of the page. Root cause: Nike's HTML fell through to the AI
section planner (only 3 sections parsed), and the planner saw cookie-related
text in the first 5000 chars of content and planned it as a "Cookie Consent
Banner" hero section. Three gaps allowed this:

1. The AI planner prompt had no exclusion rule for cookie/GDPR/consent chrome.
2. No post-filter existed to catch cookie sections that slip through planning.
3. The legacy parser's cookie filter had a 500-char text cap — detailed cookie
   banners with toggle descriptions easily exceed that.

Three-layer fix:

- [packages/sdk/src/models/section-generator.ts](packages/sdk/src/models/section-generator.ts):
  - Added explicit exclusion instruction to the AI planner prompt: "NEVER create
    sections for cookie consent banners, GDPR notices, privacy preference modals..."
  - Added a post-filter after both the parser and AI planner paths that strips
    any section whose label or first 300 chars of text match
    `/cookie|consent|gdpr|privacy\s+(preference|setting|choice|control|banner|notice)/i`.
    Re-indexes remaining sections after stripping.
- [packages/sdk/src/utils/section-parser.ts](packages/sdk/src/utils/section-parser.ts):
  - Raised the cookie/consent structural filter text cap from 500 → 2000 chars.
  - Added `privacy.?prefer` to the regex to catch "Privacy Preferences" banners.

### Fixed — Section parser: strip hidden top-level elements before unwrap (2026-04-20)

Sites like Tesla wrap huge preloaded/template content in hidden top-level divs
(e.g. `class="tds--is_hidden"`, 843K of SVG logos). These inflated the element
count so `needsUnwrap` evaluated to `false`, and inflated `bodyContent.length`
so the 25%-of-body wrapper threshold was unreachable for the real content div.
Result: the parser saw only a footer and punted to the AI planner with almost
no context.

Two-part fix in [packages/sdk/src/utils/section-parser.ts](packages/sdk/src/utils/section-parser.ts):

1. **Filter hidden top-level elements** before the unwrap decision. Matches
   `hidden`, `is_hidden`, or `display:none` in the opening tag's class/style.
   This lets `needsUnwrap` see only visible children (Tesla: 6 → 3, triggering
   the `< 6` unwrap path).
2. **Subtract hidden element byte sizes** from the body length used for the
   wrapper-detection threshold. This preserves the original 25% ratio relative
   to visible content, so the real content div (Tesla's `div.tds-shell` at 158K
   out of 170K visible) correctly qualifies as a wrapper and gets unwrapped.

Tesla still hits the AI fallback (its `tcl-section` divs contain 0 visible
text — it's effectively a hydration shell), but now feeds 3 sections (Hero,
content, Footer) instead of 1 (Footer) into the planner, giving it
substantially more context.

Regression-tested against Apple, Samsung, Converse, Reebok, Under Armour, Puma,
ASOS, and H&M — all unchanged section counts.

### Fixed — Marquee/ticker sections not spanning full viewport width (2026-04-20)

Generated marquee sections (infinite-scrolling text tickers) weren't rendering
full-width because the generation prompts had no reference pattern for marquees.
The model was producing `flex whitespace-nowrap` tracks without `w-max` on the
track or `overflow-hidden` on the container, and without duplicating the content
for seamless looping.

Files:

- [packages/sdk/src/utils/prompts.ts](packages/sdk/src/utils/prompts.ts):
  - Added **Example D** (full-width infinite marquee) to the cinematic worked
    examples. Shows the correct pattern: `overflow-hidden` outer, `w-max` +
    `flex whitespace-nowrap` track, duplicated content, CSS `@keyframes marquee`
    with `translateX(-50%)`.
  - Added a one-line marquee rule to the non-cinematic `SECTION_GENERATE_SYSTEM`
    prompt's output-rules so both generation paths produce correct marquees.

### Added — Sector-persona affinity + sector expansion (2026-04-14)

Adidas e2e v2–v4 all classified correctly (`consumer-goods` then `sportswear`)
but the persona scorer kept landing on mid-century-modern / space-agency / etc.
— never sports-dynamic. Root cause: the brand-extractor picks `#6aabcf` (a UI
accent on the report site) as the primary brand color, and that color's Aaker
profile drags the fused brand vector toward "techy/futuristic" personas,
overriding even a conf=0.90 sportswear sector signal. Aaker fusion is too
blunt when signals disagree — it smears toward the center.

Two-part fix:

1. **Expand the `Sector` enum from 20 → 31 values.** The old `consumer-goods`
   bucket conflated adidas with Unilever. Added: `sportswear`,
   `beauty-cosmetics`, `fashion-apparel`, `gaming`, `hardware-consumer`,
   `dev-tools`, `legal`, `government-public`, `crypto-web3`,
   `logistics-shipping`, `music-audio`.
2. **Direct sector→persona affinity** layered on top of Aaker scoring, so
   sectors with strong domain knowledge can override a misleading fusion
   without touching the general mechanism.

Files:

- [packages/sdk/src/utils/business-info.ts](packages/sdk/src/utils/business-info.ts):
  - `Sector` type, `SECTOR_VALUES`, and zod `ClassifySchema` extended with the
    11 new values.
  - Classifier system prompt rewritten with explicit per-sector disambiguation
    rules ("sportswear NOT fashion-apparel or consumer-goods", "dev-tools is
    the precise subset of saas when audience is developers", etc.) and
    includes named examples (adidas, Nike, Stripe, Apple, Sephora).
- [packages/sdk/src/utils/personas.ts](packages/sdk/src/utils/personas.ts):
  - 11 new `SECTOR_AAKER` vectors. sportswear is
    `[0.3, 0.9, 0.7, 0.2, 0.8]` — high excitement + ruggedness, low
    sophistication, distinct from the `consumer-goods` bucket
    `[0.6, 0.4, 0.5, 0.3, 0.3]`.
  - New `SECTOR_PERSONA_AFFINITY` sparse map. Currently encoded:
    - `sportswear → [sports-dynamic, streetwear-culture, kinetic-typography, bold-modern]`
    - `crypto-web3 → [cyberpunk-futurism, fintech-gradient, neo-grotesque, techno-minimal]`
    - `dev-tools → [techno-minimal, neo-grotesque, swiss-international, corporate-precision]`
    - `gaming → [cyberpunk-futurism, kpop-maximalism, pop-art-digital, retro-computing]`
    - `hardware-consumer → [swiss-international, neo-grotesque, japanese-minimalism, techno-minimal]`
  - New `SECTOR_AFFINITY_BONUS = 0.15`, applied as
    `total += 0.15 * businessInfo.confidence` when `personaId` is in the
    classified sector's affinity list. At conf=0.90 the bonus is +0.135 —
    enough to shift a persona from the alternatives list to #1.
  - `businessTone` weight now scales **1.8× at conf≥0.85** (was flat 0.15),
    so a strongly-classified voice can override a misleading color/font.
  - Intentionally sparse — sectors without a strong persona mapping
    (`general`, `professional-services`, etc.) fall back to pure Aaker
    scoring. Affinity is an override, not a replacement.

**Validated on:**

- 13-site classifier batch (5 regression + 8 new sectors). 9/13 correct;
  3 NULLs are fetch-layer bot blocks (epicgames, coinbase, spotify), not
  classifier errors. 1 real miss (stripe → finance instead of dev-tools —
  classifier over-indexed on "payments" despite the explicit hint).
- Adidas e2e v4 (11m, UICrit 8.7/10): confirmed `sector=sportswear`
  classification, videos wired (3/3 `.mp4` from source, 0 placeholders).
  v4 ran **before** the affinity map landed — persona was still
  space-agency. Affinity fix will be validated in v5.

### Added — Source video wiring (2026-04-14)

Videos were extracted by the asset miner but silently dropped — `fetchedContent.sourceVideos` propagated through the call stack but `section-generator.ts` never consumed it. Kimi had been re-using source video URLs *accidentally* when they happened to fall inside the first 4000 chars of `<original-html>` (noticed on an earlier adidas run where `home-people.mp4` survived that way). Now deterministic.

- [packages/sdk/src/models/section-generator.ts](packages/sdk/src/models/section-generator.ts):
  - `buildSectionPrompt` ctx now accepts `sourceVideos?: string[]`
  - New `<source-videos>` block in the prompt, sibling to `<source-images>`,
    instructing Kimi to prefer these URLs for `<video autoplay muted loop playsinline>` and to ignore the block if no video fits the section purpose
  - New `sectionSourceVideos(pool, role, index)` helper: hero gets the first
    2, content sections rotate one at a time, nav/footer get none (videos
    are scarcer and heavier than images — distribute conservatively)
  - Wired into `generatePageSectioned`'s ctx at the same callsite as
    `sectionSourceImages`

**Validated on:**

- Adidas v3 cinematic (20m, UICrit 9.7/10): 4 `<video>` tags in output,
  4/4 pointing at `report.adidas-group.com/_assets/videos/*.mp4`, 0
  placeholder URLs. Highest UICrit score of the 4 e2e runs so far.

### Added — BusinessInfo pipeline (2026-04-14)

Sector-aware classification that replaces the regex industry guess as the
strongest signal in the persona scorer and grounds Kimi's section copy to
the right vocabulary and voice. Research + design in
[businessinfo.md](docs/businessinfo.md).

- New [packages/sdk/src/utils/business-info.ts](packages/sdk/src/utils/business-info.ts)
  - `Sector` enum (20 values) + `Tone` enum (8 values)
  - `extractBusinessSignals(html)` — pulls meta description, `og:description`,
    `twitter:description`, JSON-LD `description`, first `<p>` in
    `<main>`/`<article>`, and first-nav `<a>` labels
  - `classifyBusinessInfo(signals, brandName, router)` — one JSON-mode call
    via the existing `intent_parse` stage (DeepSeek chat v3-0324,
    zod-validated, ~3–5s)
  - `getOrCreateBusinessInfo(url, html, brandName, router)` — 30-day
    in-memory cache by root domain
  - `formatCompanyBlock(info)` — compact `<company>` block for prompt
    injection
  - Env flags: `CANVAS_BUSINESS_INFO_DISABLE=1` (kill switch),
    `CANVAS_BUSINESS_INFO_TTL_DAYS=N` (override cache TTL)
- Exported from [packages/sdk/src/index.ts](packages/sdk/src/index.ts):
  `extractBusinessSignals`, `classifyBusinessInfo`,
  `getOrCreateBusinessInfo`, `formatCompanyBlock`,
  `BUSINESS_INFO_SECTORS`, `BUSINESS_INFO_TONES`, and the types
  `BusinessInfo`, `BusinessSignals`, `Sector`, `Tone`
- [packages/sdk/src/models/redesign.ts](packages/sdk/src/models/redesign.ts):
  calls `getOrCreateBusinessInfo` after `extractBrandName` in both
  `redesignFromURL` (direct + cinematic delegation) and `planRedesign`.
  Threads result through `autoMatchPersona` and `planRedesign.fetchedContent.businessInfo`.
- [packages/sdk/src/utils/personas.ts](packages/sdk/src/utils/personas.ts):
  - `BrandSignals.businessInfo?: BusinessInfo | null` field added
  - New `SECTOR_AAKER` lookup (20 sectors → Aaker 5D)
  - New `TONE_AAKER_BIAS` lookup (8 tones → Aaker 5D)
  - `AAKER_SIGNAL_WEIGHTS` rebalanced:
    `industry 0.30 / tone 0.20 / businessTone 0.15 / color 0.15 / font 0.10 / url 0.10`
    (sum = 1.00)
  - `scoreAllPersonas`: when `businessInfo.sector !== "general"`, the LLM
    sector replaces the regex industry keyword guess. Sector weight scales
    by `max(0.3, confidence)`. New `businessTone` signal fuses the LLM
    tone vector with its own 0.15 weight.
- [packages/sdk/src/models/section-generator.ts](packages/sdk/src/models/section-generator.ts):
  - `generatePageSectioned` accepts optional `businessInfo` param, falls
    back to `fetchedContent.businessInfo`
  - Injects `<company>` block into section prompts, suppressed when
    `confidence < 0.5` to avoid misleading Kimi with weak classifications
- [packages/sdk/src/utils/prompts.ts](packages/sdk/src/utils/prompts.ts):
  new `<company-context>` directive in `SECTION_GENERATE_CINEMATIC_SYSTEM`
  — terminology grounding, voice matching, audience framing, conflict
  resolution (*source content wins* on contradictions)
- [packages/sdk/src/models/project.ts](packages/sdk/src/models/project.ts):
  `fetchedContent` type extended with optional `businessInfo` so it
  propagates from `planRedesign` → `Project.generatePageSectioned` →
  api-server without touching `api-server/routes/screens.ts`.

**Validated on:**
- 8 batch-classifier tests: stripe (finance/technical-precise 0.95), rolex
  (luxury-retail/aspirational-luxury 0.95), mayoclinic (healthcare/warm
  0.95), linear (saas/technical-precise 0.90), airbnb (travel-hospitality/
  warm 0.95), redcross (nonprofit/warm 0.95), tesla (automotive/bold
  0.90), theverge (editorial-media/editorial-thoughtful 0.95). **8/8
  correct, 0 forced "general" fallbacks.**
- Full cinematic e2e on report.adidas-group.com (11m 5s, 9/9 sections,
  UICrit 8.7/10 PASS): log shows
  `business-info: consumer-goods/bold-confident conf=0.90 (injected)` — the
  `<company>` block fired on the sectioned path as designed.

**Deferred (recorded in [businessinfo.md §7 Phase 6](docs/businessinfo.md#phase-6--polish-deferred)):**
persisting `BusinessInfo` to `BrandCache` storage adapter, unit test
fixtures, non-cinematic prompt directive, `--print-business-info` CLI flag.

### Fixed — Orphaned hidden-states safety net (2026-04-14)

Kimi sometimes ships HTML where elements carry `opacity-0` / `translate-y-*`
/ `.clip-reveal` initial classes but the inline `<script>` block that
reveals them is missing or broken. The old safety net only handled a
narrow set of patterns.

- [packages/sdk/src/utils/orphaned-hidden-states.ts](packages/sdk/src/utils/orphaned-hidden-states.ts):
  - **Fixed clip-path regex**: old rule used `\b100%\b` which never
    matched (`%` isn't a word character). Now matches any `clip-path:
    inset(...)` that contains `100%` or `50%`.
  - **Broadened Tailwind hidden-utility detection**: new `HIDDEN_UTILITY_RE`
    covers `opacity-0`, `invisible`, `clip-reveal`, `scale-0/50`,
    `translate-y-{5,8,10,12,16,20,24,32,40,48,full,[arbitrary]}` and
    `-translate-y-*` / `translate-x-*` / `-translate-x-*` variants.
    Deliberately excludes small values (`translate-y-1/2` etc.) since
    those are usually layout centering, not hidden states.
  - **New `hasRevealLogic(scriptContent)`** — scans inline scripts for GSAP
    tweens, `classList.add/remove`, `setAttribute("class", ...)`,
    `.className = `, or `.style.opacity/transform/visibility =`. Zero
    matches means nothing will ever un-hide the elements.
  - **New `injectScrollRevealScript(html)`** — when `hasRevealLogic ===
    false`, injects a compact self-contained `IntersectionObserver`
    reveal script before `</body>`. Elements stay in their hidden initial
    state until they scroll into view, then the observer applies a
    transition and removes the hidden classes, giving a fade/slide-in on
    scroll. Staggers siblings by 60ms within the same observer tick for a
    cascade feel. Graceful fallback for browsers without
    `IntersectionObserver`.
  - **CSS-rule orphan pass is now gated** on `hasRevealLogic === true`, so
    when we inject the reveal script, existing CSS rules (like
    `.clip-reveal { clip-path: inset(0 100% 0 0) }`) stay intact for the
    observer to drive.
  - Called automatically from [redesign.ts:622](packages/sdk/src/models/redesign.ts#L622)
    — no caller changes needed.

**History note:** an earlier iteration of this change tried a "nuclear"
approach (stripping hidden utilities from every element class attribute
when no reveal logic was found). That made content pre-visible but
destroyed designer intent. Reverted in favor of the observer-based reveal
above, which preserves the on-scroll behavior Kimi was reaching for.

### Changed — UI: expandable chat input (2026-04-14)

- [packages/web-ui/src/components/ChatPanel.tsx](packages/web-ui/src/components/ChatPanel.tsx):
  swapped the single-line `<input>` for an auto-growing `<textarea>` with
  `rows={1}`, `resize: none`, and an effect that sets
  `height = min(scrollHeight, 100px)` on every change. Max 5 lines visible
  (100px / 20px line-height), overflow scrolls past that. Enter still
  sends, Shift+Enter now inserts a newline. Container
  `alignItems: center` → `flex-end` so the send button sits at the bottom
  as the box grows.

### Added — Planning document

- [businessinfo.md](docs/businessinfo.md): full research + implementation plan
  for the BusinessInfo pipeline. Section 7 has a per-phase checklist with
  status markers. Section 8 records post-implementation decisions and
  deviations from the original design.

### Known issues / open items

- **Kimi sometimes truncates mid-attribute on large inlined base64 data
  URIs.** Observed on a linear.app redesign run where the footer logo
  `<img src="data:image/svg+xml;base64,...">` was cut off mid-base64 with
  no closing `"` — the rest of the file (including `</footer>`, `</body>`,
  `</html>`, and any injected reveal script) was swallowed as attribute
  content. Current workaround is a one-shot patch script in
  [/tmp/patch-linear.mjs](/tmp/patch-linear.mjs). **TODO:** promote to a
  pipeline safety-net utility (`truncation-patcher.ts`) that runs before
  `fixOrphanedHiddenStates` in [redesign.ts:622](packages/sdk/src/models/redesign.ts#L622).
- **Cinematic pin sections can show a 150px "blank entry" zone** when
  Kimi uses `gsap.from(".image", { clipPath: "inset(100% 0 0 0)", ... })`
  with `scrub: 1`. The reveal unclips top→bottom as you scroll through
  the pin — for the first ~16% of the pin scroll, the section looks
  empty. Seen on Adidas cinematic run v1 ("Explore the Annual Report"
  navmobile-cine section). Not a bug in the image or reveal script —
  it's the timeline pattern itself. **Option to address:** add a rule to
  `SECTION_GENERATE_CINEMATIC_SYSTEM` that prefers `.to()` over `.from()`
  for primary imagery so images start visible and the scrub drives
  parallax/scale refinements instead of un-hiding from blank. Deferred
  pending a reproducibility run (v2).

---

## Prior history

For changes made before this CHANGELOG was started, see `git log`. Some of
the larger features that predate this file:

- Cinematic section generator with pin-reveal sync, content-fade guard,
  transition guard, and fit validator post-processors
- Brand extraction pipeline (colors, fonts, logos) with
  crawl4ai-assisted render + APCA contrast validation
- 52-persona auto-match system with Aaker 5D cosine similarity scoring
- Screenshot service with 6-frame scroll-sequence capture for animation
  brief reverse-engineering
- Auto-memory system for persistent context across conversations
