# HOWTO: Component Engine

Generate premium, animated web components by crawling top websites, extracting animation patterns, and using AI to create original components inspired by those patterns.

**Full architecture:** see [componentengine.md](componentengine.md)

---

## Prerequisites

- `MONGO_URI` set in `.env` (MongoDB Atlas)
- `OPENROUTER_API_KEY` set in `.env`
- crawl4ai running for best results (optional but recommended — without it, JS-heavy sites yield fewer sections)
- Playwright installed for quality scoring (optional): `npm install playwright && npx playwright install chromium`

Start crawl4ai (if using):
```
docker compose up -d crawl4ai
```

---

## Generation Methods

There are **4 ways** to generate components, each suited to different needs:

| Method | Best For | Fidelity | Speed |
|--------|----------|----------|-------|
| **Pipeline** (crawl → brief → generate) | Bulk generation from real websites | Medium | Slow |
| **Skeleton + CSS-only enhance** | Premium animated components | High | Medium |
| **Screenshot-guided** | Recreating a specific visual design | High visual, low animation | Medium |
| **Brand-locked generation** | On-brand components for a known client | High brand, medium animation | Slow |

### Web UI

The review page at `#/review` lets you:
- Preview generated components in an iframe
- Open full-screen previews in a new tab (with GSAP + ScrollTrigger + Swiper loaded)
- Approve components into the library (adds to `section_templates` with ELO rating)
- Reject components
- Trigger generation (1-50 components) with live progress

The ranking page at `#/rank` also has preview buttons for side-by-side comparison.

---

## Method 1: Pipeline (Crawl → Brief → Generate)

The full pipeline runs in 7 steps. Each step is a standalone CLI command.

```
seed → crawl → classify → brief → generate → score → merge
```

### Step 1: Seed crawl targets

```bash
npx tsx scripts/component-engine.ts --seed-targets
```

Only needs to be run once.

### Step 2: Crawl websites

```bash
# Single domain
npx tsx scripts/component-engine.ts --crawl stripe.com

# All pending targets
npx tsx scripts/component-engine.ts --crawl-pending

# Batch of 5
npx tsx scripts/component-engine.ts --crawl-pending --count 5
```

Check results:
```bash
npx tsx scripts/component-engine.ts --stats
npx tsx scripts/component-engine.ts --catalogue
```

### Step 3: LLM-classify ambiguous sections (optional)

```bash
npx tsx scripts/component-engine.ts --classify
```

### Step 4: Generate animation briefs

```bash
npx tsx scripts/component-engine.ts --brief --count 10
```

### Step 5: Generate components

```bash
# Default (5 components, random persona)
npx tsx scripts/component-engine.ts --generate --count 5

# With specific persona
npx tsx scripts/component-engine.ts --generate --count 5 --persona editorial-luxury

# From a specific domain only
npx tsx scripts/component-engine.ts --generate --domain stripe.com --count 5
```

### Step 6: Preview and score

```bash
npx tsx scripts/component-engine.ts --preview --count 5
open scripts/engine-previews/
```

Optional Playwright scoring:
```bash
npx tsx scripts/component-engine.ts --score --count 5
```

### Step 7: Merge into library

```bash
npx tsx scripts/component-engine.ts --merge --preview   # dry run
npx tsx scripts/component-engine.ts --merge              # write
```

---

## Method 2: Skeleton Library + CSS-Only Enhance

**This is the recommended method for premium animated components.** Hand-coded skeletons have correct animation behavior; Kimi adds visual styling via CSS only — the HTML and JavaScript are never touched.

### How it works

1. A skeleton is a minimal HTML file with working animations (GSAP timelines, ScrollTrigger, Swiper, CSS keyframes)
2. The skeleton is sent to Kimi K2.5 with a prompt asking for ONLY a `<style>` block
3. The returned CSS is injected into the skeleton — the DOM and JS stay untouched
4. This guarantees animations keep working (the core problem with full-HTML enhance)

### List available skeletons

```bash
npx tsx scripts/component-engine.ts --list-skeletons
```

Current library (in `scripts/skeletons/`):

| Skeleton | Animation | Libraries |
|----------|-----------|-----------|
| `scrollytelling-panels` | 3-stage panel-by-panel scroll transitions | GSAP, ScrollTrigger |
| `split-panel-hero` | Parallax image + staggered text reveal | GSAP, ScrollTrigger |
| `counter-dashboard` | KPI stat cards with count-up animation | GSAP, ScrollTrigger |
| `image-carousel` | Full-width slides with parallax backgrounds | Swiper |
| `text-marquee` | Infinite horizontal scroll banner | CSS only |

### Enhance a library skeleton

```bash
# Basic — uses default dark theme
npx tsx scripts/component-engine.ts --enhance-skeleton scrollytelling-panels

# With brand colors
npx tsx scripts/component-engine.ts --enhance-skeleton counter-dashboard \
  --domain adidas \
  --colors "#000000, #FFFFFF, #00B140" \
  --description "Adidas annual report KPI dashboard"

# With custom image style
npx tsx scripts/component-engine.ts --enhance-skeleton split-panel-hero \
  --images "High-end fashion photography, editorial lighting"
```

