# Atelier — Issues & Fixes Checklist

## Completed Fixes

### Issue 1: Iframe editing not working (original)
- [x] Made EDIT_INJECTION script robust by using `readyState` check instead of relying solely on `DOMContentLoaded`.

### Issue 2: Exiting edit mode changes/breaks images
- [x] Removed iframe reload on edit mode toggle. Now toggles via CSS class (`html.canvas-editing`) instead of rebuilding the blob URL.

### Issue 3: Design system card overlaps when generating new color scheme
- [x] `extractedTokens` cleared to `null` at start of both `planRedesign()` and `executeRedesign()`.

### Issue 4: Summary/Result panel disappears permanently when closed
- [x] ResultPanel now collapses to a small "Summary" pill button.

### Issue 5: Design System panel — Stitch-style theme editor
- [x] Seed color, palette generation, font selector, corner radius presets, live apply, extracted colors, localStorage persistence.

### Issue 6: DESIGN.md auto-generation
- [x] Auto-generated spec from current theme state, copy-to-clipboard, reactive updates.

### Issue 7: Design System DESIGN.md tab not scrollable
- [x] Added `onWheel stopPropagation` to DesignSystemCard.

### Issue 8: Zoom doesn't zoom from center of viewport
- [x] `zoomIn()` / `zoomOut()` now compute zoom centered on screen middle.

---

## Open Issues — Edit System (Full Audit)

### Issue 9: Auto-send useEffect has no dependency array (CRITICAL)
- [x] **File:** `ChatPanel.tsx` ~line 566
- [x] **Problem:** The auto-send `useEffect` that picks up `pendingAutoSendRef` has NO dependency array, so it runs on every render with a potentially stale `send()` closure.
- [x] **Fix:** Added `sendRef` that always points to latest `send` closure. Auto-send effect calls `sendRef.current(text)` instead of `send(text)`.

### Issue 10: Popup position is double-scaled (CRITICAL)
- [x] **File:** `ScreenCard.tsx`
- [x] **Fix:** Switched popup to `position: fixed` with screen-space coordinates. Now reads the iframe's `getBoundingClientRect()` and maps element coords to absolute screen position.

### Issue 11: Popup can render off-screen for elements near bottom of page (HIGH)
- [x] **File:** `ScreenCard.tsx`
- [x] **Fix:** Added `clampedX` and `clampedY` that keep popup within viewport bounds (`Math.min(popupX, window.innerWidth - 320)`, `Math.max(16, Math.min(popupY, window.innerHeight - 300))`).

### Issue 12: Canvas onPointerDown may intercept popup clicks (HIGH)
- [x] **File:** `ScreenCard.tsx`
- [x] **Fix:** Added `onPointerDown={e => e.stopPropagation()}` to the ElementEditPopup wrapper div. Canvas never sees popup interactions.

### Issue 13: Empty currentHtml is falsy — edit endpoint falls through (HIGH)
- [x] **File:** `ChatPanel.tsx`, `api-server/src/index.ts`
- [x] **Fix:** Frontend now throws if `!currentScreen?.html`. API check changed to `typeof b.currentHtml === "string" && b.currentHtml.length > 0`.

### Issue 14: setSelectedElement in useEffect dependency array (MEDIUM)
- [x] **File:** `ScreenCard.tsx`
- [x] **Fix:** Removed `setSelectedElement` from dependency array — zustand functions are stable refs.

### Issue 15: Inline edit blocks ALL clicks via capture-phase listener (MEDIUM)
- [x] **File:** `ScreenCard.tsx` EDIT_INJECTION
- [x] **Fix:** Changed `blockClicks` to only `stopPropagation` when click target is inside the editable element (`el.contains(ev.target)`). Clicks outside pass through normally, triggering blur → finish edit.

### Issue 16: Edit mode may need two clicks to activate (MEDIUM)
- [x] **File:** `ScreenCard.tsx`
- [x] **Fix:** Added `onPointerDown={e => e.stopPropagation()}` to all screen card action buttons (Edit, Variants, Delete). Canvas never starts a drag from button clicks.

### Issue 17: Wheel forwarding listener never cleaned up (LOW)
- [ ] **File:** `useCanvas.ts` ~line 311-345
- [ ] **Problem:** The `canvas-wheel` message listener is added in a useEffect but the useEffect already has a cleanup return. This is actually fine — the cleanup is at line 344. Non-issue on re-inspection.
- [ ] ~~**Fix:** Already has cleanup.~~ Resolved — not a bug.

---

## Open Issues — Generation Quality

### Issue 18: Generated pages too short / missing sections
- [ ] **Problem:** AI model generates pages with only 2-3 sections instead of matching the original site's 8+ sections. Content is sparse.
- [ ] **Root cause:** maxTokens was 16k (now 32k), prompts didn't enforce section count matching.
- [ ] **Fixes applied:** Increased maxTokens to 32k, added section counting from source HTML, prompts now say "original has X sections, yours MUST match."
- [ ] **Verify:** Check `docker compose logs api-server` for `finish_reason: "length"` (truncation) and section counts.

