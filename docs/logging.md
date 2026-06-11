# Atelier — Structured Pipeline Logging

## Context

The generation pipeline currently has 144 `console.log/warn/error` calls across 8 files with 14+ different prefix tags, no timing, no visual hierarchy, and parallel batch logs that interleave unreadably. When tailing `docker compose logs`, it's very hard to trace a generation run or spot issues.

## Goal

Make logs readable at a glance with clear phase boundaries, elapsed timing, and structured parallel output.

### Desired output format:
```
[00:00] ── FETCH ─────────────────────
[00:00]   crawl4ai: https://strattoncraig.com
[00:05]   Success: 215,728 chars HTML
[00:05] ── PLAN ──────────────────────
[00:05]   Brand: Stratton Craig (cache hit)
[00:07]   Persona: bold-modern (0.67)
[00:07] ── PARSE ─────────────────────
[00:07]   10 sections parsed, capped from 19
[00:07] ── GENERATE (batch 1/3) ──────
[00:07]   ├─ [1] Navigation (nav) → kimi-k2.5, 33K prompt
[00:07]   ├─ [2] Hero (hero) → kimi-k2.5, 18K prompt
[00:12]   ├─ [2] OK Hero: 6,327 chars (5s)
[00:18]   ├─ [1] ??? Navigation: truncated, patched 6 tags (11s)
[01:45] ── ASSEMBLE ──────────────────
[01:45]   10 sections, 143K chars
[01:45]   UICrit: 9.4/10 (PASS)
[01:45] ── DONE (1m 45s) ─────────────
```

---

## Current State

| File | Log Count | Prefixes Used |
|------|-----------|---------------|
| section-generator.ts | 39 | [sdk], [typescale], [contrast] |
| router.ts | 38 | [router] + emojis |
| redesign.ts | 20 | [sdk], [typescale], [contrast] |
| section-parser.ts | 20 | [section-parser], [assembleSections], [validateSection] |
| screens.ts (api) | 14 | [api] |
| project.ts | 6 | [sdk] |
| personas.ts | 5 | [personas] |
| design-critique.ts | 2 | [UICrit] |
| **Total** | **144** | **14+ different prefixes** |

### Key Issues
- No elapsed timing — impossible to know how long each phase took
- No visual phase boundaries — all lines look the same
- Parallel batch logs interleave without correlation markers
- Inconsistent prefix format across files
- Router uses emojis, others don't
- No log levels — debug details mixed with important milestones

---

## Implementation Plan

### Step 1: Create logger utility
**New file:** `packages/sdk/src/utils/logger.ts`

`PipelineRun` class:
- Tracks `startTime` for elapsed `[MM:SS]` prefix
- Methods: `phase(name)`, `info(msg)`, `warn(msg)`, `error(msg)`, `debug(msg)`
- Parallel task methods: `task(i, label)`, `taskDone(i, label, info)`, `taskWarn(i, label, info)`
- `done()` prints final elapsed time
- `debug()` only prints when `CANVAS_LOG_LEVEL=debug` env var is set
- No ANSI colours (Docker logs render them as escape chars)
- Export `NOOP_RUN` for backward compat (all methods are no-ops)
- Export from `packages/sdk/src/index.ts`

### Step 2: Thread logger through call stack
Add optional `logger?: PipelineRun` parameter to:
- `screens.ts` — create `PipelineRun` at request entry
- `project.ts` — `redesignFromURL()`, `generatePageSectioned()`, `generate()`
- `redesign.ts` — `redesignFromURL()`, `planRedesign()`
- `section-generator.ts` — `generatePageSectioned()`

When `logger` is undefined, use `NOOP_RUN`.

### Step 3: Migrate files (one at a time)

Replace `console.log` calls with structured logger calls per file. Each file maps to pipeline phases:

