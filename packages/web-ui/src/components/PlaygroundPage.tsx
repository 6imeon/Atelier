import { useState, useEffect, useCallback, useRef } from "react";
import { API_BASE, getAuthHeaders } from "../utils/api";

// ─── Types ───

interface CapturedSection {
  index: number;
  tag: string;
  bbox: { x: number; y: number; width: number; height: number };
  classes: string[];
  textPreview: string;
  hasAnimation: boolean;
}

interface CaptureResult {
  captureId: string;
  screenshot: string; // base64
  pageHeight: number;
  viewportWidth: number;
  url: string;
  sections: CapturedSection[];
}

interface ExtractResult {
  html: string;
  css: string;
  scripts: string[];
  scopeClass: string;
  assets: string[];
  libs: string[];
}

type PlaygroundTab = "extractor";

// ─── API ───

async function captureUrl(url: string): Promise<CaptureResult & { error?: string }> {
  const res = await fetch(`${API_BASE}/api/engine/capture`, {
    method: "POST",
    headers: await getAuthHeaders(),
    body: JSON.stringify({ url }),
  });
  return res.json();
}

async function extractSection(captureId: string, sectionIndex: number): Promise<ExtractResult & { error?: string }> {
  const res = await fetch(`${API_BASE}/api/engine/extract`, {
    method: "POST",
    headers: await getAuthHeaders(),
    body: JSON.stringify({ captureId, sectionIndex }),
  });
  return res.json();
}

async function saveSkeleton(name: string, html: string, css: string, description: string): Promise<{ error?: string }> {
  const res = await fetch(`${API_BASE}/api/engine/save-skeleton`, {
    method: "POST",
    headers: await getAuthHeaders(),
    body: JSON.stringify({ name, html, css, description }),
  });
  return res.json();
}

// ─── Main Page ───

interface Props {
  onBack: () => void;
}