### Issue 19: Generated pages have narrow centered content
- [ ] **Problem:** Content renders in a narrow column instead of full-width sections with edge-to-edge backgrounds.
- [ ] **Fixes applied:** Added explicit LAYOUT rules to all prompts enforcing `w-full` backgrounds with `max-w-7xl mx-auto` inner content.
- [ ] **Verify:** Next generation should have full-bleed sections.

### Issue 20: Initial screen height too short before auto-measurement
- [x] **Problem:** `screenH` was set to 1200, cutting off pages before HEIGHT_SCRIPT could measure actual content.
- [x] **Fix:** Changed to 4000px initial height. HEIGHT_SCRIPT will auto-resize to actual content height.

---

## Priority Order for Fixing

1. **Issue 10** — Popup position (can't see popup = can't edit)
2. **Issue 11** — Popup off-screen for bottom elements
3. **Issue 12** — Canvas intercepting popup clicks
4. **Issue 9** — Auto-send stale closure
5. **Issue 13** — Empty currentHtml falsy check
6. **Issue 16** — Edit needs two clicks
7. **Issue 15** — Inline edit click blocking
8. **Issue 14** — Dependency array cleanup
9. **Issue 18/19** — Generation quality (prompt changes already applied, needs verification)

---

## Open Issues — Infinite Canvas System (Full Audit)

### Issue 21: Stale closures in canvas event callbacks (CRITICAL)
- [x] **File:** `useCanvas.ts`
- [x] **Fix:** Rewrote ALL canvas callbacks (onWheel, onPointerDown, onPointerMove, onPointerUp) to read fresh state via `useCanvasStore.getState()` instead of capturing `viewport` in closures. Removed `viewport` from all dependency arrays. Callbacks now have minimal deps (only `stopMomentum`, `spaceHeld`, `startMomentum`). Event listeners no longer detach/reattach on every viewport change.

### Issue 22: Drag coordinate calculation uses stale zoom (CRITICAL)
- [x] **File:** `useCanvas.ts`
- [x] **Fix:** `onPointerMove` now reads `useCanvasStore.getState().viewport.zoom` inside the handler. Drag works correctly at any zoom level even if zoom changes mid-drag. `onPointerMove` has empty dependency array `[]`.

### Issue 23: Zoom buttons zoom to window center, not canvas center (MEDIUM)
- [x] **File:** `canvas-store.ts`
- [x] **Fix:** Changed `cy` from `window.innerHeight / 2` to `48 + (window.innerHeight - 48) / 2` to account for 48px TopBar.

### Issue 24: Dot grid alignment wrong at negative viewport positions (MEDIUM)
- [x] **File:** `InfiniteCanvas.tsx`
- [x] **Fix:** Changed modulo from `viewport.x % period` to `((viewport.x % period) + period) % period` for correct wrapping at negative values.

### Issue 25: Pointer capture not released on tool change mid-drag (MEDIUM)
- [x] **File:** `useCanvas.ts`
- [x] **Fix:** Added `useEffect` that watches `activeTool` — resets `isPanning`, `isDragging`, `isMarking` to false and clears mark preview when tool changes.

### Issue 26: Momentum doesn't stop on tool change (LOW)
- [x] **File:** `useCanvas.ts`
- [x] **Fix:** Same `useEffect` as #25 calls `stopMomentum()` when `activeTool` changes.

### Issue 27: No bounds checking for screen dragging (LOW)
- [ ] **File:** `useCanvas.ts`
- [ ] **Problem:** Screens can be dragged to extreme coordinates making them unreachable. Low priority — undo recovers.

### Issue 28: Marks not cleared after undo/redo (LOW)
- [x] **File:** `canvas-store.ts`
- [x] **Fix:** Added `marks: []` to both `undo` and `redo` return objects.

## Canvas Fix Priority

1. **Issue 21 + 22** — Stale closures + stale zoom (root cause of glitches)
2. **Issue 23** — Zoom button center offset
3. **Issue 24** — Grid alignment at negative values
4. **Issue 25 + 26** — Tool change cleanup (pointer capture + momentum)
5. **Issue 27** — Drag bounds
6. **Issue 28** — Marks on undo

---

## Open Issues — Performance

### Issue 29: ComponentBrowser creates 326 iframes causing 5.8GB RAM crash (CRITICAL)
- [x] **File:** `ComponentBrowser.tsx` — `CompRow` component
- [x] **Fix:** Removed all iframes from `CompRow`. Replaced with lightweight category-colored swatch icons (no DOM, no Tailwind CDN, no blob URLs). Memory usage per row: ~0.5KB vs ~18MB before. Total savings: **~5.8GB**.