| File | Phase(s) | Migration approach |
|------|----------|-------------------|
| section-generator.ts | PARSE, GENERATE, ASSEMBLE, DONE | Batch loops → `task()`/`taskDone()`, assembly → `phase("ASSEMBLE")` |
| redesign.ts | FETCH, PLAN | Crawl/fetch → `phase("FETCH")`, brand/persona → `phase("PLAN")` |
| router.ts | (within GENERATE) | Token/response detail → `debug()`, fallback/retry → `warn()`, remove emojis |
| section-parser.ts | PARSE, ASSEMBLE | Parse counts → `info()`, assembly detail → `debug()` |
| personas.ts | PLAN | Match result → `info()` |
| design-critique.ts | ASSEMBLE | Score/issues → `info()` |
| project.ts | (orchestration) | Section count → `info()` |
| screens.ts | (entry point) | Mode/URL → `info()` |

### Step 4: Router special handling
Router is called from many contexts (not just the pipeline). Strategy:
- Add optional `logger` to `routeJSON()` options
- When provided, detailed logs → `debug()`, retries → `warn()`
- When not provided, keep existing `console.log` (backward compat)
- Remove emoji usage, use plain-text markers

---

## Key Decisions

- **Per-run instance** (not global) — multiple concurrent generations each get their own timer
- **Explicit parameter passing** (not AsyncLocalStorage) — transparent, matches existing `onProgress` pattern
- **No buffering of parallel logs** — real-time visibility in `docker logs -f` matters more than perfect ordering; `[N]` index prefix is enough to trace
- **Gradual migration** — old `console.log` calls coexist with new logger during transition
- **No external deps** — pure utility, no winston/pino/etc.

---

## Checklist

### Setup
- [x] Create `packages/sdk/src/utils/logger.ts` with `PipelineRun` class *(Done 2026-04-08)*
- [x] Export `createPipelineRun` and `NOOP_RUN` from `packages/sdk/src/index.ts` *(Done 2026-04-08)*

### Thread logger through call stack
- [x] `packages/api-server/src/routes/screens.ts` — create `PipelineRun` at entry, pass to SDK methods *(Done 2026-04-08)*
- [x] `packages/sdk/src/models/project.ts` — add `logger?` param, forward to internal functions *(Done 2026-04-08)*
- [x] `packages/sdk/src/models/redesign.ts` — add `logger?` param to `redesignFromURL`, `planRedesign`, `fetchPage` *(Done 2026-04-08)*
- [x] `packages/sdk/src/models/section-generator.ts` — add `logger?` param to `generatePage`, `generatePageSectioned` *(Done 2026-04-08)*

### Migrate files
- [x] `packages/sdk/src/models/section-generator.ts` (39 statements) — PARSE, GENERATE, ASSEMBLE, DONE *(Done 2026-04-08)*
- [x] `packages/sdk/src/models/redesign.ts` (20 statements) — FETCH, PLAN *(Done 2026-04-08)*
- [x] `packages/sdk/src/utils/router.ts` (38 statements) — debug/warn within GENERATE *(Done 2026-04-08)*
- [x] `packages/sdk/src/utils/section-parser.ts` (20 statements) — `parseSections` + `assembleSections` migrated to logger; 6 internal fallback/validate calls remain as console.log *(Done 2026-04-08)*
- [x] `packages/sdk/src/utils/personas.ts` (5 statements) — kept as console.log (startup + match results, not pipeline-threaded) *(Done 2026-04-08)*
- [x] `packages/sdk/src/utils/design-critique.ts` (2 statements) — kept as console.log (auto-fix notifications, pure utility) *(Done 2026-04-08)*
- [x] `packages/sdk/src/models/project.ts` (6 statements) — orchestration *(Done 2026-04-08)*
- [x] `packages/api-server/src/routes/screens.ts` (14 statements) — entry point (pipeline routes migrated, edit/variant routes keep console.log) *(Done 2026-04-08)*

### Verify
- [x] `npx tsc --noEmit` — no type errors *(Done 2026-04-08 — SDK + api-server both clean)*
- [ ] Docker build + redesign test — structured output visible
- [ ] Confirm: phase banners, timing, parallel sections readable, no escape codes