### Enhance your own skeleton

```bash
npx tsx scripts/component-engine.ts --enhance my-component.html \
  --domain my-brand \
  --colors "#1a1a2e, #e94560, #ffffff" \
  --description "Dark hero section with red accents"
```

### Writing a skeleton

A good skeleton has:
- Working animation logic (GSAP timelines, ScrollTrigger, Swiper init)
- `data-*` attributes for JS selectors (not class names that CSS might change)
- Inline styles for layout (flex, grid, position) — the enhance adds visual styles on top
- Placeholder text content
- A comment on line 1 describing the pattern

The CSS-only enhance will:
- Add typography (fonts, sizes, weights)
- Add colors, gradients, shadows
- Add hover/focus transitions
- Add responsive breakpoints
- Add background images via `background-image` on existing elements

It will NOT:
- Change HTML structure
- Add or remove elements
- Modify JavaScript
- Override `transform`, `opacity`, or `translateY` (GSAP controls those)

### Legacy full-HTML mode

If you need Kimi to modify the HTML (e.g. add new elements), use `--full-html`:

```bash
npx tsx scripts/component-engine.ts --enhance my-component.html --full-html
```

**Warning:** Full-HTML mode may break animations. If structural validation detects broken selectors or missing GSAP code, it automatically falls back to CSS-only mode.

---

## Method 3: Screenshot-Guided Generation

Send actual screenshots to Kimi K2.5 vision API to recreate a specific visual design.

### Capture screenshots

```bash
# Full page capture with scroll animation triggering
npx tsx scripts/capture-adidas.ts

# Filmstrip capture (progressive scroll states)
npx tsx scripts/capture-filmstrip.ts
```

Screenshots are saved to `scripts/adidas-screenshots/`.

### Generate from screenshots

```bash
npx tsx scripts/generate-from-screenshots.ts
```

This sends each screenshot + a detailed prompt to Kimi K2.5, saves results to `generated_components`, and **automatically deletes the screenshots** after generation to save disk space.

**Note:** Screenshot-guided generation produces good visual fidelity but may miss complex animation behavior that isn't visible in a single frame. For animated components, prefer the skeleton + enhance approach.

### Manual cleanup

If screenshots weren't auto-cleaned:
```bash
npx tsx scripts/component-engine.ts --cleanup-screenshots
```

---

## Method 4: Brand-Locked Generation

Bypass the persona system entirely and lock generation to a specific brand's palette. This prevents "persona pollution" where random personas (gothic, cyberpunk, etc.) override the target brand's actual colors.

```bash
npx tsx scripts/component-engine.ts --generate --count 5 \
  --domain report.adidas-group.com \
  --brand-lock adidas \
  --brand-colors "#000000, #FFFFFF, #00B140" \
  --brand-fonts "AdihausDIN, Georgia" \
  --brand-style "Dark background, bold athletic imagery, minimal"
```

The prompt tells Kimi to use these EXACT colors — no random palette invention.

Brand-lock can be combined with `--domain` to only generate from a specific site's briefed sections.

---

## Quality Gate

Every generated component is scored on 9 factors (0-10 scale):

| Factor | Weight | What it checks |
|--------|--------|----------------|
| Semantic HTML | 10% | `<section>`, `<nav>`, heading hierarchy |
| Accessibility | 15% | Alt text, ARIA labels |
| Responsiveness | 15% | `md:` / `lg:` breakpoints |
| Code quality | 5% | Nesting depth, inline style ratio |
| Self-contained | 10% | No external CSS/JS imports |
| Content | 5% | 300+ chars of text |
| Animation | 15% | GSAP, ScrollTrigger, keyframes, prefers-reduced-motion |
| Interactivity | 10% | Swiper, tabs, buttons |
| Premium tier | 15% | Pin, scrub, SVG animation, parallax |

**Decision thresholds:**
- **7+/10** → Accept (enters library directly)
- **4-7/10** → Normalize (cleanup tracking/analytics, re-score)
- **<4/10** → Reject

Tier classification: `basic` → `interactive` → `animated` → `cinematic`

---

## Component Lifecycle

```
[Generated] → Review (#/review) → [Approved] → section_templates (ELO library) → Ranking (#/rank)
                                 → [Rejected] → archived
```

- **generated_components** — All output from any generation method. Unreviewed by default.
- **section_templates** — Approved components with ELO ratings. Used in the ranking page and by the redesign pipeline.
- **components.json** — Static export via `--merge`. Used as fallback when MongoDB is unavailable.

---

## Advanced Features

### Style transfer

Apply luxury animation patterns to a tech persona:
```bash
npx tsx scripts/component-engine.ts --style-transfer --category hero --persona tech-minimal --count 3
npx tsx scripts/component-engine.ts --generate --count 3 --persona tech-minimal
```

### Cross-industry

Apply finance industry patterns to pricing pages:
```bash
npx tsx scripts/component-engine.ts --cross-industry --from finance --to pricing --persona editorial-luxury --count 3
```

### Gap analysis

