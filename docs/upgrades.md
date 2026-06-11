# Atelier Upgrades — Research Digest

Source material:
- [Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill) — a portable `SKILL.md` collection that nudges AI coding agents toward premium frontend output. Eight skill variants (taste, gpt-taste, redesign, soft, minimalist, brutalist, stitch, output) plus a 3-dial parameterisation system.
- [google-labs-code/design.md](https://github.com/google-labs-code/design.md) — a Google Labs spec for a machine-readable design-system file (YAML front matter + markdown prose), plus a CLI (`@google/design.md`) that lints, diffs, and exports tokens.

This document covers what's in each, what's directly applicable to Atelier, and concrete upgrade proposals grouped by priority and scope.

Today's date: 2026-04-21. Atelier's current state: Kimi K2.6 across four generation stages, per-project design-system persistence (server-of-record, see [designsystemrefresh.md](designsystemrefresh.md)), cinematic + non-cinematic pipelines, section parser with card-grid coalescing.

---

## 1. taste-skill — what's useful

### 1.1 The 3-dial parameterisation model

The skill tunes output against three numeric dials (1–10):

| Dial | 1–3 (low) | 8–10 (high) |
|---|---|---|
| `DESIGN_VARIANCE` | Perfect symmetry, centred, 12-col grid | Asymmetric CSS grid, broken grids, massive whitespace, `2fr 1fr 1fr` |
| `MOTION_INTENSITY` | Static, `:hover`-only | Scroll-pinned choreography, magnetic cursors, GSAP ScrollTrigger |
| `VISUAL_DENSITY` | Art-gallery, huge gaps | Cockpit / data-dense, mono for numbers, `border-t`/`divide-y` over cards |

Baseline defaults in the repo: `DESIGN_VARIANCE=8, MOTION_INTENSITY=6, VISUAL_DENSITY=4`. User prompts can override dynamically.

**Maps cleanly onto Atelier's persona system.** Personas (space-agency, scandinavian-clean, etc.) already encode a visual direction. Dials would add an orthogonal axis the user can turn per project without picking a new persona. E.g. a "scandinavian-clean" persona at `MOTION_INTENSITY=8` vs `=3` produces very different generated HTML from the same brand tokens.

### 1.2 "Anti-slop" / AI-tell rules we do NOT yet enforce

Some of these Atelier already guards against. Those marked **new** are genuinely absent from our current prompts:

**Colour:**
- **The Lila Ban** *(new)* — explicit ban on purple/blue "AI gradient" aesthetic. Use neutral zinc/slate bases with a single desaturated accent.
- No pure `#000000` — off-black, zinc-950, charcoal *(partly new — our prompts let pure black through)*.
- Max 1 accent colour, saturation < 80% *(new)*.
- No mixing warm and cool grays within one project *(new)*.
- Tint shadows to the background hue instead of pure black at low opacity *(new)*.

**Typography:**
- **Banned: Inter font** *(new)* — swap to Geist / Outfit / Cabinet Grotesk / Satoshi. Atelier currently picks Inter by default in `DEFAULT_DESIGN`.
- Serif fonts banned on dashboards / software UIs *(new)*.
- Never use only Regular (400) + Bold (700). Add Medium (500) and SemiBold (600) for subtle hierarchy *(new)*.
- Use `font-variant-numeric: tabular-nums` for data-heavy UIs *(new)*.
- Fix orphaned words with `text-wrap: balance` / `pretty` *(new)*.
- Sentence case, not Title Case On Every Header *(new)*.

**Layout:**
- Anti-centre bias when `DESIGN_VARIANCE > 4` — force split-screen or left-aligned-content / right-aligned-asset *(new; Atelier currently has no anti-centre rule)*.
- **3-equal-column card feature rows are banned** — use 2-col zig-zag, asymmetric grid, or horizontal scroll instead *(new and important — Atelier has been producing exactly this pattern)*.
- `min-h-[100dvh]` over `h-screen` for full-bleed heroes to fix iOS Safari viewport bug *(already in our prompts; good sanity check)*.
- Grid over flex-math (`w-[calc(33%-1rem)]` → `grid grid-cols-1 md:grid-cols-3 gap-6`) *(new)*.
- Button bottom-alignment in card groups and feature-list baseline-alignment *(new)*.
- Optical vs mathematical centring — icon-next-to-text often needs 1–2px nudges *(new)*.
- "Random dark section in an otherwise light page looks like a copy-paste accident" *(new, and we've seen exactly this bug)*.

**Content:**
- "John Doe" / "Jane Smith" / "Acme Corp" / "SmartFlow" banned — use creative but realistic names *(partly new — we don't explicitly ban these)*.
- No fake round numbers (`99.99%`, `50%`, `$100.00`). Use organic values (`47.2%`, `+1 (312) 847-1928`) *(already mostly enforced, but now phrased sharper)*.
- No AI copywriting clichés: "Elevate", "Seamless", "Unleash", "Next-Gen", "Delve", "Tapestry", "In the world of…" *(new and worth adding verbatim)*.
- No exclamation marks in success messages.
- No Lorem Ipsum. Write real draft copy *(already enforced)*.

**Assets:**
- **No broken Unsplash links.** Use `https://picsum.photos/seed/{name}/1920/1080` — seedable, deterministic, always returns. *(Atelier currently generates `picsum.photos/1920/1080` without seeding, which means each deployment shuffles.)*
- Stock "diverse team" photos feel uncanny. Prefer consistent illustration or avoid.

**Icons:**
- Lucide / Feather are the default AI choice — use Phosphor or Heroicons for differentiation *(new)*.
- Rocketship for "launch", shield for "security" — cliché metaphors; swap for bolt, spark, fingerprint *(new)*.
- Standardise stroke widths globally (e.g. `1.5` everywhere) *(new)*.

**Patterns:**
- Generic card look (border + shadow + white bg) — remove the border, or use only bg, or only spacing. Cards ONLY when elevation communicates hierarchy *(partly new)*.
- 3-tower pricing tables — highlight by colour/emphasis, not just extra height *(new)*.
- Always "filled button + ghost button" — introduce text links / tertiary styles *(new)*.

**Strategic omissions (things AI forgets):**
- Privacy / TOS links in footer.
- Custom 404 page.
- Skip-to-content link for keyboard users.
- Form validation (email format, required fields).
- Cookie consent if jurisdiction requires.

### 1.3 Motion and performance rules worth lifting

Atelier already does most of this, but the taste-skill is more explicit:

- Spring physics (`type: "spring", stiffness: 100, damping: 20`), no linear easing.
- Animate **only** `transform` and `opacity` — never `top`/`left`/`width`/`height`.
- `useMotionValue` / `useTransform` for continuous animation — NEVER `useState` in a hot loop (mobile frame collapse).
- Grain / noise filters only on `fixed pointer-events-none` overlays, never on scrolling containers.
- Staggered entry: `staggerChildren` with `variants` on a common parent client component. Children must share the same client-component tree.
- `layout` / `layoutId` props for shared-element transitions.
- Wrap perpetual animations in their own microscopic memoised client components — never let them trigger re-renders in the parent.
- If using GSAP + ThreeJS + Framer Motion, **never** mix GSAP with Framer Motion in the same tree. GSAP for page-level scrolltelling, Framer for UI. *(Good guidance — we've had prompt-level collisions between GSAP ScrollTrigger and Framer Motion handlers.)*

### 1.4 The "Redesign" workflow prescription

The `redesign-skill/SKILL.md` spells out a sequence:

1. **Scan** — read the codebase, identify stack (Tailwind/vanilla/styled-components), current patterns.
2. **Diagnose** — run through the audit checklist, list every generic pattern and missing state.
3. **Fix** — apply targeted upgrades to the existing stack. Don't rewrite. Small focused changes.

And a concrete **fix priority order** (apply in this sequence for max impact / min risk):

1. Font swap — biggest instant improvement, lowest risk
2. Colour palette cleanup — remove clashing / oversaturated colours
3. Hover / active states — make the interface feel alive
4. Layout + spacing — proper grid, max-width, consistent padding
5. Replace generic components — swap clichés for modern alternatives
6. Add loading / empty / error states — make it feel finished
7. Polish typography scale + spacing — the premium final touch

**This is directly applicable to our `design_refine` stage.** Today our refine stage runs a single LLM pass. Priority-ordered passes would give more predictable quality and make it cheaper to skip polish for draft iterations.

### 1.5 The "Creative Arsenal" inspiration catalogue

Sections 8–9 of `taste-SKILL.md` are a labelled library of 40+ concrete UI patterns grouped by intent: navigation (mac-dock magnification, magnetic button, gooey menu, dynamic island, floating speed-dial), layout (bento, masonry, chroma-grid, split-scroll, curtain-reveal), cards (parallax tilt, spotlight border, holographic foil, tinder stack), scroll animations (sticky stack, horizontal hijack, locomotive sequence, zoom parallax, scroll-progress-path), typography (kinetic marquee, text-mask reveal, scramble effect, circular path), micro-interactions (particle explosion, ripple-at-click, skeleton-shimmer, mesh-gradient-bg, lens-blur).

**Atelier already has a component library (`scripts/components-cinematic.json`, `scripts/components.json`). This labelled catalogue should be cross-referenced against ours** — anything missing is a candidate to add as a retrieval hint for the section generator.

---

## 2. design.md — what's useful

### 2.1 The format itself — a direct upgrade path for CanvasDesignSystem

Atelier's current `CanvasDesignSystem` shape:

```ts
interface CanvasDesignSystem {
  seedColor: string;
  colorTheme: string;
  palette: { primary, secondary, tertiary, neutral, background?, text? };
  fonts: { headline, body, label };
  cornerRadius: string;
  logos?: ExtractedLogoData[];
}
```

DESIGN.md's schema is a strict superset and a published spec:

```yaml
---
version: alpha
name: <project-name>
colors:
  primary: "#1A1C1E"
  secondary: "#6C7278"
  tertiary: "#B8422E"
  neutral: "#F7F5F2"
typography:
  h1: { fontFamily, fontSize, fontWeight, lineHeight, letterSpacing, fontFeature, fontVariation }
  body-md: { ... }
  label-caps: { ... }
rounded: { sm: 4px, md: 8px, lg: 12px, full: 9999px }
spacing: { xs, sm, md, lg, xl, gutter, margin }
components:
  button-primary:
    backgroundColor: "{colors.tertiary}"
    textColor: "{colors.neutral}"
    rounded: "{rounded.md}"
    padding: 12px
  button-primary-hover:
    backgroundColor: "{colors.tertiary-container}"
---

## Overview
## Colors
## Typography
## Layout
## Elevation & Depth
## Shapes
## Components
## Do's and Don'ts
```

Token-reference syntax `{colors.primary}` lets components reuse palette values without duplication. Component variants (`button-primary`, `button-primary-hover`, `button-primary-active`) are siblings, not nested.

**Why this matters for Atelier:**

- It's a *spec*, not an ad-hoc shape. Adopting it gives us interop: our per-project DESIGN.md exports to Tailwind theme, Figma variables, or W3C DTCG `tokens.json` via one CLI call.
- The linter (next section) gives us free quality gates.
- Because the YAML front matter + markdown prose is human-editable, power users can hand-edit a project's design system — something our structured-only shape doesn't support well.
- Our storage column `canvas_design_system TEXT` already persists arbitrary JSON. Switching to raw DESIGN.md markdown is a one-line storage change.

### 2.2 The linter — free quality gate

`npx @google/design.md lint DESIGN.md` runs seven rules:

| Rule | Severity | Checks |
|---|---|---|
| `broken-ref` | error | Token refs like `{colors.primary}` that don't resolve |
| `missing-primary` | warning | Colors defined but no `primary` |
| `contrast-ratio` | warning | Component bg/text pairs below WCAG AA 4.5:1 |
| `orphaned-tokens` | warning | Color tokens defined but unreferenced by any component |
| `token-summary` | info | Count per section |
| `missing-sections` | info | `spacing`/`rounded` absent when other tokens exist |
| `missing-typography` | warning | Colors defined but no typography |
| `section-order` | warning | Sections out of canonical order |

**Programmatic API:**
```ts
import { lint } from '@google/design.md/linter';
const report = lint(markdownString);
// report.findings, report.summary { errors, warnings, info }, report.designSystem
```

This is a pure JS library. We can run it inside our pipeline — post-extraction for brand validation, and post-generation as an additional UICrit signal. Contrast-ratio alone catches a class of accessibility regressions we currently miss.

### 2.3 Diff mode for comparing versions

`npx @google/design.md diff before.md after.md` returns structured JSON of token-level changes:

```json
{
  "tokens": {
    "colors": { "added": ["accent"], "removed": [], "modified": ["tertiary"] },
    "typography": { "added": [], "removed": [], "modified": [] }
  },
  "regression": false
}
```

Exit code `1` if regressions detected (more errors/warnings). **Useful for our pipeline's undo/history feature** — we could surface "you regressed 3 tokens" when a user reverts a design-panel edit.

### 2.4 Export to other formats

`npx @google/design.md export --format tailwind DESIGN.md` outputs a Tailwind theme config. `--format dtcg` outputs W3C Design Tokens Format Module JSON.

**For Atelier, this means:** if we persist the project's design system as DESIGN.md, we can inject it into section-generation prompts as a Tailwind theme config directly — the LLM sees familiar syntax instead of our bespoke shape. Fewer hallucinated colour names, better use of our palette.

### 2.5 The spec command for agent context

`npx @google/design.md spec --format json` outputs the full format spec for injecting into LLM prompts as grounding context. Cheaper than us re-describing the shape.

---

## 3. Direct applicability to Atelier

### 3.1 Quick wins (low risk, high signal)

**Prompts — anti-slop rules.** Add to [packages/sdk/src/utils/prompts.ts](../packages/sdk/src/utils/prompts.ts) `<safety-rules>` and `<anti-patterns>` blocks:
- The Lila Ban (no purple/blue AI gradients).
- Banned: Inter (swap to Geist / Outfit / Cabinet Grotesk / Satoshi as the default `DEFAULT_DESIGN.fonts.body`).
- Banned: pure `#000000` — use `#0a0a0a` or zinc-950.
- Banned: "3 equal cards horizontally" feature rows.
- Anti-centre rule for high-variance layouts.
- No sudden dark-section-in-light-page (we've actually produced this bug).
- AI copywriting cliché ban list: Elevate, Seamless, Unleash, Next-Gen, Delve, Tapestry, In the world of…
- No exclamation marks in success messages.
- Use `picsum.photos/seed/<name>/<w>/<h>` — seeded, not random.
- Icon pack ban on Lucide / Feather; prefer Phosphor / Heroicons.
- `text-wrap: balance` for orphaned words.
- Button bottom-alignment in card groups.
- `font-variant-numeric: tabular-nums` in data UIs.

**Default design system.** Change [canvas-store.ts `DEFAULT_DESIGN`](../packages/web-ui/src/stores/canvas-store.ts#L148-L153): drop `Inter` and `Noto Serif`, use `Geist` / `Cabinet Grotesk` / `Satoshi` as defaults. Low-risk — `DEFAULT_DESIGN` only shows on projects with no extracted brand.

**Seed Picsum URLs in image fallback.** Anywhere `picsum.photos/1920/1080` appears without a seed, the image shuffles per reload. Seed with a stable project-plus-section hash.

### 3.2 Medium-effort, high-leverage

**Integrate `@google/design.md` linter into the pipeline.** 
- Post-brand-extract: run lint on the extracted design system. Log warnings for low-contrast, orphaned tokens.
- Post-generation: run lint on any tokens the generator has implicitly used. Any `contrast-ratio` finding becomes a fit-validate failure.
- Surface warnings in the design-system card UI. Users can see "Your primary on neutral is 3.2:1 — below WCAG AA."

**Adopt the DESIGN.md format for persistence.** Migrate [packages/sdk/src/storage/sqlite.ts `canvas_design_system`](../packages/sdk/src/storage/sqlite.ts#L234) from JSON blob to DESIGN.md markdown:
1. Add a serializer `CanvasDesignSystem → DESIGN.md string`.
2. Add a parser using `@google/design.md` programmatic API.
3. Persist markdown. Storage column stays `TEXT`.
4. Expose `GET /api/projects/:pid/design-system.md` (raw markdown) for power-user export.
5. Use `export --format tailwind` to inject the token set into section-generation prompts as a Tailwind theme snippet — format the LLM already understands well.

This also unlocks human editing (the file is hand-writable) and diff/compare for undo/redo.

**Implement the fix-priority-order in `design_refine`.** Currently one prompt, one pass. Replace with a staged refine:
1. Font swap pass (if the generated HTML uses banned fonts or browser defaults).
2. Palette cleanup pass (enforce one accent, desaturate, remove warm/cool mix).
3. Interaction-state pass (loading / empty / error / hover / active).
4. Final typography polish (tracking, orphans, line-height).

Cheaper per-pass, clearer telemetry for which stage regressed, skip-able for draft mode.

### 3.3 Deeper, more speculative

**3-dial parameterisation orthogonal to personas.** Store `{ designVariance, motionIntensity, visualDensity }` per project alongside the design system. Inject dial values into the section-generation prompt. The UI adds three sliders alongside the existing persona picker.

Personas currently bundle visual direction *and* motion complexity. Separating them makes "scandinavian-clean with cinematic motion" and "space-agency at low density" trivial.

**DESIGN.md file format for inputs too.** Allow users to upload a DESIGN.md file in the project-creation modal (alongside URL / screenshot). Run it through the linter, extract tokens, seed the project's design system. Power users with existing token systems get a zero-friction path in.

**Cross-reference taste-skill's "Creative Arsenal" with our component library.** For each of the ~40 named patterns (bento, masonry, kinetic marquee, dome gallery, spotlight border, etc.), check whether we have a matching entry in `scripts/components-cinematic.json`. Anything missing is a retrieval-index gap. The labelled names themselves are useful prompt-retrieval keys ("user asked for a masonry layout" → find masonry exemplar).

---

## 4. What to skip / what we already have

**Don't rebuild from scratch.** taste-skill is a monolithic SKILL.md aimed at Claude Code / Cursor / Antigravity running against a user's own codebase. Atelier is a self-contained pipeline generating single-file HTML. We want to extract the *rules*, not adopt the skill-file workflow.

**Already covered:**
- Our `prompts.ts` has robust cinematic rules, namespace rules (`sec-N-cine` prefixes), animation brief capture, anti-fake-KPI rules, nav/footer mandates, premium-scroll rules.
- The [designsystemrefresh.md](designsystemrefresh.md) doc already provides per-project design-system persistence — the DESIGN.md upgrade fits inside that architecture, it doesn't replace it.
- Atelier's UICrit stage overlaps with several anti-slop rules. Any additions go into UICrit's hard-test list, not a new validator.

**Skip outright:**
- `stitch-skill` — Google Stitch-specific, not relevant to our pipeline.
- `brutalist-skill` (beta, experimental) — could be modelled as a persona if demanded.
- `output-skill` — aimed at stopping lazy agents from leaving TODO comments. Our generator runs to completion on every section; not a pain point for us.

---

## 5. Proposed upgrade order

If we ship all of the above in priority order, this is the path:

1. **Week 0 (immediate):** Anti-slop rules into `prompts.ts`. Swap `DEFAULT_DESIGN` font family. Seed picsum URLs. Single PR, verifiable against the existing redesign-test fixtures.
2. **Week 0:** Install `@google/design.md`. Run the linter programmatically post-extract. Surface warnings as UICrit findings (no new UI yet).
3. **Week 1:** DESIGN.md serializer + parser alongside the current JSON persistence. Dual-write to both shapes. Add the export-to-Tailwind snippet into section-generation prompts.
4. **Week 1:** Split `design_refine` into the 5-stage fix-priority pipeline. Gate on an env var so we can A/B against the current single-pass refine.
5. **Week 2+:** 3-dial parameterisation in the UI + prompts. Cross-reference creative-arsenal catalogue against our component library, fill gaps.
6. **Later:** DESIGN.md upload path in project creation. Power-user `.md` export endpoint.

## 6. Implementation checklist

Tick as work lands. Phases are ordered so each phase ships on its own and the next one stacks on top without rework.

### Phase 1 — Prompt + defaults quick wins (1 PR, ~1 day)

Ship the low-risk anti-slop rules that don't touch storage or UI.

- [x] [packages/sdk/src/utils/prompts.ts](../packages/sdk/src/utils/prompts.ts): add "The Lila Ban" — no purple/blue AI gradients — to `<anti-patterns>`.
- [x] [prompts.ts](../packages/sdk/src/utils/prompts.ts): ban pure `#000000` — use `#0a0a0a` / zinc-950 / charcoal.
- [x] [prompts.ts](../packages/sdk/src/utils/prompts.ts): ban the "3 equal card" feature row — force 2-col zig-zag, asymmetric grid, or horizontal scroll.
- [x] [prompts.ts](../packages/sdk/src/utils/prompts.ts): anti-centre rule — if persona variance is high, force split-screen or left-aligned-content / right-aligned-asset.
- [x] [prompts.ts](../packages/sdk/src/utils/prompts.ts): ban sudden dark-section-in-light-page inconsistency.
- [x] [prompts.ts](../packages/sdk/src/utils/prompts.ts): AI cliché word ban list — Elevate, Seamless, Unleash, Next-Gen, Delve, Tapestry, "In the world of…", Game-changer.
- [x] [prompts.ts](../packages/sdk/src/utils/prompts.ts): ban exclamation marks in success/confirmation messages.
- [x] [prompts.ts](../packages/sdk/src/utils/prompts.ts): Lucide / Feather icons discouraged — prefer Phosphor or Heroicons.
- [x] [prompts.ts](../packages/sdk/src/utils/prompts.ts): cliché icon metaphors (rocketship = launch, shield = security) → bolt / spark / fingerprint / vault.
- [x] [prompts.ts](../packages/sdk/src/utils/prompts.ts): require `text-wrap: balance` on headings to kill orphaned words.
- [x] [prompts.ts](../packages/sdk/src/utils/prompts.ts): require bottom-aligned CTAs in card groups and baseline-aligned feature lists.
- [x] [prompts.ts](../packages/sdk/src/utils/prompts.ts): require `font-variant-numeric: tabular-nums` in data-dense sections.
- [x] [prompts.ts](../packages/sdk/src/utils/prompts.ts): require Max 1 accent colour, saturation < 80%.
- [x] [prompts.ts](../packages/sdk/src/utils/prompts.ts): tint shadows to background hue, no pure-black low-opacity.
- [x] [prompts.ts](../packages/sdk/src/utils/prompts.ts): force seeded Picsum URLs — `picsum.photos/seed/{project+section-hash}/{w}/{h}` — no raw `picsum.photos/1920/1080`.
- [x] [canvas-store.ts `DEFAULT_DESIGN`](../packages/web-ui/src/stores/canvas-store.ts#L148-L156): swap `Inter` / `Noto Serif` out, use `Cabinet Grotesk` / `Geist` / `JetBrains Mono` as defaults.
- [x] [section-generator.ts](../packages/sdk/src/models/section-generator.ts): audit every Picsum URL template; seed them with a stable brand+context slug. Also updated [redesign.ts](../packages/sdk/src/models/redesign.ts) in the same pass.
- [x] Regression: ran E2E on 2 sites (Positive Change Group + people-made.com). PCG UICrit 9.7/10 PASS; people-made 8/10 PASS. 11/11 automated Phase 1 checks clean on PCG. Review surfaced three new bugs fed back into prompts (GSAP scroll-timeline conflict, `whitespace-nowrap` scope, wordmark preference + nav invention) — tracked as Phase 1.1 follow-ups. Adidas / Stratton Craig deferred (optional additional sites).
- [x] CHANGELOG entry (now two: initial Phase 1 + Phase 1.1 follow-up rules).

### Phase 1.1 — Regression review findings (1 PR, ~1 day) — ✅ COMPLETE

Bugs surfaced by reviewing the PCG + people-made outputs; fed back as prompt rules.

- [x] [prompts.ts](../packages/sdk/src/utils/prompts.ts): never attach two scroll timelines to the same property on the same element (cause of PCG card-grid drift).
- [x] [prompts.ts](../packages/sdk/src/utils/prompts.ts): never multiply raw `y` by `window.innerHeight`; use `yPercent` ±30 or raw `y` ≤ 200px.
- [x] [prompts.ts](../packages/sdk/src/utils/prompts.ts): `whitespace-nowrap` scoped to nav links/short pills only, never on section/content wrappers (cause of PCG "Our vision" paragraph overflow).
- [x] [prompts.ts](../packages/sdk/src/utils/prompts.ts): prefer wordmark over a tiny complex-SVG logo when the brand mark is a traced stamp/seal (people-made illegible SVG).
- [x] [prompts.ts](../packages/sdk/src/utils/prompts.ts): never invent nav items (Search, Get Started, demo pills) that aren't on the source site.
- [x] [prompts.ts](../packages/sdk/src/utils/prompts.ts): region/locale switchers stay subtle — small icon button, not a prominent coloured pill in the primary bar.
- [x] [prompts.ts](../packages/sdk/src/utils/prompts.ts): cap primary nav at 5–7 visible items.
- [x] Rebuilt docker (no-cache) and verified rules present in running container.

### Phase 1.2 — Section-generation truncation guard (1 PR, ~0.5 day) — ✅ COMPLETE

Pipeline-level safety net for when the LLM hits its max-tokens budget mid-response.

- [x] [section-generator.ts](../packages/sdk/src/models/section-generator.ts): `isSectionTruncated(html, role)` detector — flags HTML under 400 chars, missing closing tag in trailing 300 chars, or content/hero under 800 chars.
- [x] Primary batch loop flags truncated responses as failures → feeds existing retry loop.
- [x] Retry loop also checks for truncation → a truncated retry keeps the placeholder instead of silently accepting.
- [x] Log line `[N] "Label" truncated (X chars, empty rationale) — flagging for retry` makes failure visible.
- [x] Rebuilt docker (no-cache) and verified guard present in running container.
- [ ] Deferred: router API extension for per-call `maxTokens` override (parked until we see retries also truncating).

### Phase 2 — DESIGN.md linter as a quality gate (1 PR, ~1 day) — ✅ COMPLETE

No user-visible changes yet — wired up a home-grown linter so we can start collecting signal. **Home-grown, not `@google/design.md`** — the package is alpha (v0.1.1, "expect changes"), the surface is ~500 LOC (YAML front-matter parse + token-ref resolve + contrast math + 7 lint rules + string templates), and owning it locally avoids Apache-2.0 NOTICE tracking and lets us fold Atelier-specific anti-slop rules in as lint rules later.

**New module:** [packages/sdk/src/utils/design-md.ts](../packages/sdk/src/utils/design-md.ts) — four exports: `serialize(ds, name)`, `parse(md)`, `lint(md)`, `exportTailwind(ds)`. Internals: hand-rolled YAML-subset parser, token-ref resolver, sRGB→luminance contrast math, 7 lint rules, canonical serializer.

- [x] `packages/sdk/src/utils/design-md.ts` NEW — `serialize`, `parse`, `lint`, `exportTailwind` exports.
- [x] YAML front-matter parser — strict subset (key-value, nested 2-space, quoted strings, token refs `{colors.primary}`). No `js-yaml` dep.
- [x] `resolveRef(root, value, ...)` — walk parsed object, substitute `{section.key}` refs; collect broken refs for lint.
- [x] `contrastRatio(hex1, hex2)` — W3C sRGB → relative luminance formula.
- [x] 7 lint rules: `broken-ref` (error), `contrast-ratio` (warning, WCAG AA 4.5:1), `orphaned-tokens` (warning), `missing-primary` (warning), `missing-typography` (warning), `missing-sections` (info), `section-order` (warning).
- [x] Canonical serializer — YAML front matter + H2 sections in order (Overview / Colors / Typography / Layout / Shapes / Components / Do's and Don'ts).
- [x] `exportTailwind(ds)` — Tailwind `theme.extend` config as a string template (Phase 3 consumer).
- [x] `packages/sdk/src/__tests__/design-md.test.ts` NEW — 14 vitest cases: round-trip (colors, typography, rounded, token-ref resolution), contrast math spot-checks, all 7 lint rules, `fromExtractedDesign` adapter, `exportTailwind` output shape. All pass.
- [x] [packages/sdk/src/models/redesign.ts](../packages/sdk/src/models/redesign.ts) post-extract hook: `runDesignMdLint()` helper serialises `extractedDesign` → lint → log findings via `PipelineRun` logger. Non-blocking.
- [x] UICrit hook: `contrast-ratio` findings stashed on `PageGenerationContext.dsLintFindings`, forwarded into UICrit's `report.issues` inside [section-generator.ts](../packages/sdk/src/models/section-generator.ts) as `ds-contrast-ratio` warnings.
- [x] Env flag `CANVAS_DESIGN_MD_LINT` — default on; opt out with `0` or `false`.
- [x] No UI surfacing yet — purely telemetry.
- [x] Built SDK + rebuilt docker (no-cache, ~28s) and verified all three hooks present in running container.
- [x] CHANGELOG entry.

**Deferred to Phase 7:** diff mode, DTCG export, `spec` command. **Risk/rollback:** pure additive module behind env flag; if the hand-rolled YAML parser proves brittle, swapping in `js-yaml` is a one-line change.

### Phase 3 — DESIGN.md as storage + prompt context (1 PR, ~2-3 days) — ✅ COMPLETE

Switch persistence format. Unlocks hand-edit, export, diff.

- [x] Dual-write: [api-server PUT /api/projects/:pid/design-system](../packages/api-server/src/routes/analytics.ts) stores both the raw JSON *and* a generated `.md` string in the same column (JSON wrapper, one field `"markdown"`).
- [x] Add `GET /api/projects/:pid/design-system.md` returning `text/markdown` for power-user export. Regenerates from the stored CanvasDesignSystem if `.markdown` isn't cached (pre-Phase-3 rows).
- [x] Add `PUT /api/projects/:pid/design-system.md` accepting `text/markdown`, parsed via the Phase 2 helper; adapts back to CanvasDesignSystem shape via new `toCanvasDesignSystem()` so the frontend store hydrates unchanged.
- [x] New adapters `fromCanvasDesignSystem()` and `toCanvasDesignSystem()` in [design-md.ts](../packages/sdk/src/utils/design-md.ts), plus `promptDsFormat()` env-flag helper.
- [x] [packages/sdk/src/models/section-generator.ts](../packages/sdk/src/models/section-generator.ts): flag-gated swap of the bullet design-system block for a Tailwind `theme.extend` snippet when `CANVAS_PROMPT_DS_FORMAT=tailwind`.
- [x] Measure token/length impact — tailwind 474 chars vs bullet 461, a wash; no compact variant needed.
- [x] A/B flag: `CANVAS_PROMPT_DS_FORMAT=tailwind|json`. Default remains `json`; flip the env flag on canonical sites before changing the default.
- [x] 6 new vitest cases (canvas round-trip, `promptDsFormat` flag, empty-DS edge cases). 20/20 passing.
- [x] CHANGELOG entry.

**Deferred to Phase 7:** `.md` upload in NewProjectModal, "Export Tailwind / DTCG" UI buttons, diff-on-revert.

### Phase 4 — Staged `design_refine` (1 PR, ~2-3 days) — ✅ COMPLETE

Replace the current single-pass refine with a 5-stage priority pipeline.

- [x] Five focused prompts in [packages/sdk/src/utils/prompts.ts](../packages/sdk/src/utils/prompts.ts): `REFINE_FONT_SYSTEM`, `REFINE_PALETTE_SYSTEM`, `REFINE_STATES_SYSTEM`, `REFINE_COMPONENTS_SYSTEM`, `REFINE_TYPOGRAPHY_SYSTEM`. Each pass single-focus, same "return complete HTML, change only this dimension" contract.
- [x] Orchestrator `stagedRefineHtml()` in new [packages/sdk/src/utils/staged-refine.ts](../packages/sdk/src/utils/staged-refine.ts) runs passes sequentially; each pass sees the previous pass's output.
- [x] Each pass emits a `PipelineRun` log line with char-count delta + duration so regressions are visible.
- [x] Truncation safety net: a pass that returns <30% of the prior length or <800 chars is dropped; prior HTML kept.
- [x] Env flag `CANVAS_REFINE_PASSES`: unset/`none` → no refine (opt-in default); `all` → all five passes; comma list → subset (e.g. `font,palette` for draft mode). Canonical order enforced regardless of input order.
- [x] Pipeline wired into the non-cinematic path in [redesign.ts](../packages/sdk/src/models/redesign.ts) after orphan-hidden-state fixup.
- [x] 12 vitest cases in [packages/sdk/src/__tests__/staged-refine.test.ts](../packages/sdk/src/__tests__/staged-refine.test.ts) cover pass parsing, env flag, chaining, truncation guard, failure recovery. All passing.
- [x] SDK exports: `stagedRefineHtml`, `parseRefinePasses`, `getRefinePasses`, `REFINE_PASS_ORDER` + types.
- [x] CHANGELOG entry.
- [ ] Benchmark deferred (out of PR scope): compare UICrit scores with `CANVAS_REFINE_PASSES=all` vs unset on the 4 canonical sites. Infra is ready; ~13min per full run makes this a background task.

**Design note:** default behavior is unchanged (orchestrator skipped when env unset). Opt-in avoids an unannounced ~5× generation-time bloat on first deploy; flip the env flag to run the benchmark, then consider changing the default.

### Phase 5 — 3-dial parameterisation (1 PR, ~2-3 days) — ✅ COMPLETE

Add DESIGN_VARIANCE / MOTION_INTENSITY / VISUAL_DENSITY as project-scoped dials.

- [x] Dials persisted as a top-level `dials:` section in the DESIGN.md YAML front matter; `DesignTokens.dials` and `CanvasDesignSystemInput.dials` types added to [design-md.ts](../packages/sdk/src/utils/design-md.ts).
- [x] Three range sliders in [DesignPanel.tsx](../packages/web-ui/src/components/DesignPanel.tsx) under Corner Radius. Integer 1–10. Default `(8, 6, 4)` baked into `DEFAULT_DESIGN`.
- [x] Reuses the existing debounced `updateDesignSystem` → PUT `/api/projects/:pid/design-system` — no endpoint or storage changes needed. Phase 3's dual-write persists `.dials` alongside palette/fonts.
- [x] `formatDialsForPrompt()` renders each dial as a concrete LOW/MEDIUM/HIGH guidance band with real instructions (not bare numbers). Appended unconditionally to the `dsConstraint` block in all three branches of [section-generator.ts](../packages/sdk/src/models/section-generator.ts).
- [x] 6 new vitest cases: clamp, defaults, band breakpoints, markdown round-trip, canvas-adapter round-trip. 26/26 passing.
- [x] CHANGELOG entry.
- [ ] Orthogonality verification deferred (out of PR scope): run the same site with variance/motion/density at 1/1/1 vs 10/10/10 and eyeball the HTML difference. Infra is ready.

### Phase 5.1 — Microdetail rules (1 PR, ~0.5 day) — ✅ COMPLETE

Source: [jakubkrehel/make-interfaces-feel-better](https://github.com/jakubkrehel/make-interfaces-feel-better). 11-rule polish skill; 7 of those rules are net-new to Atelier. Same shape as Phase 1 — prompt-only, no storage or UI. All ten rules shipped in a single `<microdetail-rules>` block injected into both section-generate systems (cinematic + non-cinematic).

- [x] [prompts.ts](../packages/sdk/src/utils/prompts.ts): concentric border radius — outer radius = inner radius + padding; child radius = parent − padding.
- [x] [prompts.ts](../packages/sdk/src/utils/prompts.ts): optical over geometric alignment for icon-adjacent text, play-triangles, asymmetric glyphs.
- [x] [prompts.ts](../packages/sdk/src/utils/prompts.ts): prefer stacked transparent `box-shadow` over solid 1px border for card elevation.
- [x] [prompts.ts](../packages/sdk/src/utils/prompts.ts): interruptible animations — CSS `transition` for interactive state changes, reserve `@keyframes` for staged sequences that run once.
- [x] [prompts.ts](../packages/sdk/src/utils/prompts.ts): tighten existing stagger guidance to concrete ~100ms delta between chunks.
- [x] [prompts.ts](../packages/sdk/src/utils/prompts.ts): exit animations subtler than enters — small fixed `translateY`, never full height.
- [x] [prompts.ts](../packages/sdk/src/utils/prompts.ts): contextual icon swap recipe — `scale 0.25→1`, `opacity 0→1`, `blur 4px→0`, spring `duration 0.3 bounce 0`, cubic-bezier fallback `(0.2, 0, 0, 1)`.
- [x] `text-wrap: pretty` on body paragraphs already shipped in Phase 1 typography-rules — noted here for completeness, no edit needed.
- [x] [prompts.ts](../packages/sdk/src/utils/prompts.ts): image outlines — `1px` outline at `rgba(0,0,0,0.1)` (light) / `rgba(255,255,255,0.1)` (dark). Never tinted; tinted outlines read as dirt on image edges.
- [x] [prompts.ts](../packages/sdk/src/utils/prompts.ts): `-webkit-font-smoothing: antialiased` on root for macOS crispness (minor, bundle with above).
- [x] Rebuild SDK + docker (no-cache) and verify rules land in running container.
- [ ] Regression: PCG + people-made E2E. Expect UICrit improvement on polish/detail axis.
- [x] CHANGELOG entry.

### Phase 6 — Creative Arsenal audit + fills (1 PR, ~1-2 days)

Cross-reference taste-skill's labelled pattern catalogue against our components.

- [ ] Enumerate the ~40 named patterns from [taste-SKILL.md §8](https://github.com/Leonxlnx/taste-skill/blob/main/skills/taste-skill/SKILL.md) — nav, layout, cards, scroll, gallery, typography, micro-interactions.
- [ ] Diff against [scripts/components-cinematic.json](../scripts/components-cinematic.json) and [scripts/components.json](../scripts/components.json). Flag missing patterns.
- [ ] Add the top 5 missing high-leverage patterns (bento grid, masonry, sticky scroll stack, spotlight-border card, mesh-gradient background) as new component entries with retrieval keys.
- [ ] Regression test: run the 4 canonical sites, confirm no UICrit regressions from larger retrieval pool.
- [ ] CHANGELOG entry.

### Phase 7 — Power-user DESIGN.md upload + export UI (1 PR, ~2-3 days)

User-visible endpoints around the DESIGN.md format.

- [ ] NewProjectModal: add "Upload DESIGN.md" as a project-start path alongside URL / screenshot.
- [ ] On upload, lint via Phase 2 helper; block on errors, show warnings inline.
- [ ] Add "Export design system" button in DesignPanel — streams the `GET /api/projects/:pid/design-system.md` response as a download.
- [ ] Add "Export as Tailwind theme" and "Export as DTCG tokens.json" buttons (use `@google/design.md export` programmatically).
- [ ] Add diff surfacing: when a user reverts a design-system change, call `@google/design.md diff` between versions and surface "3 tokens regressed" in the history UI.
- [ ] CHANGELOG entry.

### Out of phase

Explicitly deferred — revisit later if there's demand:

- `stitch-skill` adoption (Google Stitch-specific, not our target).
- `brutalist-skill` as a persona (bigger persona-library effort, schedule separately).
- `output-skill` (non-problem for our pipeline — generator runs to completion).
- Re-skinning the prompt system around taste-skill's SKILL.md convention (we have our own shape; extract rules, don't adopt scaffold).

## 7. References

- Taste-Skill README: <https://github.com/Leonxlnx/taste-skill/blob/main/README.md>
- Taste-Skill default SKILL.md: <https://github.com/Leonxlnx/taste-skill/blob/main/skills/taste-skill/SKILL.md>
- Redesign-Skill SKILL.md: <https://github.com/Leonxlnx/taste-skill/blob/main/skills/redesign-skill/SKILL.md>
- DESIGN.md README: <https://github.com/google-labs-code/design.md/blob/main/README.md>
- DESIGN.md spec: <https://github.com/google-labs-code/design.md/blob/main/docs/spec.md>
- npm: `@google/design.md`
- W3C Design Tokens Format Module: <https://tr.designtokens.org/format/>
