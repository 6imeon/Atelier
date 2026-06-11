# Zoom & Scroll — Review Notes

## Current Architecture

Atelier uses a custom infinite canvas with transform-based zoom (`translate + scale` on a container div). The browser's native zoom/scroll is overridden on the canvas area.

### How Zoom Works Today

| Input | On Canvas | On Iframe (edit mode) | On Chat Panel | On Other UI |
|---|---|---|---|---|
| Ctrl/Cmd + Scroll | Canvas zoom-to-cursor | Forwarded to canvas zoom | **Browser zoom (BUG)** | **Browser zoom (BUG)** |
| Regular Scroll | Canvas pan | Forwarded to canvas pan | Panel scroll | **Canvas pan bleeds through (BUG)** |
| Pinch (trackpad/touch) | Canvas zoom + pan | Not forwarded (BUG) | **Browser zoom (BUG)** | **Browser zoom (BUG)** |
| Ctrl+=/- keys | Canvas zoom (center) | Canvas zoom (center) | Canvas zoom (center) | Canvas zoom (center) |
| Ctrl+0 | Reset viewport | Reset viewport | Reset viewport | Reset viewport |

### Key Files

- `hooks/useCanvas.ts` — Main wheel/touch/keyboard handlers, momentum, zoom-to-point
- `stores/canvas-store.ts` — Viewport state (x, y, zoom), clamped 0.1x–3x
- `components/InfiniteCanvas.tsx` — CSS transform layer, `touchAction: "none"`, canvas ref
- `components/ScreenCard.tsx` — Iframe scale (0.3x), wheel forwarding script (edit mode only), pointer-events toggle
- `components/ChatPanel.tsx` — No wheel prevention, no scroll isolation
- `index.html` — `body { overflow: hidden }`, standard viewport meta (no `user-scalable=no`)

---

## Issues Found

### Issue 1: Ctrl+Scroll on Chat Panel triggers browser zoom
**Severity:** High
**What happens:** When cursor is over the chat panel and user does Ctrl+Scroll (or pinch on trackpad), the browser zooms the entire page instead of the canvas.
**Root cause:** The canvas wheel handler is attached only to `canvasRef` (the InfiniteCanvas div). The ChatPanel sits outside this div, so wheel events on it go to the browser default. There is no global `wheel` event prevention.
**Impact:** The entire page zooms, fonts get huge/tiny, layout breaks. User has to Cmd+0 to reset.

### Issue 2: Scroll on Chat Panel bleeds to canvas when panel content is at top/bottom
**Severity:** Medium
**What happens:** When the chat panel's scrollable area reaches its scroll boundary (top or bottom), further scroll events propagate to the parent — which is the canvas. This causes unwanted canvas panning.
**Root cause:** No `overscroll-behavior: contain` on the chat panel, and no `stopPropagation` on wheel events within the panel.

### Issue 3: Iframe scroll in view mode (non-edit)
**Severity:** Medium
**What happens:** In view mode, the iframe has `pointer-events: none` and `overflow: hidden`, so wheel events pass through to the canvas — this works correctly. BUT the iframe content may be taller than the visible area and the user has no way to scroll through it.
**Root cause:** `overflow: hidden` prevents scrolling inside the iframe. The only way to see more content is to zoom in on the canvas, but the iframe still shows from the top.

### Issue 4: Trackpad pinch in edit mode not forwarded
**Severity:** Medium
**What happens:** In edit mode, the injected `wheelBlock` script intercepts wheel events and forwards them. However, trackpad pinch gestures generate wheel events with `ctrlKey: true` — these ARE forwarded correctly. But native touch pinch (on touch devices) is NOT intercepted because the iframe doesn't have `touchAction: "none"` or touch event forwarding.
**Root cause:** Only wheel events are forwarded from iframe, not touch events. Touch pinch on a touch device inside an iframe in edit mode would trigger browser zoom on the iframe content.

