# Component Generation Commands

All commands run from project root. The script writes directly to `components.json` with file locking — safe to run in multiple terminals simultaneously.

## Generate Components (auto-pick industry)

Open as many terminals as you want and run the same command:

```
npx tsx scripts/generate-industry-components.ts
```

The script auto-picks the industry with the most remaining specs. Each terminal picks independently, so they spread across industries.

## Limit how many to generate

```
npx tsx scripts/generate-industry-components.ts --count 5
```

## Generate a specific industry

```
npx tsx scripts/generate-industry-components.ts --industry finance
```

## Force a specific persona

```
npx tsx scripts/generate-industry-components.ts --industry finance --persona warm-nude
```

## List what's remaining

```
npx tsx scripts/generate-industry-components.ts --list-industries
```

## List available personas

```
npx tsx scripts/generate-industry-components.ts --list-personas
```

## Check component count

```
node -e "const c=require('./scripts/components.json');const cats={};c.forEach(x=>cats[x.category]=(cats[x.category]||0)+1);console.log('Total:',c.length);console.log(JSON.stringify(cats,null,2))"
```

---

## Animated Components (GSAP, ScrollTrigger, Swiper, CSS animations)

Generates premium animated/interactive components inspired by the Adidas Annual Report 2024
and similar editorial/magazine/sports sites. Unlike standard components, these include
embedded JavaScript (GSAP, ScrollTrigger, Swiper) and CSS @keyframes animations.

### Generate all animated components

```
npx tsx scripts/generate-animated-components.ts
```

### Generate a specific group

Groups: `heroes`, `scroll-sections`, `kpi-data`, `editorial`, `interactive`, `navigation`

```
npx tsx scripts/generate-animated-components.ts --category heroes
npx tsx scripts/generate-animated-components.ts --category kpi-data
```

### Limit batch size

```
npx tsx scripts/generate-animated-components.ts --count 5
```

### Force a persona

```
npx tsx scripts/generate-animated-components.ts --persona editorial-magazine
```

### Generate with ALL personas per spec (~150+ components)

```
npx tsx scripts/generate-animated-components.ts --multi-persona
npx tsx scripts/generate-animated-components.ts --category heroes --multi-persona
```

### Regenerate all (fresh variants, ignore existing)

```
npx tsx scripts/generate-animated-components.ts --fresh
npx tsx scripts/generate-animated-components.ts --fresh --count 10
```

### List specs and status

```
npx tsx scripts/generate-animated-components.ts --list
```

### Custom output file (for parallel terminals)

```
npx tsx scripts/generate-animated-components.ts --category heroes --output scripts/components-animated-heroes.json
```

---

## Premium Editorial Components (Kimi K2.5, annual report quality)

Generates premium editorial/annual report components using Kimi K2.5 with detailed creative briefs.
Each component includes GSAP/ScrollTrigger/Swiper animations, data-animate attributes, and is production-ready.
Components are section-level HTML (no DOCTYPE) — ready to drop into the library.

### List all specs and status

```
npx tsx scripts/generate-premium-editorial.ts --list
```

### Generate 1 component to test Kimi

```
npx tsx scripts/generate-premium-editorial.ts --count 1 --preview
```

### Generate a specific category

Groups: `heroes`, `data-viz`, `editorial`, `carousels`, `interactive`, `navigation`

```
npx tsx scripts/generate-premium-editorial.ts --category heroes --preview
npx tsx scripts/generate-premium-editorial.ts --category data-viz --preview
npx tsx scripts/generate-premium-editorial.ts --category carousels --preview
```

### Force a specific persona

```
npx tsx scripts/generate-premium-editorial.ts --persona editorial-luxury --preview
npx tsx scripts/generate-premium-editorial.ts --persona techno-minimal --category tech --preview
```

### Generate with ALL personas per spec (~120 components)

```
npx tsx scripts/generate-premium-editorial.ts --multi-persona --preview
npx tsx scripts/generate-premium-editorial.ts --category luxury --multi-persona --preview
```

### Generate all premium components (default persona per group)

```
npx tsx scripts/generate-premium-editorial.ts --preview
```

### Regenerate all (overwrite existing)

```
npx tsx scripts/generate-premium-editorial.ts --fresh --preview
```

### Preview files

Preview HTML files are saved to `scripts/premium-components/generated/` when using `--preview`.
Open them in a browser to check quality before rebuilding Docker.

```
open scripts/premium-components/generated/
```

---

## Component Engine

Crawls top websites (FTSE 100, S&P 500, SaaS), extracts sections, detects animation patterns, classifies with LLM, and generates animation briefs. See `docs/componentengine.md` for full architecture.

### Seed crawl targets (31 sites)

