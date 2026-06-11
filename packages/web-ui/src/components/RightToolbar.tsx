import { useState } from "react";
import { useCanvasStore, CanvasTool } from "../stores/canvas-store";

const TOOLS: Array<{ id: CanvasTool; label: string; icon: React.ReactNode }> = [
  { id: "select", label: "Select", icon: <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/> },
  { id: "pan", label: "Pan", icon: <><path d="M18 11V6a2 2 0 0 0-4 0"/><path d="M14 10V4a2 2 0 0 0-4 0v6"/><path d="M10 10V3a2 2 0 0 0-4 0v9"/><path d="M22 12a8 8 0 0 1-8 8h-1a8 8 0 0 1-8-8V9"/></> },
  { id: "edit", label: "Edit — click a screen to edit", icon: <><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></> },
  { id: "mark", label: "Mark — draw to annotate", icon: <><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></> },
];

export function RightToolbar() {
  const { activeTool, setTool, toggleDesignPanel, designPanelOpen, screens, selectedScreenId, clearMarks, marks, viewport, zoomTo, panTo } = useCanvasStore();

  const takeScreenshot = async () => {
    const target = selectedScreenId ? screens.find(s => s.id === selectedScreenId) : null;
    const toCapture = target ? [target] : screens;
    if (toCapture.length === 0) return;
    for (const s of toCapture) {
      const blob = new Blob([s.html], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
      // Revoke after delay — new tab will have loaded by then
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    }
  };

  return (
    <div style={{
      position: "fixed", right: 16, top: "50%", transform: "translateY(-50%)",
      zIndex: 90, display: "flex", flexDirection: "column", gap: 4,
      background: "var(--bg-surface)", borderRadius: 14, padding: 4,
      border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)",
      animation: "fadeUp 0.4s ease",
    }}>
      {TOOLS.map(t => (
        <ToolButton key={t.id} label={t.label}
          active={activeTool === t.id}
          onClick={() => setTool(t.id)}
          icon={t.icon} />
      ))}

      <div style={{ height: 1, background: "var(--border)", margin: "2px 6px" }} />

      <ToolButton label="Preview in new tab" active={false}
        onClick={takeScreenshot}
        icon={<><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></>} />

      {screens.length > 0 && (
        <ToolButton label="Zoom to fit all screens" active={false}
          onClick={() => {
            if (screens.length === 0) return;
            const SCREEN_SCALE = 0.3; // Must match ScreenCard SCALE
            const TOPBAR = 48;
            const minX = Math.min(...screens.map(s => s.x));
            const minY = Math.min(...screens.map(s => s.y));
            const maxX = Math.max(...screens.map(s => s.x + s.width * SCREEN_SCALE));
            const maxY = Math.max(...screens.map(s => s.y + s.height * SCREEN_SCALE));
            const contentW = maxX - minX + 80;
            const contentH = maxY - minY + 80;
            const vw = window.innerWidth;
            const vh = window.innerHeight - TOPBAR; // Available canvas height
            const zoom = Math.min(vw / contentW, vh / contentH, 1) * 0.85;
            useCanvasStore.getState().zoomTo(zoom);
            useCanvasStore.getState().panTo(
              vw / 2 - (minX + contentW / 2) * zoom,
              TOPBAR + vh / 2 - (minY + contentH / 2) * zoom,
            );
          }}
          icon={<><path d="M15 3h6v6"/><path d="M9 21H3v-6"/><path d="M21 3l-7 7"/><path d="M3 21l7-7"/></>} />
      )}

      <ToolButton label="Design System" active={designPanelOpen}
        onClick={toggleDesignPanel}
        icon={<><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></>} />

      {marks.length > 0 && (
        <ToolButton label="Clear all marks" active={false}
          onClick={clearMarks}
          icon={<><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>} />
      )}

      <div style={{ height: 1, background: "var(--border)", margin: "2px 6px" }} />

      {/* Zoom indicator — click to reset to 100% */}
      <button onClick={() => { zoomTo(1); panTo(0, 0); }}
        title="Reset zoom to 100%"
        style={{
          height: 28, borderRadius: 8, border: "none",
          background: Math.abs(viewport.zoom - 1) < 0.01 ? "transparent" : "var(--accent-bg)",
          color: Math.abs(viewport.zoom - 1) < 0.01 ? "var(--text-muted)" : "var(--accent)",
          cursor: "pointer", fontSize: 11, fontWeight: 600, fontFamily: "inherit",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: "0 6px", transition: "all 0.15s",
        }}>
        {Math.round(viewport.zoom * 100)}%
      </button>
    </div>
  );
}

function ToolButton({ label, active, onClick, icon }: {
  label: string; active?: boolean; onClick: () => void; icon: React.ReactNode;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div style={{ position: "relative" }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}>
      <button onClick={onClick} aria-label={label} style={{
        width: 36, height: 36, borderRadius: 10, border: "none",
        background: active ? "var(--accent-bg)" : "transparent",
        color: active ? "var(--accent)" : "var(--text-muted)",
        cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
        transition: "all 0.15s",
      }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">{icon}</svg>
      </button>

      {/* Tooltip */}
      {hovered && (
        <div style={{
          position: "absolute", right: "calc(100% + 10px)", top: "50%", transform: "translateY(-50%)",
          padding: "6px 10px", borderRadius: 8, whiteSpace: "nowrap",
          background: "var(--text-primary)", color: "var(--bg)",
          fontSize: 12, fontWeight: 500, pointerEvents: "none",
          boxShadow: "var(--shadow-md)",
          animation: "fadeUp 0.12s ease",
        }}>
          {label}
        </div>
      )}
    </div>
  );
}
