# SPA Section Extraction — Research & Plan

Status: proposal / research
Owner: parser pipeline
Scope: `packages/sdk/src/utils/section-parser.ts` plus its two call sites
in `packages/sdk/src/models/redesign.ts:785` and
`packages/sdk/src/models/section-generator.ts:602`.

---

## 1. Problem

Atelier's redesign pipeline fetches a target page's raw HTML and hands it to
`parseSections` (`packages/sdk/src/utils/section-parser.ts:116`). That function
walks top-level structural tags (`nav|header|section|main|article|footer|div|aside`),
unwraps `<main>` and large `<div>` wrappers up to six levels, and classifies
each surviving element into nav / hero / content / footer. If it can't
produce at least three sections it falls through to `parseSectionsFallback`
(line 269), which scans for `<section>` via depth-counting regex and finally
to `parseSectionsByHeadings` which splits on `<h2>` boundaries. If *that*
still fails we pay the cost of the LLM planner.

On modern SPA and SSR-hydrated output the fallback chain routinely collapses
to the LLM path for two distinct reasons that need to be handled separately:

1. **"Hydration-shell" pages** (Airbnb is the canonical case in our sample):
   the server returns an HTML document whose `<body>` contains only the
   application skeleton, a `<noscript>` warning, a11y skip links, and a
   massive blob of JSON / chunk `<script>` tags that React rehydrates on
   the client. The raw HTML has **0 `<section>` tags, 0 `<article>`, 1
   `<main>`, 3 `<h2>`, 1 `<h1>`, and 298 `<div>`** — and stripping scripts
   leaves only ~470 bytes of real text in a 584 KB document. There is
   physically no content to parse; this failure class cannot be solved
   with regex tricks alone and requires either a headless renderer or
   reuse of our crawl4ai service which already runs JS.

2. **"SSR-but-non-semantic" pages** (VW, Linear, IKEA, and — despite the
   stated motivating example — Adidas). The server delivers the real content
   inline but it is authored with framework-generated wrappers and hashed
   class names (`PageSection_root__kFVv1`, `styledcontainer-sc-18harj2`,
   `hnf-page-container__main`). The current top-down unwrap gets confused by
   long chains of single-child wrappers, and the `<section>`/`<h2>` counts
   inside the *body* often fall below the magic number three once we skip
   structural junk like topic filters, notifications, and footers. This is
   the class of failure we can actually fix with better DOM-level rules.

Empirical note on Adidas: the live HTML at
`https://report.adidas-group.com/2024/en/` today contains 12 `<section>`
elements and 16 `<h2>` elements in `<body>`, so the parser's headline count
is no longer the issue on that specific URL. The sections are discoverable
— the real problem is that the parser's "skip structural" rules at lines
170–193 drop several legitimate chapter headers (class
`home-chapter-header`) because they are short on text and look like
topic-filter chrome, and the `extractSectionLabel` classname heuristic
doesn't know about Adidas's `home-*` naming convention. Treat Adidas as
an SSR-non-semantic refinement case, not a zero-signal case.

## 2. Research summary

Web page segmentation has twenty years of prior art; a few ideas from the
literature are directly applicable and a few are not.

**VIPS — Vision-based Page Segmentation** (Cai et al., MSR-TR-2003-79).
The canonical segmentation algorithm. It walks the DOM top-down,
classifies every node as either a "visual block" or a container, and
computes a *Degree of Coherence* from visual cues (background colour,
font-size deltas, borders, explicit separators). When a container's
children have roughly equal DoC it becomes a block; otherwise the
algorithm recurses. The useful takeaways for us are the top-down recursion,
the "stop when children are coherent" rule, and the explicit idea of
*separator detection* — a strong visual break (HR, big margin, colour
change, heading) marks a section boundary even when the DOM has no
`<section>` tag. We cannot use colour / font-size without a renderer,
but `<h2>`, `<hr>`, large image nodes, and `role="region"` work as
cheap stand-ins for separators.
https://www.microsoft.com/en-us/research/wp-content/uploads/2016/02/tr-2003-79.pdf

