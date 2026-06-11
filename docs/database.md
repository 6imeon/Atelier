# Atelier — MongoDB Data Layer Plan

## Architecture

**Hybrid model:** SQLite stays for local runtime (projects, screens, undo history — fast, offline). MongoDB Atlas handles the **learning layer** — data that accumulates over time and powers smarter generation.

```
┌─────────────────────────────────────┐
│            Atelier App              │
├──────────────┬──────────────────────┤
│  SQLite      │  MongoDB Atlas       │
│  (runtime)   │  (learning layer)    │
│              │                      │
│  projects    │  generation_logs     │
│  screens     │  brand_cache         │
│  assets      │  layout_examples     │
│  components  │  section_templates   │
│  undo/redo   │  user_feedback       │
│              │  prompt_history       │
└──────────────┴──────────────────────┘
```

**Why hybrid:**
- SQLite: 0ms latency for UI ops, works offline, already built
- MongoDB: schema-flexible for evolving AI data, Atlas Vector Search for RALF, TTL indexes for log rotation, free tier (512MB) is plenty

---

## Collections Schema

### 1. `generation_logs`

Every generation call — used for prompt tuning, cost tracking, and failure analysis.

```json
{
  "_id": "ObjectId",
  "projectId": "proj_abc123",
  "screenId": "scr_xyz789",
  "pipeline": "section_generate | design_refine | intent_parse | page_plan",
  "model": "moonshotai/kimi-k2.5",
  "prompt": {
    "system": "...(first 500 chars)...",
    "userLength": 3200,
    "sectionType": "hero | nav | footer | content | cta | testimonials"
  },
  "response": {
    "htmlLength": 8420,
    "sectionsCount": 1,
    "hasAnimations": true,
    "hasTailwind": true,
    "truncated": false
  },
  "performance": {
    "durationMs": 4200,
    "tokensIn": 1800,
    "tokensOut": 3100,
    "retries": 0,
    "fallbackUsed": false
  },
  "quality": {
    "contrastPass": true,
    "validHtml": true,
    "userRating": null,
    "kept": true
  },
  "createdAt": "2026-04-04T12:00:00Z",
  "expiresAt": "2026-07-04T12:00:00Z"
}
```

**Indexes:**
- `{ createdAt: -1 }` — recent logs
- `{ pipeline: 1, model: 1 }` — filter by pipeline stage
- `{ "quality.userRating": 1 }` — find rated generations
- `{ expiresAt: 1 }` — TTL index, auto-delete after 90 days

---

### 2. `brand_cache`

Cached brand extractions — avoids re-fetching and re-extracting the same site.

```json
{
  "_id": "ObjectId",
  "domain": "strattoncraig.co.uk",
  "url": "https://strattoncraig.co.uk",
  "colors": {
    "primary": "#cf0011",
    "secondary": "#1a1a1a",
    "accent": "#4672ff",
    "all": [
      { "hex": "#cf0011", "frequency": 42, "logoBonus": 500, "label": "primary" }
    ]
  },
  "fonts": {
    "heading": { "family": "GT Walsheim", "weight": "700", "source": "google" },
    "body": { "family": "Inter", "weight": "400", "source": "google" }
  },
  "logoUrl": "https://strattoncraig.co.uk/logo.svg",
  "aakerVector": [0.3, 0.2, 0.7, 0.5, 0.1],
  "personaId": "corporate-editorial",
  "sectionTypes": ["nav", "hero", "services", "testimonials", "cta", "footer"],
  "extractedAt": "2026-04-04T12:00:00Z",
  "lastUsed": "2026-04-04T12:00:00Z",
  "useCount": 3
}
```

**Indexes:**
- `{ domain: 1 }` — unique, primary lookup
- `{ lastUsed: 1 }` — LRU eviction candidates
- `{ personaId: 1 }` — find sites by persona type

---

### 3. `layout_examples`

Successful full-page layouts stored as few-shot references for RALF retrieval.

```json
{
  "_id": "ObjectId",
  "industry": "finance | healthcare | creative | tech | editorial | ecommerce",
  "pageType": "homepage | landing | about | product | blog",
  "sectionSequence": ["nav", "hero", "features", "testimonials", "pricing", "cta", "footer"],
  "sectionCount": 7,
  "metadata": {
    "sourceUrl": "stripe.com",
    "personaId": "tech-minimalist",
    "aakerVector": [0.2, 0.6, 0.8, 0.4, 0.1],
    "deviceType": "DESKTOP",
    "colorScheme": "light"
  },
  "sections": [
    {
      "type": "hero",
      "htmlSnippet": "<!-- first 200 chars for context -->",
      "tailwindClasses": ["bg-gradient-to-r", "text-6xl", "py-24"],
      "hasAnimation": true
    }
  ],
  "qualityScore": 4.2,
  "embedding": [0.012, -0.034, ...],
  "createdAt": "2026-04-04T12:00:00Z"
}
```

