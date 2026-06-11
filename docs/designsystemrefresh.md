# Design System — Per-Project Scoping

Status: proposal
Owner: TBD
Last updated: 2026-04-20

## Problem

When a user generates a redesign in Project A, the extracted design system card renders on the canvas with Project A's tokens (colours, fonts, corner radius). Switching to Project B continues to render Project A's card and tokens. Project B's own design system is never fetched or displayed.

Root cause: both `designSystem` and `extractedTokens` live in a single global Zustand slice in [packages/web-ui/src/stores/canvas-store.ts](../packages/web-ui/src/stores/canvas-store.ts), and `designSystem` is persisted to a single browser `localStorage` key (`atelier-design-system`). Nothing is keyed by `projectId`. The card-restore block in [App.tsx](../packages/web-ui/src/App.tsx#L177-L195) is also guarded by `if (!extractedTokens)`, so a stale card from the prior project short-circuits re-population.

The backend endpoint [`POST /api/projects/:pid/design-system/extract`](../packages/api-server/src/routes/analytics.ts#L157-L166) is already project-scoped, and the SDK storage layer already has `getDesignSystem`/`setDesignSystem` per project ([sqlite.ts:231-234](../packages/sdk/src/storage/sqlite.ts#L231-L234)) — they are just not exposed over HTTP, and the frontend does not respect the per-project boundary.

## Solution summary

Treat the server as the source of truth. Persist each project's design system via the existing storage layer, expose it over HTTP, and have the web client fetch it on project load and PUT it on user edits. Keep the Zustand store shape flat (mirroring how `screens` are already handled) and reset design-system state on project switch.

A debounced write-through pattern keeps UI responsive; a per-project `localStorage` cache keeps first-paint fast across reloads; a one-shot migration preserves any design system already saved under the legacy global key.

## Options considered

### A. Key the Zustand fields by projectId
Shape becomes `Record<projectId, CanvasDesignSystem>`. Minimal refactor. No network on project switch.

Rejected. Stale data accumulates in memory and `localStorage` with no clear eviction. Diverges from how `screens` are handled (flat, re-set on `setProject`). Does not survive device/browser changes. Not a professional-grade pattern for user-owned data.

### B. Flat store, rehydrate from per-project `localStorage`
Store shape matches `screens`. Rehydrate `designSystem` from `atelier-design-system:<pid>` on each `loadProject`. Clean, offline-friendly.

Rejected as primary strategy. Browser-only persistence means the design system is lost on cache clear, invisible to other devices, and cannot be inspected or audited server-side. Acceptable as a first-paint cache layered on top of Option C.

### C. Server-of-record, flat store, cached locally (recommended)
Design system persists via the existing SDK storage. New HTTP endpoints expose per-project get/put. Zustand stays flat and is reset on project switch. `localStorage` becomes a per-project cache keyed by `pid`; server response always wins on load.

Chosen. Matches the persistence model already used for projects and screens ([projects.ts:50-70](../packages/api-server/src/routes/projects.ts#L50-L70)). Supports multi-device, survives cache clears, and gives an audit trail. Fixes the reported bug completely, with headroom for future features (design-system versioning, team sharing, templates).

## Architecture

```
User edit in DesignPanel
        │
        ▼
updateDesignSystem(partial)   ──► Zustand set (flat, current project only)
        │                                │
        │                                ├─► localStorage "atelier-design-system:<pid>"
        │                                │
        │                                └─► debounced PUT /api/projects/:pid/design-system
        ▼
DesignSystemCard / DesignPanel re-render
```

```
loadProject(id)
        │
        ├─► setProject({ id, ... })  ──► store resets designSystem / extractedTokens / marks
        │
        ├─► GET  /api/projects/:id                (screens, metadata)
        └─► GET  /api/projects/:id/design-system  (in parallel)
                    │
                    ▼
            useCanvasStore.setState({ designSystem })
            cache into localStorage "atelier-design-system:<id>"
            re-derive extractedTokens card placement from first screen
```

## Implementation plan

### 1. Backend — expose design-system endpoints
File: [packages/api-server/src/routes/analytics.ts](../packages/api-server/src/routes/analytics.ts) (or lift into a new `routes/design-system.ts` for clarity).

- `GET /api/projects/:pid/design-system`
  - Ownership check mirroring [projects.ts:56-59](../packages/api-server/src/routes/projects.ts#L56-L59).
  - `return { designSystem: await storage.getDesignSystem(pid) ?? null }`.
- `PUT /api/projects/:pid/design-system`
  - Body validated against a `CanvasDesignSystem` schema (seed colour, palette, fonts, corner radius).
  - Ownership check.
  - `await storage.setDesignSystem(pid, body)`; return the stored value.
- Update `POST /api/projects/:pid/design-system/extract` to also call `storage.setDesignSystem(pid, ds)` after extraction so extracted systems survive reload without requiring an explicit save.
- Audit `packages/api-server/src/index.js` — if the legacy server is still serving any traffic, register the new routes there too or delete the file.

Persistence format: store the raw `CanvasDesignSystem` JSON. The SDK's richer `DesignSystem` shape is only needed at screen-generation time and is already synthesised from `CanvasDesignSystem` inside the generators — a lossless canonical shape avoids drift.

### 2. Frontend API helpers
File: [packages/web-ui/src/utils/api.ts](../packages/web-ui/src/utils/api.ts)

- `fetchDesignSystem(pid: string): Promise<CanvasDesignSystem | null>`
- `saveDesignSystem(pid: string, ds: CanvasDesignSystem): Promise<CanvasDesignSystem>`

Both use the existing auth header helper.

### 3. Store refactor
File: [packages/web-ui/src/stores/canvas-store.ts](../packages/web-ui/src/stores/canvas-store.ts)

- Replace `loadDesignSystem()` with `loadDesignSystemForProject(pid: string): CanvasDesignSystem` that reads `atelier-design-system:${pid}` and falls back to `DEFAULT_DESIGN`.
- Initial state holds `designSystem: DEFAULT_DESIGN` (no pid at boot).
- `setProject(p)`: if `p.id !== state.project?.id`, reset `designSystem`, `extractedTokens`, `marks`, `selectedScreenId` to defaults. The loader is then responsible for hydrating from the server.
- `updateDesignSystem(partial)`:
  - Merge into current `designSystem`.
  - Write cache to `atelier-design-system:${pid}`.
  - Schedule a debounced `saveDesignSystem(pid, merged)` (250–500 ms trailing debounce; cancelled on project switch).
- `createProject` and `importProject`: scope any design-system writes to the new project's `pid`. Drop writes to the legacy global key.
- Export/import: the `.atelier` file should carry the design system as part of the project payload; on import, PUT it to the server for the new `pid`.

### 4. App.tsx loader
File: [packages/web-ui/src/App.tsx](../packages/web-ui/src/App.tsx#L139-L199)

- After `setProject({ id, ... })` the store is clean (per step 3).
- Fire `fetchDesignSystem(id)` in parallel with the project/screens fetch.
- When it resolves:
  - `useCanvasStore.setState({ designSystem })`.
  - Write `atelier-design-system:${id}` as cache.
  - Derive `extractedTokens` card placement from `designSystem` and the first screen. **Remove the `!extractedTokens` guard** on [line 180](../packages/web-ui/src/App.tsx#L180).
- If the server returns `null`, do not render a card; the canvas stays clean until the user extracts or edits.

### 5. Consumers — verify, don't refactor
These already read the flat store shape and require no surface changes, only a timing audit:

- [DesignPanel.tsx](../packages/web-ui/src/components/DesignPanel.tsx) — slider/picker changes need to go through the debounced `updateDesignSystem`. Spot-check that the panel is mounted only within an active project context.
- [InfiniteCanvas.tsx:221](../packages/web-ui/src/components/InfiniteCanvas.tsx#L221) — no change.
- [ChatPanel.tsx](../packages/web-ui/src/components/ChatPanel.tsx) — the redesign flows call `updateDesignSystem` after brand extraction ([ChatPanel.tsx:299-313](../packages/web-ui/src/components/ChatPanel.tsx#L299) and [467-483](../packages/web-ui/src/components/ChatPanel.tsx#L467)). Confirm these execute while the correct `projectId` is latched in the store; otherwise the PUT lands on the wrong project.
- [DesignSystemCard.tsx](../packages/web-ui/src/components/DesignSystemCard.tsx) — no change.

### 6. Migration
One-shot, runs once on the first authenticated session after deploy.

1. On app boot, if `localStorage.getItem('atelier-design-system')` exists and `localStorage.getItem('atelier-ds-migrated')` is unset:
   - Stash the legacy value in memory as `legacyDesignSystem`.
2. On the next `loadProject(id)` where the server returns `null` for the project's design system:
   - Seed the store and the per-project cache (`atelier-design-system:<id>`) from `legacyDesignSystem`.
   - Do not PUT to the server until the user makes an edit (avoids silently claiming fresh projects).
   - Show a single informational toast: "Restored your saved design system."
3. Set `atelier-ds-migrated=1` and schedule removal of the legacy key after 30 days.

## Testing

### Unit
- `packages/web-ui/src/stores/canvas-store.test.ts` (new): setProject(A), updateDesignSystem({ seedColor: '#f00' }), setProject(B) — assert store resets. Re-enter A via the rehydrate helper — assert red persists.
- Debounce: assert that rapid `updateDesignSystem` calls produce exactly one PUT per debounce window.

### API
- Alongside the existing analytics route tests: GET returns null for absent, PUT round-trips, ownership check returns 403 for non-owners.

### Integration
- Mount `App` with mocked `fetchDesignSystem` returning different tokens for A and B; switch projects and assert `DesignSystemCard` re-renders with B's tokens.

### Migration
- Seed `localStorage` with the legacy key, load a project whose server design system is null, assert the legacy values surface exactly once and the migrated flag is set.

### Manual
- Two-tab same-project edit: last-write-wins on PUT is acceptable but worth eye-balling.
- Export → delete → import: design system survives the round-trip into the new `pid`.

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| `updateDesignSystem` fires before `setProject` latches new `pid` — PUT lands on wrong project. | Audit ChatPanel flows; add a `getState().project?.id` null-guard in `updateDesignSystem` that drops the write if no project is active. |
| Slider/colour-picker spam causes PUT storms. | Trailing-edge debounce, 250–500 ms, cancelled on unmount and on project switch. |
| Legacy `packages/api-server/src/index.js` still serves traffic and new routes aren't registered. | Decide during implementation: delete the file, or register there too. |
| Legacy design systems silently migrated into wrong projects. | Only seed the first project with a null server design system, display a toast, set the migrated flag. |
| `CanvasDesignSystem` schema drift between client and server. | Single shared TypeScript type exported from `packages/sdk/src/storage/interface.ts` and imported by both sides. Validate PUT body with Zod on the server. |

## Rollout

1. Ship backend endpoints behind the existing auth path — safe no-ops if the frontend hasn't shipped yet.
2. Ship frontend changes (store, App.tsx, API helpers, DesignPanel debounce).
3. Enable migration path on the next release after (2).
4. Remove the legacy global-key read path after 30 days of migrated-flag presence in production telemetry.

## Implementation checklist

Tick as work lands. Order within each section is the recommended sequence; sections 1 and 2 can run in parallel with 3.

### Backend
- [ ] Add `GET /api/projects/:pid/design-system` in [analytics.ts](../packages/api-server/src/routes/analytics.ts) with ownership check.
- [ ] Add `PUT /api/projects/:pid/design-system` with Zod body validation and ownership check.
- [ ] Update `POST /api/projects/:pid/design-system/extract` to persist via `storage.setDesignSystem(pid, ds)`.
- [ ] Share a single `CanvasDesignSystem` type export from [packages/sdk/src/storage/interface.ts](../packages/sdk/src/storage/interface.ts) and import it on both client and server.
- [ ] Decision: delete legacy `packages/api-server/src/index.js` or register new routes there.
- [ ] API route tests: GET null-case, PUT round-trip, non-owner 403.

### Frontend — API layer
- [ ] Add `fetchDesignSystem(pid)` to [packages/web-ui/src/utils/api.ts](../packages/web-ui/src/utils/api.ts).
- [ ] Add `saveDesignSystem(pid, ds)` to the same file.

### Frontend — store refactor
- [ ] Replace `loadDesignSystem()` with `loadDesignSystemForProject(pid)` in [canvas-store.ts](../packages/web-ui/src/stores/canvas-store.ts).
- [ ] Initial store state uses `DEFAULT_DESIGN` (no pid at boot).
- [ ] `setProject` resets `designSystem`, `extractedTokens`, `marks`, `selectedScreenId` when pid changes.
- [ ] `updateDesignSystem` writes cache to `atelier-design-system:${pid}`.
- [ ] `updateDesignSystem` schedules a 250–500 ms trailing-debounced `saveDesignSystem` PUT, cancelled on project switch/unmount.
- [ ] `updateDesignSystem` drops the write if `state.project?.id` is null.
- [ ] `createProject` and `importProject` scope all design-system writes to the new `pid`; drop writes to the legacy global key.
- [ ] Store unit test: cross-project reset + per-project rehydrate.

### Frontend — App.tsx loader
- [ ] Fire `fetchDesignSystem(id)` in parallel with the project/screens fetch in [loadProject](../packages/web-ui/src/App.tsx#L139-L199).
- [ ] On resolve, `setState({ designSystem })` and write the per-pid cache.
- [ ] Remove the `!extractedTokens` guard on [App.tsx:180](../packages/web-ui/src/App.tsx#L180).
- [ ] Re-derive `extractedTokens` card placement unconditionally when the server returns a design system.
- [ ] Skip card render when the server returns `null`.

### Frontend — consumers (verify only)
- [ ] Audit [ChatPanel.tsx:299-313](../packages/web-ui/src/components/ChatPanel.tsx#L299) and [467-483](../packages/web-ui/src/components/ChatPanel.tsx#L467) — confirm `updateDesignSystem` runs after `setProject` has latched the new `pid`.
- [ ] Confirm [DesignPanel.tsx](../packages/web-ui/src/components/DesignPanel.tsx) only mounts within an active project.
- [ ] Confirm [InfiniteCanvas.tsx:221](../packages/web-ui/src/components/InfiniteCanvas.tsx#L221) renders cleanly without edits.

### Migration
- [ ] On boot, stash legacy `atelier-design-system` into an in-memory `legacyDesignSystem` if `atelier-ds-migrated` is unset.
- [ ] On the first `loadProject` where server returns `null`, seed the store and per-pid cache from `legacyDesignSystem`.
- [ ] Do not PUT the migrated values until the user edits.
- [ ] Show a one-time toast: "Restored your saved design system."
- [ ] Set `atelier-ds-migrated=1`; schedule legacy-key removal after 30 days.
- [ ] Migration integration test: legacy seed surfaces exactly once, flag is set.

### Integration + manual QA
- [ ] Integration test: switch A → B with mocked `fetchDesignSystem`, assert `DesignSystemCard` shows B's tokens.
- [ ] Two-tab same-project edit — last-write-wins is acceptable but verify UI does not flicker.
- [ ] Export → delete → import: design system survives the round-trip into the new pid.

### Rollout gates
- [ ] Ship backend endpoints first (safe no-op until frontend lands).
- [ ] Ship frontend changes in the next release.
- [ ] Enable migration path in the release after that.
- [ ] After 30 days, remove legacy global-key read path.

## Out of scope

- Design-system versioning or undo of design-system edits.
- Sharing design systems between projects or as templates.
- Team-level design systems above the project scope.

These are natural follow-ups once the per-project persistence lands.