**Mozilla Readability.js.** Scores candidate nodes by text length,
comma count, and a penalty for link density; builds up the score into
the parent chain and picks the top candidate. Its `unlikelyCandidates`
regex is directly liftable:
`/-ad-|banner|breadcrumbs|combx|comment|cover-wrap|disqus|footer|gdpr|header|legends|menu|related|remark|replies|rss|shoutbox|sidebar|skyscraper|social|sponsor|supplemental|ad-break|pagination|pager|popup/i`
— we should merge this into our existing `isStructural` block at
section-parser.ts:172. Readability is designed to find the *single*
article body, not to segment a marketing page, so we adopt the scoring
machinery but not its winner-takes-all selection.
https://github.com/mozilla/readability/blob/main/Readability.js

**Trafilatura.** Cascaded XPath rules plus text-density filters,
falling back to jusText and Readability. Best-in-class F1 on the
scrapinghub article-extraction benchmark (0.945 vs newspaper3k's 0.912).
For our purposes the relevant lesson is that rule cascades beat
ML-on-tokens for the "find the content" problem and are robust to
malformed HTML — we should keep our approach rule-based rather than
reach for embeddings.
https://trafilatura.readthedocs.io/en/latest/evaluation.html
https://aclanthology.org/2021.acl-demo.15.pdf

**Boilerpipe.** Decision trees over text-density, link-density, and
block-position features. Not worth reimplementing, but confirms that
*block-local link density* is a high-signal boilerplate feature — nav
menus, "related links" strips, and footer columns all ring the same
bell. We already strip nav/header/footer separately but do not use
link density for inner-div classification.

**VIPS in practice — ParticleMedia/vips (Java).** Modern port of the
algorithm. Good reference for block extraction ordering (depth-first),
but depends on rendered geometry we don't have.
https://github.com/ParticleMedia/vips

**Wappalyzer fingerprint patterns.** For SPA detection we want
cheap string tests:
- Next.js: `__NEXT_DATA__` script, `id="__next"`, `/_next/` asset paths.
- Nuxt: `window.__NUXT__`, `id="__nuxt"`, `/_nuxt/` assets, `data-v-<hex>`.
- Vue 3 standalone: `data-v-<hex>` scoped-style attrs.
- React (SSR): `data-reactroot`, `data-react-*`, `id="__react-application"`,
  `id="root"`.
- SvelteKit: `__SVELTEKIT_DATA__`, `<!-- HEAD_svelte-`, `data-sveltekit-*`.
- Astro: `<astro-island>`, `astro-slot`, comments like `<!-- Astro -->`.
https://github.com/tomnomnom/wappalyzer

**"Web Content Extraction with Heuristics & NLP"** (Leong, 2023).
Surveys real-world heuristics and concludes that the combination
"tag semantics + text density + class-name keyword list" dominates
single-feature approaches on marketing/landing pages (as opposed to
news articles, where Readability alone is close to optimal).
https://medium.com/aimonks/web-content-extraction-with-heuristics-nlp-8e901875c8ed

**Comparing extraction algorithms (Chuniversiteit).** Ranks
heuristic tools above neural models on complex pages. Concrete
confirmation that we should not be tempted to swap in an ML
classifier for inner-div ranking.
https://chuniversiteit.nl/papers/comparison-of-web-content-extraction-algorithms

## 3. DOM analysis findings

All counts are computed inside `<body>` after stripping `<script>` and
`<style>` content. `text/script` is the ratio of visible text bytes to
script bytes *in `<body>`* — a rough proxy for "how much of this page is
server-rendered content". Samples fetched via plain `curl -sL` with a
desktop User-Agent on 2026-04-13.

| Site | Raw KB | Body KB | text/script | `<section>` | `<article>` | `<main>` | h1 | h2 | h3 | h4 | `<div>` | `<script>` | Framework |
|------|-------:|--------:|------------:|------------:|------------:|---------:|---:|---:|---:|---:|--------:|-----------:|-----------|
| Adidas `report.adidas-group.com/2024/en/` | 121 | 113 | N/A* | 12 | 1 | 1 | 2 | 16 | 2 | 0 | 192 | 6 | Custom (chunk paths under `/2024/en/_next/`-style) |
| Adidas `report.adidas-group.com/2025/en/` | 145 | 135 | N/A* | 10 | 1 | 1 | 2 | 10 | 7 | 0 | 191 | 0 | Custom (same `home-*` template as 2024) |
| VW `vw.com/en.html` | 612 | 453 | 0.04 | 20 | 0 | 1 | 5 | 12 | 10 | 0 | 671 | 23 | React SSR (`data-reactroot`, styled-components hashes) |
| IKEA `ikea.com/gb/en/this-is-ikea/` | 137 | 132 | 0.06 | 9 | 1 | 1 | 1 | 7 | 6 | 0 | 121 | 40 | Generic SSR + `hnf-*` custom prefix |
| Airbnb `airbnb.com/` | 570 | 474 | 0.00 | 0 | 0 | 1 | 1 | 3 | 0 | 0 | 298 | 55 | React hydration shell (`id="react-application"`) |
| Linear `linear.app/` | 2235 | 1935 | 0.01 | 9 | 0 | 1 | 1 | 8 | 7 | 1 | 738 | 115 | Next.js (`/_next/` ×109, CSS module hashes) |

\* Adidas's chunk stripping produced a zero script byte count because all
scripts were pulled external — the visible-text denominator blows up. In
practice Adidas is a content-rich page and the "SSR-non-semantic"
classification applies.

**Adidas 2024 vs 2025 comparison.** The two reports ship the same template:
identical `home-*` class convention on every `<section>`, identical zero
inline-script pattern (all JS external, so text/script is N/A for both),
nearly identical `<div>` counts (192 vs 191), same single `<main>`, same
`<article>`, same two `<h1>`s, same `<header>`/`<footer>` shape. 2025 has
10 `<section>`s vs 2024's 12 and 10 `<h2>`s vs 16 (fewer chapter-header
sections, more `<h3>` sub-headings — 7 vs 2), but structurally both
documents are the same SSR-non-semantic page and any fix proven on 2024
will trivially work on 2025. No new framework markers. The structural-skip
rule finding from section 1 (short chapter-header sections with class
`home-chapter-header` being dropped by `isStructural`) applies identically
to 2025 and is still the single change required to unblock both URLs.