**Indexes:**
- `{ industry: 1, pageType: 1, qualityScore: -1 }` — RALF retrieval query
- Vector index on `embedding` field — Atlas Vector Search for semantic similarity

---

### 4. `section_templates`

Individual successful sections that can be used as few-shot examples in `section_generate` prompts.

```json
{
  "_id": "ObjectId",
  "type": "hero | nav | footer | features | testimonials | pricing | cta | stats | team",
  "industry": "tech",
  "style": "minimalist | bold | editorial | playful | corporate",
  "html": "<section class='py-24 bg-white'>...</section>",
  "htmlLength": 2400,
  "features": {
    "hasAnimation": true,
    "hasCta": true,
    "hasImage": false,
    "columnCount": 3,
    "tailwindClasses": ["grid", "gap-8", "lg:grid-cols-3"]
  },
  "qualityScore": 4.5,
  "timesReused": 12,
  "sourceGenerationId": "ObjectId ref to generation_logs",
  "createdAt": "2026-04-04T12:00:00Z"
}
```

**Indexes:**
- `{ type: 1, industry: 1, qualityScore: -1 }` — retrieve best sections by type
- `{ timesReused: -1 }` — most popular templates
- `{ type: 1, style: 1 }` — filter by visual style

---

### 5. `user_feedback`

Implicit and explicit signals about generation quality.

```json
{
  "_id": "ObjectId",
  "generationId": "ObjectId ref to generation_logs",
  "projectId": "proj_abc123",
  "screenId": "scr_xyz789",
  "action": "kept | deleted | edited | exported | variant_created",
  "editDelta": {
    "sectionsModified": 2,
    "htmlDiffSize": 340
  },
  "explicitRating": null,
  "timeToAction": 45000,
  "createdAt": "2026-04-04T12:00:00Z"
}
```

**Indexes:**
- `{ generationId: 1 }` — link feedback to generation
- `{ action: 1, createdAt: -1 }` — analyze patterns

---

### 6. `prompt_history`

Track prompt evolution — what system prompts produce the best results.

```json
{
  "_id": "ObjectId",
  "promptType": "section_generate | page_plan | intent_parse",
  "version": 14,
  "systemPrompt": "You are a senior web designer...",
  "promptHash": "sha256:abc123",
  "stats": {
    "totalUses": 230,
    "avgQualityScore": 3.8,
    "avgDurationMs": 4100,
    "truncationRate": 0.05,
    "contrastPassRate": 0.92
  },
  "activeFrom": "2026-03-15T00:00:00Z",
  "activeTo": null,
  "notes": "Added XML delimiters, reduced token count by 40%"
}
```

**Indexes:**
- `{ promptType: 1, version: -1 }` — latest prompt per type
- `{ promptHash: 1 }` — unique, deduplicate

---

## Implementation Checklist

### Phase 1 — Foundation ✅

- [x] **Install dependencies** — `npm install mongodb` in `packages/sdk`
- [x] **Create MongoDB adapter** — `packages/sdk/src/storage/mongodb.ts` implementing `AnalyticsAdapter` interface with all 6 collections, indexes, TTL, connection pooling, staleness checks
- [x] **Define `AnalyticsAdapter` interface** — added to `packages/sdk/src/storage/interface.ts` with full TypeScript types for `GenerationLog`, `BrandCache`, `LayoutExample`, `SectionTemplate`, `UserFeedback`
- [x] **Add env config** — `MONGO_URI` added to `.env` (commented, optional)
- [x] **Add TTL index** on `generation_logs.expiresAt` (90-day auto-cleanup) — created in `mongodb.ts` `_ensureIndexes()`
- [x] **Wire into API server** — `packages/api-server/src/index.ts` initializes analytics on startup (non-blocking), closes on shutdown
- [x] **Export from SDK** — `createAnalytics`, `AnalyticsAdapter`, and all data types exported from `packages/sdk/src/index.ts`
- [x] **Add `/api/feedback` endpoint** — accepts `projectId`, `screenId`, `action`, forwards to `analytics.logFeedback()`
- [x] **Create Atlas cluster** — M0 free tier, `atelier` database, connection verified with test script
- [x] **Connection test** — `scripts/test-mongo.ts` passes: generation log write, brand cache read/write, index creation, cleanup