### Issue 30: Blob URLs leaked in CompRow thumbnails (HIGH)
- [x] **File:** `ComponentBrowser.tsx`
- [x] **Fix:** No longer applicable — CompRow no longer creates blob URLs (iframes removed entirely).

### Issue 31: Preview iframe blob URL leaked on component switch (MEDIUM)
- [x] **File:** `ComponentBrowser.tsx`
- [x] **Fix:** Added `prevBlobUrl` ref. Old blob URL is revoked via `URL.revokeObjectURL()` before creating new one. Cleanup function also revokes on unmount.

---

## Open Issues — Design System (Full Audit)

### Issue 32: DesignPanel doesn't apply color/font/radius changes to screens (CRITICAL)
- [x] **File:** `DesignPanel.tsx`
- [x] **Problem:** The side panel (opened via RightToolbar gear icon) calls `updateDesignSystem()` to update the store, but never calls `applyColorToScreens()`, `applyFontToScreens()`, or `applyRadiusToScreens()`. Changing any value in the panel updates the store/localStorage but screens on canvas keep old colors/fonts/radii. The DesignSystemCard (on-canvas card) does this correctly — DesignPanel does not.
- [x] **Fix:** Rewrote DesignPanel to use the same apply functions (`applyColorToScreens`, `applyFontToScreens`, `applyRadiusToScreens`) as DesignSystemCard. All changes now propagate to screens immediately.

### Issue 33: Frontend designSystem never forwarded to SDK for generation (CRITICAL)
- [x] **File:** `api-server/src/index.ts` line ~110-135
- [x] **Problem:** ChatPanel sends `designSystem: { colors, fonts, cornerRadius }` in the generate request body, but the API endpoint (`/screens/generate`) never calls `project.setDesignSystem()` with it. The SDK's `project.generate()` uses `this._designSystem` which is always `null` for fresh projects. So generated pages never receive the user's chosen design system. The design system the user configures is completely ignored during generation.
- [x] **Fix:** Added `project.setDesignSystem()` call in the API generate endpoint that maps the frontend's `CanvasDesignSystem` shape to the SDK's `DesignSystem` interface before calling `project.generate()`.

### Issue 34: Two divergent design system UIs (DesignPanel vs DesignSystemCard) (HIGH)
- [x] **File:** `DesignPanel.tsx`, `DesignSystemCard.tsx`
- [x] **Problem:** There are two completely separate design system editors with different feature sets, behavior, and font/theme lists.
- [x] **Fix:** Rewrote DesignPanel to match DesignSystemCard's UI — same 26 fonts, same 5 theme options with dropdown, same shade pickers, same radius options (including "None"/0px), same DESIGN.md tab with copy button. Removed redundant save button (auto-persists). Both UIs now behave identically.

### Issue 35: DesignPanel uses click-to-cycle for fonts and themes (MEDIUM)
- [x] **File:** `DesignPanel.tsx`
- [x] **Problem:** Fonts and color themes cycled through options on click. Only 6 fonts available.
- [x] **Fix:** Resolved by Issue 34 — now uses expandable font list (26 fonts) and theme dropdown.

### Issue 36: DesignPanel save button is redundant (LOW)
- [x] **File:** `DesignPanel.tsx`
- [x] **Problem:** `updateDesignSystem()` already auto-persists to localStorage. Save button was redundant.
- [x] **Fix:** Resolved by Issue 34 — save button removed.

### Issue 37: DesignPanel missing "None" (0px) corner radius option (LOW)
- [x] **File:** `DesignPanel.tsx`
- [x] **Problem:** Missing "0px" (None) radius option.
- [x] **Fix:** Resolved by Issue 34 — now has all 6 radius options including "None".

### Issue 38: DesignSystemCard Dropdown doesn't close on outside click (MEDIUM)
- [x] **File:** `DesignSystemCard.tsx` Dropdown component
- [x] **Problem:** The color theme `Dropdown` component had no click-away listener. Clicking elsewhere left the dropdown open.
- [x] **Fix:** Added transparent fixed overlay that closes dropdown on outside click (same pattern as TopBar export dropdown).

### Issue 39: DesignSystemCard has no close/dismiss button (MEDIUM)
- [x] **File:** `DesignSystemCard.tsx`
- [x] **Problem:** Once placed on canvas, the DesignSystemCard had no way to be dismissed by the user.
- [x] **Fix:** Added X close button in the card header that sets `extractedTokens` to `null`.

### Issue 40: DesignSystemCard is not draggable on canvas (LOW)
- [x] **File:** `DesignSystemCard.tsx`
- [x] **Problem:** The card was positioned at a fixed `(x, y)` and couldn't be moved. If it overlapped screens, user couldn't reposition it.
- [x] **Fix:** Added drag handling to the card header. Pointer events on the header div start a drag that updates `extractedTokens.x/y` in the store, accounting for canvas zoom level. Close button clicks are excluded from drag initiation.

