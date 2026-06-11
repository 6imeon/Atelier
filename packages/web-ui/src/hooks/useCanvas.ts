import { useCallback, useEffect, useRef, useState } from "react";
import { useCanvasStore } from "../stores/canvas-store";

// --- Zoom-to-point helper ---
// Adjusts viewport so the zoom centers on (cx, cy) in screen space
function zoomAtPoint(cx: number, cy: number, newZoom: number) {
  const { viewport, panTo, zoomTo } = useCanvasStore.getState();
  const clamped = Math.max(0.1, Math.min(3, newZoom));
  const scale = clamped / viewport.zoom;
  const nx = cx - (cx - viewport.x) * scale;
  const ny = cy - (cy - viewport.y) * scale;
  panTo(nx, ny);
  zoomTo(clamped);
}

// --- Momentum decay ---
const FRICTION = 0.92;
const MIN_VELOCITY = 0.5;

// Live mark preview state — shared so InfiniteCanvas can render it
export interface MarkPreview {
  x: number; y: number; width: number; height: number;
}

export function useCanvas(canvasRef: React.RefObject<HTMLDivElement | null>) {
  const viewport = useCanvasStore(s => s.viewport);
  const activeTool = useCanvasStore(s => s.activeTool);
  const ps = useRef({
    isPanning: false, isDragging: false, dragId: null as string | null,
    isMarking: false, markStartX: 0, markStartY: 0,
    sx: 0, sy: 0, svx: 0, svy: 0, ssx: 0, ssy: 0,
  });
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [markPreview, setMarkPreview] = useState<MarkPreview | null>(null);

  // Momentum state
  const momentum = useRef({ vx: 0, vy: 0, lastX: 0, lastY: 0, lastTime: 0, raf: 0 });

  // Batched screen-drag state: track pending position in a ref, flush once per frame
  const dragRaf = useRef<number>(0);
  const pendingDrag = useRef<{ id: string; x: number; y: number } | null>(null);

  // Touch gesture state
  const touch = useRef({
    active: false,
    pointers: new Map<number, { x: number; y: number }>(),
    initialDist: 0,
    initialZoom: 0,
    initialMidX: 0,
    initialMidY: 0,
    initialVpX: 0,
    initialVpY: 0,
  });

  const startMomentum = useCallback(() => {
    cancelAnimationFrame(momentum.current.raf);
    const tick = () => {
      const m = momentum.current;
      if (Math.abs(m.vx) < MIN_VELOCITY && Math.abs(m.vy) < MIN_VELOCITY) return;
      const { viewport: vp, panTo } = useCanvasStore.getState();
      panTo(vp.x + m.vx, vp.y + m.vy);
      m.vx *= FRICTION;
      m.vy *= FRICTION;
      m.raf = requestAnimationFrame(tick);
    };
    momentum.current.raf = requestAnimationFrame(tick);
  }, []);

  const stopMomentum = useCallback(() => {
    cancelAnimationFrame(momentum.current.raf);
    momentum.current.vx = 0;
    momentum.current.vy = 0;
  }, []);

  const cycleScreen = useCallback((dir: 1 | -1) => {
    const { screens, selectedScreenId, selectScreen: sel } = useCanvasStore.getState();
    if (screens.length === 0) return;
    if (!selectedScreenId) { sel(screens[0].id); return; }
    const idx = screens.findIndex(s => s.id === selectedScreenId);
    const next = (idx + dir + screens.length) % screens.length;
    sel(screens[next].id);
  }, []);

  // --- Wheel: zoom-to-cursor + pan ---
  // ALL callbacks read fresh state from getState() to avoid stale closures
  const onWheel = useCallback((e: WheelEvent) => {
    // Let DesignSystemCard and other scrollable overlays handle their own scrolling
    if ((e.target as HTMLElement)?.closest?.("[data-design-card]")) return;
    e.preventDefault();
    stopMomentum();
    const vp = useCanvasStore.getState().viewport;
    if (e.ctrlKey || e.metaKey) {
      const newZoom = vp.zoom * (1 + -e.deltaY * 0.01);
      zoomAtPoint(e.clientX, e.clientY, newZoom);
    } else {
      useCanvasStore.getState().panTo(vp.x - e.deltaX, vp.y - e.deltaY);
    }
  }, [stopMomentum]);

  // --- Pointer down: behavior depends on active tool ---
  const onPointerDown = useCallback((e: PointerEvent) => {
    // Let DesignSystemCard handle its own pointer events (buttons, inputs, etc.)
    if ((e.target as HTMLElement)?.closest?.("[data-design-card]")) return;
    stopMomentum();
    const store = useCanvasStore.getState();
    const tool = store.activeTool;
    const vp = store.viewport;
    const el = (e.target as HTMLElement).closest("[data-screen-id]") as HTMLElement | null;

    const startPan = () => {
      ps.current = { ...ps.current, isPanning: true, sx: e.clientX, sy: e.clientY, svx: vp.x, svy: vp.y };
      momentum.current.lastX = e.clientX;
      momentum.current.lastY = e.clientY;
      momentum.current.lastTime = performance.now();
      (e.currentTarget as HTMLElement)?.setPointerCapture(e.pointerId);
    };

    // Middle click or space always pans
    if (e.button === 1 || (e.button === 0 && spaceHeld)) { startPan(); return; }

    // Pan tool: always pan
    if (e.button === 0 && tool === "pan") { store.selectScreen(null); startPan(); return; }

    // Edit tool: click screen to open inline edit prompt
    if (e.button === 0 && tool === "edit") {
      const target = e.target as HTMLElement;
      if (target.closest("button") || target.closest("input") || target.closest("textarea") || target.tagName === "BUTTON" || target.tagName === "INPUT" || target.tagName === "TEXTAREA") {
        return;
      }
      if (el) {
        const id = el.dataset.screenId!;
        store.selectScreen(id);
        if (store.editingScreenId !== id) {
          store.setEditingScreen(id);
        }
      } else {
        store.setEditingScreen(null);
        store.selectScreen(null);
        startPan();
      }
      return;
    }

    // Mark tool: draw rectangle annotation
    if (e.button === 0 && tool === "mark") {
      ps.current = {
        ...ps.current, isMarking: true,
        markStartX: (e.clientX - vp.x) / vp.zoom,
        markStartY: (e.clientY - vp.y) / vp.zoom,
        sx: e.clientX, sy: e.clientY,
      };
      (e.currentTarget as HTMLElement)?.setPointerCapture(e.pointerId);
      return;
    }

    // Select tool: click screen to select+drag, empty to pan
    if (e.button === 0 && el) {
      const id = el.dataset.screenId!;
      const scr = store.screens.find(s => s.id === id);
      if (scr) {
        store.selectScreen(id);
        ps.current = { ...ps.current, isDragging: true, dragId: id, sx: e.clientX, sy: e.clientY, ssx: scr.x, ssy: scr.y };
        (e.currentTarget as HTMLElement)?.setPointerCapture(e.pointerId);
      }
      return;
    }
    if (e.button === 0) { store.selectScreen(null); startPan(); }
  }, [spaceHeld, stopMomentum]);

  // --- Pointer move: pan with velocity tracking / drag screen ---
  const onPointerMove = useCallback((e: PointerEvent) => {
    const p = ps.current;
    if (p.isPanning) {
      const now = performance.now();
      const dt = now - momentum.current.lastTime;
      if (dt > 0) {
        momentum.current.vx = (e.clientX - momentum.current.lastX) * (16 / dt);
        momentum.current.vy = (e.clientY - momentum.current.lastY) * (16 / dt);
      }
      momentum.current.lastX = e.clientX;
      momentum.current.lastY = e.clientY;
      momentum.current.lastTime = now;
      useCanvasStore.getState().panTo(p.svx + e.clientX - p.sx, p.svy + e.clientY - p.sy);
      return;
    }
    if (p.isDragging && p.dragId) {
      const zoom = useCanvasStore.getState().viewport.zoom; // Fresh zoom
      pendingDrag.current = {
        id: p.dragId,
        x: p.ssx + (e.clientX - p.sx) / zoom,
        y: p.ssy + (e.clientY - p.sy) / zoom,
      };
      if (!dragRaf.current) {
        dragRaf.current = requestAnimationFrame(() => {
          dragRaf.current = 0;
          const d = pendingDrag.current;
          if (d) {
            useCanvasStore.getState().updateScreen(d.id, { x: d.x, y: d.y });
          }
        });
      }
    }
    if (p.isMarking) {
      const vp = useCanvasStore.getState().viewport;
      const endX = (e.clientX - vp.x) / vp.zoom;
      const endY = (e.clientY - vp.y) / vp.zoom;
      setMarkPreview({
        x: Math.min(p.markStartX, endX),
        y: Math.min(p.markStartY, endY),
        width: Math.abs(endX - p.markStartX),
        height: Math.abs(endY - p.markStartY),
      });
    }
  }, []); // No deps — reads all state from getState()

  // --- Pointer up: release + start momentum ---
  const onPointerUp = useCallback((e: PointerEvent) => {
    const p = ps.current;
    const wasPanning = p.isPanning;
    if (p.isMarking) {
      const vp = useCanvasStore.getState().viewport;
      const endX = (e.clientX - vp.x) / vp.zoom;
      const endY = (e.clientY - vp.y) / vp.zoom;
      const x = Math.min(p.markStartX, endX);
      const y = Math.min(p.markStartY, endY);
      const w = Math.abs(endX - p.markStartX);
      const h = Math.abs(endY - p.markStartY);
      if (w > 10 && h > 10) {
        useCanvasStore.getState().addMark({
          id: `mark_${Date.now()}`, x, y, width: w, height: h,
          color: "#E8FF59",
        });
      }
    }
    // Flush any pending batched drag update
    if (dragRaf.current) {
      cancelAnimationFrame(dragRaf.current);
      dragRaf.current = 0;
    }
    const finalDrag = pendingDrag.current;
    if (finalDrag) {
      useCanvasStore.getState().updateScreen(finalDrag.id, { x: finalDrag.x, y: finalDrag.y });
      pendingDrag.current = null;
    }
    ps.current = { ...ps.current, isPanning: false, isDragging: false, dragId: null, isMarking: false };
    setMarkPreview(null);
    if (wasPanning) startMomentum();
  }, [startMomentum]);

  // --- Touch handlers for pinch-to-zoom + two-finger pan ---
  const onTouchStart = useCallback((e: TouchEvent) => {
    stopMomentum();
    const t = touch.current;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const ct = e.changedTouches[i];
      t.pointers.set(ct.identifier, { x: ct.clientX, y: ct.clientY });
    }

    if (t.pointers.size >= 2) {
      e.preventDefault();
      const pts = [...t.pointers.values()];
      const dx = pts[1].x - pts[0].x;
      const dy = pts[1].y - pts[0].y;
      t.initialDist = Math.hypot(dx, dy);
      t.initialZoom = useCanvasStore.getState().viewport.zoom;
      t.initialMidX = (pts[0].x + pts[1].x) / 2;
      t.initialMidY = (pts[0].y + pts[1].y) / 2;
      const vp = useCanvasStore.getState().viewport;
      t.initialVpX = vp.x;
      t.initialVpY = vp.y;
      t.active = true;
    }
  }, [stopMomentum]);

  const onTouchMove = useCallback((e: TouchEvent) => {
    const t = touch.current;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const ct = e.changedTouches[i];
      t.pointers.set(ct.identifier, { x: ct.clientX, y: ct.clientY });
    }

    if (t.active && t.pointers.size >= 2) {
      e.preventDefault();
      const pts = [...t.pointers.values()];
      const dx = pts[1].x - pts[0].x;
      const dy = pts[1].y - pts[0].y;
      const dist = Math.hypot(dx, dy);
      const midX = (pts[0].x + pts[1].x) / 2;
      const midY = (pts[0].y + pts[1].y) / 2;

      const scale = dist / t.initialDist;
      const newZoom = Math.max(0.1, Math.min(3, t.initialZoom * scale));
      const panDx = midX - t.initialMidX;
      const panDy = midY - t.initialMidY;
      const zoomScale = newZoom / t.initialZoom;
      const nx = t.initialMidX - (t.initialMidX - t.initialVpX) * zoomScale + panDx;
      const ny = t.initialMidY - (t.initialMidY - t.initialVpY) * zoomScale + panDy;

      useCanvasStore.getState().panTo(nx, ny);
      useCanvasStore.getState().zoomTo(newZoom);
    }
  }, []);

  const onTouchEnd = useCallback((e: TouchEvent) => {
    const t = touch.current;
    for (let i = 0; i < e.changedTouches.length; i++) {
      t.pointers.delete(e.changedTouches[i].identifier);
    }
    if (t.pointers.size < 2) {
      t.active = false;
    }
  }, []);

  // --- Reset drag state + stop momentum on tool change ---
  useEffect(() => {
    stopMomentum();
    if (dragRaf.current) { cancelAnimationFrame(dragRaf.current); dragRaf.current = 0; }
    pendingDrag.current = null;
    const p = ps.current;
    if (p.isDragging || p.isPanning || p.isMarking) {
      ps.current = { ...ps.current, isPanning: false, isDragging: false, dragId: null, isMarking: false };
      setMarkPreview(null);
    }
  }, [activeTool, stopMomentum]);

  // --- Keyboard shortcuts ---
  useEffect(() => {
    const isTyping = () => {
      const tag = document.activeElement?.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || (document.activeElement as HTMLElement)?.isContentEditable;
    };
    const kd = (e: KeyboardEvent) => {
      if (isTyping()) return;
      if (e.code === "Space" && !e.repeat) { setSpaceHeld(true); e.preventDefault(); }
      if ((e.ctrlKey||e.metaKey) && e.key === "0") {
        e.preventDefault();
        useCanvasStore.getState().panTo(0, 0);
        useCanvasStore.getState().zoomTo(1);
      }
      if ((e.ctrlKey||e.metaKey) && e.key === "=") {
        e.preventDefault();
        const vp = useCanvasStore.getState().viewport;
        zoomAtPoint(window.innerWidth / 2, 48 + (window.innerHeight - 48) / 2, vp.zoom * 1.2);
      }
      if ((e.ctrlKey||e.metaKey) && e.key === "-") {
        e.preventDefault();
        const vp = useCanvasStore.getState().viewport;
        zoomAtPoint(window.innerWidth / 2, 48 + (window.innerHeight - 48) / 2, vp.zoom / 1.2);
      }
      if ((e.ctrlKey||e.metaKey) && e.key === "z") {
        e.preventDefault();
        if (e.shiftKey) useCanvasStore.getState().redo();
        else useCanvasStore.getState().undo();
      }
      if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); cycleScreen(1); }
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); cycleScreen(-1); }
      if (e.key === "Escape") {
        const store = useCanvasStore.getState();
        if (store.editingScreenId) {
          // Exit edit mode first
          store.setEditingScreen(null);
          store.setTool("select");
        } else if (store.selectedElement) {
          store.setSelectedElement(null);
        } else {
          store.selectScreen(null);
        }
      }
      if ((e.key === "Delete" || e.key === "Backspace") && !e.ctrlKey && !e.metaKey) {
        const { selectedScreenId, removeScreen } = useCanvasStore.getState();
        if (selectedScreenId) { e.preventDefault(); removeScreen(selectedScreenId); }
      }
    };
    const ku = (e: KeyboardEvent) => { if (e.code === "Space") setSpaceHeld(false); };
    window.addEventListener("keydown", kd); window.addEventListener("keyup", ku);
    return () => { window.removeEventListener("keydown", kd); window.removeEventListener("keyup", ku); };
  }, [cycleScreen]); // Only depends on cycleScreen — all state reads use getState()

  // --- Forward wheel events from iframes ---
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === "canvas-wheel") {
        stopMomentum();
        let screenX = e.data.clientX;
        let screenY = e.data.clientY;
        const sourceIframe = e.source as Window | null;
        if (sourceIframe) {
          const iframes = document.querySelectorAll("iframe");
          for (const iframe of iframes) {
            if (iframe.contentWindow === sourceIframe) {
              const rect = iframe.getBoundingClientRect();
              const iframeScale = rect.width / iframe.offsetWidth;
              screenX = rect.left + e.data.clientX * iframeScale;
              screenY = rect.top + e.data.clientY * iframeScale;
              break;
            }
          }
        }
        if (e.data.ctrlKey || e.data.metaKey) {
          const vp = useCanvasStore.getState().viewport;
          const newZoom = vp.zoom * (1 + -e.data.deltaY * 0.01);
          zoomAtPoint(screenX, screenY, newZoom);
        } else {
          const vp = useCanvasStore.getState().viewport;
          useCanvasStore.getState().panTo(vp.x - e.data.deltaX, vp.y - e.data.deltaY);
        }
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [stopMomentum]);

  // --- Attach all listeners ---
  useEffect(() => {
    const el = canvasRef.current; if (!el) return;
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("pointerdown", onPointerDown as any);
    el.addEventListener("pointermove", onPointerMove as any);
    el.addEventListener("pointerup", onPointerUp as any);
    el.addEventListener("touchstart", onTouchStart, { passive: false });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd);
    el.addEventListener("touchcancel", onTouchEnd);
    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("pointerdown", onPointerDown as any);
      el.removeEventListener("pointermove", onPointerMove as any);
      el.removeEventListener("pointerup", onPointerUp as any);
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [canvasRef, onWheel, onPointerDown, onPointerMove, onPointerUp, onTouchStart, onTouchMove, onTouchEnd]);

  // Cleanup momentum + drag RAF on unmount
  useEffect(() => { return () => { cancelAnimationFrame(momentum.current.raf); cancelAnimationFrame(dragRaf.current); }; }, []);

  return { spaceHeld, viewport, markPreview };
}
