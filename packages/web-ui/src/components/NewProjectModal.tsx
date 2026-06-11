import React, { useState, useEffect, useRef } from "react";

// Sage palette for command palette (design C)
const P = {
  bg: "var(--np-bg, #F8FAF8)",
  sf: "var(--np-sf, #F0F4F0)",
  card: "var(--np-card, #FFFFFF)",
  bd: "var(--np-bd, #DDE5DD)",
  t1: "var(--np-t1, #1A1F1A)",
  t2: "var(--np-t2, #5C6B5C)",
  t3: "var(--np-t3, #94A394)",
  ac: "var(--np-ac, #4A7C59)",
};

type StartType = "blank" | "generate" | "url" | "screenshot";

const OPTIONS: Array<{ id: StartType; title: string; desc: string; shortcut: string; icon: React.ReactNode }> = [
  {
    id: "blank", title: "Blank Canvas", desc: "Empty project, start designing", shortcut: "B",
    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 9h18"/></svg>,
  },
  {
    id: "generate", title: "AI Generate", desc: "Describe a UI, get screens", shortcut: "G",
    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
  },
  {
    id: "url", title: "Redesign from URL", desc: "Extract design system, rebuild", shortcut: "U",
    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 12a9 9 0 0 1-9 9m9-9a9 9 0 0 0-9-9m9 9H3m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9"/></svg>,
  },
  {
    id: "screenshot", title: "From Screenshot", desc: "Upload an image to recreate", shortcut: "S",
    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>,
  },
];

interface Props {
  open: boolean;
  onClose: () => void;
  onCreate: (title: string, startType: StartType) => void;
}

export function NewProjectModal({ open, onClose, onCreate }: Props) {
  const [name, setName] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setName("");
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key === "ArrowDown") { e.preventDefault(); setActiveIndex(i => Math.min(i + 1, OPTIONS.length - 1)); }
      if (e.key === "ArrowUp") { e.preventDefault(); setActiveIndex(i => Math.max(i - 1, 0)); }
      if (e.key === "Enter") {
        e.preventDefault();
        const title = name.trim() || "Untitled";
        onCreate(title, OPTIONS[activeIndex].id);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, name, activeIndex, onCreate, onClose]);

  if (!open) return null;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 300, background: "rgba(0,0,0,0.25)",
      display: "flex", alignItems: "center", justifyContent: "center",
      backdropFilter: "blur(4px)",
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        width: 440, borderRadius: 14, background: P.card,
        border: `1px solid ${P.bd}`, boxShadow: "0 16px 48px rgba(0,0,0,0.1)",
        overflow: "hidden", animation: "npFadeIn 0.2s ease",
      }}>
        {/* Input row */}
        <div style={{
          display: "flex", alignItems: "center", gap: 10, padding: "14px 16px",
          borderBottom: `1px solid ${P.bd}`,
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={P.t3} strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          <input
            ref={inputRef}
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Project name..."
            style={{
              flex: 1, border: "none", outline: "none", background: "transparent",
              fontSize: 15, fontWeight: 500, color: P.t1, fontFamily: "inherit",
            }}
          />
          <span style={{
            padding: "3px 7px", borderRadius: 4, background: P.sf, fontSize: 10,
            fontWeight: 600, color: P.t3, border: `1px solid ${P.bd}`,
          }}>Enter</span>
        </div>

        {/* Section label */}
        <div style={{
          padding: "8px 16px", fontSize: 10, fontWeight: 600, color: P.t3,
          textTransform: "uppercase", letterSpacing: "0.04em",
        }}>Start from</div>

        {/* Options */}
        <div style={{ padding: "4px 8px" }}>
          {OPTIONS.map((opt, i) => (
            <div
              key={opt.id}
              onClick={() => {
                const title = name.trim() || "Untitled";
                onCreate(title, opt.id);
              }}
              onMouseEnter={() => setActiveIndex(i)}
              style={{
                display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
                borderRadius: 8, cursor: "pointer", transition: "background 0.1s",
                background: i === activeIndex ? P.sf : "transparent",
              }}
            >
              <div style={{
                width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                background: i === activeIndex ? `${P.ac}15` : P.sf,
                display: "flex", alignItems: "center", justifyContent: "center",
                color: i === activeIndex ? P.ac : P.t3,
              }}>{opt.icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: P.t1 }}>{opt.title}</div>
                <div style={{ fontSize: 11, color: P.t3 }}>{opt.desc}</div>
              </div>
              <span style={{ fontSize: 10, color: P.t3 }}>{opt.shortcut}</span>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{
          padding: "10px 16px", borderTop: `1px solid ${P.bd}`, background: P.sf,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          fontSize: 11, color: P.t3,
        }}>
          <div style={{ display: "flex", gap: 10 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
              <kbd style={{ padding: "1px 5px", borderRadius: 3, background: P.card, border: `1px solid ${P.bd}`, fontSize: 9, fontWeight: 600 }}>&uarr;&darr;</kbd> navigate
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
              <kbd style={{ padding: "1px 5px", borderRadius: 3, background: P.card, border: `1px solid ${P.bd}`, fontSize: 9, fontWeight: 600 }}>&crarr;</kbd> select
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
              <kbd style={{ padding: "1px 5px", borderRadius: 3, background: P.card, border: `1px solid ${P.bd}`, fontSize: 9, fontWeight: 600 }}>esc</kbd> cancel
            </span>
          </div>
          <span>30-day auto-cleanup</span>
        </div>
      </div>

      <style>{`
        @keyframes npFadeIn {
          from { opacity: 0; transform: scale(0.96) translateY(8px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  );
}

export type { StartType };