## Design System Fix Priority

1. **Issue 33** — designSystem not forwarded to SDK (generation ignores design system entirely)
2. **Issue 32** — DesignPanel doesn't apply to screens (changes are cosmetic only)
3. **Issue 34** — Consolidate the two UIs (fixes 35, 36, 37 as side effects)
4. **Issue 38** — Dropdown click-away
5. **Issue 39** — Close button for card
6. **Issue 40** — Draggable card

---

## Open Issues — Editing System (Full Audit v2)

### Issue 41: Iframe message handlers don't filter by screen ID — cross-talk (CRITICAL)
- [x] **File:** `ScreenCard.tsx` lines 232-272
- [x] **Problem:** Message handlers processed events from ALL iframes, causing cross-talk (height/HTML overwrites between screens).
- [x] **Fix:** Added `e.source !== iframeRef.current?.contentWindow` guard to all three message handlers (`canvas-content-height`, `canvas-html-updated`, `canvas-element-select`). Each ScreenCard now only processes messages from its own iframe.

### Issue 42: No loading indicator during AI edit (HIGH)
- [x] **File:** `ScreenCard.tsx`, `ChatPanel.tsx`, `canvas-store.ts`
- [x] **Problem:** No visual feedback while AI edit was processing (3-8 seconds). User might think nothing happened.
- [x] **Fix:** Added `screenEditLoading` state to canvas store. `editExistingScreen()` sets it to the screen ID on start, clears on finish. ScreenCard shows a dark overlay with spinner and "Applying edit..." text while the edit is in flight.

### Issue 43: REFINE_SYSTEM prompt too terse — poor edit quality (HIGH)
- [x] **File:** `sdk/src/utils/prompts.ts`
- [x] **Problem:** Edit prompt was only 3 lines — AI could strip Tailwind CDN, truncate HTML, lose structure, add comments.
- [x] **Fix:** Expanded REFINE_SYSTEM to 15 explicit rules: preserve Tailwind CDN, return complete `<!DOCTYPE html>`, keep all images/sections, no truncation, no comments, target only the specified element, maintain full-width layout. Also documents the JSON input format.

### Issue 44: Edit endpoint sends entire page HTML to AI — wasteful (MEDIUM)
- [x] **Files:** `ScreenCard.tsx`, `ChatPanel.tsx`, `api-server/src/index.ts`, `sdk/src/utils/prompts.ts`
- [x] **Problem:** Every edit sent the FULL page HTML (30-100KB) to the AI and received the FULL page back. Slow, expensive, truncation risk.
- [x] **Fix:** Implemented section-level editing pipeline:
  1. `ElementEditPopup.sendAiEdit()` now passes `editContext` (element selector, section selector, section HTML) via `canvas-populate-chat` event
  2. `ChatPanel` captures `editContext` in `pendingEditContextRef` and forwards it through `send()` → `editExistingScreen()` → API request body
  3. API endpoint detects `sectionSelector` in request — extracts the matching section HTML using depth-counting tag parser, sends only the section to AI via new `REFINE_SECTION_SYSTEM` prompt, then splices the edited section back into the full page
  4. Falls back to full-page edit if section extraction fails
  - Token usage reduction: ~5-10x for targeted element edits (e.g., 2KB section vs 40KB full page)

### Issue 45: No undo for edits — history not pushed before edit (HIGH)
- [x] **File:** `ChatPanel.tsx` `editExistingScreen()` function
- [x] **Problem:** AI edits via `updateScreen()` lost the previous state — no way to undo.
- [x] **Fix:** Added `pushHistory()` call before `updateScreen()` in `editExistingScreen()`. Ctrl+Z now undoes AI edits.

### Issue 46: ReplacementBrowser preview blob URL never revoked (MEDIUM)
- [x] **File:** `ScreenCard.tsx` ReplacementBrowser component
- [x] **Problem:** Blob URLs created for each preview were never revoked — memory leak.
- [x] **Fix:** Added `prevBlobRef` to track and revoke previous blob URLs before creating new ones. Cleanup function also revokes on unmount.

### Issue 47: No way to exit edit mode via keyboard (MEDIUM)
- [x] **File:** `useCanvas.ts`
- [x] **Problem:** No keyboard shortcut to exit edit mode — had to click empty canvas or change tool.
- [x] **Fix:** Extended Escape key handler with priority chain: 1) exit edit mode if editing, 2) clear selected element if one exists, 3) deselect screen. Switches tool back to "select" when exiting edit mode.

