# BusinessInfo Pipeline — Plan & Research

**Created:** 2026-04-14
**Status:** Proposed — not started

## 1. Problem

The redesign pipeline today captures the *visual* surface of a site (colors, fonts, logos, layout) and the *structural* surface (sections, per-section text), but throws away almost every signal that tells us **what the company actually does**. That gap shows up in three places:

1. **Persona matcher** (`autoMatchPersona`) receives `url`, `brandName`, `colors`, `fonts`, `userPrompt`. It has no notion of sector beyond a regex guess against the URL and brand name (`industry.ts`). A SaaS lender and a luxury watchmaker with similar color palettes can end up with the same persona.
2. **Section generator prompt** (`SECTION_GENERATE_CINEMATIC_SYSTEM`) gets `<brand-tokens>` (colors/fonts/logo) and `brandName` in the user prompt — but zero positioning context. Kimi invents copy from section text alone, so voice/terminology drifts off-sector (e.g. writing "Get started free" for an asset manager).
3. **Aaker fusion** already weights `industry` at the highest signal (`AAKER_SIGNAL_WEIGHTS.industry = 0.30` in [personas.ts:632](../packages/sdk/src/utils/personas.ts#L632)), yet the industry label it fuses is derived from a regex — the most load-bearing signal has the weakest source of truth.

What gets thrown away during `fetchPage`:

- `<meta name="description">` — read once for brand name fallback, then discarded ([redesign.ts:232-250](../packages/sdk/src/models/redesign.ts#L232-L250))
- `og:description`, `og:site_name`, Twitter card descriptions — never read
- JSON-LD `Organization.description` / `WebSite.description` — never read
- First `<p>` inside `<main>`/`<article>` (usually the hero subtitle or about paragraph) — lost in the 6000-char text slice
- Nav labels (sector tell: "Portfolio", "Funds", "Menu", "Clinics") — lost

## 2. Goal

Introduce a **BusinessInfo** artifact: a small, structured, cached object derived once per `fetchPage` that captures *what the company does, who they serve, what sector they're in, and what tone they use*. Feed it into (a) persona scoring as a first-class signal and (b) the section generator prompt as positioning context. Must be cheap, idempotent, and fall back gracefully when upstream signals are weak.

## 3. Research summary

### 3.1 LLM-based company/sector classification is a solved problem
- **Rizinski et al. (2023)** — [Company classification using zero-shot learning](https://arxiv.org/pdf/2305.01028) — showed zero-shot NLI models (distilbart-mnli) classify companies into GICS sectors from free-text descriptions without fine-tuning. Key finding: a 2-sentence company description is enough.
- **Vamvourellis et al. (2023)** — [Company Similarity using Large Language Models](https://arxiv.org/pdf/2308.08031) — proved LLM embeddings of company descriptions cluster by sector in cosine space, outperforming TF-IDF baselines.
- **Chae & Davidson (2025)** — [LLMs for Text Classification: Zero-Shot to Instruction-Tuning](https://journals.sagepub.com/doi/10.1177/00491241251325243) — confirms that frontier LLMs (GPT-4/Claude-class) reach ~90% accuracy on NAICS/MCC code classification from short text, with performance scaling with model size.
- **Coris AI / Real Industry (2024)** — [GPT-4 merchant classification](https://www.coris.ai/blogs/coris-ai-launches-merchant-real-industry-using-gpt-4) — production system uses GPT-4 to map merchants to NAICS codes from scraped site text, reporting >90% precision.

**Implication for us:** a single Haiku call on extracted meta + first paragraph + nav labels is enough to produce a reliable sector label. No custom training, no embedding infra required.

### 3.2 LLM embedding similarity beats keyword matching for relevance scoring
- **Ebrat et al. (GenAI-RecSys 2025)** — [End-to-End Personalization: Unifying Recommender Systems](https://genai-personalization.github.io/assets/papers/GenAIRecP2025/12_Ebrat.pdf) — LLM embeddings + cosine similarity contribute the largest performance gain in hybrid scorers, especially for cold-start items (which is exactly our situation: every new redesign is a cold-start match).
- **MDPI Information (2024)** — [Comparative Analysis of NLP-Based Models for Company Classification](https://www.mdpi.com/2078-2489/15/2/77) — compares TF-IDF, BERT, sentence-transformers on company classification. Sentence-transformer embeddings of short descriptions beat TF-IDF by ~15 F1 points; zero-shot NLI is within 3 points of supervised BERT.

**Implication for us:** once we have a 1-2 sentence description, we can either (a) classify to a fixed taxonomy OR (b) embed and cosine-match against persona embeddings directly. (b) is more powerful but requires precomputing persona embeddings; (a) integrates cleanly with the existing Aaker fusion. **Recommendation: do (a) first, leave (b) as phase 3.**

### 3.3 Weighted scoring with dynamic weights is standard
- **Leadspace Revenue Radar** and similar B2B persona-scoring tools use weighted signals with **dynamic weight adjustment based on signal availability** — exactly the pattern our `autoMatchPersona` already implements (1 signal→50/50, 2→55/45, 3+→65/35 Aaker-vs-direct).
- **Aaker 5D (Sincerity / Excitement / Competence / Sophistication / Ruggedness)** — [LiveInnovation](https://liveinnovation.org/brand-personality-understanding-aakers-5-dimension-model/) — the model we already use — has well-studied sector correlations: finance→Competence, luxury→Sophistication, outdoor/auto→Ruggedness, consumer/kids→Sincerity, entertainment/beauty→Excitement. This gives us a direct sector→Aaker bias map.

**Implication for us:** we can wire sector into Aaker fusion via a lookup table (`SECTOR_AAKER_BIAS`) without changing the fusion math.

### 3.4 Competitive landscape — what do other AI builders do?
Findings on Relume, Durable, Framer AI, v0, Uizard (search hits mostly marketing — technical mechanism is undocumented, so this is inference from observed behavior):

- **Durable** ([review](https://durable.com/blog/relume-vs-durable)) — asks the user for business type as a *dropdown input* before generation (Plumber, Lawyer, Bakery, etc.). Their taxonomy drives template selection and copy. **They do not scrape** — they ask. Weakness: poor for redesigns of existing sites, which is our primary flow.
- **Relume** ([AI site builder](https://library.relume.io/ai-site-builder)) — user supplies a text prompt describing the business; their system uses it to pick sitemap/section patterns. Same weakness — no crawl-based extraction.
- **Framer AI** ([Framer AI](https://www.framer.com/ai/)) — prompt-driven, no known sector inference from URL.
- **v0.dev** — prompt-driven, no sector layer.
- **Uizard** — prompt-driven with style categories, but the category is user-selected.

**Implication for us:** no mainstream AI builder auto-derives business context *from a URL crawl* today. Our redesign flow is URL-first, which is a differentiator — and adding BusinessInfo extraction makes the flow strictly better than any prompt-driven competitor at redesigning existing sites, because we capture sector context the user didn't have to type.

### 3.5 What the research doesn't answer
- How many sector buckets is the sweet spot? NAICS has 1,057 codes (too many, LLM drift), GICS has 11 sectors + 25 industry groups (reasonable), Durable uses ~400 dropdown values. **Our existing `industry.ts` has 14.** Research suggests 10-25 is the LLM-classification sweet spot — our count is already close; we just need to upgrade the *source* from regex to LLM.
- Whether a tone axis (formal/playful/technical/aspirational) deserves its own signal weight or should collapse into sector. No clean answer — we'll start with collapsing and split only if personas cluster badly.

## 4. Design

### 4.1 The BusinessInfo object

```typescript
// packages/sdk/src/utils/business-info.ts
export type Sector =
  | "finance" | "healthcare" | "ecommerce" | "saas" | "enterprise-tech"
  | "creative-agency" | "editorial-media" | "education" | "food-beverage"
  | "real-estate" | "travel-hospitality" | "professional-services"
  | "entertainment" | "nonprofit" | "luxury-retail" | "consumer-goods"
  | "industrial" | "automotive" | "fitness-wellness" | "general";

export type Tone =
  | "formal-corporate" | "technical-precise" | "warm-approachable"
  | "bold-confident" | "playful-energetic" | "aspirational-luxury"
  | "editorial-thoughtful" | "neutral";

export interface BusinessInfo {
  whatTheyDo: string;        // ≤140 chars, one sentence
  sector: Sector;
  audience: string;          // ≤80 chars, e.g. "institutional investors", "parents of young children"
  tone: Tone;
  confidence: number;        // 0..1, from the classifier
  sourceSignals: string[];   // which raw signals we found: ["og:description", "meta:description", "hero-p"]
  rawSummary: string;        // the 1-2 sentence seed we fed to classify (kept for debugging)
}
```

### 4.2 Extraction flow (in `fetchPage`)

```
fetchPage(url)
  ├─ existing: crawl4ai / direct fetch → html + text
  ├─ NEW: extractBusinessSignals(html) → { description, ogDescription, jsonLdDescription, heroText, navLabels }
  ├─ NEW: if any signal present:
  │     → summarizeBusiness(signals, brandName) [Haiku call]
  │     → classifyBusinessInfo(summary) [second Haiku call OR same call with structured output]
  │     → BusinessInfo
  └─ cache on BrandData (storage.brandCache)
```

Two options for the LLM call:

**Option A — single call, structured output** (recommended):
One Haiku call with a JSON schema that returns `{whatTheyDo, sector, audience, tone, confidence}` in one shot. Haiku-4.5 is ≤500ms typical latency, ~$0.0003 per call. Cached on brand cache so free on rerun.

**Option B — two-step (summary → classify)**:
Call 1 produces free-form summary, call 2 classifies to taxonomy. More robust to bad signals but 2× latency and cost. Only use if Option A drifts in testing.

**Decision:** start with A, fall back to B only if sector accuracy <85% on a 20-site test set.

### 4.3 Scoring integration

Three changes to `autoMatchPersona` / `BrandSignals`:

**(1) Add `businessInfo?: BusinessInfo` to `BrandSignals`** ([personas.ts:72-78](../packages/sdk/src/utils/personas.ts#L72-L78)).

**(2) Replace regex industry with LLM sector when available** — in the Aaker fusion step ([personas.ts:975-985](../packages/sdk/src/utils/personas.ts#L975-L985)):
```typescript
const industryLabel = signals.businessInfo?.sector
  ?? classifyIndustry(signals.url, signals.brandName, signals.pageTitle)
  ?? "general";
```
Keep regex as fallback so non-redesign flows (pure prompt) still work.

**(3) Tone → Aaker vector bias**:
Add a new weight `tone=0.15` (carving from current splits, not adding). Map `Tone` enum → Aaker 5D:
```
formal-corporate     → [0.2, 0.1, 0.9, 0.5, 0.2]
technical-precise    → [0.1, 0.2, 0.9, 0.3, 0.3]
warm-approachable    → [0.9, 0.3, 0.5, 0.2, 0.3]
bold-confident       → [0.2, 0.8, 0.7, 0.4, 0.6]
playful-energetic    → [0.6, 0.95, 0.3, 0.1, 0.2]
aspirational-luxury  → [0.2, 0.4, 0.5, 0.95, 0.2]
editorial-thoughtful → [0.5, 0.3, 0.7, 0.8, 0.2]
```
Fuse alongside the existing industry/color/font/tone(text)/url vectors. **Note:** we already have a "tone" signal in `AAKER_SIGNAL_WEIGHTS.tone = 0.25` — that's derived from user prompt text analysis. We're not replacing it; we're narrowing its role (now = user prompt tone only) and adding `businessTone = 0.15` from the crawled site.

**New AAKER_SIGNAL_WEIGHTS:**
```
industry:     0.30  (unchanged — but now LLM-sourced)
tone:         0.20  (was 0.25 — user prompt only)
businessTone: 0.15  (new — from BusinessInfo.tone)
color:        0.15  (was 0.20)
font:         0.10  (was 0.15)
url:          0.10  (unchanged)
```
Sum = 1.00. Rebalanced so total signal strength is preserved, sector remains the strongest signal, and site-derived tone gets a real voice without dominating user intent.

### 4.4 Prompt injection

Add a `<company>` block to the section generator user prompt, above `<brand-tokens>`:

```
<company>
What they do: {whatTheyDo}
Sector: {sector}
Audience: {audience}
Tone: {tone}
</company>
```

Inject in [section-generator.ts:~890](../packages/sdk/src/models/section-generator.ts) next to `brandName` / `tokenSummary`. Keep it ≤6 lines — Kimi ignores long context blocks, and we want it to bleed into copy generation, not dominate it.

Also add to `SECTION_GENERATE_CINEMATIC_SYSTEM` ([prompts.ts](../packages/sdk/src/utils/prompts.ts)) a short directive: *"Use the `<company>` block to ground copy, terminology, and voice. If it conflicts with section text, the section text wins."* — this handles the edge case where the company summary is wrong but the section is clearly about something specific.

### 4.5 Caching

BusinessInfo is stable per-domain for weeks/months. Cache on `BrandCache` (existing storage interface — [storage/interface.ts](../packages/sdk/src/storage/interface.ts)) keyed by root domain. On cache hit, skip the LLM call entirely. On cache miss, extract + classify + persist. TTL: 30 days (override via env `CANVAS_BUSINESS_INFO_TTL_DAYS`).

## 5. Risks & mitigations

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| LLM hallucinates sector for content-thin sites | Medium | Require `sourceSignals.length >= 1`; if no signals found, skip BusinessInfo entirely and fall back to existing regex path |
| Wrong sector misleads persona scoring | Medium | Sector is 0.30 weight — it can bias but not dominate. Color/font/tone signals still vote. Confidence field can scale the bias: `actualWeight = 0.30 * confidence` |
| Extra 500ms latency per redesign | Low | Parallelize with existing fetchPage steps; cache per-domain aggressively |
| `<company>` block pollutes copy ("we are a fintech company that...") | Medium | Prompt directive instructs Kimi to use it as *context*, not *source*. Test with 3-5 sites and tune wording |
| Summary drifts on rebrands / pivoted companies | Low | 30-day TTL catches most drift; add manual cache-bust via env flag |
| Token cost creep | Low | Haiku at ~$0.0003/call, cached → ~$0.10/1000 redesigns. Negligible |

## 6. Out of scope (for now)

- Persona embedding + cosine match (phase 3 in §3.2(b)) — valuable but requires embedding infra we don't have
- Multilingual sector classification — assume English sites for v1
- Sector-specific layout bias (e.g. "finance sites prefer dense data tables") — possible future work, but don't conflate with this plan
- A/B testing sector-aware vs baseline persona scoring — defer until after shipping

## 7. Action checklist

**Status legend:** ✅ shipped · 🟡 partial/deferred · ⬜ not started

### Phase 1 — extraction + artifact ✅
- [x] Create [packages/sdk/src/utils/business-info.ts](../packages/sdk/src/utils/business-info.ts) with `Sector`, `Tone`, `BusinessInfo` types
- [x] Implement `extractBusinessSignals(html: string): BusinessSignals` — parses `<meta name="description">`, `<meta property="og:description">`, `<meta name="twitter:description">`, JSON-LD `Organization.description` / `WebSite.description` (walks `@graph`), first `<p>` in `<main>`/`<article>`, nav `<a>` text
- [x] Implement `classifyBusinessInfo(signals, brandName, router): Promise<BusinessInfo | null>` — single JSON-mode call via `intent_parse` stage (DeepSeek chat v3-0324, response_format json_object, zod-validated) returning `{whatTheyDo, sector, audience, tone, confidence}`. **Decision:** used the existing `intent_parse` stage instead of adding a new `business_classify` stage to avoid router changes. DeepSeek is faster and cheaper than Haiku via OpenRouter anyway.
- [x] Implement in-memory `BusinessInfo` cache keyed by root domain, 30-day TTL, `CANVAS_BUSINESS_INFO_TTL_DAYS` env override
- [x] Export from [packages/sdk/src/index.ts](../packages/sdk/src/index.ts) — `extractBusinessSignals`, `classifyBusinessInfo`, `getOrCreateBusinessInfo`, `formatCompanyBlock`, `BUSINESS_INFO_SECTORS`, `BUSINESS_INFO_TONES`, types `BusinessInfo`, `BusinessSignals`, `Sector`, `Tone`
- [ ] 🟡 Unit tests: 10 sector-diverse fixture HTMLs. **Deferred** — real e2e runs are more valuable as first-pass validation given the small number of integration surfaces.

### Phase 2 — redesign pipeline integration ✅
- [x] Call `getOrCreateBusinessInfo` inside [redesignFromURL](../packages/sdk/src/models/redesign.ts) right after `extractBrandName`, before brand-data extraction
- [x] Same call threaded into [planRedesign](../packages/sdk/src/models/redesign.ts) so the plan-then-generate flow (the main app path) also captures business info
- [x] Pass `businessInfo` to `autoMatchPersona` in both `redesign.ts` call sites AND the internal call in `generatePageSectioned`
- [x] Propagate through `planRedesign.fetchedContent.businessInfo` field so `Project.generatePageSectioned` picks it up without touching [api-server/routes/screens.ts](../packages/api-server/src/routes/screens.ts)
- [x] Also passed explicitly as the 13th arg to `generatePageSectioned` from the cinematic delegation branch in `redesignFromURL`
- [x] Log classification result via `log.info("business-info: sector=X tone=Y conf=Z (N signals)")` — appears during PLAN phase
- [ ] 🟡 Persist to `BrandCache` storage adapter. **Deferred to Phase 6** — in-memory cache is sufficient for single-process API server; persisting requires extending the `BrandCache` interface and all storage backends. Add when we hit multi-process scale-out.

### Phase 3 — persona scoring integration ✅
- [x] Add `businessInfo?: BusinessInfo | null` to `BrandSignals` in [personas.ts](../packages/sdk/src/utils/personas.ts)
- [x] Add `SECTOR_AAKER` lookup table — 20 Sector enum values → Aaker 5D vectors (sourced from Aaker 5D research §3.3)
- [x] Add `TONE_AAKER_BIAS` lookup table — 8 Tone enum values → Aaker 5D vectors (mapping from §4.3)
- [x] Rebalance `AAKER_SIGNAL_WEIGHTS` to `{ industry: 0.30, tone: 0.20, businessTone: 0.15, color: 0.15, font: 0.10, url: 0.10 }` — sum = 1.00 verified
- [x] In `scoreAllPersonas`: when `signals.businessInfo && sector !== "general"`, use LLM `SECTOR_AAKER[sector]` vector in place of the regex `industryToAaker` path. Regex remains the fallback for non-redesign flows and `"general"` classifications.
- [x] Scale sector weight by `max(0.3, businessInfo.confidence)` — low-confidence classifications still count but with a floor
- [x] New `businessTone` signal fuses `TONE_AAKER_BIAS[tone]` vector with its own 0.15 weight when `tone !== "neutral"`, confidence-scaled
- [ ] ⬜ `computePersonaConfidence` update for higher floor with more signals — **not needed**; the existing dynamic `aakerWeight` (0.50/0.55/0.65 based on signal count) already does this. Leaving as-is.

### Phase 4 — prompt injection ✅
- [x] Pre-format `companyBlock` once per page in `generatePageSectioned` via `formatCompanyBlock(businessInfo)` — suppressed entirely when `confidence < 0.5` to avoid misleading Kimi with weak classifications
- [x] Thread `businessInfo` through `generatePageSectioned` → `buildSectionPrompt.ctx.companyBlock`
- [x] Inject `<company>` block in [buildSectionPrompt](../packages/sdk/src/models/section-generator.ts) between `<page-context>` and `<page-plan>` (above `<brand-tokens>`)
- [x] Add `<company-context>` directive block to [SECTION_GENERATE_CINEMATIC_SYSTEM](../packages/sdk/src/utils/prompts.ts) — covers: terminology grounding, voice matching, audience framing, conflict resolution (*source content wins*), graceful absence
- [ ] ⬜ Apply same treatment to `SECTION_GENERATE_SYSTEM` (non-cinematic prompt). **Deferred** — the cinematic path is the main flow; non-cinematic path produces simpler copy where generic tone is less costly. Revisit if non-cinematic quality regresses.

### Phase 5 — verification (in progress)
- [x] Full SDK typecheck clean: `npx tsc --noEmit` in `packages/sdk`
- [x] Full api-server typecheck clean: `npx tsc --noEmit` in `packages/api-server`
- [x] SDK build succeeds: `npm run build` in `packages/sdk`
- [ ] ⬜ Docker rebuild + `docker compose up -d api-server`
- [ ] ⬜ Run e2e redesign on a 3-5 site sector-diverse test set. Minimum: Adidas (sportswear → fitness-wellness expected), a fintech, a luxury brand. Record `businessInfo` output for each via log tail.
- [ ] ⬜ Manually verify sector + tone correctness on those runs (target ≥85% agreement with human judgment)
- [ ] ⬜ Diff persona selection before/after on the same 3-5 sites — confirm changes are in the expected direction (e.g., fintech now picks a corporate/fintech persona it wasn't picking before)
- [ ] ⬜ Grep the generated section prompts in logs to confirm `<company>` block is present (when confidence ≥ 0.5)
- [ ] ⬜ Inspect generated copy on 3 sites — confirm terminology grounds to sector (e.g., "assets under management" for asset managers, not "users")

### Phase 6 — polish (deferred)
- [x] `CANVAS_BUSINESS_INFO_DISABLE=1` kill switch implemented in `getOrCreateBusinessInfo`
- [x] `CANVAS_BUSINESS_INFO_TTL_DAYS=N` TTL override
- [ ] ⬜ Persist `BusinessInfo` to `BrandCache` storage adapter (multi-process scale-out)
- [ ] ⬜ Add `--print-business-info` flag to the e2e test harness
- [ ] ⬜ Add unit test fixtures (10 sector-diverse HTML snippets) — covers Phase 1 deferred item
- [x] Sector/Tone enums documented via file-header block comment in business-info.ts

## 8. Implementation notes & decisions (post-implementation)

Things that deviated from the original plan or are worth recording:

1. **Model choice** — Original plan called for Haiku. Switched to DeepSeek chat v3-0324 via the existing `intent_parse` pipeline stage. Reasons: (a) already configured with `response_format: json_object`, (b) faster on OpenRouter than Haiku, (c) zero router.ts changes, (d) cheaper. Classifier quality is the real gate — if DeepSeek drifts in e2e testing, switch to `anthropic/claude-haiku-4.5` via a `CANVAS_MODEL_INTENT_PARSE` env override for the business-info call specifically.

2. **Schema validation** — Used zod (`ClassifySchema`) on the classifier output so any drift from the enum taxonomy fails fast instead of silently poisoning the scorer. Routes through `routeJSON(..., ClassifySchema)` which already has schema support.

3. **Confidence suppression threshold** — `<company>` block is suppressed entirely when `confidence < 0.5`. This is deliberately conservative: a weak classification misleading Kimi is worse than no classification at all. Sector/tone still contribute to Aaker fusion (floored at 0.3) because the fusion is additive and competes with other signals; the prompt block is a direct instruction so it gets the higher bar.

4. **Propagation path** — Used `fetchedContent.businessInfo` as the carrier between `planRedesign` and `Project.generatePageSectioned`, rather than adding it as an explicit parameter on the `Project` public method. This avoided touching [api-server/routes/screens.ts](../packages/api-server/src/routes/screens.ts) entirely. The cinematic delegation branch in `redesignFromURL` still passes it explicitly as the 13th arg because that's a direct internal call.

5. **Brand extraction order** — Classified BEFORE `extractBrandDataFull` (colors/fonts) so that if brand extraction is slow or fails, business-info is still captured. In practice they're independent, so order is mostly cosmetic.

6. **Pre-existing unused-import hints** — Added imports caused transient "unused" hints while threading, all resolved by final commit. The hint-level noise was expected; zero errors remain.

7. **Plan items NOT implemented** (and why):
   - BrandCache persistence: deferred — in-memory fine for single-process
   - Unit test fixtures: deferred — e2e runs are higher-signal first-pass
   - Non-cinematic prompt directive: deferred — cinematic is primary flow
   - `computePersonaConfidence` tweak: not needed — existing dynamic weights cover it
   - Custom `business_classify` pipeline stage: not needed — `intent_parse` works

## 8. Open questions

1. Should `businessInfo.rawSummary` (the 1-2 sentence seed) ALSO be injected into the prompt, or just the structured fields? Structured is cleaner; raw is more expressive. **Lean: structured only.** Revisit if copy quality is still generic.
2. If the classifier returns `sector=general` with low confidence, should we suppress the `<company>` block entirely? **Lean: yes, `confidence >= 0.5` threshold for prompt injection.**
3. Should we extract a separate `competitors` field (site lists "trusted by X, Y, Z" → social proof)? **Defer — out of scope for v1.**
4. Should sector influence `classifyTier` / `detectAnimations` in section-extractor? Fintech → data viz, luxury → slow scrub. **Interesting, but defer — don't conflate plans.**

---

## Sources

Research papers:
- [Company classification using zero-shot learning (Rizinski et al., 2023)](https://arxiv.org/pdf/2305.01028)
- [Company Similarity using Large Language Models (Vamvourellis et al., 2023)](https://arxiv.org/pdf/2308.08031)
- [Comparative Analysis of NLP-Based Models for Company Classification (MDPI Information, 2024)](https://www.mdpi.com/2078-2489/15/2/77)
- [LLMs for Text Classification: Zero-Shot to Instruction-Tuning (Chae & Davidson, 2025)](https://journals.sagepub.com/doi/10.1177/00491241251325243)
- [LLMs for product classification in e-commerce: zero-shot GPT/Claude (ScienceDirect, 2025)](https://www.sciencedirect.com/science/article/pii/S2949719125000184)
- [End-to-End Personalization: Unifying Recommender Systems (GenAI-RecSys 2025)](https://genai-personalization.github.io/assets/papers/GenAIRecP2025/12_Ebrat.pdf)
- [Intelligent Classification and Personalized Recommendation (arXiv 2403.19345)](https://arxiv.org/pdf/2403.19345)

Industry / production systems:
- [Coris AI — GPT-4 merchant classification to NAICS](https://www.coris.ai/blogs/coris-ai-launches-merchant-real-industry-using-gpt-4)
- [NAICS Association classification tools](https://www.naics.com/search/)

Brand/persona theory:
- [Aaker 5D Brand Personality Model (LiveInnovation)](https://liveinnovation.org/brand-personality-understanding-aakers-5-dimension-model/)
- [Brand Personality Radar Chart (Medium / Al Leong)](https://idesignstrategy.medium.com/sculpting-corporate-brand-identity-the-art-and-science-of-the-brand-personality-radar-chart-c24bc15f6389)
- [Leadspace Revenue Radar — persona scoring models](https://www.leadspace.com/blog/revenue-radar-finding-the-right-type-of-buyer-using-persona-scoring-models/)
- [Weighted Scoring Model (Product School)](https://productschool.com/blog/product-fundamentals/weighted-scoring-model)

Competitive landscape:
- [Relume AI site builder](https://library.relume.io/ai-site-builder)
- [Relume vs Durable comparison](https://durable.com/blog/relume-vs-durable)
- [Framer AI](https://www.framer.com/ai/)
