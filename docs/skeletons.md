# Skeletons — Spec, Rules, and Expansion Plan

Source date: 2026-04-22. Atelier's skeleton library lives at [scripts/skeletons/](../scripts/skeletons/) and is consumed by [scripts/component-engine.ts](../scripts/component-engine.ts) via `--enhance-skeleton <name>` + the programmatic API in [packages/sdk/src/utils/component-generator.ts](../packages/sdk/src/utils/component-generator.ts) (`enhanceFromSkeleton`).

This doc defines **what a skeleton is**, **what makes one good**, and a **phase-checklist** for auditing the current 5 and expanding the library.

---

## 1. What a skeleton is (and what it is not)

A skeleton is a single-concept, brand-agnostic HTML fragment that demonstrates one animation or layout pattern. The engine's default `enhanceFromSkeleton` mode is CSS-only: the LLM returns a `<style>` block and the skeleton HTML ships **byte-identical**. Full-HTML mode exists but is reserved for edge cases.

Implications:

- The skeleton's **HTML is the contract**. Text, class names, data attributes all ship to production.
- The skeleton's **CSS is a slot**. Color, typography, shadow, spacing treatment are filled by Kimi per brand.
- Brand bias leaks **forever** — any slogan, proper noun, or stylised eyebrow ("CHAPTER 01", "KEY FIGURES") baked into HTML becomes an AI tell on every site.

A skeleton is **not**: a whole page, a component library entry, a React component, a persona reference. Atomic Design ladder (Frost 2016): skeletons sit at the **organism** tier — complete enough to ship as a section, abstract enough that atoms (color, copy, image) are slotted in.

---

## 2. How skeletons feed the pipeline

Flow:

1. **Author** a skeleton at [scripts/skeletons/](../scripts/skeletons/)`<name>.html`.
2. **Enhance** via `component-engine.ts --enhance-skeleton <name> --domain <X> --colors <Y> --description <text>` (`component-engine.ts:1158`). Kimi writes only the `<style>` block; HTML preserved.
3. **Validate** via `validateEnhanceStructure` at [component-generator.ts:446](../packages/sdk/src/utils/component-generator.ts#L446) — confirms `data-*` attributes and selectors in the CSS still target nodes in the skeleton. Fallback to CSS-only if full-HTML mode breaks structure.
4. **Persist** populated variants in [scripts/components-cinematic.json](../scripts/components-cinematic.json) (today: 278KB, seeded from the 2024-adidas pass).
5. **Retrieve** at section-generation time: the section generator in [packages/sdk/src/models/section-generator.ts](../packages/sdk/src/models/section-generator.ts) picks matching components by persona + role + animation brief and injects them as retrieval hints into the prompt.

Exemplar quality matters more than quantity (Liu et al., 2025 — *Retrieval-Augmented Code Generation*). **5 curated skeletons beat 50 noisy ones.** Gate admission harshly.

---

## 3. Current state (as of 2026-04-22)

Five skeletons exist, all mined from a single pass over report.adidas-group.com/2024:

| File | Pattern | Libs |
|---|---|---|
| [counter-dashboard.html](../scripts/skeletons/counter-dashboard.html) | 3-col KPI grid, viewport-once count-up | GSAP |
| [image-carousel.html](../scripts/skeletons/image-carousel.html) | Swiper with parallax slides | Swiper |
| [scrollytelling-panels.html](../scripts/skeletons/scrollytelling-panels.html) | 3×3 pinned-scroll panel swap | GSAP + ScrollTrigger |
| [split-panel-hero.html](../scripts/skeletons/split-panel-hero.html) | Two-panel hero with scroll reveal | GSAP |
| [text-marquee.html](../scripts/skeletons/text-marquee.html) | CSS-only infinite marquee | CSS-only |

**Known issues** (found 2026-04-22 while auditing generated HTML):

- All five skeletons hardcode uppercase-styled eyebrow labels: `"KEY FIGURES"`, `"CHAPTER 01"`, `"FEATURED STORY"`, `"INNOVATION"` / `"PERFORMANCE"`. Since CSS-only enhance cannot rewrite HTML (`component-generator.ts:289`), these literals ship in every generated site. This caused the "— THE SYSTEM / — OUR PURPOSE / — OUR GROUP" AI-tell visible on PCG and Linear regression runs. Banned in prompts 2026-04-22 ([CHANGELOG.md](../CHANGELOG.md)) — now must be stripped at source too.
- `split-panel-hero.html` contains the literal string `"Impossible Is Nothing"` (adidas slogan). Brand bias leak.
- Three of five skip the `prefers-reduced-motion` branch.
- `scrollytelling-panels.html` hardcodes a 3×3 cardinality — works only at that specific size.

---

## 4. Rules for a good skeleton

Synthesised from Alexander 1977, Tidwell 2020, Frost 2016, Curtis (EightShapes), Leviathan & Valevski 2024 (Generative UI, Google Labs), Liu et al. 2025 (RAG survey) — plus reading the current `enhanceFromSkeleton` contract.

1. **One concept per file.** Don't bundle hero + marquee. Retrieval ranks single-concept exemplars better (Liu 2025).
2. **Comment header = spec.** First three `<!-- -->` lines: PATTERN name, one-sentence problem statement, required libs. The engine reads the first comment as the description at [component-engine.ts:1147](../scripts/component-engine.ts#L1147).
3. **Reference URL in comment.** Add `<!-- Ref: https://linear.app -->` so we can re-audit inspiration and dedupe.
4. **Every animated element carries a `data-*` hook.** The structural validator at [component-generator.ts:446](../packages/sdk/src/utils/component-generator.ts#L446) fingerprints `data-*` attrs. Use `data-anim`, `data-idx`, `data-col`, not class selectors alone.
5. **No brand text, no domain text.** Use bracket tokens: `[HEADLINE]`, `[BODY]`, `[CTA]`. Our split-panel-hero leaks "Impossible Is Nothing" — never ship a real slogan.
6. **No uppercase-styled eyebrow labels.** Generic placeholder copy is fine; the moment an eyebrow carries stylised text it becomes an AI signature across every generated site. If the pattern genuinely needs an eyebrow slot, mark it `[EYEBROW]` AND gate its visibility on a `data-eyebrow` attribute so it can be omitted entirely.
7. **CSS custom properties as slot points.** Declare `--accent`, `--bg`, `--fg`, `--font-display` on `:root` or the section wrapper. Kimi's `<style>` block overrides tokens without rewriting rules (Curtis, *Naming Tokens*).
8. **Inline styles ONLY for structural geometry** — position, flex, grid, sticky, height. Typography / color / spacing / elevation belong in the `<style>` slot that Kimi owns.
9. **Libs are declared in the comment, not imported.** GSAP + Swiper + ScrollTrigger are globally loaded by the renderer (see [component-generator.ts:313](../packages/sdk/src/utils/component-generator.ts#L313)). Never emit `<script src="...">`.
10. **No `<!DOCTYPE>` / `<html>` / `<head>` / `<body>`.** Skeletons are fragments — one `<section>` + optional `<style>` + `<script>`.
11. **Scope JS queries to the component root.** Use a unique root class (e.g. `.bento-grid`) then `root.querySelectorAll` — never bare `.card` / `.item` selectors that collide when multiple sections ship on one page.
12. **Loop over `querySelectorAll`, don't hardcode cardinality.** A skeleton with "3 columns, 3 images" only works at that specific shape. Derive counts; use `%` and `fr` for grid.
13. **Respect `prefers-reduced-motion`.** Either a media query in the `<style>` slot or a JS guard that short-circuits GSAP when the media query matches.
14. **Fail gracefully without JS.** The initial paint must show content — don't start elements at `opacity:0` with no CSS fallback. Use `class="no-js-show"` + `.no-js-show { opacity: 1 }` when JS is disabled, flipped by an early inline `document.documentElement.classList.add('js')`.

---

## 5. Anti-patterns

1. **Uppercase-styled eyebrow text hardcoded** — "KEY FIGURES", "CHAPTER 01", "FEATURED STORY". (This was our bug.)
2. **Real slogan/brand text as placeholder** — "Impossible Is Nothing" in split-panel-hero leaks adidas into every output.
3. **Inline font/color/shadow/border-radius.** Caps what Kimi can express without `!important`.
4. **Class names that encode a brand or domain** (`adidas-stat`, `report-header`) — use generic names.
5. **Tight coupling between JS and DOM count** (hardcoded "3 columns, 3 images"). Fragile under any retrieval context that wants a 2×4 or 4×3 layout.
6. **Multiple concepts in one file** — skeletons are retrieved by genre. A split-hero-with-marquee can't be classified.
7. **Direct CDN `<script src>` tags** — duplicates globals, violates engine contract.
8. **Missing `data-*` anchors on animated nodes** — the structural validator can't verify preservation, and broken enhance ships silently.

---

## 6. Admission rubric (score /8, gate at ≥7 to admit)

| # | Criterion | Pass test |
|---|---|---|
| 1 | Pattern appears on ≥3 premium reference sites | List URLs in the comment header |
| 2 | Brand-agnostic copy | `grep` finds zero proper nouns, zero uppercase slogan-style eyebrows |
| 3 | Single concept | One `<section>`, one dominant motion idea |
| 4 | Works under CSS-only enhance | Run `enhanceFromSkeleton` with `cssOnly:true`; HTML must be byte-identical outside the injected `<style>` |
| 5 | Uses only globally-loaded libs | No `<script src>`; GSAP / Swiper / ScrollTrigger only |
| 6 | All animated nodes carry `data-*` hooks | Structural validator at [component-generator.ts:446](../packages/sdk/src/utils/component-generator.ts#L446) finds every GSAP-targeted node |
| 7 | Respects `prefers-reduced-motion` | Media query or JS guard present |
| 8 | Fills cleanly on one LLM pass | Dry-run against 3 distinct brand palettes; zero structural warnings |

---

## 7. Premium component vocabulary to mine

Target genres across [stripe.com](https://stripe.com), [linear.app](https://linear.app), [vercel.com](https://vercel.com), [framer.com](https://framer.com), [apple.com](https://apple.com), [oxide.computer](https://oxide.computer), [pudding.cool](https://pudding.cool), [awwwards.com](https://www.awwwards.com), and annual-report genre (adidas 2020/2022/2023/2024, patagonia, nike, brewdog).

Priority queue — mine in roughly this order. Each name → one-sentence pattern. Skip if it overlaps existing skeletons.

### 7.1 Adidas-report-specific (mine across 2020/2022/2023/2024)

1. **pinned-key-message** — word-by-word headline reveal, scrub-locked to scroll, image parallaxes behind. Chapter openers on every adidas report.
2. **animated-bar-chart** — horizontal bars draw in on scroll-trigger; data-attributes drive target widths. Financial year-over-year comparisons.
3. **sticky-sidebar-toc** — left rail with scroll-synced active-section highlight. Report navigation convention.
4. **horizontal-scroll-strip** — year milestones / product history advance on horizontal scroll pinned inside a vertical container.
5. **scrub-counter-locked** — numbers update scrub-locked to scroll position (different from existing `counter-dashboard` which fires once at viewport-enter).
6. **panel-peel-reveal** — sticky section uses `clip-path` to peel back, revealing the next chapter underneath. Adidas 2023/2024 chapter transitions.
7. **timeline-year-scrubber** — horizontal timeline; click a year-dot to animate camera to that milestone. Annual-report timelines.

### 7.2 Non-adidas premium patterns

8. **bento-grid-hover** — asymmetric tile grid; each tile grows on hover while siblings dim. Apple iPad product pages.
9. **sticky-feature-list** — text list sticky on the left; single image swaps on the right as the active list item changes on scroll. Stripe + Linear feature pages.
10. **spotlight-border-card** — `conic-gradient` border follows the cursor on cards. Vercel template gallery.
11. **comparison-slider** — draggable divider over two full-bleed images (before/after). Oxide, product landing pages.
12. **magnetic-cta** — CTA button translates toward the cursor within a 40-80px radius. Linear CTAs.
13. **text-mask-video** — `background-clip:text` headline masks a muted looping video. Apple WWDC hero.
14. **image-sequence-canvas** — scroll scrubs through a 60-120 frame sprite sheet on a `<canvas>`. Apple AirPods-style scroll story.
15. **quote-pull-serif** — oversized serif caps with rotated attribution. Patagonia, NYTimes longform.
16. **full-bleed-clip-wipe** — two halves of a split reveal via `clip-path: polygon()` as scroll progresses. BrewDog-style transitions.
17. **card-stack-to-grid** — three stacked cards fan out into a 3-column grid as the user enters the section. Framer marketing.
18. **pricing-sticky-column** — one pricing column pinned while the rest scroll under (emphasis on a tier). Linear pricing.
19. **faq-motion-accordion** — answer height animates with easing rather than CSS `height:auto` jump. Framer sites.
20. **logo-wall-rotator** — grayscale grid of logos, one cycles to color every 3s on a loop. B2B landing pages.

---

## 8. Phase checklist

### Phase S0 — Eyebrow + brand-bias cleanup on existing 5 (1 PR, ~1h) — ✅ COMPLETE (2026-04-22)

Before expanding, fix the current library. High-leverage, low-risk.

- [x] [scripts/skeletons/counter-dashboard.html](../scripts/skeletons/counter-dashboard.html): replaced `"KEY FIGURES"` with `[EYEBROW]` + `data-eyebrow="optional"`; `"At a Glance"` → `[HEADLINE]`; per-card `[LABEL_N]` / `[DESC_N]` slots; `data-target` reset to `0` so Kimi fills real numbers.
- [x] [scripts/skeletons/image-carousel.html](../scripts/skeletons/image-carousel.html): `"CHAPTER 01/02/03"` → `[EYEBROW_1..3]` + `data-eyebrow="optional"`; titles → `[HEADLINE_N]`; bodies → `[BODY_N]`.
- [x] [scripts/skeletons/split-panel-hero.html](../scripts/skeletons/split-panel-hero.html): `"FEATURED STORY"` → `[EYEBROW]`; **removed adidas slogan `"Impossible Is Nothing"`** → `[HEADLINE]`; `[BODY]` + `[CTA]` tokens.
- [x] [scripts/skeletons/scrollytelling-panels.html](../scripts/skeletons/scrollytelling-panels.html): `"OUR PURPOSE / OUR BRAND / OUR VALUES"` → `[LABEL_LEFT_N]` / `[LABEL_RIGHT_N]`; `"READ MORE"` → `[CTA]`; removed hardcoded `font-family: Georgia,serif` so Kimi owns typography.
- [x] [scripts/skeletons/text-marquee.html](../scripts/skeletons/text-marquee.html): `"INNOVATION / PERFORMANCE / SUSTAINABILITY"` → `[MARQUEE_ITEM_1..3]`.
- [x] `prefers-reduced-motion` media query in all 5 skeletons. The 4 GSAP-driven ones also carry a JS guard that short-circuits expensive timelines when the OS flag is set.
- [x] `<!-- Ref: https://report.adidas-group.com/2024/en/ -->` comment line in all 5.
- [ ] **Deferred to S0.1:** derive `scrollytelling-panels` column-count from `querySelectorAll` (currently hardcoded 3×3). Out of the prompt-cleanup scope; tracked as future work.
- [ ] **Deferred to S0.1:** re-enhance each against 3 persona palettes (corporate-precision / swiss-international / editorial-luxury) to regenerate [scripts/components-cinematic.json](../scripts/components-cinematic.json) entries with clean token text. Requires running `scripts/component-engine.ts --enhance-skeleton` per skeleton per persona.
- [x] CHANGELOG entry.

### Phase S1 — Adidas-report expansion (1 PR, ~1-2 days) — ✅ COMPLETE (2026-04-22)

Mine 7 new skeletons from [adidas 2020](https://report.adidas-group.com/2020/en/), [2022](https://report.adidas-group.com/2022/en/), [2023](https://report.adidas-group.com/2023/en/), [2024](https://report.adidas-group.com/2024/en/). Each ships tokenised (`[EYEBROW]`, `[HEADLINE]`, `[BODY]`, `[LABEL_N]`), carries `data-*` attributes on every animated node, scopes JS queries under a unique root class, honours `prefers-reduced-motion`, and references only globally-loaded libs.

- [x] [scripts/skeletons/pinned-key-message.html](../scripts/skeletons/pinned-key-message.html) — word-by-word reveal, scrub-locked, parallax background. Ref: 2023.
- [x] [scripts/skeletons/animated-bar-chart.html](../scripts/skeletons/animated-bar-chart.html) — draw-in horizontal bars on scroll, `data-target` percentages drive fill + value. Ref: 2024.
- [x] [scripts/skeletons/sticky-sidebar-toc.html](../scripts/skeletons/sticky-sidebar-toc.html) — scroll-synced left-rail section nav with click-to-scroll. Ref: 2022.
- [x] [scripts/skeletons/horizontal-scroll-strip.html](../scripts/skeletons/horizontal-scroll-strip.html) — pinned vertical container, horizontal track translate through milestones. Ref: 2023.
- [x] [scripts/skeletons/scrub-counter-locked.html](../scripts/skeletons/scrub-counter-locked.html) — scrub-locked counters (distinct from viewport-once counter-dashboard). Ref: 2024.
- [x] [scripts/skeletons/panel-peel-reveal.html](../scripts/skeletons/panel-peel-reveal.html) — sticky section clip-path peel to next chapter. Ref: 2023.
- [x] [scripts/skeletons/timeline-year-scrubber.html](../scripts/skeletons/timeline-year-scrubber.html) — horizontal milestone timeline, click-to-animate. Ref: 2020.
- [x] Each passes the §6 mechanical checks: 4-line comment header, no CDN `<script src>`, `data-*` attributes on every animated node, `prefers-reduced-motion` present.
- [x] Each has a `Ref:` URL pointing at a specific adidas-report year.
- [ ] **Deferred to S0.1 (same batch as existing-5 regeneration):** regenerate components-cinematic.json for all 7 across ≥3 persona palettes via `scripts/component-engine.ts --enhance-skeleton`.
- [x] CHANGELOG entry.

### Phase S2 — Non-adidas premium patterns (1 PR, ~2-3 days) — ✅ COMPLETE (2026-04-23)

Mine the 13 patterns in §7.2. Split across PRs if it runs long — the priority-8-to-14 block is the best leverage for diversifying output beyond the annual-report aesthetic.

Top-priority batch (do first):

- [x] `bento-grid-hover.html` — asymmetric 6-col grid, hover lift + media scale. Ref: apple.com/apple-intelligence, linear.app/features, vercel.com.
- [x] `sticky-feature-list.html` — sticky media column; scroll-triggered item activation swaps image. Ref: stripe.com/payments, apple.com/iphone-15-pro, linear.app/method.
- [x] `spotlight-border-card.html` — pointer-tracked radial glow inside card border. Ref: linear.app/features, vercel.com, framer.com.
- [x] `comparison-slider.html` — draggable divider clips before/after images. Ref: apple.com/apple-vision-pro, stripe.com, figma.com.
- [x] `magnetic-cta.html` — cursor-magnetic CTA translate + inner scale. Ref: awwwards.com, framer.com, linear.app.
- [x] `image-sequence-canvas.html` — scroll-scrubbed canvas frame playback (data-frames/data-src-pattern). Ref: apple.com/airpods-pro, apple.com/iphone-15-pro, rivian.com/r1s.
- [x] `text-mask-video.html` — `background-clip:text` headline with video layer + reduced-motion gate. Ref: apple.com/shot-on-iphone, nike.com, framer.com.

Second-priority batch (do after):

- [x] `card-stack-to-grid.html` — pinned scroll; offset-stacked cards tween to grid layout. Ref: apple.com/services, linear.app/features, framer.com.
- [x] `pricing-sticky-column.html` — 3-tier grid with scaled + badged middle tier; CSS-only. Ref: stripe.com/pricing, linear.app/pricing, vercel.com/pricing.
- [x] `faq-motion-accordion.html` — `<details>` rows with grid-row 0fr→1fr animated height + rotating chevron. Ref: stripe.com/customers, linear.app/docs, framer.com/help.
- [x] `logo-wall-rotator.html` — infinite-drift logo track with mask-image edges + hover dim-siblings. Ref: stripe.com/customers, linear.app/customers, vercel.com.
- [x] `quote-pull-serif.html` — oversized serif pull-quote with decorative open-quote glyph + author block. Ref: theverge.com, newyorker.com, linear.app/customers.
- [x] `full-bleed-clip-wipe.html` — center-out `clip-path` wipe on viewport entry + content fade. Ref: apple.com/mac, rivian.com, nike.com.

For each:

- [x] Passes the §6 rubric (score ≥7) — priority batch of 7.
- [x] Comment header has 2-3 `Ref:` URLs, not 1 — confirms pattern is industry-generic, not site-specific.
- [ ] **Deferred to S0.1 batch:** regenerate components-cinematic.json across ≥3 persona palettes.
- [ ] **Deferred:** spot-check 2 generated sites use the new patterns (retrieval sanity check).
- [x] CHANGELOG entry (priority batch).

### Phase S3 — Admission tooling (1 PR, ~0.5 day, optional)

Turn the §6 rubric into a checker script so the gate is automatic.

- [ ] [scripts/lint-skeleton.ts](../scripts/lint-skeleton.ts) NEW — scans a skeleton file, returns pass/fail per rubric criterion plus overall score.
- [ ] Checks: comment-header presence, `Ref:` URL presence, no uppercase eyebrow literals (regex: `>[A-Z ]{4,}<`), no hardcoded font/color inline styles, `prefers-reduced-motion` guard, `data-*` attribute presence on JS-queried selectors.
- [ ] Pre-commit hook or CI step runs the lint against any file under `scripts/skeletons/`.
- [ ] CHANGELOG entry.

---

## 9. References

Academic / theoretical:

- Alexander, *A Pattern Language* (1977). [patternlanguage.com](https://www.patternlanguage.com/)
- Tidwell, *Designing Interfaces* 3e (O'Reilly 2020). [designinginterfaces.com](https://www.designinginterfaces.com/)
- Frost, *Atomic Design* ch. 2 (2016). [atomicdesign.bradfrost.com/chapter-2](https://atomicdesign.bradfrost.com/chapter-2/)
- Curtis, *Naming Tokens in Design Systems*. [medium.com/eightshapes-llc](https://medium.com/eightshapes-llc/naming-tokens-in-design-systems-9e86c7444676)
- Leviathan & Valevski, *Generative UI* (Google Labs, 2024). [generativeui.github.io/paper.pdf](https://generativeui.github.io/static/pdfs/paper.pdf)
- Liu et al., *Retrieval-Augmented Code Generation: A Survey* (arXiv 2510.04905, 2025). [arxiv.org/abs/2510.04905](https://arxiv.org/html/2510.04905v1)

Industry / reference sites:

- [apple.com](https://apple.com), [stripe.com](https://stripe.com), [linear.app](https://linear.app), [vercel.com](https://vercel.com), [framer.com](https://framer.com), [oxide.computer](https://oxide.computer), [pudding.cool](https://pudding.cool), [awwwards.com](https://www.awwwards.com), [siteinspire.com](https://www.siteinspire.com).
- Annual reports: [adidas 2020](https://report.adidas-group.com/2020/en/), [2022](https://report.adidas-group.com/2022/en/), [2023](https://report.adidas-group.com/2023/en/), [2024](https://report.adidas-group.com/2024/en/); patagonia, nike, brewdog annual reports.

Related Atelier docs:

- [upgrades.md](upgrades.md) — anti-slop / prompt-rule phases (Phase 1-5.1 shipped; Phase 6 = Creative Arsenal audit overlaps this plan).
- [docs/HOWTO-ComponentEngine.md](HOWTO-ComponentEngine.md) — engine usage reference.
- [docs/sourcecomponentselection.md](sourcecomponentselection.md) — retrieval side of the pipeline.