### Issue 48: Variants button only adds chat message, doesn't auto-generate (MEDIUM)
- [x] **File:** `ScreenCard.tsx`
- [x] **Problem:** Variants button only added a chat message — didn't trigger generation. User had to manually send.
- [x] **Fix:** Changed to dispatch `canvas-populate-chat` event with `autoSend: true` (same pattern as AI edit). Now selects the screen and auto-triggers generation. Removed unused `addChatMessage` from ScreenCard.

## Editing Fix Priority

1. **Issue 41** — Cross-talk between screens (data corruption)
2. **Issue 45** — No undo for edits (data loss)
3. **Issue 42** — No loading indicator (UX confusion)
4. **Issue 43** — Poor edit prompt (quality)
5. **Issue 47** — Escape to exit edit mode (UX)
6. **Issue 48** — Variants button broken (feature)
7. **Issue 46** — Blob URL leak (memory)
8. **Issue 44** — Full HTML wasteful (optimization, future)

---

## Open Issues — Zoom System (Full Audit)

### Issue 49: Keyboard zoom (Ctrl+=/−) centers on wrong Y — ignores TopBar (MEDIUM)
- [x] **File:** `useCanvas.ts`
- [x] **Problem:** Keyboard zoom shortcuts used `window.innerHeight / 2` as center Y, ignoring the 48px TopBar. Zoom centered ~24px too high.
- [x] **Fix:** Changed Y to `48 + (window.innerHeight - 48) / 2` to match the store's `zoomIn()`/`zoomOut()` calculation.

### Issue 50: Ctrl+0 resets to 50% zoom instead of 100% (MEDIUM)
- [x] **File:** `useCanvas.ts`
- [x] **Problem:** `Ctrl+0` called `zoomTo(0.5)` (50%) instead of `zoomTo(1)` (100%).
- [x] **Fix:** Changed to `zoomTo(1)`.

### Issue 51: Zoom-to-fit ignores TopBar height in centering (LOW)
- [x] **File:** `RightToolbar.tsx`
- [x] **Problem:** Zoom-to-fit used full `window.innerHeight` for centering, not accounting for 48px TopBar.
- [x] **Fix:** Changed to `vh = window.innerHeight - 48` for available height, and offset pan Y by 48px.

### Issue 52: Zoom-to-fit button only appears with 2+ screens (MEDIUM)
- [x] **File:** `RightToolbar.tsx`
- [x] **Problem:** Button hidden when only 1 screen on canvas. User couldn't fit-to-view after panning away.
- [x] **Fix:** Changed condition from `screens.length > 1` to `screens.length > 0`.

### Issue 53: Iframe wheel event coordinate mapping at non-1x zoom (NON-ISSUE)
- [x] **File:** `useCanvas.ts`
- [x] **Problem:** Investigated whether iframe wheel forwarding coordinates were incorrect at canvas zoom != 1.
- [x] **Result:** Verified correct. `getBoundingClientRect()` captures compound transforms (SCALE * canvasZoom), and `iframe.offsetWidth` returns the layout width (1440). The formula `iframeScale = rect.width / offsetWidth` correctly gives `0.3 * canvasZoom`, which properly maps iframe-internal coordinates to screen space. Not a bug.

### Issue 54: Hardcoded SCALE 0.3 in zoom-to-fit calculation (LOW)
- [x] **File:** `RightToolbar.tsx`
- [x] **Problem:** Magic number `0.3` needed to match ScreenCard's SCALE constant.
- [x] **Fix:** Extracted to named `SCREEN_SCALE` constant with comment indicating it must match ScreenCard. Also extracted `TOPBAR` constant.

## Zoom Fix Priority

1. **Issue 50** — Ctrl+0 resets to wrong zoom level
2. **Issue 49** — Keyboard zoom ignores TopBar
3. **Issue 52** — Zoom-to-fit hidden with 1 screen
4. **Issue 51** — Zoom-to-fit TopBar offset
5. **Issue 54** — Hardcoded SCALE constant

---

## Open Issues — Memory Usage (Full Audit)

### Issue 55: Undo history stores full HTML copies of every screen (CRITICAL)
- [x] **File:** `canvas-store.ts`
- [x] **Problem:** `pushHistory()` had no depth limit — unbounded growth of screen snapshots (each with 50-500KB HTML).
- [x] **Fix:** Capped history depth at 20 entries. Oldest entries are dropped when limit is exceeded, freeing their HTML references for GC.

### Issue 56: React.StrictMode causes double mount/unmount in development (HIGH)
- [x] **File:** `main.tsx`
- [x] **Problem:** `<React.StrictMode>` double-invoked all effects — every iframe, event listener, and blob URL was created/destroyed/recreated on mount.
- [x] **Fix:** Removed `<React.StrictMode>` wrapper. Codebase has proper cleanup patterns already.

### Issue 57: Global store exposure prevents garbage collection (MEDIUM)
- [x] **File:** `main.tsx`
- [x] **Problem:** `(window as any).__canvas = useCanvasStore` pinned entire store to global scope.
- [x] **Fix:** Removed the line entirely. Also removed unused `React` and `useCanvasStore` imports.