### Phase 2 — Generation Logging ✅

- [x] **Instrument `router.ts`** — `routeJSON()` logs every call to `analytics.logGeneration()` with: pipeline stage, model, prompt lengths, HTML length, section count, animation detection, truncation, token counts (in/out), duration, retry/fallback status, HTML validity
- [x] **Add `analytics` property to `ModelRouter`** — public field, set from API server on startup
- [x] **Wire API server → router** — `getRouter().analytics = analytics` after Atlas connects
- [x] **Add error logging** — `_logError()` fires on: body read timeout, body read failure, API error responses. All logged as generation records with `validHtml: false`
- [x] **Timing** — `_routeStart` captures full `routeJSON` duration including retries
- [x] **Non-blocking** — all `.logGeneration()` calls use `.catch()` to never block generation
- [ ] **Verify** — generate a page, check Atlas for log documents

### Phase 3 — Brand Cache ✅

- [x] **Modify `brand-extractor.ts`** — added optional `analytics` param to `extractBrandDataFull()`. Checks `getBrandCache(domain)` before any network/parsing work. On cache hit, reconstructs `BrandData` from cached colors/fonts and returns immediately
- [x] **Cache on extraction** — after successful extraction, calls `setBrandCache()` with colors (primary/secondary/accent/all), fonts (heading/body), logo URL, section types
- [x] **Add `lastUsed` update** — `getBrandCache()` in `mongodb.ts` bumps `lastUsed` and `useCount` on every hit
- [x] **Add cache TTL** — 30-day staleness check built into `getBrandCache()`, returns `null` if older (triggers re-extraction)
- [x] **Pass analytics to all call sites** — all 3 `extractBrandDataFull()` calls in `project.ts` now pass `getRouter().analytics`
- [x] **Non-blocking writes** — cache write uses `.catch()` to never block extraction pipeline
- [ ] **Verify** — redesign same URL twice, second should skip extraction

### Phase 4 — Section Templates ✅

- [x] **Auto-save successful sections** — `assembleSections()` calls `saveSectionTemplates()` which saves each section (>100 chars) to `section_templates` with type detection, feature metadata (animation, CTA, images, column count, Tailwind classes), capped at 8KB per section
- [x] **Section type detection** — `detectSectionType()` classifies sections into: nav, footer, hero, pricing, testimonials, features, stats, team, faq, cta, contact, gallery, content — using regex on HTML content
- [x] **Retrieve in prompts** — before the generation loop in `generatePageSectioned()`, pre-fetches 1 top-rated template per section role from analytics. Injected into `buildSectionPrompt()` as `<example-section>` XML block with instructions to use as style inspiration, not copy verbatim
- [x] **Dedup** — `mongodb.ts` `saveSectionTemplate()` deduplicates by type + htmlLength, bumps `timesReused` on near-match instead of inserting
- [x] **Analytics wired through** — `assembleSections()` accepts optional `analytics` param, passed from both `project.ts` and `api-server` variant endpoint
- [x] **Non-blocking** — all template saves use `.catch()` to never block generation
- [x] **Quality gate** — templates are NO longer saved immediately during `assembleSections()`. Instead, `saveSectionTemplates()` is called from the `/api/feedback` endpoint only on positive actions (`exported`, `edited`, `variant_created`). Frontend passes screen `html` with feedback. Deleted screens never produce templates
- [ ] **Verify** — generate 5+ pages, check templates accumulating, check retrieval in prompt

### Phase 5 — Layout Examples (RALF)

- [x] **Save full layouts** — after `assembleSections()` in `generatePageSectioned()`, saves section sequence, metadata (sourceUrl, personaId, deviceType), section snippets, and quality score to `layout_examples`
- [x] **Industry classifier** — `classifyIndustry()` classifies URLs/brands into 14 industries: finance, healthcare, ecommerce, tech, creative, editorial, education, food, realestate, travel, professional, entertainment, nonprofit, general
- [x] **Page type detector** — `detectPageType()` classifies pages: homepage, about, services, product, blog, contact, portfolio, careers, landing
- [x] **Section label classifier** — `detectSectionTypeFromLabel()` maps section labels to types: nav, footer, hero, pricing, testimonials, features, stats, team, faq, cta, contact, gallery, logos, content
- [x] **Retrieval in `planRedesign()`** — before the AI planning call, fetches up to 2 layout examples for the detected industry. Injects section sequences as reference hints into the planning prompt (e.g. `"site: [nav → hero → features → testimonials → cta → footer]"`)
- [x] **Non-blocking** — layout save uses `.catch()`, retrieval failure silently skipped
- [ ] **Atlas Vector Search** — embed layout metadata for semantic similarity retrieval (deferred — exact match works well for now)
- [ ] **Verify** — generate pages across industries, check RALF retrieval improves section planning

