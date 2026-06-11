# Atelier — Project Review

**Date:** 2026-04-06
**Scope:** Full codebase review across all 5 packages (SDK, API Server, Web UI, Figma Plugin, MCP Server), infrastructure, and documentation.

---

## Executive Summary

Atelier is an ambitious AI-native UI design platform with a well-thought-out architecture. The monorepo is cleanly structured with clear package boundaries, and the research-backed design pipeline (OKLCH, APCA, Aaker, UICrit) is genuinely differentiated. However, the project has outgrown some of its initial scaffolding — the API server is a monolithic file with no auth, the web-ui has significant code duplication and performance pitfalls, and several features (Why overlay, MCP server, Figma plugin) are partially wired up.

**Overall Grade: B+** — Strong foundation and vision, needs hardening for production use.

---

## 1. Architecture & Wiring

### What's Working Well

- **Monorepo structure** is clean — Turbo orchestration, workspace dependencies, per-package tsconfigs
- **SDK as the brain** — all AI logic, design algorithms, and quality gates live in one importable package. API server and MCP server are thin consumers
- **Multi-model routing** with automatic fallback is production-grade. Timeout handling (20min outer, 6min body read, 30s heartbeat logs) is thoughtful
- **Design token pipeline** is end-to-end: Aaker vector -> typography scale + border radius + spacing + shadows + animations -> prompt injection -> generation -> UICrit validation
- **Viewport culling** in InfiniteCanvas prevents iframe proliferation

### Wiring Issues Found

| Issue | Severity | Location |
|-------|----------|----------|
| **Why overlay not receiving data** — `injectWhyAttributes()` exists but `data-why-*` attributes are only reliably injected in `generatePageSectioned()`. The `redesignFromURL()` path calls `injectWhyAttributes()` but relies on regex heuristics that may miss sections without standard HTML tags | High | `sdk/src/models/project.ts` |
| **MCP server is minimal** — `mcp-server/src/index.ts` exposes tools but hasn't been updated for newer SDK features (consistency constraints, Aaker tokens, section generation) | Medium | `packages/mcp-server/` |
| **Figma plugin is disconnected** — No API integration. Plugin reads from clipboard/manual paste, not from the running Atelier instance. No shared auth or project sync | Medium | `packages/figma-plugin/` |
| **Analytics adapter is fire-and-forget** — MongoDB analytics (`logGeneration`, `saveSectionTemplate`) are called with `.catch(() => {})` everywhere. Silent failures mean analytics data could be missing without anyone knowing | Medium | `api-server/src/index.ts` |
| **Unused import** — `autoMatchPersonaDetailed` imported but never called in `project.ts` | Low | `sdk/src/models/project.ts` |
| **Screen storage is ephemeral** — API server creates in-memory SDK projects. Screens are lost on restart unless MongoDB is connected. The SQLite adapter exists in SDK but isn't wired into the API server | High | `api-server/src/index.ts` |

---

## 2. Security

### Critical Issues

1. **No Authentication** — Every API endpoint is publicly accessible. No API keys, JWT, OAuth, or any form of identity verification. Anyone who can reach the server can generate content, consume OpenRouter credits, and read all projects.

2. **Unbounded Request Body** — The custom JSON body parser (`body()` function) has no size limit. A malicious client could send a multi-GB payload and exhaust server memory.

3. **SSRF Risk** — `redesignFromURL()` accepts arbitrary URLs and the server fetches them via Crawl4AI or direct `fetch()`. Only a basic `^https?://` regex check exists. Internal network addresses (169.254.x.x, 10.x.x.x, localhost) are not blocked, enabling server-side request forgery.

### Medium Issues

4. **Rate limiter memory leak** — `rateBuckets` Map grows unbounded as new IPs connect. Old entries are filtered per-request but never pruned from the Map itself.

5. **X-Forwarded-For spoofing** — Rate limiting trusts the `X-Forwarded-For` header without proxy verification. Behind a reverse proxy this is correct, but without one, clients can spoof their IP.

6. **Path traversal incomplete** — Asset serving sanitizes filenames with char replacement but doesn't verify the resolved path stays within the assets directory. Should use `path.resolve()` + prefix check.

7. **Figma plugin postMessage origin** — Uses `'*'` target origin (noted in improvements.md as known issue).

