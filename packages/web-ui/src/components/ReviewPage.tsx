import { useState, useEffect, useCallback, useRef } from "react";
import { API_BASE, getAuthHeaders } from "../utils/api";

interface GeneratedComponent {
  id: string;
  category: string;
  name: string;
  tier?: string;
  score?: number;
  merged: boolean;
  rejected?: boolean;
  approved?: boolean;
  source?: { domain?: string; persona?: string; method?: string };
  generatedAt?: string;
}

interface GenerationJob {
  id: string;
  status: "running" | "completed" | "failed";
  requested: number;
  accepted: number;
  normalized: number;
  rejected: number;
  errors: number;
  log: string[];
}

interface SkeletonInfo {
  name: string;
  file: string;
  description: string;
  libraries: string[];
  sizeChars: number;
}

type Filter = "all" | "pending" | "approved" | "rejected";
type GenMethod = "pipeline" | "skeleton" | "brand-lock";

async function fetchGenerated(limit = 200): Promise<GeneratedComponent[]> {
  const res = await fetch(`${API_BASE}/api/engine/generated?limit=${limit}`, { headers: await getAuthHeaders() });
  if (!res.ok) return [];
  const data = await res.json();
  return data.components || [];
}

async function fetchComponentHtml(id: string): Promise<string> {
  const res = await fetch(`${API_BASE}/api/engine/generated/${encodeURIComponent(id)}`, { headers: await getAuthHeaders() });
  if (!res.ok) return "";
  const data = await res.json();
  return data.html || "";
}

async function approveComponent(id: string): Promise<boolean> {
  const res = await fetch(`${API_BASE}/api/engine/generated/${encodeURIComponent(id)}/approve`, {
    method: "POST",
    headers: await getAuthHeaders(),
  });
  return res.ok;
}

async function rejectComponent(id: string): Promise<boolean> {
  const res = await fetch(`${API_BASE}/api/engine/generated/${encodeURIComponent(id)}/reject`, {
    method: "POST",
    headers: await getAuthHeaders(),
  });
  return res.ok;
}

async function fetchSkeletons(): Promise<SkeletonInfo[]> {
  const res = await fetch(`${API_BASE}/api/engine/skeletons`, { headers: await getAuthHeaders() });
  if (!res.ok) return [];
  const data = await res.json();
  return data.skeletons || [];
}

async function triggerGeneration(opts: {
  method: GenMethod;
  count?: number;
  skeleton?: string;
  description?: string;
  colors?: string;
  images?: string;
  domain?: string;
  persona?: string;
  brandName?: string;
  brandColors?: string;
  brandFonts?: string;
  brandStyle?: string;
}): Promise<{ jobId: string; requested: number; available?: number; error?: string }> {
  const res = await fetch(`${API_BASE}/api/engine/generate`, {
    method: "POST",
    headers: await getAuthHeaders(),
    body: JSON.stringify(opts),
  });
  return res.json();
}

async function fetchJobStatus(jobId: string): Promise<GenerationJob | null> {
  const res = await fetch(`${API_BASE}/api/engine/generate/${encodeURIComponent(jobId)}`, { headers: await getAuthHeaders() });
  if (!res.ok) return null;
  return res.json();
}

interface Props {
  onBack: () => void;
}