```
npx tsx scripts/component-engine.ts --seed-targets
```

### List all targets and their status

```
npx tsx scripts/component-engine.ts --list-targets
```

### Crawl a specific domain

```
npx tsx scripts/component-engine.ts --crawl stripe.com
npx tsx scripts/component-engine.ts --crawl diageo.com
```

### Crawl all pending targets

```
npx tsx scripts/component-engine.ts --crawl-pending
npx tsx scripts/component-engine.ts --crawl-pending --count 5
```

### LLM-classify low-confidence sections (DeepSeek V3)

```
npx tsx scripts/component-engine.ts --classify
```

### Generate animation briefs (Qwen3-VL-235B + screenshots)

```
npx tsx scripts/component-engine.ts --brief
npx tsx scripts/component-engine.ts --brief --count 5
```

### Show animation pattern catalogue

```
npx tsx scripts/component-engine.ts --catalogue
```

### Generate premium components from briefed sections (Kimi K2.5)

```
npx tsx scripts/component-engine.ts --generate
npx tsx scripts/component-engine.ts --generate --count 5
npx tsx scripts/component-engine.ts --generate --persona editorial-luxury
npx tsx scripts/component-engine.ts --generate --persona tech-minimal
npx tsx scripts/component-engine.ts --generate --persona bold-modern
```

### Score generated components with Playwright (JS errors, responsive)

```
npx tsx scripts/component-engine.ts --score
npx tsx scripts/component-engine.ts --score --count 10
```

### Merge accepted components into components.json (with dedup)

```
npx tsx scripts/component-engine.ts --merge --preview    # dry run
npx tsx scripts/component-engine.ts --merge              # write to components.json
```

### Re-crawl stale targets (not crawled in N days)

```
npx tsx scripts/component-engine.ts --refresh
npx tsx scripts/component-engine.ts --refresh --days 14
```

### Rating-driven regeneration (replace low-quality components)

```
npx tsx scripts/component-engine.ts --regenerate-low
```

### Gap analysis (find missing categories/tiers)

```
npx tsx scripts/component-engine.ts --gap-analysis
```

### Generate inspired components from top patterns

```
npx tsx scripts/component-engine.ts --inspire --category hero --tier cinematic --count 5
npx tsx scripts/component-engine.ts --inspire --category stats --tier animated --persona editorial-luxury
```

### Style transfer (apply different persona to animation patterns)

```
npx tsx scripts/component-engine.ts --style-transfer --category hero --persona tech-minimal
npx tsx scripts/component-engine.ts --style-transfer --category features --persona bold-modern --count 5
```

### Cross-industry inspiration

```
npx tsx scripts/component-engine.ts --cross-industry --from fashion --to pricing --persona tech-minimal
npx tsx scripts/component-engine.ts --cross-industry --from finance --to hero --persona editorial-luxury
```

### Animation trend detection

```
npx tsx scripts/component-engine.ts --trends
```

### Show engine stats

```
npx tsx scripts/component-engine.ts --stats
```

---

## Brand Cache Management

Clear, list, or inspect the brand extraction cache (MongoDB). Useful when a site's fonts/logos weren't picked up correctly — clearing the cache forces a full re-extraction on the next redesign.

### List all cached domains

```
npx tsx scripts/clear-brand-cache.ts --list
```

Shows domain, heading/body fonts, logo status, usage count, and age.

### Clear cache for a specific domain

```
npx tsx scripts/clear-brand-cache.ts people-made.com
npx tsx scripts/clear-brand-cache.ts strattoncraig.com
```

### Clear all cached domains

```
npx tsx scripts/clear-brand-cache.ts --all
```

---

## Analytics & Rating System

### Quality summary (requires auth)

```
curl -H "Authorization: Bearer $API_KEY" http://localhost:8080/api/analytics/quality
```

### Rating trends (7d/30d)

```
curl -H "Authorization: Bearer $API_KEY" http://localhost:8080/api/analytics/trends?days=30
```

### Storage stats

```
curl http://localhost:8080/api/analytics/stats
```

### Trigger ELO decay (increase uncertainty on stale templates)

```
curl -X POST -H "Authorization: Bearer $API_KEY" http://localhost:8080/api/analytics/elo-decay
```

### List section types + template counts

```
curl -H "Authorization: Bearer $API_KEY" http://localhost:8080/api/elo/section-types
```

### ELO leaderboard for a section type

```
curl -H "Authorization: Bearer $API_KEY" http://localhost:8080/api/elo/leaderboard/hero
```

---

## Rebuild Docker after generating

```
docker compose up -d --build
```

## Live Docker logs

```
docker logs -f canvas-ai-api-server-1 2>&1
```