Representative section markers observed:

- **Adidas**: `<section class="home-hero home-aos">`,
  `<section class="home-chapter-header home-chapter-header--3 home-section content-filter-disabled grain">`,
  `<section class="home-dashboard home-section">`,
  `<section class="home-quiz home-section">`. Twelve semantic `<section>`
  tags with rich class names — the current parser already sees them but
  *filters them out* as structural (see problem section).
- **Linear**: `<section class="PageSection_root__kFVv1 PageSection_rootHomepage__2x22W">`,
  `<section class="CustomerQuotes_container__Grlfj hide-laptop" id="customers">`,
  `<section class="CTA_homepagePrefooter__FWdih">`. Plus `role="region"`
  wrappers around notification toasts which should be ignored.
- **VW**: `<section class="sectionGroup">` ×5, and deep styled-components
  wrappers named `styledcontainer-sc-18harj2` ×44. The real chapters are
  the `sectionGroup` nodes; the 44 styled containers are leaf layout
  primitives we must not recurse into.
- **IKEA**: `<section>` with `hnf-*` prefix classes; single `<main>` wrapper
  around them.
- **Airbnb**: no `<section>` at all. Body content is a tree of
  `<div data-testid="...">` nodes whose text content is injected at
  runtime. `<noscript>` warning and 470 bytes of skip-link text are
  literally the only extractable strings.

Frameworks detected via string tests:

| Site | `__NEXT_DATA__` | `window.__NUXT__` | `data-reactroot` | `data-v-<hex>` | `/_next/` | `/_nuxt/` | id app |
|------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| Adidas 2024 | – | – | – | – | – | – | – |
| Adidas 2025 | – | – | – | – | – | – | – |
| VW      | – | – | 31 | – | – | – | – |
| IKEA    | – | – | – | – | – | – | – |
| Airbnb  | – | – | – | – | – | – | `react-application` |
| Linear  | – | – | – | – | 109 | – | – |

The only uniformly-useful marker across the sample is the
**text-to-script byte ratio inside `<body>`**: Adidas scores as
content-rich, VW/IKEA/Linear all score in the 0.01–0.06 range
(SSR but script-heavy), and Airbnb scores 0.00 (hydration shell).
This is our strongest single SPA signal.

## 4. Detection heuristics — `detectSPA(html)`

