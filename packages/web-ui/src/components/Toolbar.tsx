import { useCanvasStore } from "../stores/canvas-store";

export function Toolbar() {
  const { viewport, zoomIn, zoomOut, resetViewport, isGenerating } = useCanvasStore();
  const pct = Math.round(viewport.zoom * 100);

  return (
    <div style={{
      position: "fixed", bottom: 12, right: 64, zIndex: 90,
      display: "flex", alignItems: "center", gap: 8,
    }}>
      {/* Generation status */}
      {isGenerating && (
        <div style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "6px 12px", borderRadius: 8,
          background: "var(--chrome-surface)", border: "1px solid var(--chrome-border)",
          fontSize: 11, fontWeight: 500, color: "var(--accent-text)",
        }}>
          <div style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--accent)", animation: "pulse 2s infinite" }} />
          Generating...
        </div>
      )}

      {/* Zoom */}
      <div style={{
        display: "flex", alignItems: "center", gap: 2,
        background: "var(--chrome-surface)", borderRadius: 8, padding: 3,
        border: "1px solid var(--chrome-border)",
      }}>
        <ZoomBtn onClick={zoomOut} label="Zoom out">&minus;</ZoomBtn>
        <button onClick={resetViewport} aria-label="Reset zoom" title="Reset view" style={{
          padding: "0 6px", fontSize: 11, fontWeight: 500, color: "var(--chrome-text-secondary)",
          background: "transparent", border: "none", cursor: "pointer",
          fontFamily: "inherit", minWidth: 36, textAlign: "center",
        }}>{pct}%</button>
        <ZoomBtn onClick={zoomIn} label="Zoom in">+</ZoomBtn>
      </div>
    </div>
  );
}

function ZoomBtn({ onClick, label, children }: { onClick: () => void; label: string; children: React.ReactNode }) {
  return (
    <button onClick={onClick} aria-label={label} title={label} style={{
      width: 28, height: 28, borderRadius: 6, border: "none",
      background: "transparent", color: "var(--chrome-text-muted)", cursor: "pointer",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: 14, transition: "all 0.15s",
    }}>{children}</button>
  );
}