export function ReviewPage({ onBack }: Props) {
  const [components, setComponents] = useState<GeneratedComponent[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedHtml, setSelectedHtml] = useState<string>("");
  const [loadingHtml, setLoadingHtml] = useState(false);
  const [filter, setFilter] = useState<Filter>("pending");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Generation state
  const [genMethod, setGenMethod] = useState<GenMethod>("pipeline");
  const [genCount, setGenCount] = useState(10);
  const [genSkeleton, setGenSkeleton] = useState<string>("");
  const [genDescription, setGenDescription] = useState("");
  const [genColors, setGenColors] = useState("");
  const [genImages, setGenImages] = useState("");
  const [genDomain, setGenDomain] = useState("");
  const [genBrandName, setGenBrandName] = useState("");
  const [genBrandColors, setGenBrandColors] = useState("");
  const [genBrandFonts, setGenBrandFonts] = useState("");
  const [genBrandStyle, setGenBrandStyle] = useState("");
  const [genJobId, setGenJobId] = useState<string | null>(null);
  const [genJob, setGenJob] = useState<GenerationJob | null>(null);
  const [genError, setGenError] = useState<string | null>(null);
  const [skeletons, setSkeletons] = useState<SkeletonInfo[]>([]);
  const [showModal, setShowModal] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load skeletons
  useEffect(() => {
    fetchSkeletons().then(setSkeletons);
  }, []);

  // Load components
  const loadComponents = useCallback(() => {
    setLoading(true);
    fetchGenerated().then(comps => {
      setComponents(comps);
      setLoading(false);
    });
  }, []);

  useEffect(() => { loadComponents(); }, [loadComponents]);

  // Poll generation job status
  useEffect(() => {
    if (!genJobId) return;
    const poll = setInterval(async () => {
      const status = await fetchJobStatus(genJobId);
      if (!status) return;
      setGenJob(status);
      if (status.status !== "running") {
        clearInterval(poll);
        pollRef.current = null;
        loadComponents();
      }
    }, 2000);
    pollRef.current = poll;
    return () => clearInterval(poll);
  }, [genJobId, loadComponents]);

  const handleGenerate = useCallback(async () => {
    setGenError(null);
    const opts: Parameters<typeof triggerGeneration>[0] = { method: genMethod };

    if (genMethod === "pipeline") {
      opts.count = genCount;
      if (genDomain) opts.domain = genDomain;
    } else if (genMethod === "skeleton") {
      if (!genSkeleton) { setGenError("Select a skeleton"); return; }
      opts.skeleton = genSkeleton;
      if (genDescription) opts.description = genDescription;
      if (genColors) opts.colors = genColors;
      if (genImages) opts.images = genImages;
      if (genDomain) opts.domain = genDomain;
    } else if (genMethod === "brand-lock") {
      opts.count = genCount;
      if (!genBrandName || !genBrandColors) { setGenError("Brand name and colors are required"); return; }
      opts.brandName = genBrandName;
      opts.brandColors = genBrandColors;
      if (genBrandFonts) opts.brandFonts = genBrandFonts;
      if (genBrandStyle) opts.brandStyle = genBrandStyle;
      if (genDomain) opts.domain = genDomain;
    }

    const result = await triggerGeneration(opts);
    if (result.error) {
      setGenError(result.error);
      return;
    }
    setGenJobId(result.jobId);
    setGenJob({ id: result.jobId, status: "running", requested: result.requested, accepted: 0, normalized: 0, rejected: 0, errors: 0, log: [] });
    setShowModal(false); // close modal, progress shows in header
  }, [genMethod, genCount, genSkeleton, genDescription, genColors, genImages, genDomain, genBrandName, genBrandColors, genBrandFonts, genBrandStyle]);

  // Load HTML when selection changes
  useEffect(() => {
    if (!selectedId) { setSelectedHtml(""); return; }
    setLoadingHtml(true);
    fetchComponentHtml(selectedId).then(html => {
      setSelectedHtml(html);
      setLoadingHtml(false);
    });
  }, [selectedId]);

  const handleApprove = useCallback(async (id: string) => {
    if (await approveComponent(id)) {
      setComponents(prev => prev.map(c => c.id === id ? { ...c, approved: true, rejected: false, merged: true } : c));
    }
  }, []);

  const handleReject = useCallback(async (id: string) => {
    if (await rejectComponent(id)) {
      setComponents(prev => prev.map(c => c.id === id ? { ...c, rejected: true, approved: false } : c));
    }
  }, []);

  const handlePreview = useCallback(async (id: string) => {
    const headers = await getAuthHeaders();
    const token = (headers as Record<string, string>)["Authorization"]?.replace("Bearer ", "");
    const url = `${API_BASE}/api/engine/preview/${encodeURIComponent(id)}${token ? `?token=${encodeURIComponent(token)}` : ""}`;
    window.open(url, "_blank");
  }, []);

  // Derive categories
  const categories = Array.from(new Set(components.map(c => c.category))).sort();

  // Apply filters
  const filtered = components.filter(c => {
    if (filter === "pending" && (c.approved || c.rejected || c.merged)) return false;
    if (filter === "approved" && !c.approved) return false;
    if (filter === "rejected" && !c.rejected) return false;
    if (categoryFilter && c.category !== categoryFilter) return false;
    return true;
  });

  const counts = {
    all: components.length,
    pending: components.filter(c => !c.approved && !c.rejected && !c.merged).length,
    approved: components.filter(c => c.approved).length,
    rejected: components.filter(c => c.rejected).length,
  };

  const wrappedHtml = selectedHtml ? `<!DOCTYPE html><html><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<script src="https://cdn.tailwindcss.com"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js"></script>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.css">
<script src="https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.js"></script>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Playfair+Display:ital,wght@0,700;1,700&display=swap" rel="stylesheet">
<style>body{font-family:'Inter',sans-serif;margin:0;overflow-x:hidden}</style>
</head><body>${selectedHtml}</body></html>` : "";

  // Job progress helpers
  const jobDone = genJob ? genJob.accepted + genJob.normalized + genJob.rejected + genJob.errors : 0;
  const jobRunning = genJob?.status === "running";

  return (
    <div style={{
      height: "100vh",
      display: "flex",
      fontFamily: "'Inter', system-ui, sans-serif",
      background: "var(--chrome-bg, #FAF8F9)",
      color: "var(--chrome-text, #1F1A1C)",
    }}>
      {/* Sidebar */}
      <div style={{
        width: 280,
        borderRight: "1px solid var(--chrome-border, #e5e5e5)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{ padding: 16, borderBottom: "1px solid var(--chrome-border, #e5e5e5)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <button
              onClick={onBack}
              style={{
                background: "none", border: "none", cursor: "pointer",
                color: "var(--chrome-text-muted, #999)", fontSize: 12,
                padding: "4px 0",
                display: "flex", alignItems: "center", gap: 4,
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 12H5M12 19l-7-7 7-7"/>
              </svg>
              Back
            </button>
            <div style={{ flex: 1 }} />
            <button
              onClick={() => setShowModal(true)}
              style={{
                padding: "5px 14px", borderRadius: 6, border: "none", cursor: "pointer",
                background: "var(--accent, #7c5cfc)", color: "#fff",
                fontSize: 11, fontWeight: 600,
                display: "flex", alignItems: "center", gap: 5,
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              Generate
            </button>
          </div>
          <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>Review Components</h2>
          <p style={{ fontSize: 12, color: "var(--chrome-text-muted, #999)", margin: "4px 0 0" }}>
            {counts.pending} pending review
          </p>

          {/* Progress pill — visible when job is active */}
          {genJob && (
            <div style={{
              marginTop: 10,
              padding: "6px 10px",
              borderRadius: 8,
              background: jobRunning
                ? "rgba(124,92,252,0.08)"
                : genJob.status === "completed" ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)",
              display: "flex", alignItems: "center", gap: 8,
              cursor: jobRunning ? "default" : "pointer",
            }}
              onClick={() => { if (!jobRunning) setGenJob(null); }}
              title={jobRunning ? "Generation in progress" : "Click to dismiss"}
            >
              {jobRunning && <Spinner />}
              <span style={{
                flex: 1, fontSize: 11, fontWeight: 500,
                color: jobRunning ? "var(--accent, #7c5cfc)"
                  : genJob.status === "completed" ? "#16a34a" : "#dc2626",
              }}>
                {jobRunning && `Generating ${jobDone}/${genJob.requested}...`}
                {genJob.status === "completed" && `Done: ${genJob.accepted} accepted, ${genJob.rejected} rejected`}
                {genJob.status === "failed" && "Generation failed"}
              </span>
              {jobRunning && (
                <div style={{
                  width: 40, height: 3, borderRadius: 2,
                  background: "rgba(124,92,252,0.15)", overflow: "hidden",
                }}>
                  <div style={{
                    height: "100%", borderRadius: 2,
                    background: "var(--accent, #7c5cfc)",
                    width: `${genJob.requested > 0 ? (jobDone / genJob.requested) * 100 : 0}%`,
                    transition: "width 0.3s",
                  }} />
                </div>
              )}
              {!jobRunning && (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ opacity: 0.5 }}>
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              )}
            </div>
          )}
        </div>

        {/* Filter tabs */}
        <div style={{ display: "flex", gap: 2, padding: "8px 12px", borderBottom: "1px solid var(--chrome-border, #e5e5e5)" }}>
          {(["all", "pending", "approved", "rejected"] as Filter[]).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                flex: 1, padding: "5px 0", borderRadius: 4, border: "none", cursor: "pointer",
                background: filter === f ? "var(--accent-bg, rgba(124,92,252,0.1))" : "transparent",
                color: filter === f ? "var(--accent, #7c5cfc)" : "var(--chrome-text-muted, #999)",
                fontSize: 11, fontWeight: filter === f ? 600 : 400,
                textTransform: "capitalize",
              }}
            >
              {f} ({counts[f]})
            </button>
          ))}
        </div>

        {/* Category filter */}
        <div style={{ padding: "8px 12px", borderBottom: "1px solid var(--chrome-border, #e5e5e5)", display: "flex", flexWrap: "wrap", gap: 4 }}>
          <button
            onClick={() => setCategoryFilter(null)}
            style={{
              padding: "3px 8px", borderRadius: 10, border: "none", cursor: "pointer",
              background: !categoryFilter ? "var(--accent, #7c5cfc)" : "var(--chrome-surface, #f0f0f0)",
              color: !categoryFilter ? "#fff" : "var(--chrome-text-muted, #999)",
              fontSize: 10, fontWeight: 500,
            }}
          >
            All
          </button>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              style={{
                padding: "3px 8px", borderRadius: 10, border: "none", cursor: "pointer",
                background: categoryFilter === cat ? "var(--accent, #7c5cfc)" : "var(--chrome-surface, #f0f0f0)",
                color: categoryFilter === cat ? "#fff" : "var(--chrome-text-muted, #999)",
                fontSize: 10, fontWeight: 500,
              }}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Component list */}
        <div style={{ flex: 1, overflowY: "auto", padding: "4px 8px" }}>
          {loading && (
            <div style={{ textAlign: "center", padding: 40, color: "var(--chrome-text-muted, #999)", fontSize: 13 }}>
              Loading...
            </div>
          )}
          {!loading && filtered.length === 0 && (
            <div style={{ textAlign: "center", padding: 40, color: "var(--chrome-text-muted, #999)", fontSize: 13 }}>
              No components match this filter
            </div>
          )}
          {filtered.map(comp => (
            <button
              key={comp.id}
              onClick={() => setSelectedId(comp.id)}
              style={{
                display: "block", width: "100%", textAlign: "left",
                padding: "10px 12px", borderRadius: 6, border: "none", cursor: "pointer",
                background: selectedId === comp.id ? "var(--accent-bg, rgba(124,92,252,0.1))" : "transparent",
                marginBottom: 2, transition: "background 0.1s",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{
                  fontSize: 13, fontWeight: selectedId === comp.id ? 600 : 400,
                  color: selectedId === comp.id ? "var(--accent, #7c5cfc)" : "var(--chrome-text, #333)",
                  flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {comp.name || comp.id}
                </span>
                {comp.approved && <StatusDot color="#22c55e" title="Approved" />}
                {comp.rejected && <StatusDot color="#ef4444" title="Rejected" />}
                {comp.merged && <StatusDot color="#3b82f6" title="Merged" />}
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                <span style={{
                  fontSize: 10, padding: "1px 6px", borderRadius: 8,
                  background: "var(--chrome-surface, #f0f0f0)",
                  color: "var(--chrome-text-muted, #999)",
                }}>
                  {comp.category}
                </span>
                {comp.tier && (
                  <span style={{
                    fontSize: 10, padding: "1px 6px", borderRadius: 8,
                    background: comp.tier === "gold" ? "rgba(234,179,8,0.15)" : comp.tier === "silver" ? "rgba(148,163,184,0.15)" : "var(--chrome-surface, #f0f0f0)",
                    color: comp.tier === "gold" ? "#b45309" : comp.tier === "silver" ? "#64748b" : "var(--chrome-text-muted, #999)",
                  }}>
                    {comp.tier}
                  </span>
                )}
                {comp.score != null && (
                  <span style={{
                    fontSize: 10,
                    color: comp.score >= 8 ? "#16a34a" : comp.score >= 6 ? "#ca8a04" : "#dc2626",
                  }}>
                    {comp.score}/10
                  </span>
                )}
              </div>
              {comp.source?.domain && (
                <div style={{ fontSize: 10, color: "var(--chrome-text-muted, #999)", marginTop: 3 }}>
                  {comp.source.domain}
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Main preview area */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {!selectedId && (
          <div style={{
            flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
            color: "var(--chrome-text-muted, #999)", fontSize: 14,
          }}>
            Select a component to preview
          </div>
        )}

        {selectedId && (
          <>
            {/* Toolbar */}
            <div style={{
              padding: "12px 20px",
              borderBottom: "1px solid var(--chrome-border, #e5e5e5)",
              display: "flex", alignItems: "center", gap: 10,
            }}>
              <span style={{ fontSize: 14, fontWeight: 600, flex: 1 }}>
                {components.find(c => c.id === selectedId)?.name || selectedId}
              </span>

              <button
                onClick={() => handlePreview(selectedId)}
                style={{
                  padding: "7px 16px", borderRadius: 6,
                  border: "1px solid var(--chrome-border, #e5e5e5)",
                  background: "var(--chrome-surface, #f5f5f5)",
                  color: "var(--chrome-text, #333)",
                  fontSize: 12, fontWeight: 500, cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 6,
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                  <polyline points="15 3 21 3 21 9"/>
                  <line x1="10" y1="14" x2="21" y2="3"/>
                </svg>
                Preview
              </button>

              <button
                onClick={() => handleReject(selectedId)}
                style={{
                  padding: "7px 16px", borderRadius: 6,
                  border: "1px solid #fca5a5",
                  background: components.find(c => c.id === selectedId)?.rejected ? "#ef4444" : "#fff5f5",
                  color: components.find(c => c.id === selectedId)?.rejected ? "#fff" : "#dc2626",
                  fontSize: 12, fontWeight: 500, cursor: "pointer",
                }}
              >
                Reject
              </button>

              <button
                onClick={() => handleApprove(selectedId)}
                style={{
                  padding: "7px 16px", borderRadius: 6,
                  border: "1px solid #86efac",
                  background: components.find(c => c.id === selectedId)?.approved ? "#22c55e" : "#f0fdf4",
                  color: components.find(c => c.id === selectedId)?.approved ? "#fff" : "#16a34a",
                  fontSize: 12, fontWeight: 500, cursor: "pointer",
                }}
              >
                Approve
              </button>
            </div>

            {/* iframe preview */}
            <div style={{ flex: 1, padding: 16, overflow: "hidden" }}>
              {loadingHtml ? (
                <div style={{
                  height: "100%", display: "flex", alignItems: "center", justifyContent: "center",
                  color: "var(--chrome-text-muted, #999)", fontSize: 13,
                }}>
                  Loading preview...
                </div>
              ) : (
                <iframe
                  srcDoc={wrappedHtml}
                  sandbox="allow-scripts"
                  style={{
                    width: "100%",
                    height: "100%",
                    border: "1px solid var(--chrome-border, #e5e5e5)",
                    borderRadius: 8,
                    background: "#fff",
                  }}
                  title="Component preview"
                />
              )}
            </div>
          </>
        )}
      </div>

      {/* ── Generate Modal ── */}
      {showModal && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 1000,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
          onClick={e => { if (e.target === e.currentTarget) setShowModal(false); }}
        >
          {/* Backdrop */}
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.35)", backdropFilter: "blur(2px)" }} />

          {/* Panel */}
          <div style={{
            position: "relative", zIndex: 1,
            background: "var(--chrome-bg, #fff)",
            borderRadius: 12,
            boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
            width: 440, maxHeight: "80vh",
            display: "flex", flexDirection: "column",
            overflow: "hidden",
          }}>
            {/* Modal header */}
            <div style={{
              padding: "20px 24px 16px",
              borderBottom: "1px solid var(--chrome-border, #e5e5e5)",
              display: "flex", alignItems: "center",
            }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0, flex: 1 }}>Generate Components</h3>
              <button
                onClick={() => setShowModal(false)}
                style={{
                  background: "none", border: "none", cursor: "pointer",
                  color: "var(--chrome-text-muted, #999)", padding: 4,
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            {/* Method tabs */}
            <div style={{ display: "flex", gap: 0, borderBottom: "1px solid var(--chrome-border, #e5e5e5)" }}>
              {([
                { id: "pipeline" as GenMethod, label: "Pipeline", desc: "From crawled sections" },
                { id: "skeleton" as GenMethod, label: "Skeleton", desc: "CSS-only enhance" },
                { id: "brand-lock" as GenMethod, label: "Brand Lock", desc: "Exact brand colors" },
              ]).map(m => (
                <button
                  key={m.id}
                  onClick={() => setGenMethod(m.id)}
                  style={{
                    flex: 1, padding: "12px 8px 10px", border: "none", cursor: "pointer",
                    background: "transparent",
                    borderBottom: genMethod === m.id ? "2px solid var(--accent, #7c5cfc)" : "2px solid transparent",
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
                  }}
                >
                  <span style={{
                    fontSize: 12, fontWeight: genMethod === m.id ? 600 : 400,
                    color: genMethod === m.id ? "var(--accent, #7c5cfc)" : "var(--chrome-text, #333)",
                  }}>{m.label}</span>
                  <span style={{ fontSize: 9, color: "var(--chrome-text-muted, #aaa)" }}>{m.desc}</span>
                </button>
              ))}
            </div>

            {/* Form body */}
            <div style={{ padding: "20px 24px", overflowY: "auto", flex: 1 }}>
              {/* How it works */}
              <HowItWorks method={genMethod} />

              {/* Pipeline */}
              {genMethod === "pipeline" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <FormField label="Count">
                    <input type="number" min={1} max={50} value={genCount}
                      onChange={e => setGenCount(Math.max(1, Math.min(50, parseInt(e.target.value) || 1)))}
                      disabled={jobRunning} style={{ ...inputStyle, width: 80, textAlign: "center" as const }} />
                  </FormField>
                  <FormField label="Domain" hint="Optional — filter by source domain">
                    <input placeholder="e.g. stripe.com" value={genDomain}
                      onChange={e => setGenDomain(e.target.value)} style={inputStyle} />
                  </FormField>
                </div>
              )}

              {/* Skeleton */}
              {genMethod === "skeleton" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <FormField label="Skeleton Pattern">
                    <select value={genSkeleton} onChange={e => setGenSkeleton(e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
                      <option value="">-- Select a skeleton --</option>
                      {skeletons.map(s => (
                        <option key={s.name} value={s.name}>{s.name} ({s.libraries.join(", ")})</option>
                      ))}
                    </select>
                  </FormField>
                  {genSkeleton && skeletons.find(s => s.name === genSkeleton)?.description && (
                    <div style={{
                      fontSize: 11, color: "var(--chrome-text-muted, #999)",
                      padding: "8px 12px", borderRadius: 6,
                      background: "var(--chrome-surface, #f5f5f5)",
                      lineHeight: 1.4,
                    }}>
                      {skeletons.find(s => s.name === genSkeleton)?.description}
                    </div>
                  )}
                  <FormField label="Description" hint="What this component is for">
                    <input placeholder="e.g. Adidas annual report hero" value={genDescription}
                      onChange={e => setGenDescription(e.target.value)} style={inputStyle} />
                  </FormField>
                  <FormField label="Color Palette">
                    <ColorPaletteInput value={genColors} onChange={setGenColors} />
                  </FormField>
                  <FormField label="Image Style">
                    <input placeholder="e.g. Athletic photography" value={genImages}
                      onChange={e => setGenImages(e.target.value)} style={inputStyle} />
                  </FormField>
                </div>
              )}

              {/* Brand Lock */}
              {genMethod === "brand-lock" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <FormField label="Count">
                    <input type="number" min={1} max={50} value={genCount}
                      onChange={e => setGenCount(Math.max(1, Math.min(50, parseInt(e.target.value) || 1)))}
                      style={{ ...inputStyle, width: 80, textAlign: "center" as const }} />
                  </FormField>
                  <FormField label="Brand Name" required>
                    <input placeholder="e.g. adidas" value={genBrandName}
                      onChange={e => setGenBrandName(e.target.value)} style={inputStyle} />
                  </FormField>
                  <FormField label="Brand Colors" required>
                    <ColorPaletteInput value={genBrandColors} onChange={setGenBrandColors} />
                  </FormField>
                  <FormField label="Brand Fonts">
                    <input placeholder="e.g. AdihausDIN, Georgia" value={genBrandFonts}
                      onChange={e => setGenBrandFonts(e.target.value)} style={inputStyle} />
                  </FormField>
                  <FormField label="Brand Style">
                    <input placeholder="e.g. Dark, bold, athletic" value={genBrandStyle}
                      onChange={e => setGenBrandStyle(e.target.value)} style={inputStyle} />
                  </FormField>
                  <FormField label="Domain" hint="Optional — filter source sections">
                    <input placeholder="e.g. report.adidas-group.com" value={genDomain}
                      onChange={e => setGenDomain(e.target.value)} style={inputStyle} />
                  </FormField>
                </div>
              )}

              {genError && (
                <div style={{
                  marginTop: 12, padding: "8px 12px", borderRadius: 6,
                  background: "rgba(239,68,68,0.08)", color: "#dc2626",
                  fontSize: 12,
                }}>
                  {genError}
                </div>
              )}
            </div>

            {/* Modal footer */}
            <div style={{
              padding: "16px 24px",
              borderTop: "1px solid var(--chrome-border, #e5e5e5)",
              display: "flex", alignItems: "center", gap: 10,
            }}>
              <button
                onClick={() => setShowModal(false)}
                style={{
                  padding: "9px 20px", borderRadius: 6,
                  border: "1px solid var(--chrome-border, #e5e5e5)",
                  background: "transparent",
                  color: "var(--chrome-text, #333)",
                  fontSize: 13, fontWeight: 500, cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <div style={{ flex: 1 }} />
              <button
                onClick={handleGenerate}
                disabled={jobRunning}
                style={{
                  padding: "9px 28px", borderRadius: 6, border: "none",
                  cursor: jobRunning ? "default" : "pointer",
                  background: jobRunning ? "var(--chrome-surface, #e5e5e5)" : "var(--accent, #7c5cfc)",
                  color: jobRunning ? "var(--chrome-text-muted, #999)" : "#fff",
                  fontSize: 13, fontWeight: 600,
                }}
              >
                {genMethod === "skeleton" ? "Enhance Skeleton" : `Generate ${genMethod === "pipeline" || genMethod === "brand-lock" ? genCount : ""}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusDot({ color, title }: { color: string; title: string }) {
  return (
    <span
      title={title}
      style={{
        width: 8, height: 8, borderRadius: "50%",
        background: color, display: "inline-block", flexShrink: 0,
      }}
    />
  );
}

function Spinner() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ animation: "spin 1s linear infinite", flexShrink: 0 }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <circle cx="12" cy="12" r="10" stroke="var(--accent, #7c5cfc)" strokeWidth="2.5" strokeDasharray="32 32" strokeLinecap="round" />
    </svg>
  );
}

function FormField({ label, hint, required, children }: { label: string; hint?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--chrome-text, #333)", marginBottom: 4 }}>
        {label}{required && <span style={{ color: "#dc2626", marginLeft: 2 }}>*</span>}
      </label>
      {children}
      {hint && <div style={{ fontSize: 10, color: "var(--chrome-text-muted, #aaa)", marginTop: 3 }}>{hint}</div>}
    </div>
  );
}

function HowItWorks({ method }: { method: GenMethod }) {
  const [open, setOpen] = useState(false);

  const content: Record<GenMethod, { steps: string[]; tip: string }> = {
    pipeline: {
      steps: [
        "Generates components from websites already crawled and briefed in the database.",
        "Each briefed section has an animation brief describing scroll effects, transitions, and layout.",
        "A creative persona is assigned to style the component (typography, colors, mood).",
        "Kimi K2.5 generates the full HTML + CSS + JS from the brief.",
        "Components are scored on 9 quality factors (accessibility, responsiveness, animation, etc.).",
        "Scored 7+/10 = accepted, 4-7 = normalized and re-scored, <4 = rejected.",
      ],
      tip: "Requires briefed sections in the database. If none are available, crawl a site first via the CLI: npx tsx scripts/component-engine.ts --crawl stripe.com --brief",
    },
    skeleton: {
      steps: [
        "Pick a pre-built skeleton — a working HTML component with animations already coded.",
        "Describe what the component is for and set your brand colors.",
        "Kimi K2.5 returns ONLY a CSS stylesheet — the HTML and JavaScript are never touched.",
        "The CSS adds typography, colors, gradients, hover effects, and responsive breakpoints.",
        "Because the DOM stays untouched, animations (GSAP, ScrollTrigger, Swiper) always work.",
      ],
      tip: "Best for premium animated components. The skeleton library has patterns like scrollytelling panels, parallax heroes, counter dashboards, carousels, and marquees.",
    },
    "brand-lock": {
      steps: [
        "Works like Pipeline but locks generation to your exact brand palette.",
        "Bypasses the random persona system — no more purple gothic or neon cyberpunk on your corporate site.",
        "Set your brand name, exact hex colors, fonts, and style description.",
        "The prompt tells Kimi to use ONLY these colors — no palette invention.",
        "Combine with Domain to only generate from a specific crawled site's sections.",
      ],
      tip: "Use this when generating components for a known client. Example: --brand-lock adidas with colors #000, #FFF, #00B140 ensures every component matches the brand.",
    },
  };

  const { steps, tip } = content[method];

  return (
    <div style={{
      marginBottom: 16,
      borderRadius: 8,
      border: "1px solid var(--chrome-border, #e5e5e5)",
      overflow: "hidden",
    }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: "100%", padding: "8px 12px",
          background: "var(--chrome-surface, #f8f8f8)",
          border: "none", cursor: "pointer",
          display: "flex", alignItems: "center", gap: 6,
          fontSize: 11, fontWeight: 500, color: "var(--chrome-text-muted, #777)",
        }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
        How it works
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
          style={{ marginLeft: "auto", transform: open ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.15s" }}>
          <path d="M9 18l6-6-6-6"/>
        </svg>
      </button>
      {open && (
        <div style={{ padding: "12px 14px", fontSize: 11, lineHeight: 1.6, color: "var(--chrome-text, #444)" }}>
          <ol style={{ margin: 0, paddingLeft: 18 }}>
            {steps.map((s, i) => (
              <li key={i} style={{ marginBottom: 4 }}>{s}</li>
            ))}
          </ol>
          <div style={{
            marginTop: 10, padding: "8px 10px", borderRadius: 6,
            background: "rgba(124,92,252,0.06)",
            fontSize: 10, color: "var(--chrome-text-muted, #666)",
            lineHeight: 1.5,
          }}>
            <strong>Tip:</strong> {tip}
          </div>
        </div>
      )}
    </div>
  );
}

function ColorPaletteInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  // Parse comma-separated hex colors from the string
  const colors = value
    .split(",")
    .map(c => c.trim())
    .filter(c => /^#[0-9a-fA-F]{3,8}$/.test(c));

  const updateColor = (index: number, hex: string) => {
    const updated = [...colors];
    updated[index] = hex;
    onChange(updated.join(", "));
  };

  const addColor = (hex: string) => {
    onChange(value ? `${value}, ${hex}` : hex);
  };

  const removeColor = (index: number) => {
    const updated = colors.filter((_, i) => i !== index);
    onChange(updated.join(", "));
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {/* Swatches row */}
      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
        {colors.map((color, i) => (
          <div key={i} style={{ position: "relative", display: "inline-flex" }}>
            <label style={{
              width: 32, height: 32, borderRadius: 6, cursor: "pointer",
              background: color,
              border: "2px solid var(--chrome-border, #e5e5e5)",
              boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
              display: "block",
            }}>
              <input
                type="color"
                value={color.length === 4
                  ? `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`
                  : color}
                onChange={e => updateColor(i, e.target.value)}
                style={{ position: "absolute", width: 0, height: 0, opacity: 0, pointerEvents: "none" }}
              />
            </label>
            <button
              onClick={() => removeColor(i)}
              style={{
                position: "absolute", top: -5, right: -5,
                width: 14, height: 14, borderRadius: "50%",
                background: "var(--chrome-bg, #fff)",
                border: "1px solid var(--chrome-border, #ddd)",
                cursor: "pointer", padding: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 9, color: "var(--chrome-text-muted, #999)", lineHeight: 1,
              }}
              title="Remove"
            >
              x
            </button>
          </div>
        ))}

        {/* Add color button */}
        <label style={{
          width: 32, height: 32, borderRadius: 6, cursor: "pointer",
          border: "2px dashed var(--chrome-border, #ccc)",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "var(--chrome-text-muted, #999)", fontSize: 16,
        }}
          title="Add color"
        >
          +
          <input
            type="color"
            value="#000000"
            onChange={e => addColor(e.target.value)}
            style={{ position: "absolute", width: 0, height: 0, opacity: 0, pointerEvents: "none" }}
          />
        </label>
      </div>

      {/* Raw text fallback */}
      <input
        placeholder="#000000, #FFFFFF, #00B140"
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{ ...inputStyle, fontSize: 11, color: "var(--chrome-text-muted, #888)" }}
      />
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "8px 12px", borderRadius: 6,
  border: "1px solid var(--chrome-border, #e5e5e5)",
  background: "var(--chrome-surface, #f5f5f5)",
  color: "var(--chrome-text, #333)",
  fontSize: 13,
};
