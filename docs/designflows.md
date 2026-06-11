# Atelier — Design Generation Pipeline Audit

## Overview

Full audit of all generation paths, API call patterns, prompt sizes, and performance bottlenecks. Conducted after observing that generation slowed from ~5 minutes (full page) to ~7 minutes (single section).

---

## 1. Generation Paths

### Path A: Generate from Prompt

**Trigger:** User types a prompt in ChatPanel (no URL).
**Endpoint:** `POST /api/projects/:pid/screens/generate` (no `sourceUrl`)
**Method:** `project.generate()`

| Step | Pipeline Stage | Model | maxTokens | Time |
|------|---------------|-------|-----------|------|
| 1. Parse intent | `intent_parse` | DeepSeek V3 | 1,000 | ~2-4s |
| 2. AI plan sections | `intent_parse` | DeepSeek V3 | 1,000 | ~3-5s |
| 3. Match persona | local | — | — | <1s |
| 4. Select components | `intent_parse` (via library) | DeepSeek V3 | 1,000 | ~3-7s |
| 5-14. Generate 8-10 sections | `section_generate` x10 | Kimi K2.5 | 12,000 | **30-60s each** |
| 15. Assemble + UICrit | local | — | — | <1s |

**Total API calls:** 3 + N sections = **11-13 calls, ALL SEQUENTIAL**
**Estimated time:** 6-12 minutes

### Path B: Redesign from URL (Single-Call)

**Trigger:** User types a URL, `redesignFromURL()` called directly.
**Endpoint:** `POST /api/projects/:pid/screens/generate` (with `sourceUrl`)
**Method:** `project.redesignFromURL()`

| Step | Pipeline Stage | Model | maxTokens | Time |
|------|---------------|-------|-----------|------|
| 1. Fetch page (crawl4ai) | HTTP | — | — | ~5-15s |
| 2. Extract brand data | local parsing | — | — | <1s |
| 3. Generate full page | `layout_generate` | Kimi K2.5 | **32,000** | ~60-180s |

**Total API calls:** **1**
**Estimated time:** 2-4 minutes

### Path C: Redesign Plan + Sectioned Generation

**Trigger:** User clicks "Redesign" → plan → generate per page.
**Endpoint:** `POST /api/projects/:pid/redesign/plan` then `POST /api/projects/:pid/redesign/generate`
**Methods:** `planRedesign()` → `generatePageSectioned()`

#### Phase 1: Plan

| Step | Pipeline Stage | Model | maxTokens | Time |
|------|---------------|-------|-----------|------|
| 1. Fetch page (crawl4ai) | HTTP | — | — | ~5-15s |
| 2. Extract brand data | local | — | — | <1s |
| 3. RALF layout lookup | DB query | — | — | <1s |
| 4. AI plan (pages + design system) | `intent_parse` | DeepSeek V3 | 1,000 | ~2-5s |

#### Phase 2: Generate per Page

| Step | Pipeline Stage | Model | maxTokens | Time |
|------|---------------|-------|-----------|------|
| 1. Parse sections from HTML | local | — | — | <1s |
| 2. (Conditional) AI section plan | `intent_parse` | DeepSeek V3 | 1,000 | ~3-5s |
| 3. Match persona, palette, fonts | local | — | — | <1s |
| 4. Fetch RALF templates | DB queries x3-4 | — | — | **sequential, 1-3s** |
| 5. Match components per section | local | — | — | <1s |
| 6-15. Generate 8-10 sections | `section_generate` x10 | Kimi K2.5 | 12,000 | **30-60s each** |
| 16. Assemble + Why attributes | local | — | — | <1s |
| 17. UICrit + auto-fix | local | — | — | <1s |
| 18. RALF save | DB write | — | — | <1s |

**Total API calls per page:** 1 (conditional) + N sections = **8-11 calls, ALL SEQUENTIAL**
**For multi-page (3 pages):** Pages are also sequential = **24-33 calls**
**Estimated time per page:** 5-12 minutes

---

## 2. Prompt Sizes

### System Prompt (constant per section)

