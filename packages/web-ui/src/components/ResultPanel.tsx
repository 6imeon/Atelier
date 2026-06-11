import { useState } from "react";
import { useCanvasStore } from "../stores/canvas-store";

export function ResultPanel() {
  const { chatMessages, screens, agentTasks } = useCanvasStore();
  const [open, setOpen] = useState(true);
  const [copied, setCopied] = useState(false);

  const completedTasks = agentTasks.filter(t => t.status === "done");
  const lastUserMsg = [...chatMessages].reverse().find(m => m.role === "user")?.content;
  const lastAssistantMsg = [...chatMessages].reverse().find(m => m.role === "assistant")?.content;

  if (completedTasks.length === 0) return null;

  const copyPrompt = async () => {
    if (!lastUserMsg) return;
    await navigator.clipboard.writeText(lastUserMsg);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  // Collapsed pill mode
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{
          position: "fixed", top: 56, left: 8, zIndex: 90,
          display: "flex", alignItems: "center", gap: 6,
          padding: "8px 14px", borderRadius: 20,
          background: "var(--chrome-bg)", border: "1px solid var(--chrome-border)",
          boxShadow: "var(--shadow-md)", cursor: "pointer",
          color: "var(--chrome-text)", fontSize: 12, fontWeight: 500,
          transition: "all 0.2s ease",
        }}
        onMouseEnter={e => { e.currentTarget.style.boxShadow = "var(--shadow-lg)"; e.currentTarget.style.borderColor = "var(--accent)"; }}
        onMouseLeave={e => { e.currentTarget.style.boxShadow = "var(--shadow-md)"; e.currentTarget.style.borderColor = "var(--chrome-border)"; }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
        Summary
        <span style={{
          width: 6, height: 6, borderRadius: "50%", background: "var(--accent)", flexShrink: 0,
        }} />
      </button>
    );
  }

  // Expanded panel
  return (
    <div style={{
      position: "fixed", top: 56, left: 8, bottom: 80, width: 280, zIndex: 90,
      background: "var(--chrome-bg)", borderRadius: 12,
      border: "1px solid var(--chrome-border)", boxShadow: "var(--shadow-lg)",
      display: "flex", flexDirection: "column", overflow: "hidden",
      animation: "slideIn 0.3s ease",
    }}>
      {/* Close → collapse to pill */}
      <div style={{ position: "absolute", top: 8, right: 8, zIndex: 1 }}>
        <button onClick={() => setOpen(false)} aria-label="Collapse" style={{
          width: 24, height: 24, borderRadius: 6, border: "none",
          background: "transparent", color: "var(--chrome-text-muted)", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
        {lastUserMsg && (
          <div style={{
            padding: "10px 12px", marginBottom: 12, borderRadius: 8,
            background: "var(--chrome-surface)", border: "1px solid var(--chrome-border)",
          }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
              <div style={{ width: 16, height: 16, borderRadius: 4, background: "var(--accent)", opacity: 0.7, flexShrink: 0, marginTop: 2 }} />
              <span style={{ fontSize: 12, color: "var(--chrome-text)", lineHeight: 1.5 }}>{lastUserMsg}</span>
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 8, paddingLeft: 24 }}>
              <button onClick={copyPrompt} aria-label="Copy prompt" title={copied ? "Copied!" : "Copy prompt"} style={{
                background: "none", border: "none", color: copied ? "#22c55e" : "var(--chrome-text-muted)", cursor: "pointer", padding: 0,
              }}>
                {copied ? (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
                ) : (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                )}
              </button>
            </div>
          </div>
        )}

        <div style={{ fontSize: 13, color: "var(--chrome-text-secondary)", lineHeight: 1.7 }}>
          {lastAssistantMsg && <p style={{ marginBottom: 12 }}>{lastAssistantMsg}</p>}

          {screens.length > 0 && (
            <>
              <p style={{ marginBottom: 8 }}>Here's a summary of what I've created:</p>
              <ul style={{ paddingLeft: 16, margin: 0 }}>
                {screens.map(s => (
                  <li key={s.id} style={{ marginBottom: 10 }}>
                    <strong style={{ color: "var(--chrome-text)" }}>{s.prompt.slice(0, 40)}:</strong>{" "}
                    A {s.deviceType.toLowerCase()} screen generated from your prompt.
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