### Issue 58: Console.log calls hold references to large objects (MEDIUM)
- [x] **File:** `ChatPanel.tsx`
- [x] **Problem:** `console.log` of full SSE response text and JSON.stringify of design tokens retained large objects in browser memory.
- [x] **Fix:** Removed large-object console.log calls (plan response, parsed events, design tokens). Error logs retained.

### Issue 59: RightToolbar screenshot blob URL never revoked (MEDIUM)
- [x] **File:** `RightToolbar.tsx`
- [x] **Problem:** `takeScreenshot()` created blob URLs but never revoked them — each leaked 50-500KB.
- [x] **Fix:** Added `setTimeout(() => URL.revokeObjectURL(url), 5000)` after opening in new tab.

### Issue 60: ScreenCard component not memoized (MEDIUM)
- [x] **File:** `ScreenCard.tsx`
- [x] **Problem:** All ScreenCards re-rendered on any canvas state change (viewport, tool, selection). Heavy component with iframe, event listeners, DOM queries.
- [x] **Fix:** Wrapped ScreenCard in `React.memo()`. Only re-renders when its `screen` prop changes (shallow compare on the object reference).

## Memory Fix Priority

1. **Issue 55** — Undo history (15MB+ duplication)
2. **Issue 56** — StrictMode double-render (200-400MB dev overhead)
3. **Issue 60** — ScreenCard memoization (GC pressure)
4. **Issue 57** — Global store exposure
5. **Issue 58** — Console.log large objects
6. **Issue 59** — Screenshot blob URL leak

---

### Issue 61: "Replace From Library" breaks zoom/pan (CRITICAL)
- [x] **File:** `ScreenCard.tsx` — `replaceWithComponent()` and `ReplacementBrowser` `onClose`
- [x] **Problem:** After using "Replace From Library" (select element → edit → replace from library), `setEditingScreen(null)` was never called. The iframe stayed in edit mode with `canvas-editing` CSS class active, which intercepts all wheel events via `postMessage`. This blocked zoom and pan across the entire canvas. Closing the ReplacementBrowser without selecting also left edit mode stuck.
- [x] **Fix:** Added `setEditingScreen(null)` to both `replaceWithComponent()` (after successful replacement) and `onClose` callback (when user cancels). Also added `setSelectedElement(null)` to `onClose` for full cleanup.

---

## Editing System Review (Round 2)

### Issue 62: querySelector fails on Tailwind selectors with colons (CRITICAL)
- [ ] **File:** `ScreenCard.tsx` — EDIT_INJECTION `canvas-inline-edit`, `canvas-update-text`, `canvas-replace-section` handlers
- [ ] **Problem:** `getSelector()` now uses `CSS.escape()` to build selectors (e.g. `section.w-full.bg-white > h1.text-4xl.md\:text-5xl`), but the `document.querySelector()` calls in the message handlers receive the escaped selector string and may fail if the escaping doesn't round-trip correctly. The `try/catch` silently swallows errors so inline edit, text update, and section replace all fail with no feedback.
- [x] **Fix:** Replaced raw `querySelector` with `safeQuery()` wrapper that logs warnings/errors. Added `CSS.escape()` in `getSelector()` for class names.

### Issue 63: Selection not cleared after inline edit (HIGH)
- [ ] **File:** `ScreenCard.tsx` — `finishEdit()` in EDIT_INJECTION
- [ ] **Problem:** After inline editing completes, `window.getSelection()` is not cleared. Text remains visually selected, causing confusion and accidental overwrites.
- [x] **Fix:** Added `window.getSelection().removeAllRanges()` in `finishEdit()`.

### Issue 64: Edit event listeners always active regardless of edit mode (HIGH)
- [ ] **File:** `ScreenCard.tsx` — EDIT_INJECTION `mousemove`, `click`, `mouseleave` listeners
- [ ] **Problem:** The injected `mousemove` (overlay), `click` (element select), and `mouseleave` listeners run continuously inside the iframe even when not in edit mode. They are gated by `html.canvas-editing` CSS class for pointer-events, but the listeners still fire and process events unnecessarily.
- [x] **Fix:** Added `isEditMode()` helper that checks `canvas-editing` class. All three handlers (mousemove, click, mouseleave) now early-return when not in edit mode.

### Issue 65: Blur handler race condition allows double finishEdit (HIGH)
- [ ] **File:** `ScreenCard.tsx` — `onBlur` handler in EDIT_INJECTION inline edit
- [ ] **Problem:** The blur handler uses a 100ms `setTimeout` to check `document.activeElement`. If `canvas-inline-edit` is sent twice before the first finishes, two blur handlers stack, both calling `finishEdit()` — causing duplicate `sendCleanHtml()` calls and `canvas-inline-edit-done` messages.
- [x] **Fix:** Added `finished` flag in `finishEdit()` — returns immediately if already finished. Added `inlineEditActive` module-level flag to prevent second `canvas-inline-edit` while one is active.