### Recommendations

- Add API key middleware as the minimum viable auth (check `Authorization: Bearer <key>` header against env var)
- Add `Content-Length` check (reject > 10MB) in body parser
- Block private IP ranges in URL fetching (RFC 1918, link-local, loopback)
- Add periodic cleanup to rate limiter (every 60s, prune entries older than window)

---

## 3. Performance

### Web UI

| Issue | Impact | Fix |
|-------|--------|-----|
| **ScreenCard inline scripts rebuilt on every render** — `EDIT_INJECTION`, `WHY_INJECTION`, `HEIGHT_SCRIPT`, etc. are template literals concatenated inside the component. React re-evaluates these on every render | High | Move to module-level constants or `useMemo` with stable deps |
| **No debouncing on screen drag** — `updateScreen()` fires on every pointermove during drag, triggering Zustand updates and potential re-renders | High | Batch position updates with `requestAnimationFrame` or debounce |
| **Duplicate utility functions** — `hexToHSL`, `hslToHex`, `applyColorToScreens`, `applyFontToScreens`, `applyRadiusToScreens` defined in both `DesignPanel.tsx` and `DesignSystemCard.tsx` (~120 LOC duplicated) | Medium | Extract to `src/utils/color.ts` |
| **Inline style objects** — Every render creates new `style={{}}` objects, preventing React's shallow-comparison optimization | Medium | Use Tailwind classes or CSS modules (noted in improvements.md) |
| **No AbortController** — API requests in ChatPanel and ComponentBrowser are not cancellable. Component unmount during generation leaves orphaned requests | Medium | Pass AbortSignal to all fetch calls |
| **ChatPanel string concatenation** — HTML built with `+=` in streaming loop | Low | Use array + join |

### API Server

| Issue | Impact | Fix |
|-------|--------|-----|
| **Single-threaded request handling** — Node.js HTTP server with no clustering. One long AI generation (up to 20 min) blocks the event loop for response writing | Medium | Use `cluster` module or deploy behind a load balancer |
| **Synchronous file read in asset endpoint** — `readFileSync` used in the hot path | Low | Switch to `fs.promises.readFile` |
| **No connection limits** — `server.maxConnections` not set | Low | Set reasonable limit (e.g., 100) |

### SDK

| Issue | Impact | Fix |
|-------|--------|-----|
| **`project.ts` is 1,694 lines** — `redesignFromURL()` alone is 200+ lines, `generatePageSectioned()` is 300+. Hard to navigate and test | Medium | Extract into focused modules: `redesign.ts`, `section-generator.ts`, `brand-extractor-pipeline.ts` |
| **CRAWL4AI_JS embedded as string** — Large JavaScript snippet for Crawl4AI browser injection is a string constant. Hard to maintain and syntax-check | Low | Move to a separate `.js` file and `readFileSync` at startup |

---

## 4. Code Quality

### Strengths

- **TypeScript strict mode** throughout
- **Zustand store** is fully typed with clear action boundaries
- **No `any` types** in web-ui main code (only in catch blocks)
- **Prompt engineering** is detailed, rule-based, and well-commented
- **Error recovery** in router is thorough (truncated HTML repair, empty response retry, code fence stripping)

### Issues

| Issue | Location | Severity |
|-------|----------|----------|
| **API server is one file (739 lines)** — All routes, middleware, helpers, and startup in `index.ts`. No separation of concerns, untestable | `api-server/src/index.ts` | High |
| **Custom HTTP router** — Hand-rolled regex router instead of Express/Fastify. Fragile, no middleware chain, no parameter typing | `api-server/src/index.ts:74-94` | Medium |
| **Error handling via string matching** — `err.message.includes("Rate limit") ? 429 : 500`. Brittle, any message change breaks status codes | `api-server/src/index.ts:723-726` | Medium |
| **Dead code** — Screen retrieval fallback in edit endpoint (lines 301-307) never executes since frontend always sends `currentHtml` | `api-server/src/index.ts:301-307` | Low |
| **Console.log debug noise** — Extensive `[why]`, `[edit]`, `[undo]`, `[design]` logging still present. No log levels or feature flags | Multiple files | Low |
| **No error boundaries** in React — iframe errors or component crashes take down the entire app | `web-ui/src/` | Medium |