Goal: return `{ isSPA: boolean; confidence: 0..1; reason: string; bodyTextBytes: number; bodyScriptBytes: number }` in a single pass, cheap enough to run before `parseSections` on every request.

The function returns an SPA score in [0, 1]; the caller uses `>= 0.5` as
the branch threshold. Signals are additive and capped.

1. **Semantic-tag drought** (+0.30). Strip scripts/styles from `<body>`,
   then count `<section>` + `<article>` + `<h2>`. If the sum is ≤ 2, add
   0.30. This is the "would the existing parser give up?" signal and is
   the most important trigger.

2. **Text-to-script byte ratio** (+0.25 at ≤ 0.05, +0.10 at ≤ 0.15).
   After stripping, compare visible-text bytes to the `<script>`-bytes we
   removed. A page where scripts outweigh text 20× is almost certainly
   either SPA-hydrated or chunk-heavy SSR.

3. **Framework fingerprints** (+0.20 any match, +0.05 per extra match,
   cap at +0.35). Regex the full HTML once for:
   - `__NEXT_DATA__`, `id="__next"`, `/_next/`
   - `window.__NUXT__`, `id="__nuxt"`, `/_nuxt/`
   - `data-reactroot`, `id="react-application"`, `id="root"` *and*
     script import of `react-dom`
   - `data-v-[a-f0-9]{6,}` (Vue scoped styles)
   - `__SVELTEKIT_DATA__`, `data-sveltekit-`
   - `<astro-island`, `astro-slot`
   Adidas will miss all of these by design and still go through the
   normal path — which is correct because its semantic tags are healthy.

4. **High-div low-semantic ratio** (+0.15). `divCount / (sectionCount +
   articleCount + 1) >= 100`. Triggers on Airbnb (298/1 = 298) and VW
   (671/21 = 32 — no trigger) and Linear (738/10 = 74 — no trigger).
   Intentionally narrow; the idea is to catch shells without flagging
   healthy SSR.

5. **Noscript nag** (+0.10). Presence of a `<noscript>` block containing
   any of `without javascript`, `enable javascript`, `requires javascript`.
   Tiny extra signal but catches pure shells unambiguously.

Confidence mapping:
- `< 0.30` → not an SPA; use existing `parseSections` unchanged.
- `0.30..0.60` → ambiguous; run existing `parseSections` first and only
  fall through to `parseSectionsSPA` if it returns fewer than 4 sections.
- `>= 0.60` → high confidence; call `parseSectionsSPA` directly. Existing
  parser is still available via `parseSectionsLegacy` for A/B
  comparison in the test harness.

Expected classification on the sample:

| Site    | drought | ratio | framework | div-heavy | noscript | Score | Path |
|---------|--------:|------:|----------:|----------:|---------:|------:|------|
| Adidas  | 0.00 (16 h2 + 12 sec) | 0.00 | 0.00 | 0.00 | 0.00 | **0.00** | legacy |
| VW      | 0.00 (12+20) | 0.25 | 0.20 | 0.00 | 0.00 | **0.45** | ambiguous → legacy-then-SPA |
| IKEA    | 0.00 (7+9) | 0.25 | 0.00 | 0.00 | 0.00 | **0.25** | legacy |
| Airbnb  | 0.30 (3+0) | 0.25 | 0.20 | 0.15 | 0.10 | **1.00** | SPA-direct |
| Linear  | 0.00 (8+9) | 0.25 | 0.20 | 0.00 | 0.00 | **0.45** | ambiguous |

Airbnb is the only case that hits "SPA-direct", which is correct because
it's the only case where the legacy parser has literally no DOM to work
with — and `parseSectionsSPA` will *also* fail on it, so we surface this
as a typed error and let the caller re-fetch through the crawl4ai path
(or wire up a render step). VW, IKEA, and Linear are well-formed SSR
pages that the legacy parser should handle once we fix issue (2) in
section 1 — those improvements go into `parseSectionsSPA` as a stricter
second attempt rather than as modifications to the legacy path.

## 5. Extraction strategy — `parseSectionsSPA(html)`

The SPA-aware path discards the "unwrap the single wrapper" logic and
instead walks the DOM looking for *section-like blocks* anywhere in the
tree, scoring them by text density and class-name keywords, and picking
the top N by DOM order. The tuning is biased toward recall; the caller
will still apply the max-sections cap downstream.