### Issue 66: screenEditLoading not cleared on early return (MEDIUM)
- [ ] **File:** `ChatPanel.tsx` — `editExistingScreen()`
- [ ] **Problem:** If `project?.id` is null, the function returns early on line 506 without clearing any loading state. If a previous edit set `screenEditLoading`, it persists forever.
- [x] **Fix:** The early return already happens before `setScreenEditLoading` is called (line 506 vs 512), so loading state is never orphaned. Added warning log on early return for visibility.

### Issue 67: No loading check before inline edit (MEDIUM)
- [ ] **File:** `ScreenCard.tsx` — `startInlineEdit()`
- [ ] **Problem:** If the screen is currently loading an AI edit (`screenEditLoading === screen.id`), clicking "Edit Text" will start an inline edit that conflicts with the pending AI edit.
- [x] **Fix:** `startInlineEdit()` now returns early if `screenEditLoading === screen.id`.

### Issue 68: Selector uses only 2 classes — often not unique (MEDIUM)
- [ ] **File:** `ScreenCard.tsx` — `getSelector()` in EDIT_INJECTION
- [ ] **Problem:** `slice(0, 2)` takes only the first 2 CSS classes. With Tailwind, elements commonly have 5-10 classes. Two classes often aren't enough to uniquely identify an element, causing `querySelector` to match the wrong one.
- [x] **Fix:** Now picks up to 4 non-responsive classes first, then fills with responsive ones if needed. Prioritizes stable classes (no `:`) for more reliable selectors.

### Issue 69: Section preview truncated at 500 chars (MEDIUM)
- [ ] **File:** `ScreenCard.tsx` — EDIT_INJECTION click handler
- [ ] **Problem:** `section.outerHTML.slice(0, 500)` sends truncated, invalid HTML as the section preview. This is only used for display in the popup, but it's misleading.
- [x] **Fix:** Now sends opening tag + first 200 chars of text content instead of truncated outerHTML.

### Issue 70: Add diagnostic logging to edit pipeline (ENHANCEMENT)
- [ ] **File:** `ScreenCard.tsx`, `ChatPanel.tsx`
- [ ] **Problem:** When editing fails, there's no visibility into why. Need logging at each step: element selection → popup action → message dispatch → API call → response → HTML update.
- [x] **Fix:** Added `[edit]` and `[inline-edit]` console logging at: element selection, querySelector calls (via `safeQuery`), text updates, section replacements, inline edit start/finish, and ChatPanel edit dispatch.