---

## 5. Testing

### Current State

- **SDK:** 15 tests (8 router, 7 design-system) via Vitest
- **API Server:** 0 tests
- **Web UI:** 0 tests
- **Figma Plugin:** 0 tests
- **MCP Server:** 0 tests

### Gaps

| Gap | Priority |
|-----|----------|
| **No API endpoint tests** — Routes with complex validation logic, SSE streaming, and multi-step generation have zero test coverage | Critical |
| **No component tests** — ScreenCard (1,320 LOC) with complex iframe lifecycle, message protocols, and edit mode has no tests | High |
| **No integration tests** — End-to-end flow from ChatPanel prompt → API → SDK → generated HTML is untested | High |
| **No contract tests** — postMessage protocol between parent and iframe is implicitly defined in string templates. Breaking changes are invisible | Medium |
| **Test fixtures exist but unused** — `__loadTestFixtures()` in App.tsx suggests intent to test but no test files consume them | Low |

### Recommendations

1. Add API endpoint tests with `supertest` (or raw `http.request` since no Express)
2. Add React Testing Library tests for ChatPanel generation flow and ScreenCard edit mode
3. Add SDK integration tests that mock OpenRouter responses and verify full pipeline output
4. Define postMessage protocol as a TypeScript interface and test both sides against it

---

## 6. Developer Experience

### What's Good

- **Turbo** orchestrates build/dev/test across packages
- **Vite** dev server with API proxy works seamlessly
- **Docker Compose** brings up Crawl4AI + API server in one command
- **.env.example** documents all configuration
- **19 docs** covering architecture, AI models, components, deployment
- **3 Claude Code skills** for prompt enhancement, React export, design extraction
- **CI pipeline** via GitHub Actions (build, lint, test)

### What Needs Work

| Issue | Recommendation |
|-------|---------------|
| **No dev onboarding script** — New developers must read multiple docs to understand setup | Add a `scripts/setup.sh` that checks prerequisites, copies `.env.example`, runs `npm install`, and starts Docker |
| **No API documentation** — Endpoints are discovered by reading source code | Generate OpenAPI spec from route definitions, or add a `/api/docs` endpoint |
| **No storybook or component playground** — `preview.html` exists but is manual | Consider Storybook for the component library visualization |
| **Lint/format not enforced** — No pre-commit hooks, CI runs lint but doesn't block | Add `husky` + `lint-staged` for pre-commit formatting |
| **Build errors not obvious** — Root `tsconfig.json` excludes multiple packages/files. The exclusion list is fragile | Consider per-package `tsconfig.build.json` files instead of root-level exclusions |

---

## 7. Feature Completeness

### Fully Working

- Canvas with zoom/pan/momentum/pinch
- Screen generation from prompts
- Website redesign from URL (with Crawl4AI crawling)
- Multi-page redesign with planning
- Design system editing (colors, fonts, radius)
- Component browser (550+ components)
- Screen variants (REFINE/EXPLORE/REIMAGINE)
- Inline editing with AI refinement
- Undo/redo (20-step history)
- Export/import as `.atelier` files
- Keyboard shortcuts
- Viewport culling
- OKLCH palettes, APCA contrast, UICrit critique
- Aaker personality-driven design tokens
- Multi-page consistency constraints

### Partially Working

| Feature | Status | Blocker |
|---------|--------|---------|
| **Why overlay** | Code deployed, badges not appearing | `injectWhyAttributes()` regex may not match all section patterns; needs end-to-end test after Docker rebuild |
| **Analytics/Learning layer** | MongoDB adapter works, API endpoints exist | No dashboard or visibility into collected data. RALF retrieval (`getLayoutExamples`) is wired but untested at scale |
| **Screenshot service** | Code exists in `sdk/screenshot/service.ts` | Requires Playwright, not included in Docker, no API endpoint to trigger it |
| **React export** | API endpoint exists, skill script works | No UI button to trigger export from canvas |

### Not Started / Placeholder