### Step 1 — Strip noise
- Remove `<script>`, `<style>`, `<template>`, `<svg>` (keep svg-less
  copies for text counting), HTML comments, and all elements with class /
  id matching Readability's `unlikelyCandidates` regex (see section 2).
- Remove `role="region"` containers whose only text children are ARIA
  live-region announcements (`<section aria-live="polite">` on Linear).

### Step 2 — Candidate discovery
Walk the DOM (regex-based, like the existing `findTopLevelElements`) and
collect any element that matches **any** of:

- Tag in `{section, article, main}`.
- Tag `div` with `role` in `{region, main, article, group}`.
- Tag `div` with `aria-labelledby` pointing at a heading.
- Tag `div|article` whose class/id (case-insensitive) contains one of:
  `section`, `chapter`, `block`, `module`, `panel`, `hero`, `feature`,
  `cta`, `highlight`, `intro`, `content-(module|block)`, `slice`
  (Prismic), `storyblok-` (Storyblok), `page-section`, `page_section`,
  `pagesection` (Next CSS-module hashed form — Linear).
- Tag `div` whose *immediate* child is an `h1`/`h2`/`h3` and which
  contains ≥ 200 chars of text.

We skip nothing based on depth in this phase — a Linear `PageSection_root`
may be nine wrappers deep from `<body>`.

### Step 3 — Scoring
For each candidate compute:

- `textLen` = stripped text bytes.
- `linkDensity` = link-text-bytes / textLen.
- `headingHits` = count of immediate or one-level-nested h1..h4.
- `classScore` = +2 if class matches a positive keyword, −2 if matches
  Readability's unlikely regex, +1 if class matches a framework CSS-
  module pattern (`/^[A-Z][a-zA-Z]*_(root|container|section)__[a-zA-Z0-9]{5}$/`).
- `sizeScore` = `min(5, textLen / 200)`.
- `densityPenalty` = `linkDensity > 0.5 ? -3 : 0`.
- `depthPenalty` = `max(0, depth - 10) * -0.5` (only very deeply nested
  candidates get docked; normal 4–9 nesting is free).

Final `score = classScore + sizeScore + headingHits + densityPenalty + depthPenalty`.

Require `score >= 2 && textLen >= 120` for acceptance.

### Step 4 — De-duplication / merging
Candidates can overlap (a Linear `<main>` contains five `<section
class="PageSection_root">`). Apply the **containment rule**:

- If candidate A contains candidate B by byte offset and B's score ≥
  A's score − 1, drop A. This prefers the inner, more specific block.