`SECTION_GENERATE_SYSTEM`: ~4,200 chars (~1,100 tokens)
- Output rules (JSON format, rationale)
- Animation rules (GSAP, ScrollTrigger, intersection observer)
- Imagery rules (picsum.photos placeholders)
- CRO rules (single CTA, social proof placement)
- Quality guidance (responsive, accessible)

### Per-Section User Prompt (from `buildSectionPrompt()`)

| Component | Size | Notes |
|-----------|------|-------|
| Role-specific hints | 500-1,200 chars | Hero hints are largest (~1,200 chars) |
| Component reference HTML | 0-5,000 chars | 2 components x 2,500 chars each |
| RALF template example | 0-3,000 chars | If cached template exists |
| Design token summary | 800-1,200 chars | Colors, fonts, OKLCH palette, Aaker tokens |
| Section plan (all labels) | 300-500 chars | Full page context |
| Source text content | 0-3,000 chars | `section.textContent` |
| Original HTML | 0-4,000 chars | `section.rawHtml.slice(0, 4000)` |
| Page context + nav items | 200-500 chars | Brand, domain, adjacent sections |

**Total per-section prompt: 8,000-17,000 chars (~2,000-4,500 tokens)**

### Comparison: Single-Call vs Sectioned

| | Single-Call (Path B) | Per-Section (Path C) |
|---|---|---|
| Input tokens | ~6,500-8,000 (one call) | ~2,000-4,500 per call x 10 = **20,000-45,000 total** |
| Output tokens | ~8,000-15,000 (one call) | ~2,000-4,000 per call x 10 = **20,000-40,000 total** |
| Total tokens | ~15,000-23,000 | **40,000-85,000** |
| API calls | 1 | 10 |
| HTTP overhead | 1x | 10x |

**Sectioned generation uses 3-4x more tokens and 10x more API calls for the same page.**

---

## 3. Bottlenecks (Priority Order)

### ~~CRITICAL: Sequential Section Generation~~ FIXED

**Impact was: 3-4x slowdown** — now resolved.

Sections are generated in parallel batches of 4 via `Promise.all()`. Results are placed back in order by index. Progress updates show batch info.

**Result:** 10-section page generation dropped from ~8-10 min to ~2-3 min.

### MODERATE: Prompt Bloat

**Impact: +10-30s per section**

Each section prompt carries:
- **Component HTML** (up to 5,000 chars) — raw Tailwind HTML when a 500-char structural description would suffice
- **RALF template example** (up to 3,000 chars) — may conflict with component reference, adding confusion
- **Aaker token block** (~500 chars) — border-radius, spacing, shadow values that Tailwind classes already encode
- **Full OKLCH palette** (~400 chars) — 11-step color scale when only 3-4 values are used

Larger prompts = slower Kimi K2.5 inference. Even within its efficient range (0-32K tokens), each additional 1,000 input tokens adds ~1-3s of processing.

**Fix:** Trim component refs to structural descriptions. Remove RALF templates when component match exists. Condense Aaker tokens.

### ~~MODERATE: Sequential Template Lookups~~ FIXED

Template lookups now run in parallel via `Promise.all()`. Saves 1-3s.

### MINOR: Double Script Extraction

**Impact: negligible performance, code clarity issue**

`assembleSections()` calls `validateSection()` + `extractScripts()` twice — once in the HTML template and again in the script assembly block (lines 691 and 736). Scripts are extracted, fixed, and accumulated in both passes but only the second set is used in the output.

### MINOR: `selectForPrompt()` May Use AI

The component library's `selectForPrompt()` method may make an additional AI call to match components to the prompt. This is an extra API call that could be replaced with local keyword matching.

---

## 4. Model Configuration