### Phase 6 — Feedback Loop

- [x] **Track implicit feedback** — `sendFeedback()` utility in `web-ui/src/utils/feedback.ts`, wired into:
  - `ScreenCard.tsx` — fires `"deleted"` on screen delete
  - `ChatPanel.tsx` — fires `"variant_created"` on variant success, `"edited"` on edit success (with `htmlDiffSize`)
  - `TopBar.tsx` — fires `"exported"` on HTML download
- [x] **API endpoint** — `POST /api/feedback` (built in Phase 1), validates action, logs to `user_feedback` collection
- [x] **Connect to quality scores** — `adjustTemplateScores()` on `AnalyticsAdapter` / `MongoAnalytics`: after feedback, adjusts `qualityScore` on templates created in last 10 minutes. Score deltas: exported +1, kept +0.5, variant_created +0.3, edited +0.2, deleted -0.5
- [ ] **Prompt version tracking** — hash system prompts, log which version was used per generation (deferred)
- [ ] **Dashboard query** — aggregation pipeline: avg quality by model, by prompt version, by industry (deferred)

### Phase 7 — Maintenance ✅

- [x] **Connection pooling** — `MongoClient` configured with `maxPoolSize: 50`, `minPoolSize: 2`, shared across all requests via singleton
- [x] **Graceful degradation** — audited all 11 analytics call sites: all have `.catch()` or are inside try/catch. App works identically with or without `MONGO_URI`
- [x] **Index review** — 14 indexes created on initialization, covering all query patterns. Review after 1000+ documents with `explain()`
- [x] **Data export** — `scripts/export-analytics.ts`: exports all collections (or a single one) to timestamped JSON files. Usage: `npx tsx scripts/export-analytics.ts [collection] [--output dir]`
- [x] **Size monitoring** — `GET /api/analytics/stats` endpoint returns per-collection document counts, total docs, estimated storage MB, free tier limit (512MB), and usage percentage. `getStats()` added to `AnalyticsAdapter` / `MongoAnalytics`

---

## Environment Setup

```bash
# .env
MONGO_URI=mongodb+srv://atelier:<password>@cluster0.xxxxx.mongodb.net/atelier?retryWrites=true&w=majority

# Optional — app works without it, just no analytics
# MONGO_URI=              # leave empty to disable
```

---

## File Changes Summary

| File | Change |
|------|--------|
| `packages/sdk/src/storage/interface.ts` | Add `AnalyticsAdapter` interface, update `StorageBackend` type |
| `packages/sdk/src/storage/mongodb.ts` | **New** — MongoDB analytics adapter |
| `packages/sdk/src/utils/router.ts` | Add generation logging after API calls |
| `packages/sdk/src/utils/brand-extractor.ts` | Add cache check before extraction |
| `packages/sdk/src/utils/section-parser.ts` | Save section templates after assembly |
| `packages/sdk/src/models/project.ts` | Wire analytics into generation pipeline, layout example retrieval |
| `packages/sdk/src/utils/prompts.ts` | Accept few-shot examples in prompt builders |
| `packages/api-server/src/index.ts` | Add `/api/feedback` endpoint, initialize analytics adapter |
| `packages/web-ui/src/components/ChatPanel.tsx` | Fire feedback events |
| `packages/web-ui/src/components/ScreenCard.tsx` | Fire feedback events (delete, export) |
| `.env` / `.env.example` | Add `MONGO_URI` |
| `package.json` (sdk) | Add `mongodb` dependency |

---

## Cost Estimate

| Tier | Storage | Reads/Writes | Cost |
|------|---------|-------------|------|
| Atlas M0 (free) | 512MB | 100 reads/sec | $0 |
| Atlas M2 (if needed) | 2GB | 200 reads/sec | $9/mo |
| Atlas M10 (production) | 10GB+ | unlimited | $57/mo |

At ~1KB per generation log and ~3KB per section template, the free tier holds **~150K generation logs** or **~50K section templates**. More than enough for the first year of development.