### Issue 5: Zoom-to-fit button may conflict with zoom clamp
**Severity:** Low
**What happens:** The "Zoom to fit all screens" button in RightToolbar calculates a zoom level and calls `zoomTo()`, which clamps to 0.1–3x. If screens are very spread out, the calculated zoom might be < 0.1 and get clamped, meaning the user can't see all screens.
**Root cause:** Hard clamp in `zoomTo: Math.max(0.1, Math.min(3, z))`.

### Issue 6: No zoom level indicator
**Severity:** Low (UX)
**What happens:** User has no visual feedback about current zoom level. They don't know if they're at 50%, 100%, or 200%.
**Root cause:** No zoom indicator UI element exists.

### Issue 7: Forwarded iframe wheel coordinates are in iframe space, not screen space
**Severity:** Medium
**What happens:** When wheel events are forwarded from the iframe via postMessage, `clientX` and `clientY` are relative to the iframe's viewport, not the browser window. The `zoomAtPoint()` function expects screen-space coordinates. This means zoom-to-cursor in edit mode zooms toward the wrong point.
**Root cause:** `e.clientX/clientY` inside the iframe are local to the iframe, but `zoomAtPoint` uses them as if they're window coordinates.

---

## Checklist

### Critical Fixes
- [x] **Prevent browser zoom globally** — Global wheel listener in App.tsx prevents Ctrl+Scroll browser zoom everywhere.
- [x] **Isolate chat panel scroll** — Added `overscroll-behavior: contain` to chat toast and agent log scrollable containers.
- [x] **Fix iframe wheel coordinate mapping** — Forwarded wheel events now map iframe-local clientX/clientY to screen space using iframe bounding rect + scale.

### Important Improvements
- [ ] **Add touch event forwarding in iframe edit mode** — Inject touch event listeners alongside wheel listeners in the iframe's `wheelBlock` script. Forward `touchstart/touchmove/touchend` via postMessage so pinch-to-zoom works on touch devices in edit mode.
- [x] **Add zoom level indicator** — Shows current zoom % in right toolbar. Click to reset to 100%. Highlights when not at 100%.
- [x] **Prevent browser zoom on the entire app** — Updated viewport meta with `maximum-scale=1.0, user-scalable=no`. Global Ctrl+wheel prevention via App.tsx.

### Nice to Have
- [ ] **Zoom slider in toolbar** — A small slider or +/- buttons for precise zoom control.
- [ ] **Smooth zoom animation** — Animate zoom transitions instead of instant jumps (use requestAnimationFrame to lerp).
- [ ] **Lower zoom floor for many screens** — Consider lowering min zoom from 0.1 to 0.05 for users with many screens.
- [ ] **Scroll-to-reveal in iframe** — When zoomed in enough on a screen, allow scrolling within the iframe content (currently always overflow:hidden).
- [ ] **Double-click to zoom** — Double-click on canvas to zoom in, double-click again to zoom out (common in design tools).

---

## Architecture Notes

### Event Flow Diagram
```
User scrolls/pinches
       |
       v
  Is cursor over canvas div?
  YES ──> useCanvas wheel handler ──> preventDefault ──> zoomAtPoint / panTo
  NO  ──> Is cursor over chat panel?
          YES ──> Panel scrolls (or browser zoom if Ctrl held) ← BUG
          NO  ──> Browser default (zoom/scroll) ← BUG
```

### Recommended Fix for Browser Zoom
```typescript
// In App.tsx or main.tsx — prevent browser zoom globally
useEffect(() => {
  const handler = (e: WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault(); // Prevent browser zoom everywhere
    }
  };
  document.addEventListener("wheel", handler, { passive: false });
  return () => document.removeEventListener("wheel", handler);
}, []);
```

### Recommended Fix for Chat Scroll Isolation
```css
.chat-scroll-container {
  overscroll-behavior: contain; /* Prevents scroll chaining to parent */
}
```