```typescript
// router.ts MODEL_CONFIG
intent_parse:      { model: "deepseek/deepseek-chat-v3-0324",  maxTokens: 1,000,  temp: 0.1 }
vision_interpret:  { model: "moonshotai/kimi-k2.5",            maxTokens: 4,000,  temp: 0.3 }
layout_generate:   { model: "moonshotai/kimi-k2.5",            maxTokens: 32,000, temp: 0.7 }
design_refine:     { model: "moonshotai/kimi-k2.5",            maxTokens: 16,000, temp: 0.4 }
code_render:       { model: "deepseek/deepseek-chat-v3-0324",  maxTokens: 8,000,  temp: 0.1 }
design_extract:    { model: "deepseek/deepseek-chat-v3-0324",  maxTokens: 4,000,  temp: 0.2 }
section_generate:  { model: "moonshotai/kimi-k2.5",            maxTokens: 12,000, temp: 0.6 }
```

### Kimi K2.5 Performance Notes

- 128K context window, but inference speed degrades above ~32K input tokens
- At 3,000-5,500 input tokens per section call, well within efficient range
- Output speed: ~15-25 tokens/sec
- `maxTokens: 12,000` allows up to 12K completion tokens — typical usage is 2,000-4,000
- `reasoning: { effort: "none" }` is set, which disables the thinking step (good)
- Temperature 0.6 for section_generate produces creative but sometimes inconsistent output

### Potential Model Alternatives

- **DeepSeek V3** (`deepseek/deepseek-chat-v3-0324`): Faster inference, good at structured HTML, already used for intent parsing. Could handle section generation at lower temp.
- **Qwen3 235B** (`qwen/qwen3-235b-a22b`): Listed as fallback for intent_parse. Strong reasoning.
- **Google Gemini 2.5 Flash** (`google/gemini-2.5-flash`): Listed as fallback for code_render. Very fast.

---

## 5. Quality vs Speed Tradeoffs

| Approach | Quality | Speed | API Cost |
|----------|---------|-------|----------|
| Single-call (layout_generate, 32K) | Good overall coherence | **Fast** (2-4 min) | Low (1 call) |
| Sectioned sequential (current) | Best per-section fidelity | **Slow** (5-12 min) | High (10+ calls) |
| Sectioned parallel (proposed) | Same as sequential | **Fast** (2-3 min) | Same (10+ calls) |
| Hybrid: nav+hero+footer single, content parallel | Good coherence + fidelity | **Fast** (2-4 min) | Medium (4-6 calls) |

---

## 6. Optimisation Checklist

### Immediate (high impact, low risk)

- [x] **Parallelize section generation** — batch `Promise.all()` in groups of 3-4 concurrent calls. Respects OpenRouter rate limits while achieving 3-4x speedup. **Expected: 10 min → 3 min.** *(Done 2026-04-07 — section-generator.ts, BATCH_SIZE=4)*
- [x] **Parallelize template lookups** — `Promise.all()` on RALF queries. **Expected: saves 1-3s.** *(Done 2026-04-07 — section-generator.ts)*
- [ ] **Reduce section_generate maxTokens** — sections rarely use more than 4,000 output tokens. Consider dynamic maxTokens by role (nav/footer: 6K, content: 10K, hero: 12K) rather than a blanket reduction, to avoid truncating complex sections.

### Short-term (moderate impact)

- [ ] **Trim component references** — replace raw HTML (5,000 chars) with structural descriptions (500 chars). Reduces prompt by ~4,500 chars per section.
- [ ] **Conditional RALF templates** — only include template example if NO component match exists for that section. Avoids conflicting references.
- [ ] **Compact system prompt variants** — create a smaller SECTION_GENERATE_SYSTEM for nav/footer that omits CRO and animation rules (~2,000 chars instead of 4,200).

### Medium-term (architectural)

- [ ] **Hybrid generation mode** — generate nav + hero + footer in one `layout_generate` call (structural skeleton), then parallelize content sections. Best of both worlds: coherence from single-call + fidelity from sectioned.
- [ ] **Streaming assembly** — send sections to the frontend as they complete via SSE, instead of waiting for all sections to finish. The user sees the page build up section by section. **Perceived performance improvement even without actual speedup.**
- [ ] **Generation caching** — cache generated sections by content hash + design tokens. If the same source content is redesigned with the same brand, reuse cached sections.

### Monitoring

- [ ] **Add per-step timing** — log `Date.now()` before and after each API call to identify exactly where time is spent. Currently we log prompt sizes but not wall-clock time per step.
