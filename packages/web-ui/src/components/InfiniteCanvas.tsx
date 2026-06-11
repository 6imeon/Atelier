import { useRef, useState, useCallback, useMemo } from "react";
import { useCanvasStore, type AtelierExport, type CanvasScreen } from "../stores/canvas-store";
import { useCanvas } from "../hooks/useCanvas";
import { ScreenCard } from "./ScreenCard";
import { DesignSystemCard } from "./DesignSystemCard";

/** Check if a screen is visible in the current viewport (with 1-screen buffer). */
function isScreenVisible(screen: CanvasScreen, viewport: { x: number; y: number; zoom: number }, containerW: number, containerH: number): boolean {
  const SCALE = 0.3;
  const sw = screen.width * SCALE;
  const sh = screen.height * SCALE;
  // Screen's position in viewport pixel space
  const sx = screen.x * viewport.zoom + viewport.x;
  const sy = screen.y * viewport.zoom + viewport.y;
  const sew = sw * viewport.zoom;
  const seh = sh * viewport.zoom;
  // Buffer: 1 screen width/height in each direction
  const bx = sew;
  const by = seh;
  return (
    sx + sew + bx > 0 &&
    sx - bx < containerW &&
    sy + seh + by > 0 &&
    sy - by < containerH
  );
}