| Feature | Notes |
|---------|-------|
| **User accounts / multi-tenancy** | No auth, no user model, all projects are shared |
| **Real-time collaboration** | Eg-walker mentioned in improvements.md but not started |
| **Version history / branching** | Undo/redo is in-memory only, no persistent version control |
| **Deployment / hosting** | Generated pages can only be exported as HTML, no one-click deploy |
| **Asset management** | Images use `picsum.photos` placeholders, no upload/CDN integration |
| **Responsive preview** | Device type is set at generation, no toggle to preview same page at different breakpoints |

---

## 8. Documentation

### Strengths

- `README.md` is comprehensive (36KB) with clear quick-start, architecture diagram, and feature descriptions
- `improvements.md` is an excellent living document tracking 31+ issues with research references
- `issues.md` tracks specific bugs with fix status
- Per-feature docs in `docs/` cover AI models, database, components, export/import

### Gaps

- **No CONTRIBUTING.md** — No guidance for external contributors
- **No CHANGELOG** — Version history is only in git log
- **No API reference** — Endpoints documented informally in README but no schema definitions
- **Stale references** — Some docs reference old patterns (e.g., `router.json()` which was renamed to `routeJSON()`)
- **No architecture decision records (ADRs)** — Decisions like "why custom HTTP router instead of Express" are undocumented

---

## 9. Infrastructure

### Docker

- **Two-stage builds** for both API server and web-ui (good)
- **Health checks** configured with appropriate intervals
- **Volume mount** for SQLite persistence
- **Missing:** No Docker health check for MongoDB connectivity
- **Missing:** No resource limits (memory, CPU) on containers
- **Missing:** No log rotation configuration

### CI/CD

- **GitHub Actions** runs build/lint/test on push and PR
- **Missing:** No deployment pipeline (staging, production)
- **Missing:** No Docker image publishing to registry
- **Missing:** No dependency vulnerability scanning (e.g., `npm audit`, Snyk)
- **Missing:** No performance benchmarks or regression tests

---

## 10. Prioritized Recommendations

### P0 — Do Before Any Production Use

| # | Action | Effort | Impact | Status |
|---|--------|--------|--------|--------|
| 1 | **Add API authentication** — Bearer token middleware, env-var API key | 2h | Prevents unauthorized credit consumption | DONE |
| 2 | **Add request body size limit** — Reject payloads > 10MB | 30min | Prevents OOM DoS | DONE |
| 3 | **Block private IP ranges in URL fetch** — Prevent SSRF | 1h | Security hardening | DONE |
| 4 | **Wire SQLite storage into API server** — Persist projects across restarts | 2h | Data durability | DONE |

**P0 Details (completed 2026-04-06):**
- Auth: `ATELIER_API_KEY` env var + `authenticate()` middleware on all POST routes. Returns 401 on bad/missing key. No key = open access (dev mode). CORS preflight updated to allow `Authorization` header. Frontend uses `VITE_ATELIER_API_KEY` via shared `apiHeaders()` utility.
- Body limit: `body()` parser tracks incoming bytes, destroys request at 10MB with 413 status.
- SSRF: `validateExternalUrl()` blocks localhost, 127.x, 10.x, 172.16-31.x, 192.168.x, 169.254.x, IPv6 loopback/link-local. Applied to all URL-accepting endpoints.
- Bonus: Rate limiter cleanup (60s interval prunes stale IPs), asset path traversal fix (`path.resolve` + prefix check), error handler maps AuthError→401, Payload→413, SSRF→403.
- Pre-commit hooks: `lint-staged` config added to root package.json. husky + `.husky/` dir removed because repo is not yet connected to GitLab. To activate: `git init && npx husky init`, then set `.husky/pre-commit` to `npx lint-staged`.
- Storage: Default changed from `memory` to `sqlite`. `createStorage()` initializes on startup with fallback to memory if SQLite fails. All generation routes persist screens (`createScreen`), edit routes update HTML (`updateScreen`), GET routes read from storage first. New `GET /api/projects` and `GET /api/projects/:pid` endpoints added. Storage closed gracefully on shutdown.

### P1 — High-Impact Improvements