### Issue 71: sendCleanHtml strips ALL outline styles — removes legitimate CSS (HIGH)
- [x] **File:** `ScreenCard.tsx` — `sendCleanHtml()` in EDIT_INJECTION
- [x] **Problem:** `clone.querySelectorAll('[style*="outline"]')` matches any element with "outline" in its style attribute and clears it. This deletes user-intentional outline styles (e.g. `outline: 2px solid red` for accessibility focus indicators).
- [x] **Fix:** Now only clears outlines containing `#7c5cfc` (the editor's purple highlight color).

### Issue 72: Section extraction regex fragile with attribute ordering (HIGH)
- [x] **File:** `api-server/src/index.ts` — `extractSectionHtml()`
- [x] **Problem:** The lookahead regex assumes classes appear in a single `class="..."` attribute and fails if the HTML has unusual attribute ordering, escaped quotes, or multiple class attributes. Falls back silently to full-page edit.
- [x] **Fix:** Rewrote to find all opening tags of the type first, then validate classes by parsing the class attribute separately. Also handles `nth-of-type` and unescapes CSS.escape backslashes from selectors.

### Issue 73: String.replace() only replaces first duplicate section (MEDIUM)
- [x] **File:** `api-server/src/index.ts` — section splice after AI edit
- [x] **Problem:** `fullHtml.replace(sectionHtml, result.html)` uses `String.replace()` which only replaces the first occurrence. If identical sections exist, the wrong one may be replaced.
- [x] **Fix:** Now uses `indexOf` to find the exact position and `slice()` to splice, avoiding ambiguity with duplicate sections.

### Issue 75: sendCleanHtml removes ALL script tags including user scripts (MEDIUM)
- [x] **File:** `ScreenCard.tsx` — `sendCleanHtml()` in EDIT_INJECTION
- [x] **Problem:** `clone.querySelectorAll('script').forEach(s => s.remove())` strips all scripts including user analytics, carousel init scripts, and third-party integrations. Only injected canvas scripts should be removed.
- [x] **Fix:** Now only removes scripts matching known injected patterns (`canvas-wheel`, `canvas-element-select`, `canvas-content-height`, `render-diag`, `__canvas_overlay`, `img.onerror`). External scripts (`src` attribute) and Tailwind CDN are preserved.

### Issue 76: API edit returns 200 with empty/undefined HTML — silent failure (MEDIUM)
- [x] **File:** `api-server/src/index.ts` — edit endpoint, `ChatPanel.tsx` — `editExistingScreen()`
- [x] **Problem:** If the AI returns empty HTML, the API still responds with 200. Frontend `updateScreen()` sets the screen to empty content. Chat shows "Updated the screen with your changes" despite failure.
- [x] **Fix:** Server now returns 500 if HTML is empty or under 50 chars. Client validates response length before updating and shows error message on failure.

---

## Component Library / Replace From Library Review

### Issue 77: ReplacementBrowser fetch error silently swallowed (HIGH)
- [x] **File:** `ScreenCard.tsx` — `ReplacementBrowser` fetch effect
- [x] **Problem:** `.catch(() => {})` silently swallows all errors from `fetch("/api/components")`. If the fetch fails (network error, server down, malformed JSON), user sees an empty component list with no error message.
- [x] **Fix:** Added `fetchError` state. Errors are logged and displayed in the UI with red text. HTTP status errors are also caught.

### Issue 78: Selected component not reset on category/search change (HIGH)
- [x] **File:** `ScreenCard.tsx` — `ReplacementBrowser` filter effect
- [x] **Problem:** When switching categories, `selected` still points to a component from the previous category. The condition `if (result.length > 0 && !selected)` never triggers because `selected` is already set. Preview shows wrong component. User may accidentally replace with wrong content.
- [x] **Fix:** Now always sets `selected` to `result[0]` (or null) whenever the filtered list changes.

### Issue 79: Replace fails silently if selector doesn't match DOM (HIGH)
- [x] **File:** `ScreenCard.tsx` — `replaceWithComponent()` and EDIT_INJECTION `canvas-replace-section` handler
- [x] **Problem:** If `safeQuery()` returns null (element no longer exists, selector escaped incorrectly), the replacement silently fails. No feedback to user — modal closes, edit mode exits, but nothing changed.
- [x] **Fix:** EDIT_INJECTION handler now sends `canvas-replace-result` message back to parent with `success` flag and error details. `replaceWithComponent()` listens for the result and logs errors.

### Issue 80: No empty state when zero components match filter (MEDIUM)
- [x] **File:** `ScreenCard.tsx` — `ReplacementBrowser` component list
- [x] **Problem:** When no components match the search/category filter, the list area is blank with no message. User doesn't know if components are loading or if none exist.
- [x] **Fix:** Shows contextual "No components found" message with search term or category name when `filtered.length === 0`.

### Issue 81: Category suggestion map incomplete (MEDIUM)
- [x] **File:** `ScreenCard.tsx` — `ReplacementBrowser` sectionCategoryMap
- [x] **Problem:** Only maps `nav→navbar`, `header→navbar`, `footer→footer`. All other section types default to "all" which shows 326+ components — overwhelming.
- [x] **Fix:** Updated: `header→hero` (more likely), added `article→cards`. Future improvement: infer category from section class names.

### Issue 82: No validation of component HTML before replacement (LOW)
- [x] **File:** `ScreenCard.tsx` — `replaceWithComponent()`
- [x] **Problem:** Component HTML from the seed file is sent directly to the iframe without validation. Malformed HTML could corrupt the page.
- [x] **Fix:** Added validation that HTML is non-empty and at least 10 chars before sending to iframe.

### Issue 83: Selecting element to edit scrolls iframe to bottom (HIGH)
- [x] **File:** `ScreenCard.tsx` — EDIT_INJECTION click handler, `ElementEditPopup`, `canvas-store.ts`
- [x] **Problem:** On tall pages (27K px), `getBoundingClientRect()` returns large y values for elements far down the page. The popup position was calculated from these element rects, causing it to appear at the clamped bottom of the screen — far from where the user clicked.
- [x] **Fix:** Now sends `clickX`/`clickY` (the actual click position in iframe coordinates) via postMessage. Popup positions itself relative to the click point mapped to screen coords, not the element's document-level rect. Added `clickX`/`clickY` to `ElementSelection` interface.

### Issue 84: Edit popup UI is generic and bland (ENHANCEMENT)
- [x] **File:** `ScreenCard.tsx` — `ElementEditPopup` component
- [x] **Problem:** The edit popup is a plain box with text links. It should be a more polished, spatial interaction — like a radial wheel or floating pill bar that appears at the click point.
- [x] **Fix:** Redesigned as "Stacked Cards + Glow" — radial glow backdrop, slide-right hover with accent border, zoom-adaptive sizing (scales 0.75x–1.1x based on viewport.zoom), smart positioning (flips left/right based on screen edge), red dismiss button. Removed old EditOption component.