function EditOverlay() {
  const { editingScreenId, setEditingScreen, screens, addChatMessage } = useCanvasStore();
  const [editPrompt, setEditPrompt] = useState("");
  const screen = screens.find(s => s.id === editingScreenId);
  if (!screen) return null;

  const submit = () => {
    const text = editPrompt.trim();
    if (!text) return;
    addChatMessage("user", `Edit screen "${screen.prompt.slice(0, 40)}": ${text}`);
    setEditPrompt("");
    setEditingScreen(null);
  };

  const SCALE = 0.3;
  return (
    <div style={{
      position: "absolute", left: screen.x, top: screen.y + screen.height * SCALE + 40,
      zIndex: 10, animation: "fadeUp 0.15s ease",
    }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 6,
        padding: "8px 10px 8px 14px", borderRadius: 12,
        background: "var(--chrome-surface)", border: "1px solid var(--chrome-border)",
        boxShadow: "var(--shadow-lg)", minWidth: 280,
      }}>
        <input value={editPrompt} onChange={e => setEditPrompt(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") submit(); if (e.key === "Escape") setEditingScreen(null); }}
          placeholder="Describe your edit..."
          autoFocus
          style={{
            flex: 1, border: "none", outline: "none", fontSize: 13, fontFamily: "inherit",
            color: "var(--chrome-text)", background: "transparent",
          }} />
        <button onClick={submit} disabled={!editPrompt.trim()} style={{
          width: 28, height: 28, borderRadius: 8, border: "none", flexShrink: 0,
          background: editPrompt.trim() ? "var(--accent)" : "transparent",
          color: editPrompt.trim() ? "white" : "var(--chrome-text-muted)",
          cursor: editPrompt.trim() ? "pointer" : "default",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </button>
        <button onClick={() => setEditingScreen(null)} style={{
          width: 28, height: 28, borderRadius: 8, border: "none",
          background: "transparent", color: "var(--chrome-text-muted)", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
    </div>
  );
}

function MarkOverlay({ mark }: { mark: { id: string; x: number; y: number; width: number; height: number; color: string } }) {
  const { removeMark } = useCanvasStore();
  return (
    <div style={{
      position: "absolute", left: mark.x, top: mark.y, width: mark.width, height: mark.height,
      border: `2px solid ${mark.color}`, borderRadius: 4,
      background: `${mark.color}10`, pointerEvents: "auto",
    }}>
      <button onClick={() => removeMark(mark.id)} style={{
        position: "absolute", top: -10, right: -10, width: 20, height: 20, borderRadius: "50%",
        background: mark.color, border: "none", color: "#000", cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700,
      }}>x</button>
    </div>
  );
}

export function InfiniteCanvas() {
  const canvasRef = useRef<HTMLDivElement>(null);
  const { screens, viewport, activeTool, marks, extractedTokens } = useCanvasStore();
  const { markPreview } = useCanvas(canvasRef);
  const [dragOver, setDragOver] = useState(false);

  // Viewport culling: only mount iframes for visible screens
  const containerW = canvasRef.current?.clientWidth ?? window.innerWidth;
  const containerH = canvasRef.current?.clientHeight ?? window.innerHeight;
  const visibleIds = useMemo(() => {
    const set = new Set<string>();
    for (const s of screens) {
      if (isScreenVisible(s, viewport, containerW, containerH)) set.add(s.id);
    }
    return set;
  }, [screens, viewport.x, viewport.y, viewport.zoom, containerW, containerH]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const hasFile = Array.from(e.dataTransfer.items).some(
      item => item.kind === "file"
    );
    if (hasFile) setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    // Only clear when leaving the canvas itself, not child elements
    if (e.currentTarget === e.target) setDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (!file?.name.endsWith(".atelier")) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string) as AtelierExport;
        const store = useCanvasStore.getState();
        if (store.screens.length > 0) {
          const ok = confirm(
            `Import "${data.project.title}"?\n\nThis will replace the current project.\n${data.screens.length} screen${data.screens.length !== 1 ? "s" : ""} will be loaded.`
          );
          if (!ok) return;
        }
        store.importProject(data);
      } catch (err) {
        alert(`Failed to import: ${(err as Error).message}`);
      }
    };
    reader.readAsText(file);
  }, []);

  const cursors = { select: "default", pan: "grab", edit: "crosshair", mark: "crosshair" } as const;

  return (
    <div ref={canvasRef}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{
      width: "100%", height: "100%", overflow: "hidden", position: "relative", background: "var(--canvas-bg)",
      cursor: cursors[activeTool] || "default", touchAction: "none",
    }}>
      {/* Drop overlay */}
      {dragOver && (
        <div style={{
          position: "absolute", inset: 0, zIndex: 50,
          background: "rgba(99, 102, 241, 0.08)",
          border: "2px dashed rgba(99, 102, 241, 0.4)",
          display: "flex", alignItems: "center", justifyContent: "center",
          pointerEvents: "none",
        }}>
          <div style={{
            padding: "16px 28px", borderRadius: 12,
            background: "var(--chrome-surface)", border: "1px solid var(--chrome-border)",
            boxShadow: "var(--shadow-lg)",
            fontSize: 14, fontWeight: 500, color: "var(--chrome-text)",
          }}>
            Drop .atelier file to import
          </div>
        </div>
      )}

      {/* Dot grid */}
      <div className="canvas-dot-grid" style={{
        position: "absolute", inset: 0,
        backgroundSize: `${Math.max(24 * viewport.zoom, 1)}px ${Math.max(24 * viewport.zoom, 1)}px`,
        backgroundPosition: (() => {
          const spacing = Math.max(24 * viewport.zoom, 1);
          const px = ((viewport.x % spacing) + spacing) % spacing;
          const py = ((viewport.y % spacing) + spacing) % spacing;
          return `${isFinite(px) ? px : 0}px ${isFinite(py) ? py : 0}px`;
        })(),
      }} />

      {/* Transform layer */}
      <div style={{
        position: "absolute",
        transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
        transformOrigin: "0 0",
      }}>
        {screens.map(s => <ScreenCard key={s.id} screen={s} isVisible={visibleIds.has(s.id)} />)}
        {marks.map(m => <MarkOverlay key={m.id} mark={m} />)}
        {/* Live preview while drawing a mark */}
        {markPreview && markPreview.width > 2 && markPreview.height > 2 && (
          <div style={{
            position: "absolute",
            left: markPreview.x, top: markPreview.y,
            width: markPreview.width, height: markPreview.height,
            border: "2px solid #E8FF59",
            borderRadius: 4,
            background: "rgba(232, 255, 89, 0.08)",
            pointerEvents: "none",
          }} />
        )}
        {extractedTokens && <DesignSystemCard x={extractedTokens.x} y={extractedTokens.y} tokens={extractedTokens.tokens} />}
        <EditOverlay />
      </div>

      {/* Empty state */}
      {screens.length === 0 && (
        <div style={{
          position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
          pointerEvents: "none",
        }}>
          <div style={{ textAlign: "center", maxWidth: 360, animation: "fadeUp 0.6s ease" }}>
            <div style={{
              width: 56, height: 56, margin: "0 auto 20px", borderRadius: 16,
              background: "var(--chrome-surface)", border: "1px solid var(--chrome-border)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--chrome-text-muted)" strokeWidth="1.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
            </div>
            <div style={{ fontSize: 16, fontWeight: 600, color: "var(--chrome-text)", marginBottom: 8 }}>
              What would you like to design?
            </div>
            <div style={{ fontSize: 13, color: "var(--chrome-text-muted)", lineHeight: 1.6 }}>
              Describe a UI in the chat and Atelier will generate it here.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