| # | Action | Effort | Impact | Status |
|---|--------|--------|--------|--------|
| 5 | **Split API server into route modules** — `routes/projects.ts`, `routes/screens.ts`, `routes/components.ts` + middleware stack | 4h | Testability, maintainability | DONE |
| 6 | **Add API endpoint tests** — Test generation flow, validation, error cases with mocked SDK | 4h | Regression prevention | DONE |
| 7 | **Extract duplicated web-ui utilities** — Color conversion, apply-to-screens functions into shared `utils/` | 1h | DRY, fewer bugs | DONE |
| 8 | **Fix Why overlay end-to-end** — Verify `injectWhyAttributes()` output, test with real generation | 2h | Completing a shipped feature | DONE |
| 9 | **Add React error boundaries** — Wrap ScreenCard, ChatPanel, DesignPanel | 1h | Prevents full-app crashes | DONE |
| 10 | **Debounce screen drag updates** — RAF-batch position changes during drag | 1h | Smoother canvas interaction | DONE |

### P2 — Quality of Life

| # | Action | Effort | Impact | Status |
|---|--------|--------|--------|--------|
| 11 | **Add OpenAPI spec** — Auto-generate or manually write API docs | 3h | Developer onboarding | DONE |
| 12 | **Add pre-commit hooks** — husky + lint-staged for format/lint on commit | 1h | Code quality enforcement | PARTIAL |
| 13 | **Memoize ScreenCard injection scripts** — Move to module-level constants | 30min | Fewer re-render allocations | DONE |
| 14 | **Add AbortController to fetch calls** — Cancel API requests on unmount | 1h | Prevents leaked requests | DONE |
| 15 | **Clean up debug logging** — Add log levels or strip `console.log` behind `DEBUG` env flag | 1h | Cleaner console output | DONE |
| 16 | **Add React export button to UI** — Currently only available via skill/API | 2h | Feature accessibility | DONE |

### P3 — Future Architecture

| # | Action | Effort | Impact | Status |
|---|--------|--------|--------|--------|
| 17 | **Refactor `project.ts`** — Split 1,694-line file into focused modules | 4h | Maintainability | DONE |
| 18 | **Add persistent version history** — Save screen snapshots to storage, enable timeline view | 8h | User value | |
| 19 | **Add responsive preview** — Toggle between mobile/tablet/desktop for same screen | 4h | Designer workflow | DONE |
| 20 | **Image upload & CDN** — Replace picsum placeholders with real asset management | 8h | Production readiness | |
| 21 | **Static thumbnail caching** — Render iframe to canvas when culled, show cached image | 4h | Better viewport culling UX | DONE |
| 22 | **Migrate to Express/Fastify** — Replace custom router with battle-tested framework | 4h | Middleware ecosystem, testing, reliability | |

---

## Appendix: File Size Analysis

| File | Lines | Notes |
|------|-------|-------|
| `sdk/src/models/project.ts` | 1,694 | Largest file. Contains 3 generation paths, brand extraction, consistency constraints, Why injection. **Should be split.** |
| `web-ui/src/components/ScreenCard.tsx` | 1,320 | Second largest. Iframe lifecycle, edit mode, Why mode, height measurement, render diagnostics. |
| `web-ui/src/components/ChatPanel.tsx` | 1,061 | SSE handling, redesign flow, edit dispatching, URL extraction. |
| `api-server/src/index.ts` | 739 | Monolithic server. All routes, middleware, startup. |
| `web-ui/src/components/DesignSystemCard.tsx` | 741 | Color picker, font sync, palette generation. |
| `sdk/src/utils/router.ts` | ~600 | Model routing with retry, fallback, timeout, HTML recovery. |
| `sdk/src/utils/prompts.ts` | ~500 | All system prompts for 7 pipeline stages. |
| `web-ui/src/components/DesignPanel.tsx` | 497 | Design token sidebar (duplicates code from DesignSystemCard). |

---

## Appendix: Dependency Health

| Package | Version | Status |
|---------|---------|--------|
| React | ^19.0.0 | Current |
| Zustand | ^5.0.0 | Current |
| Vite | ^6.0.0 | Current |
| TypeScript | ^5.7.0 | Current |
| MongoDB Driver | ^7.1.1 | Current |
| Zod | ^3.23.0 | Current |
| Tailwind CSS | ^3.4.0 | Stable (v4 available but breaking) |
| better-sqlite3 | ^11.0.0 | Current |
| Turbo | ^2.3.0 | Current |

All dependencies are on current major versions. No known CVEs at time of review.

---

*Review generated by Claude. All findings should be verified against current code state.*