- If A contains ≥ 2 accepted B's and A's own extra text (A.textLen − sum
  of B.textLen) is < 200 chars, drop A entirely (it's a wrapper).
- After containment resolution, merge any adjacent accepted candidates
  whose combined text is < 250 chars (likely a header-card pair).

### Step 5 — Role assignment
Mirror the legacy classifier:
- First candidate whose ancestor chain contains `<nav>` or `<header
  role="banner">` → `nav`.
- First remaining candidate with `<h1>` or whose class matches
  `/hero|jumbotron|splash|intro/i` → `hero`.
- Last candidate whose ancestor is `<footer>` or whose class matches
  `/footer|prefooter/i` → `footer`.
- Everything else → `content`.

### Step 6 — Cap
If `accepted.length > maxSections`, keep nav + hero + footer + the
highest-scoring content sections, preserving DOM order. Same cap logic
as legacy parser lines 244–258.

### Validation against samples

Walkthrough of what the rules would produce on each sample (mental
simulation; needs to be verified with fixtures in the implementation
checklist):

- **Adidas (legacy path — but if forced through SPA)**: twelve
  `<section class="home-*">` all match via keyword `home` → no;
  match via tag = section. Chapter headers score low on text (50–120
  chars) but pass the heading-adjacency rule. Containment drops
  `<main>` in favour of the inner `<section>`s. Expected accepted:
  hero, chapter-header-1, chapter-header-2, slider, chapter-header-3,
  key-areas, dashboard, business-model, esg, chapter-header-4, quiz,
  and footer → ~10–12 sections. ✓
- **VW**: `sectionGroup` ×5 match via keyword + tag. Deeper
  `styledcontainer` divs match keyword but contain the `sectionGroup`
  candidates and lose containment. `featureAppSection` ×2 and
  `powerTeaserSection` ×2 contribute. Expected: ~8–10 sections. ✓
- **IKEA**: nine `<section>` match via tag. `hnf-page-container__main`
  loses containment. Chapter h2s (Newsroom, Social impact, Life at
  Home Report, etc.) give headingHits. Expected: ~7–9 sections. ✓
- **Linear**: nine `<section>` candidates, five of which are
  `PageSection_root__kFVv1` (match CSS-module regex, +1). `CustomerQuotes_container__Grlfj` and `CTA_homepagePrefooter` match
  keyword. Two notification-panel `<section aria-live>` are stripped in
  step 1. Expected: ~8 sections plus footer. ✓
- **Airbnb**: no candidates survive step 2 because every `data-testid`
  div has `textLen == 0`. The function returns `[]` and the caller
  gets a typed `SPAEmptyShellError` that the SDK can use to trigger a
  rendered-HTML re-fetch via crawl4ai or to fall straight to the LLM
  planner.

The rules give ≥ 8 sections on each content-bearing sample. If any
sample drops below 6 in real testing, the first knob to turn is the
acceptance threshold (`score >= 2` → `score >= 1`).

## 6. Implementation checklist

Ordered steps. Each is independently reviewable.

1. **Add fixture directory** `packages/sdk/test/fixtures/spa/` containing
   the five `.html` samples captured during this research, plus a
   short `README.md` note about the capture date and UA string used.
   Size budget: ~3.5 MB of HTML — keep them as-is, do not prettify.

2. **Add a new module** `packages/sdk/src/utils/spa-detector.ts`
   exporting `detectSPA(html: string): SPADetection`. Pure function,
   no dependency on logger. Unit-tested against the five fixtures with
   expected score bands:
   - Adidas: `< 0.30`
   - VW: `0.40..0.55`
   - IKEA: `< 0.35`
   - Airbnb: `>= 0.80`
   - Linear: `0.40..0.55`

3. **Add a new module** `packages/sdk/src/utils/spa-section-parser.ts`
   exporting `parseSectionsSPA(html, logger?, opts?): ParsedSection[]`
   and a typed `SPAEmptyShellError`. Reuse `stripHtmlTags`,
   `findAllByTag`, `extractSectionLabel`, and `mergeTinySections`
   from `section-parser.ts` — export them from the legacy file first
   rather than copy-pasting.

4. **Shared helpers** promoted from `section-parser.ts` to a new
   `section-parser-shared.ts`:
   - `stripHtmlTags`
   - `findAllByTag`
   - `unlikelyCandidatesRegex` (new — ported from Readability)
   - `extractSectionLabel`
   - `mergeTinySections`
   - `ParsedSection` type (already exported; move the type too)
   The legacy file and the SPA file both import from the shared
   module. No behaviour change to the legacy path.

5. **Call-site branching.** In both `packages/sdk/src/models/redesign.ts:785`
   and `packages/sdk/src/models/section-generator.ts:602` replace the
   direct `parseSections(...)` call with:
   ```ts
   const det = detectSPA(rawHtml);
   let sections: ParsedSection[];
   if (det.confidence >= 0.60) {
     try { sections = parseSectionsSPA(rawHtml, logger, opts); }
     catch (e) {
       if (e instanceof SPAEmptyShellError) {
         // existing AI-planner path — unchanged
       } else throw e;
     }
   } else if (det.confidence >= 0.30) {
     sections = parseSections(rawHtml, logger, opts);
     if (sections.length < 4) {
       sections = parseSectionsSPA(rawHtml, logger, opts);
     }
   } else {
     sections = parseSections(rawHtml, logger, opts);
   }
   ```
   Log the detection score and the chosen path at debug level so we
   can tune thresholds from production traces.

6. **Tests.** `packages/sdk/test/spa-section-parser.test.ts` asserts,
   for each of the four content-bearing fixtures, that:
   - `parseSectionsSPA` returns 7–12 sections
   - The first section has role `nav` or `hero`
   - The last section has role `footer` (if any candidate had a
     footer ancestor)
   - No section's `textContent` is < 100 chars (tiny-merge worked)
   - `rawHtml` is deduplicated (no pair where `a.rawHtml.includes(b.rawHtml)`)
   For Airbnb, assert the function throws `SPAEmptyShellError`.

7. **A/B harness.** Add a small script `packages/sdk/scripts/compare-parsers.ts`
   that loads each fixture, runs both parsers, prints a side-by-side
   diff of section count / roles / labels, and optionally hits the
   existing AI-planner endpoint with the same HTML to log the LLM's
   section plan for manual spot-check. Not wired into CI — run it
   locally when tuning thresholds.

8. **Production telemetry.** Extend the existing pipeline logger in
   `packages/sdk/src/utils/logger.ts` (or the nearest equivalent) to
   record `spa.confidence`, `spa.path`, `spa.sectionCount`,
   `spa.score`, and a bucketed `spa.textToScriptRatio` per run.
   Watch the rate of `parseSectionsSPA < 4` cases — those are the
   ones still punting to the LLM planner, and their HTML should be
   captured as new fixtures.

9. **Adidas label fix (separate small PR).** Independent of the SPA
   work, delete or narrow the Topics-Filter-style structural skip at
   `section-parser.ts:174–177`; today it throws out Adidas chapter
   headers that *are* legitimate sections. Gate by text length <
   40 *and* class match instead of text length < 200 OR class match.

## 7. Risks & edge cases

- **Over-segmentation on component libraries.** Design-system sites
  like `https://stripe.com/` can have twenty card-like divs in a
  single marketing section; the keyword list will flag each as a
  `feature` and the parser will explode. Mitigations: the
  `headingHits >= 1` requirement in the accept rule (cards rarely
  carry their own h1–h3), and the "drop parent A if it contains ≥ 2
  accepted B with little extra text" containment rule — which
  works the other direction: it drops the *parent* when cards are
  identical, not the cards themselves. Worth testing on a Stripe
  fixture before shipping.

- **Under-segmentation on deeply nested Next.js output.** Linear's
  `PageSection_root__kFVv1` appears nested inside three container
  divs whose class names (`page_container__ysa5u`) also match
  `container`. Containment should drop the outer divs, but if the
  class scoring assigns equal scores we keep the outer one by
  accident. The `score ≥ A.score − 1` tiebreaker in the containment
  rule is chosen specifically to err on the side of the inner node.

- **False SPA detection on heavy-script static sites.** WordPress with
  ten analytics snippets can easily hit text/script < 0.05 while
  still producing healthy `<section>`s. Mitigation: the drought
  signal gates the whole score — if `<section>` + `<article>` +
  `<h2>` >= 3 the page contributes 0 from the drought axis, so
  script ratio alone tops out at 0.45 and falls into the ambiguous
  band, where we still run the legacy parser first. A pure
  static-site-with-analytics should land around 0.25–0.45 and use
  the legacy path.

- **Empty-shell Airbnb class.** Nothing text-based fixes this; the
  SDK has to either render (crawl4ai already does this — see
  `docker compose ps` note in the research instructions) or punt
  to the LLM planner. `SPAEmptyShellError` carries a `reason:
  "empty-body"` so the caller can branch; don't swallow it silently.

- **Performance cost.** `detectSPA` is a single pass of three or four
  regexes over HTML already in memory, ~1–3 ms for a 2 MB Linear
  page. `parseSectionsSPA` is comparable to the legacy parser — it
  walks the DOM twice (candidate discovery, then containment) but
  over a smaller set. No headless browser, no DOM library. Total
  budget: < 20 ms on the largest fixture.

- **Regex fragility.** Everything is string-based and HTML can
  always surprise us (unquoted attributes, stray `<` in text).
  Reuse `findAllByTag`'s depth-counting rather than naive
  open/close regexes anywhere we can. If we start hitting
  pathological failures, a drop-in replacement with `node-html-parser`
  (4 kB gzipped, no browser deps) is a bounded escalation — but
  only after fixture-driven evidence justifies it.

- **Label extraction on hashed class names.** `extractSectionLabel`
  currently regex-matches class substrings like `hero|feature|team`.
  On Linear the classes are `PageSection_root__kFVv1` — useless.
  Fall back to the first `<h2>` inside the candidate for labels,
  and only consult class names when headings are absent. This is a
  one-line reorder in `extractSectionLabel` (section-parser.ts:442).