Find what's missing in your library:
```bash
npx tsx scripts/component-engine.ts --gap-analysis
```

### Fill gaps with synthetic briefs

```bash
npx tsx scripts/component-engine.ts --inspire --category pricing --tier animated --count 5
npx tsx scripts/component-engine.ts --generate --count 5
```

### Replace low-quality components

```bash
npx tsx scripts/component-engine.ts --regenerate-low
```

### Re-crawl stale sites

```bash
npx tsx scripts/component-engine.ts --refresh --days 30
```

### Animation trends

```bash
npx tsx scripts/component-engine.ts --trends
```

---

## Available Personas

Run `--list-personas` to see all 52. Common ones:

| Persona | Style |
|---------|-------|
| `editorial-luxury` | Refined, high-contrast, generous whitespace, serif headings |
| `tech-minimal` | Clean sans-serif, monochrome with one accent, sharp edges |
| `bold-modern` | Oversized type, strong colors, dynamic layouts |

---

## API Endpoints

| Endpoint | Auth | Description |
|----------|------|-------------|
| `GET /api/engine/targets` | Yes | List crawl targets |
| `GET /api/engine/sections` | Yes | Browse extracted sections |
| `GET /api/engine/sections/:id` | Yes | Full section details |
| `GET /api/engine/patterns` | Yes | Animation patterns |
| `GET /api/engine/catalogue` | No | Pattern catalogue (public) |
| `GET /api/engine/generated` | Yes | Generated components |
| `GET /api/engine/generated/:id` | Yes | Full component HTML |
| `POST /api/engine/generated/:id/approve` | Yes | Approve → library |
| `POST /api/engine/generated/:id/reject` | Yes | Reject |
| `GET /api/engine/preview/:id` | Token | Standalone HTML preview |
| `POST /api/engine/generate` | Yes | Trigger generation job |
| `GET /api/engine/generate/:jobId` | Yes | Poll job status |
| `GET /api/engine/stats` | No | Engine stats (public) |

---

## CLI Reference

```
Phase 1-2: Crawl + Extract
  --seed-targets              Seed crawl target list
  --list-targets              List targets and status
  --crawl <domain>            Crawl a specific domain
  --crawl-pending [--count N] Crawl pending targets
  --classify                  LLM-classify low-confidence sections
  --brief [--count N]         Generate animation briefs
  --catalogue                 Show animation pattern catalogue

Phase 3: Generate
  --generate [--count N]      Generate from briefed sections
    [--persona <id>]          Use specific persona
    [--domain <d>]            Filter by source domain
    [--brand-lock <name>]     Lock to brand palette (bypasses persona)
    [--brand-colors "<hex>"]  Brand color palette (required with --brand-lock)
    [--brand-fonts "<fonts>"] Brand fonts (optional)
    [--brand-style "<desc>"]  Brand style description (optional)

Phase 3.5: Skeleton Enhancement
  --list-skeletons            List skeleton patterns in library
  --enhance-skeleton <name>   Enhance from library (CSS-only, safe)
  --enhance <file.html>       Enhance custom skeleton file
    [--domain <name>]         Source domain label
    [--colors <palette>]      Color palette
    [--images <style>]        Image style
    [--description <text>]    Component description
    [--full-html]             Legacy: Kimi rewrites full HTML (may break animations)

Phase 4: Merge
  --merge                     Merge into components.json (with dedup)
  --merge --preview           Dry run
  --preview [--count N]       Export as standalone HTML

Phase 5: Continuous
  --refresh [--days N]        Re-crawl stale targets
  --regenerate-low            Replace bottom 10% ELO
  --gap-analysis              Show coverage matrix
  --inspire --category <c> --tier <t> [--count N]
  --score [--count N]         Playwright quality scoring

Phase 6: Smart Generation
  --style-transfer --category <c> --persona <id> [--count N]
  --cross-industry --from <i> --to <c> --persona <id> [--count N]
  --trends                    Animation trend analysis

General
  --list-personas             List all 52 personas
  --cleanup-screenshots       Remove screenshot files to save disk
  --stats                     Engine stats
```

---

## Troubleshooting

**"No sections extracted" / only 1-2 sections per site**
Most modern sites render content with JavaScript. Without crawl4ai, you only get the shell HTML. Start crawl4ai: `docker compose up -d crawl4ai`

**"No briefed sections ready for generation"**
Run `--brief` first, or use `--inspire` to create synthetic briefs from the pattern catalogue.

**Components don't match the target brand**
Use `--brand-lock` to bypass persona and force exact brand colors. Or use the skeleton + CSS-only enhance approach with `--colors`.

**Enhanced component animations are broken**
The CSS-only enhance mode (default) cannot break animations since it only adds a `<style>` block. If using `--full-html`, the system auto-falls back to CSS-only when structural validation detects broken selectors.

**Preview files don't animate**
Scroll down in the preview — components start below a spacer div so scroll-triggered animations can fire. Ensure internet connectivity (CDN scripts for GSAP/Tailwind load externally).

**Screenshots taking too much disk space**
Run `--cleanup-screenshots` after generation. The `generate-from-screenshots.ts` script auto-cleans after use.
