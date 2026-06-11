import { useState, useEffect, useRef, useCallback } from "react";
import { useCanvasStore } from "../stores/canvas-store";

interface UIComponent {
  id: string;
  category: string;
  name: string;
  description: string;
  html: string;
  tags: string[];
  source: string;
  adaptability: string;
  quality: number;
  usageCount: number;
}

const CATEGORIES = [
  "all", "hero", "features", "cards", "navbar", "footer", "cta",
  "carousel", "banner", "stats", "forms", "gallery", "team", "modal", "sidebar", "faq",
];

const API = "";

type DeviceMode = "desktop" | "tablet" | "mobile";
const DEVICE_WIDTHS: Record<DeviceMode, string> = {
  desktop: "100%",
  tablet: "768px",
  mobile: "375px",
};

export function ComponentBrowser({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [components, setComponents] = useState<UIComponent[]>([]);
  const [filtered, setFiltered] = useState<UIComponent[]>([]);
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<UIComponent | null>(null);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<{ total: number; byCategory: Record<string, number> } | null>(null);
  const [device, setDevice] = useState<DeviceMode>("desktop");
  const previewRef = useRef<HTMLIFrameElement>(null);

  // Fetch components on open
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setLoading(true);
    Promise.all([
      fetch(`${API}/api/components`, { signal: controller.signal }).then(r => r.json()),
      fetch(`${API}/api/components/stats`, { signal: controller.signal }).then(r => r.json()),
    ]).then(([data, statsData]) => {
      const comps = data.components || [];
      setComponents(comps);
      setFiltered(comps);
      if (comps.length > 0 && !selected) setSelected(comps[0]);
      setStats(statsData);
    }).catch(err => {
      if (err.name === "AbortError") return;
      console.warn("Failed to load components:", err);
    }).finally(() => setLoading(false));
    return () => controller.abort();
  }, [open]);

  // Filter on category/search change
  useEffect(() => {
    let result = components;
    if (category !== "all") result = result.filter(c => c.category === category);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q) ||
        c.tags.some(t => t.toLowerCase().includes(q))
      );
    }
    setFiltered(result);
    if (result.length > 0 && (!selected || !result.find(c => c.id === selected.id))) {
      setSelected(result[0]);
    }
  }, [components, category, search]);

  // Update preview iframe when selected component changes — revoke old blob URL
  const prevBlobUrl = useRef<string | null>(null);
  useEffect(() => {
    if (!selected || !previewRef.current) return;
    if (prevBlobUrl.current) URL.revokeObjectURL(prevBlobUrl.current);
    const html = `<!DOCTYPE html><html><head>
      <script src="https://cdn.tailwindcss.com"></script>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"></script>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js"></script>
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.css">
      <script src="https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.js"></script>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Playfair+Display:ital,wght@0,700;1,700&display=swap" rel="stylesheet">
      <style>body{margin:0;font-family:'Inter',sans-serif;}</style>
    </head><body>${selected.html}</body></html>`;
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    prevBlobUrl.current = url;
    previewRef.current.src = url;
    return () => { if (prevBlobUrl.current) { URL.revokeObjectURL(prevBlobUrl.current); prevBlobUrl.current = null; } };
  }, [selected]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const addToCanvas = useCallback((comp: UIComponent) => {
    const { screens, addScreen, viewport } = useCanvasStore.getState();
    const canvasX = (-viewport.x + window.innerWidth / 2) / viewport.zoom - 200;
    const canvasY = (-viewport.y + window.innerHeight / 2) / viewport.zoom - 200;
    // Offset if screens exist
    const offsetX = screens.length * 30;
    addScreen({
      id: `comp_${Date.now()}`,
      projectId: useCanvasStore.getState().project?.id || "default",
      prompt: comp.name,
      html: comp.html,
      deviceType: "DESKTOP",
      x: canvasX + offsetX,
      y: canvasY,
      width: 1440,
      height: 900,
    });
    onClose();
  }, [onClose]);

  const copyHtml = useCallback((comp: UIComponent) => {
    navigator.clipboard.writeText(comp.html);
  }, []);

  const getIndustry = (comp: UIComponent) => {
    return comp.tags?.find(t =>
      !["tailwind", "responsive", "ai-generated", "industry"].includes(t) &&
      !t.startsWith("persona:") &&
      t !== comp.category
    ) || "";
  };

  if (!open) return null;

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)",
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100,
      }}
    >
      <div style={{
        width: "92vw", maxWidth: 1280, height: "88vh", background: "var(--chrome-surface, #18181b)",
        borderRadius: 20, border: "1px solid var(--chrome-border, #27272a)", overflow: "hidden",
        display: "flex", flexDirection: "column", boxShadow: "0 24px 80px rgba(0,0,0,0.5)",
      }}>
        {/* Top bar */}
        <div style={{
          padding: "16px 24px", borderBottom: "1px solid var(--chrome-border, #27272a)",
          display: "flex", alignItems: "center", gap: 16,
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent, #7c5cfc)" strokeWidth="1.5">
            <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
            <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
          </svg>
          <span style={{ fontSize: 15, fontWeight: 600, color: "var(--chrome-text, #fafafa)" }}>Components</span>
          {stats && (
            <span style={{
              fontSize: 11, color: "var(--chrome-text-muted, #71717a)",
              background: "var(--chrome-bg, #0e0e10)", padding: "3px 10px", borderRadius: 10,
            }}>{stats.total}</span>
          )}

          {/* Search */}
          <div style={{ flex: 1, maxWidth: 320, position: "relative" }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
              style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--chrome-text-muted, #71717a)" }}>
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search..."
              style={{
                width: "100%", padding: "8px 12px 8px 34px", borderRadius: 8,
                border: "1px solid var(--chrome-border, #27272a)",
                background: "var(--chrome-bg, #0e0e10)", color: "var(--chrome-text, #fafafa)",
                fontSize: 13, fontFamily: "inherit", outline: "none",
              }}
            />
          </div>

          <div style={{ flex: 1 }} />

          {/* Device toggle */}
          <div style={{
            display: "flex", gap: 2, background: "var(--chrome-surface, #18181b)",
            borderRadius: 8, padding: 3,
          }}>
            {(["desktop", "tablet", "mobile"] as const).map(d => (
              <button key={d} onClick={() => setDevice(d)} style={{
                padding: "5px 10px", border: "none", borderRadius: 6,
                background: device === d ? "var(--chrome-bg, #0e0e10)" : "transparent",
                color: device === d ? "var(--chrome-text, #fafafa)" : "var(--chrome-text-muted, #71717a)",
                cursor: "pointer", fontSize: 11, fontFamily: "inherit",
                textTransform: "capitalize",
              }}>{d}</button>
            ))}
          </div>

          <button onClick={onClose} style={{
            background: "none", border: "none", color: "var(--chrome-text-muted, #71717a)",
            cursor: "pointer", padding: 6, borderRadius: 8,
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Body: split view */}
        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
          {/* Left panel: filters + list */}
          <div style={{
            width: 440, borderRight: "1px solid var(--chrome-border, #27272a)",
            display: "flex", flexDirection: "column", flexShrink: 0,
          }}>
            {/* Filter chips */}
            <div style={{
              display: "flex", gap: 6, padding: "12px 16px",
              borderBottom: "1px solid var(--chrome-border, #27272a)",
              overflowX: "auto", flexShrink: 0,
            }}>
              {CATEGORIES.filter(c => c === "all" || (stats?.byCategory[c] ?? 0) > 0).map(cat => (
                <button key={cat} onClick={() => setCategory(cat)} style={{
                  padding: "5px 12px", borderRadius: 8, fontSize: 11, fontWeight: 500,
                  border: category === cat
                    ? "1px solid var(--accent, #7c5cfc)"
                    : "1px solid var(--chrome-border, #27272a)",
                  background: category === cat ? "rgba(124,92,252,0.08)" : "transparent",
                  color: category === cat ? "var(--accent-text, #a78bfa)" : "var(--chrome-text-muted, #71717a)",
                  cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
                }}>
                  {cat === "all" ? "All" : cat.charAt(0).toUpperCase() + cat.slice(1)}
                </button>
              ))}
            </div>

            {/* Component list */}
            <div style={{ flex: 1, overflowY: "auto" }}>
              {loading ? (
                <div style={{ textAlign: "center", padding: 40, color: "var(--chrome-text-muted, #71717a)", fontSize: 13 }}>
                  Loading components...
                </div>
              ) : filtered.length === 0 ? (
                <div style={{ textAlign: "center", padding: 40, color: "var(--chrome-text-muted, #71717a)", fontSize: 13 }}>
                  {components.length === 0 ? "No components in library." : "No matching components."}
                </div>
              ) : (
                filtered.map(comp => (
                  <CompRow
                    key={comp.id}
                    component={comp}
                    active={selected?.id === comp.id}
                    industry={getIndustry(comp)}
                    onClick={() => setSelected(comp)}
                  />
                ))
              )}
            </div>
          </div>

          {/* Right panel: preview */}
          <div style={{
            flex: 1, display: "flex", flexDirection: "column",
            background: "var(--chrome-bg, #0e0e10)",
          }}>
            {selected ? (
              <>
                {/* Preview header */}
                <div style={{
                  padding: "16px 24px", borderBottom: "1px solid var(--chrome-border, #27272a)",
                  display: "flex", alignItems: "flex-start", justifyContent: "space-between",
                }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 600, color: "var(--chrome-text, #fafafa)", marginBottom: 4 }}>
                      {selected.name}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--chrome-text-muted, #71717a)", lineHeight: 1.5, maxWidth: 500 }}>
                      {selected.description}
                    </div>
                  </div>
                </div>

                {/* Preview iframe */}
                <div style={{
                  flex: 1, margin: "16px 24px", borderRadius: 12, overflow: "hidden",
                  border: "1px solid var(--chrome-border, #27272a)", background: "white",
                  display: "flex", justifyContent: "center",
                }}>
                  <iframe
                    ref={previewRef}
                    title={selected.name}
                    style={{
                      width: DEVICE_WIDTHS[device],
                      height: "100%",
                      border: "none",
                      background: "white",
                      transition: "width 0.3s ease",
                    }}
                  />
                </div>

                {/* Preview footer */}
                <div style={{
                  padding: "12px 24px", display: "flex", alignItems: "center",
                  justifyContent: "space-between",
                }}>
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    {selected.tags.map(t => (
                      <span key={t} style={{
                        fontSize: 9, padding: "2px 7px", borderRadius: 4,
                        background: "var(--chrome-surface, #18181b)",
                        border: "1px solid var(--chrome-border, #27272a)",
                        color: "var(--chrome-text-muted, #71717a)",
                      }}>{t}</span>
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => copyHtml(selected)} style={{
                      padding: "8px 20px", borderRadius: 8, fontSize: 12, fontWeight: 500,
                      cursor: "pointer", fontFamily: "inherit",
                      background: "transparent", color: "var(--chrome-text-secondary, #a1a1aa)",
                      border: "1px solid var(--chrome-border, #27272a)",
                    }}>Copy HTML</button>
                    <button onClick={() => addToCanvas(selected)} style={{
                      padding: "8px 20px", borderRadius: 8, fontSize: 12, fontWeight: 500,
                      cursor: "pointer", fontFamily: "inherit", border: "none",
                      background: "var(--accent, #7c5cfc)", color: "white",
                    }}>Add to Canvas</button>
                  </div>
                </div>
              </>
            ) : (
              <div style={{
                flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
                color: "var(--chrome-text-muted, #71717a)", fontSize: 13,
              }}>
                Select a component to preview
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Component Row (lightweight — NO iframe, NO Tailwind CDN per row) ────────

function CompRow({ component, active, industry, onClick }: {
  component: UIComponent; active: boolean; industry: string; onClick: () => void;
}) {
  const categoryColors: Record<string, string> = {
    hero: "#6366f1", features: "#10b981", cards: "#f59e0b", navbar: "#3b82f6",
    footer: "#6b7280", cta: "#ef4444", carousel: "#8b5cf6", banner: "#ec4899",
    stats: "#14b8a6", forms: "#f97316", gallery: "#a855f7", team: "#06b6d4",
    modal: "#64748b", sidebar: "#84cc16", faq: "#eab308",
  };
  const swatchColor = categoryColors[component.category] || "#52525b";

  return (
    <div onClick={onClick} style={{
      display: "flex", alignItems: "center", gap: 12, padding: "10px 16px",
      cursor: "pointer", transition: "background 0.1s",
      borderBottom: "1px solid rgba(39,39,42,0.5)",
      background: active ? "rgba(124,92,252,0.08)" : "transparent",
      borderLeft: active ? "2px solid var(--accent, #7c5cfc)" : "2px solid transparent",
    }}>
      {/* Thumbnail swatch — lightweight color block instead of iframe */}
      <div style={{
        width: 48, height: 36, borderRadius: 6, overflow: "hidden", flexShrink: 0,
        border: "1px solid var(--chrome-border, #27272a)",
        background: `linear-gradient(135deg, ${swatchColor}22, ${swatchColor}44)`,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <span style={{ fontSize: 16, opacity: 0.5 }}>
          {component.category === "hero" ? "◆" : component.category === "navbar" ? "☰" :
           component.category === "footer" ? "▬" : component.category === "cards" ? "▢" :
           component.category === "cta" ? "→" : component.category === "forms" ? "▤" :
           component.category === "gallery" ? "▦" : "◻"}
        </span>
      </div>

      {/* Body */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13, fontWeight: 500, color: "var(--chrome-text, #fafafa)",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>{component.name}</div>
        <div style={{
          fontSize: 10, color: "var(--chrome-text-muted, #71717a)",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 2,
        }}>{component.description}</div>
      </div>

      {/* Badges */}
      <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
        <span style={{
          fontSize: 9, padding: "2px 6px", borderRadius: 4,
          background: "var(--chrome-bg, #0e0e10)", border: "1px solid var(--chrome-border, #27272a)",
          color: "var(--chrome-text-muted, #71717a)",
        }}>{component.category}</span>
        {industry && (
          <span style={{
            fontSize: 9, padding: "2px 6px", borderRadius: 4,
            background: "var(--chrome-bg, #0e0e10)",
            border: "1px solid rgba(124,92,252,0.2)",
            color: "var(--accent-text, #a78bfa)",
          }}>{industry}</span>
        )}
      </div>
    </div>
  );
}