export function PlaygroundPage({ onBack }: Props) {
  const [tab] = useState<PlaygroundTab>("extractor");

  return (
    <div style={{
      height: "100vh",
      display: "flex",
      flexDirection: "column",
      fontFamily: "'Inter', system-ui, sans-serif",
      background: "var(--chrome-bg, #FAF8F9)",
      color: "var(--chrome-text, #1F1A1C)",
    }}>
      {/* Top bar */}
      <div style={{
        padding: "12px 20px",
        borderBottom: "1px solid var(--chrome-border, #e5e5e5)",
        display: "flex", alignItems: "center", gap: 12,
      }}>
        <button
          onClick={onBack}
          style={{
            background: "none", border: "none", cursor: "pointer",
            color: "var(--chrome-text-muted, #999)", fontSize: 12,
            display: "flex", alignItems: "center", gap: 4, padding: "4px 0",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
          Back
        </button>
        <h1 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>Playground</h1>
        <div style={{ flex: 1 }} />
        <span style={{
          fontSize: 10, padding: "3px 8px", borderRadius: 10,
          background: "rgba(124,92,252,0.1)", color: "var(--accent, #7c5cfc)",
          fontWeight: 600, letterSpacing: "0.03em",
        }}>
          EXPERIMENTAL
        </span>
      </div>

      {/* Tab bar */}
      <div style={{
        display: "flex", gap: 0,
        borderBottom: "1px solid var(--chrome-border, #e5e5e5)",
        padding: "0 20px",
      }}>
        {([
          { id: "extractor" as PlaygroundTab, label: "Component Extractor", icon: "M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" },
        ]).map(t => (
          <button
            key={t.id}
            style={{
              padding: "10px 16px", border: "none", cursor: "pointer",
              background: "transparent",
              borderBottom: tab === t.id ? "2px solid var(--accent, #7c5cfc)" : "2px solid transparent",
              display: "flex", alignItems: "center", gap: 6,
              fontSize: 12, fontWeight: tab === t.id ? 600 : 400,
              color: tab === t.id ? "var(--accent, #7c5cfc)" : "var(--chrome-text-muted, #999)",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d={t.icon}/>
            </svg>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflow: "hidden" }}>
        {tab === "extractor" && <ComponentExtractor />}
      </div>
    </div>
  );
}

// ─── Component Extractor ───

const HISTORY_KEY = "playground-url-history";
function getUrlHistory(): string[] {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]"); } catch { return []; }
}
function addUrlHistory(url: string) {
  const history = getUrlHistory().filter(u => u !== url);
  history.unshift(url);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 8)));
}

function ComponentExtractor() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [capture, setCapture] = useState<CaptureResult | null>(null);
  const [hoveredSection, setHoveredSection] = useState<number | null>(null);
  const [selectedSection, setSelectedSection] = useState<number | null>(null);
  const [selectedSections, setSelectedSections] = useState<Set<number>>(new Set());
  const [extracting, setExtracting] = useState(false);
  const [extracted, setExtracted] = useState<ExtractResult | null>(null);
  const [showCode, setShowCode] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [skeletonName, setSkeletonName] = useState("");
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const screenshotRef = useRef<HTMLDivElement>(null);
  const [imgDims, setImgDims] = useState<{ w: number; h: number } | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const urlHistory = getUrlHistory();

  const handleCapture = useCallback(async () => {
    if (!url) return;
    let normalized = url.trim();
    if (!normalized.startsWith("http")) normalized = "https://" + normalized;
    setLoading(true);
    setError(null);
    setCapture(null);
    setSelectedSection(null);
    setSelectedSections(new Set());
    setExtracted(null);
    setShowPreview(false);
    try {
      const result = await captureUrl(normalized);
      if (result.error) {
        setError(result.error);
      } else {
        setCapture(result);
        addUrlHistory(normalized);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Capture failed");
    }
    setLoading(false);
  }, [url]);

  // Keyboard navigation for sections
  useEffect(() => {
    if (!capture) return;
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const max = capture.sections.length - 1;
      if (e.key === "ArrowDown" || e.key === "j") {
        e.preventDefault();
        setSelectedSection(prev => prev === null ? 0 : Math.min(prev + 1, max));
        setExtracted(null); setShowCode(false); setShowPreview(false); setSaveMsg(null);
      } else if (e.key === "ArrowUp" || e.key === "k") {
        e.preventDefault();
        setSelectedSection(prev => prev === null ? max : Math.max(prev - 1, 0));
        setExtracted(null); setShowCode(false); setShowPreview(false); setSaveMsg(null);
      } else if (e.key === "Enter" && selectedSection !== null && !extracted && !extracting) {
        e.preventDefault();
        // trigger extract via a ref-less approach
        setExtracting(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [capture, selectedSection, extracted, extracting]);

  // Handle extract triggered by Enter key
  useEffect(() => {
    if (extracting && !extracted && capture && selectedSection !== null) {
      extractSection(capture.captureId, selectedSection).then(result => {
        if ((result as any).error) setError((result as any).error);
        else setExtracted(result);
        setExtracting(false);
      }).catch(err => {
        setError(err instanceof Error ? err.message : "Extract failed");
        setExtracting(false);
      });
    }
  }, [extracting, extracted, capture, selectedSection]);

  const handleExtract = useCallback(async () => {
    if (!capture) return;
    const indices = selectedSections.size > 0 ? Array.from(selectedSections) : selectedSection !== null ? [selectedSection] : [];
    if (indices.length === 0) return;
    setExtracting(true);
    setExtracted(null);
    setShowCode(false);
    try {
      const result = await extractSection(capture.captureId, indices.length === 1 ? indices[0] : indices as any);
      if (result.error) {
        setError(result.error as string);
      } else {
        setExtracted(result);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Extract failed");
    }
    setExtracting(false);
  }, [capture, selectedSection, selectedSections]);

  const handleSave = useCallback(async () => {
    if (!extracted || !skeletonName.trim()) return;
    setSaving(true);
    setSaveMsg(null);
    try {
      const name = skeletonName.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-");
      const section = capture?.sections[selectedSection!];
      const desc = `Extracted from ${capture?.url || "unknown"} — ${section?.tag} section`;
      const result = await saveSkeleton(name, extracted.html, extracted.css, desc);
      if (result.error) {
        setSaveMsg(`Error: ${result.error}`);
      } else {
        setSaveMsg(`Saved as ${name}.html`);
      }
    } catch {
      setSaveMsg("Save failed");
    }
    setSaving(false);
  }, [extracted, skeletonName, capture, selectedSection]);

  // Track image dimensions for overlay scaling
  const handleImgLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setImgDims({ w: img.naturalWidth, h: img.naturalHeight });
  }, []);

  const selectedInfo = capture && selectedSection !== null ? capture.sections[selectedSection] : null;

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      {/* URL bar */}
      <div style={{
        padding: "16px 20px",
        borderBottom: "1px solid var(--chrome-border, #e5e5e5)",
        display: "flex", gap: 10, alignItems: "center",
        position: "relative",
      }}>
        <div style={{
          flex: 1, display: "flex", alignItems: "center",
          background: "var(--chrome-surface, #f5f5f5)",
          borderRadius: 8, border: "1px solid var(--chrome-border, #e5e5e5)",
          overflow: "visible", position: "relative",
        }}>
          <span style={{ padding: "0 0 0 12px", color: "var(--chrome-text-muted, #aaa)", fontSize: 12, flexShrink: 0 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
            </svg>
          </span>
          <input
            value={url}
            onChange={e => { setUrl(e.target.value); setShowHistory(false); }}
            onKeyDown={e => { if (e.key === "Enter") { handleCapture(); setShowHistory(false); } }}
            onFocus={() => { if (urlHistory.length > 0 && !url) setShowHistory(true); }}
            onBlur={() => setTimeout(() => setShowHistory(false), 200)}
            placeholder="Enter a URL to extract components from..."
            style={{
              flex: 1, padding: "10px 12px", border: "none", background: "transparent",
              fontSize: 13, color: "var(--chrome-text, #333)", outline: "none",
            }}
          />
          {/* History dropdown */}
          {showHistory && urlHistory.length > 0 && (
            <div style={{
              position: "absolute", top: "100%", left: 0, right: 0, zIndex: 100,
              marginTop: 4, borderRadius: 8, overflow: "hidden",
              background: "var(--chrome-bg, #fff)",
              border: "1px solid var(--chrome-border, #e5e5e5)",
              boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
            }}>
              <div style={{ padding: "6px 10px", fontSize: 10, color: "var(--chrome-text-muted, #aaa)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Recent
              </div>
              {urlHistory.map(h => (
                <button
                  key={h}
                  onMouseDown={e => { e.preventDefault(); setUrl(h); setShowHistory(false); }}
                  style={{
                    display: "block", width: "100%", textAlign: "left",
                    padding: "8px 12px", border: "none", cursor: "pointer",
                    background: "transparent", fontSize: 12,
                    color: "var(--chrome-text, #333)",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = "var(--chrome-surface, #f5f5f5)"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                >
                  {h}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Re-capture button (visible when we have a capture) */}
        {capture && !loading && (
          <button
            onClick={handleCapture}
            title="Re-capture"
            style={{
              padding: "9px", borderRadius: 8, border: "1px solid var(--chrome-border, #e5e5e5)",
              background: "var(--chrome-surface, #f5f5f5)", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "var(--chrome-text-muted, #888)",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
            </svg>
          </button>
        )}

        <button
          onClick={handleCapture}
          disabled={loading || !url.trim()}
          style={{
            padding: "10px 24px", borderRadius: 8, border: "none",
            background: loading ? "var(--chrome-surface, #e5e5e5)" : "var(--accent, #7c5cfc)",
            color: loading ? "var(--chrome-text-muted, #999)" : "#fff",
            fontSize: 13, fontWeight: 600, cursor: loading ? "default" : "pointer",
            display: "flex", alignItems: "center", gap: 6,
            flexShrink: 0,
          }}
        >
          {loading ? (
            <>
              <Spinner />
              Capturing...
            </>
          ) : "Capture"}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div style={{
          margin: "0 20px", padding: "10px 14px", borderRadius: 8,
          background: "rgba(239,68,68,0.08)", color: "#dc2626",
          fontSize: 12, marginTop: 12,
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <span>{error}</span>
          <button onClick={() => setError(null)} style={{
            marginLeft: "auto", background: "none", border: "none", cursor: "pointer",
            color: "#dc2626", fontSize: 14,
          }}>x</button>
        </div>
      )}

      {/* Empty state */}
      {!capture && !loading && (
        <div style={{
          flex: 1, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", gap: 12,
          color: "var(--chrome-text-muted, #aaa)",
        }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" style={{ opacity: 0.4 }}>
            <polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2"/>
            <line x1="12" y1="22" x2="12" y2="15.5"/>
            <polyline points="22 8.5 12 15.5 2 8.5"/>
          </svg>
          <div style={{ fontSize: 14, fontWeight: 500 }}>Component Extractor</div>
          <div style={{ fontSize: 12, maxWidth: 360, textAlign: "center", lineHeight: 1.5 }}>
            Enter a URL above to capture a full-page screenshot. Click on any section to extract its HTML and CSS, then save it as a skeleton for enhancement.
          </div>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div style={{
          flex: 1, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", gap: 12,
          color: "var(--chrome-text-muted, #aaa)",
        }}>
          <Spinner size={32} />
          <div style={{ fontSize: 13 }}>Rendering page in headless browser...</div>
          <div style={{ fontSize: 11, color: "var(--chrome-text-muted, #bbb)" }}>This may take 5-15 seconds</div>
        </div>
      )}

      {/* Capture result */}
      {capture && !loading && (
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          {/* Screenshot panel */}
          <div
            ref={screenshotRef}
            style={{
              flex: 1, overflowY: "auto", padding: 20,
              position: "relative",
              background: "#e8e8e8",
            }}
          >
            <div style={{
              position: "relative", display: "inline-block",
              boxShadow: "0 4px 24px rgba(0,0,0,0.12)",
              borderRadius: 4, overflow: "hidden",
            }}>
              <img
                src={`data:image/png;base64,${capture.screenshot}`}
                alt="Page screenshot"
                onLoad={handleImgLoad}
                style={{ display: "block", width: "100%", height: "auto" }}
              />
              {/* Section overlays */}
              {imgDims && capture.sections.map(section => {
                const scaleX = (screenshotRef.current?.querySelector("img")?.clientWidth || imgDims.w) / capture.viewportWidth;
                const scaleY = scaleX; // uniform scale since we preserve aspect ratio
                const isHovered = hoveredSection === section.index;
                const isSelected = selectedSection === section.index || selectedSections.has(section.index);
                const isMulti = selectedSections.size > 0;
                return (
                  <div
                    key={section.index}
                    onMouseEnter={() => setHoveredSection(section.index)}
                    onMouseLeave={() => setHoveredSection(null)}
                    onClick={(e) => {
                      if (e.shiftKey || e.metaKey) {
                        // Multi-select: toggle this section
                        setSelectedSections(prev => {
                          const next = new Set(prev);
                          // Include current single selection in multi set
                          if (selectedSection !== null && next.size === 0) next.add(selectedSection);
                          if (next.has(section.index)) next.delete(section.index);
                          else next.add(section.index);
                          return next;
                        });
                        setSelectedSection(section.index);
                      } else {
                        // Single select
                        setSelectedSection(section.index);
                        setSelectedSections(new Set());
                      }
                      setExtracted(null);
                      setShowCode(false);
                      setShowPreview(false);
                      setSaveMsg(null);
                    }}
                    style={{
                      position: "absolute",
                      left: section.bbox.x * scaleX,
                      top: section.bbox.y * scaleY,
                      width: section.bbox.width * scaleX,
                      height: section.bbox.height * scaleY,
                      border: isSelected
                        ? `2px solid ${isMulti && selectedSections.has(section.index) ? "#f59e0b" : "var(--accent, #7c5cfc)"}`
                        : isHovered
                          ? "2px solid rgba(124,92,252,0.5)"
                          : "1px solid transparent",
                      background: isSelected
                        ? "rgba(124,92,252,0.08)"
                        : isHovered
                          ? "rgba(124,92,252,0.04)"
                          : "transparent",
                      cursor: "pointer",
                      transition: "border 0.1s, background 0.1s",
                      boxSizing: "border-box",
                      borderRadius: 2,
                    }}
                  >
                    {/* Label */}
                    {(isHovered || isSelected) && (
                      <div style={{
                        position: "absolute", top: 0, left: 0,
                        background: isSelected ? "var(--accent, #7c5cfc)" : "rgba(124,92,252,0.85)",
                        color: "#fff", fontSize: 10, fontWeight: 600,
                        padding: "2px 8px", borderRadius: "0 0 4px 0",
                        pointerEvents: "none",
                        display: "flex", alignItems: "center", gap: 4,
                      }}>
                        &lt;{section.tag}&gt;
                        {section.hasAnimation && (
                          <span style={{
                            background: "rgba(255,255,255,0.25)",
                            padding: "0 4px", borderRadius: 3, fontSize: 8,
                          }}>animated</span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Section count badge */}
            <div style={{
              position: "sticky", bottom: 12, left: 12,
              display: "inline-flex", alignItems: "center", gap: 6,
              background: "rgba(0,0,0,0.7)", color: "#fff",
              padding: "6px 12px", borderRadius: 20,
              fontSize: 11, fontWeight: 500,
            }}>
              {capture.sections.length} sections detected
              {selectedSections.size > 1 && (
                <span style={{ background: "#f59e0b", color: "#000", padding: "1px 6px", borderRadius: 10, fontSize: 10, fontWeight: 700 }}>
                  {selectedSections.size} selected
                </span>
              )}
              <span style={{ fontSize: 9, opacity: 0.6 }}>Shift+click to multi-select</span>
            </div>
          </div>

          {/* Detail panel */}
          <div style={{
            width: 320, borderLeft: "1px solid var(--chrome-border, #e5e5e5)",
            display: "flex", flexDirection: "column", overflow: "hidden",
            background: "var(--chrome-bg, #fff)",
          }}>
            {!selectedInfo && (
              <div style={{
                flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
                padding: 24, textAlign: "center",
                color: "var(--chrome-text-muted, #aaa)", fontSize: 13, lineHeight: 1.5,
              }}>
                Click a section on the screenshot to view details and extract its code
              </div>
            )}

            {selectedInfo && (
              <>
                {/* Section header */}
                <div style={{
                  padding: "16px 16px 12px",
                  borderBottom: "1px solid var(--chrome-border, #e5e5e5)",
                }}>
                  {selectedSections.size > 1 && (
                    <div style={{
                      marginBottom: 8, padding: "4px 8px", borderRadius: 6,
                      background: "rgba(245,158,11,0.1)", fontSize: 11,
                      color: "#b45309", fontWeight: 500,
                    }}>
                      {selectedSections.size} sections selected — will be merged on extract
                    </div>
                  )}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <span style={{
                      fontSize: 14, fontWeight: 600,
                      color: "var(--accent, #7c5cfc)",
                    }}>&lt;{selectedInfo.tag}&gt;</span>
                    {selectedInfo.hasAnimation && (
                      <span style={{
                        fontSize: 9, padding: "2px 6px", borderRadius: 6,
                        background: "rgba(124,92,252,0.1)", color: "var(--accent, #7c5cfc)",
                        fontWeight: 600,
                      }}>ANIMATED</span>
                    )}
                  </div>
                  {selectedInfo.classes.length > 0 && (
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 8 }}>
                      {selectedInfo.classes.slice(0, 5).map(c => (
                        <span key={c} style={{
                          fontSize: 10, padding: "2px 6px", borderRadius: 6,
                          background: "var(--chrome-surface, #f0f0f0)",
                          color: "var(--chrome-text-muted, #888)",
                          fontFamily: "monospace",
                        }}>.{c}</span>
                      ))}
                      {selectedInfo.classes.length > 5 && (
                        <span style={{ fontSize: 10, color: "var(--chrome-text-muted, #aaa)" }}>
                          +{selectedInfo.classes.length - 5} more
                        </span>
                      )}
                    </div>
                  )}
                  <div style={{
                    fontSize: 11, color: "var(--chrome-text-muted, #999)",
                    display: "flex", gap: 12,
                  }}>
                    <span>{Math.round(selectedInfo.bbox.width)} x {Math.round(selectedInfo.bbox.height)}px</span>
                  </div>
                </div>

                {/* Text preview */}
                {selectedInfo.textPreview && (
                  <div style={{
                    padding: "12px 16px",
                    borderBottom: "1px solid var(--chrome-border, #e5e5e5)",
                    fontSize: 11, color: "var(--chrome-text-muted, #888)",
                    lineHeight: 1.5,
                    maxHeight: 80, overflow: "hidden",
                  }}>
                    {selectedInfo.textPreview}
                  </div>
                )}

                {/* Actions */}
                <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
                  <button
                    onClick={handleExtract}
                    disabled={extracting}
                    style={{
                      width: "100%", padding: "9px 16px", borderRadius: 6,
                      border: "none", cursor: extracting ? "default" : "pointer",
                      background: extracting ? "var(--chrome-surface, #e5e5e5)" : "var(--accent, #7c5cfc)",
                      color: extracting ? "var(--chrome-text-muted, #999)" : "#fff",
                      fontSize: 12, fontWeight: 600,
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                    }}
                  >
                    {extracting ? <><Spinner /> Extracting...</> : selectedSections.size > 1 ? `Extract ${selectedSections.size} Sections` : "Extract HTML + CSS"}
                  </button>
                </div>

                {/* Extracted result */}
                {extracted && (
                  <div style={{
                    flex: 1, overflowY: "auto",
                    borderTop: "1px solid var(--chrome-border, #e5e5e5)",
                    display: "flex", flexDirection: "column",
                  }}>
                    {/* Stats */}
                    <div style={{
                      padding: "12px 16px",
                      display: "flex", gap: 8, flexWrap: "wrap",
                    }}>
                      <StatBadge label="HTML" value={`${(extracted.html.length / 1024).toFixed(1)}KB`} />
                      <StatBadge label="CSS" value={`${(extracted.css.length / 1024).toFixed(1)}KB`} />
                      {extracted.scripts && extracted.scripts.length > 0 && (
                        <StatBadge label="JS" value={`${extracted.scripts.length} script${extracted.scripts.length > 1 ? "s" : ""}`} />
                      )}
                      {extracted.scopeClass && (
                        <StatBadge label="Scope" value={extracted.scopeClass} />
                      )}
                      {extracted.libs.length > 0 && extracted.libs.map(l => (
                        <StatBadge key={l} label="" value={l} accent />
                      ))}
                    </div>

                    {/* Toggle code */}
                    <button
                      onClick={() => setShowCode(!showCode)}
                      style={{
                        margin: "0 16px 8px", padding: "6px 12px", borderRadius: 6,
                        border: "1px solid var(--chrome-border, #e5e5e5)",
                        background: "transparent", cursor: "pointer",
                        fontSize: 11, fontWeight: 500, color: "var(--chrome-text, #555)",
                        display: "flex", alignItems: "center", gap: 6,
                      }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
                      </svg>
                      {showCode ? "Hide Code" : "View Code"}
                    </button>

                    {showCode && (
                      <pre style={{
                        margin: "0 16px 12px", padding: 12, borderRadius: 6,
                        background: "#1e1e2e", color: "#cdd6f4",
                        fontSize: 10, lineHeight: 1.5,
                        overflow: "auto", maxHeight: 200,
                        whiteSpace: "pre-wrap", wordBreak: "break-all",
                      }}>
                        {extracted.css && `/* Scoped CSS (class: .${extracted.scopeClass || "extracted"}) */\n${extracted.css}\n\n`}
                        {`/* HTML */\n`}{extracted.html}
                        {extracted.scripts && extracted.scripts.length > 0 && `\n\n/* Extracted Scripts */\n${extracted.scripts.map((s, i) => `// Script ${i + 1}\n${s}`).join("\n\n")}`}
                      </pre>
                    )}

                    {/* Live preview toggle */}
                    <div style={{ padding: "8px 16px" }}>
                      <button
                        onClick={() => setShowPreview(!showPreview)}
                        style={{
                          width: "100%", padding: "6px 12px", borderRadius: 6,
                          border: "1px solid var(--chrome-border, #e5e5e5)",
                          background: showPreview ? "rgba(124,92,252,0.08)" : "transparent",
                          cursor: "pointer",
                          fontSize: 11, fontWeight: 500,
                          color: showPreview ? "var(--accent, #7c5cfc)" : "var(--chrome-text, #555)",
                          display: "flex", alignItems: "center", gap: 6,
                        }}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
                        </svg>
                        {showPreview ? "Hide Preview" : "Live Preview"}
                      </button>
                    </div>

                    {showPreview && (
                      <div style={{
                        margin: "0 16px 12px", borderRadius: 6, overflow: "hidden",
                        border: "1px solid var(--chrome-border, #e5e5e5)",
                        height: 240,
                      }}>
                        <iframe
                          srcDoc={`<!DOCTYPE html><html><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<script src="https://cdn.tailwindcss.com"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js"></script>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.css">
<script src="https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.js"></script>
<style>body{margin:0;overflow-x:hidden;font-family:system-ui,sans-serif}${extracted.css ? extracted.css.replace(/</g, "\\x3c") : ""}</style>
</head><body>${extracted.html}</body></html>`}
                          sandbox="allow-scripts"
                          style={{ width: "100%", height: "100%", border: "none", background: "#fff" }}
                          title="Live preview"
                        />
                      </div>
                    )}

                    {/* Save as skeleton */}
                    <div style={{ padding: "8px 16px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--chrome-text-muted, #777)" }}>
                        Save as Skeleton
                      </div>
                      <div style={{ display: "flex", gap: 6 }}>
                        <input
                          value={skeletonName}
                          onChange={e => setSkeletonName(e.target.value)}
                          placeholder="skeleton-name"
                          style={{
                            flex: 1, padding: "7px 10px", borderRadius: 6,
                            border: "1px solid var(--chrome-border, #e5e5e5)",
                            background: "var(--chrome-surface, #f5f5f5)",
                            fontSize: 12, color: "var(--chrome-text, #333)",
                          }}
                        />
                        <button
                          onClick={handleSave}
                          disabled={saving || !skeletonName.trim()}
                          style={{
                            padding: "7px 16px", borderRadius: 6, border: "none",
                            background: saving ? "var(--chrome-surface, #e5e5e5)" : "#22c55e",
                            color: saving ? "var(--chrome-text-muted, #999)" : "#fff",
                            fontSize: 12, fontWeight: 600, cursor: saving ? "default" : "pointer",
                          }}
                        >
                          Save
                        </button>
                      </div>
                      {saveMsg && (
                        <div style={{
                          fontSize: 11,
                          color: saveMsg.startsWith("Error") ? "#dc2626" : "#16a34a",
                        }}>
                          {saveMsg}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Small Components ───

function Spinner({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ animation: "spin 1s linear infinite", flexShrink: 0 }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <circle cx="12" cy="12" r="10" stroke="var(--accent, #7c5cfc)" strokeWidth="2.5" strokeDasharray="32 32" strokeLinecap="round" />
    </svg>
  );
}

function StatBadge({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <span style={{
      fontSize: 10, padding: "3px 8px", borderRadius: 6,
      background: accent ? "rgba(124,92,252,0.1)" : "var(--chrome-surface, #f0f0f0)",
      color: accent ? "var(--accent, #7c5cfc)" : "var(--chrome-text-muted, #888)",
      fontWeight: 500, display: "inline-flex", gap: 3,
    }}>
      {label && <span style={{ fontWeight: 600 }}>{label}</span>}
      {value}
    </span>
  );
}
