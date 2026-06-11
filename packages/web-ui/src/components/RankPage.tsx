import { useState, useEffect, useCallback, useRef } from "react";
import { API_BASE, getAuthHeaders } from "../utils/api";

interface SectionType {
  type: string;
  count: number;
}

interface TemplatePair {
  a: { _id: string; type: string; style?: string; html: string; elo: { rating: number; matches: number; wins: number; sigma: number } };
  b: { _id: string; type: string; style?: string; html: string; elo: { rating: number; matches: number; wins: number; sigma: number } };
}

interface LeaderboardEntry {
  _id: string;
  type: string;
  style?: string;
  rating: number;
  matches: number;
  wins: number;
  htmlSnippet: string;
}

async function fetchSectionTypes(): Promise<SectionType[]> {
  const res = await fetch(`${API_BASE}/api/elo/section-types`, { headers: await getAuthHeaders() });
  if (!res.ok) return [];
  return res.json();
}

async function fetchPair(sectionType: string): Promise<TemplatePair | null> {
  const res = await fetch(`${API_BASE}/api/elo/pair/${encodeURIComponent(sectionType)}`, { headers: await getAuthHeaders() });
  if (!res.ok) return null;
  return res.json();
}

async function fetchLeaderboard(sectionType: string): Promise<LeaderboardEntry[]> {
  const res = await fetch(`${API_BASE}/api/elo/leaderboard/${encodeURIComponent(sectionType)}`, { headers: await getAuthHeaders() });
  if (!res.ok) return [];
  return res.json();
}

async function submitVote(winnerId: string, loserId: string, outcome: "win" | "draw", sectionType: string): Promise<void> {
  await fetch(`${API_BASE}/api/elo/compare`, {
    method: "POST",
    headers: await getAuthHeaders(),
    body: JSON.stringify({ winnerId, loserId, outcome, sectionType }),
  });
}

interface Props {
  onBack: () => void;
}

export function RankPage({ onBack }: Props) {
  const [sectionTypes, setSectionTypes] = useState<SectionType[]>([]);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [pair, setPair] = useState<TemplatePair | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [voted, setVoted] = useState(false);
  const [totalVotes, setTotalVotes] = useState(0);
  const iframeARef = useRef<HTMLIFrameElement>(null);
  const iframeBRef = useRef<HTMLIFrameElement>(null);

  // Load section types on mount
  useEffect(() => {
    fetchSectionTypes().then(types => {
      setSectionTypes(types);
      if (types.length > 0) setSelectedType(types[0].type);
    });
  }, []);

  // Load pair + leaderboard when type changes
  useEffect(() => {
    if (!selectedType) return;
    setLoading(true);
    setPair(null);
    Promise.all([
      fetchPair(selectedType),
      fetchLeaderboard(selectedType),
    ]).then(([p, lb]) => {
      setPair(p);
      setLeaderboard(lb);
      setLoading(false);
      setVoted(false);
    });
  }, [selectedType]);

  const loadNextPair = useCallback(() => {
    if (!selectedType) return;
    setLoading(true);
    setVoted(false);
    Promise.all([
      fetchPair(selectedType),
      fetchLeaderboard(selectedType),
    ]).then(([p, lb]) => {
      setPair(p);
      setLeaderboard(lb);
      setLoading(false);
    });
  }, [selectedType]);

  const handleVote = useCallback((choice: "a" | "b" | "skip") => {
    if (!pair || voted) return;
    setVoted(true);
    setTotalVotes(v => v + 1);

    if (choice === "skip") {
      // Draw
      submitVote(pair.a._id, pair.b._id, "draw", pair.a.type).then(loadNextPair);
    } else {
      const winnerId = choice === "a" ? pair.a._id : pair.b._id;
      const loserId = choice === "a" ? pair.b._id : pair.a._id;
      submitVote(winnerId, loserId, "win", pair.a.type).then(loadNextPair);
    }
  }, [pair, voted, loadNextPair]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A" || e.key === "1") handleVote("a");
      else if (e.key === "ArrowRight" || e.key === "d" || e.key === "D" || e.key === "2") handleVote("b");
      else if (e.key === " " || e.key === "s" || e.key === "S") { e.preventDefault(); handleVote("skip"); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleVote]);

  const openPreviewTab = useCallback((html: string) => {
    const fullHtml = `<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<script src="https://cdn.tailwindcss.com"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js"></script>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.css">
<script src="https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.js"></script>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Playfair+Display:ital,wght@0,700;1,700&display=swap" rel="stylesheet">
<style>body{font-family:'Inter',sans-serif;margin:0;}</style>
</head><body class="bg-white">
<div style="height:30vh;background:#f3f4f6;display:flex;align-items:center;justify-content:center">
<p style="color:#9ca3af;font-size:14px">Scroll down to see component</p>
</div>
${html}
<div style="height:50vh;background:#f9fafb"></div>
<script>window.addEventListener('load',function(){if(typeof gsap!=='undefined'&&typeof ScrollTrigger!=='undefined'){gsap.registerPlugin(ScrollTrigger);setTimeout(function(){ScrollTrigger.refresh()},200)}});</script>
</body></html>`;
    const blob = new Blob([fullHtml], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
  }, []);

  const renderIframe = (html: string, ref: React.RefObject<HTMLIFrameElement | null>) => {
    const wrappedHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><script src="https://cdn.tailwindcss.com"></script><style>body{margin:0;overflow-x:hidden}</style></head><body>${html}</body></html>`;
    return (
      <iframe
        ref={ref}
        srcDoc={wrappedHtml}
        sandbox="allow-scripts"
        style={{
          width: "100%",
          height: 400,
          border: "1px solid var(--chrome-border, #e5e5e5)",
          borderRadius: 8,
          background: "#fff",
        }}
        title="Section preview"
      />
    );
  };

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
        width: 220,
        borderRight: "1px solid var(--chrome-border, #e5e5e5)",
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 4,
        overflowY: "auto",
      }}>
        <button
          onClick={onBack}
          style={{
            background: "none", border: "none", cursor: "pointer",
            color: "var(--chrome-text-muted, #999)", fontSize: 12,
            textAlign: "left", padding: "6px 8px", marginBottom: 8,
            display: "flex", alignItems: "center", gap: 6,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
          Back to Library
        </button>

        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--chrome-text-muted, #999)", textTransform: "uppercase", letterSpacing: "0.05em", padding: "8px 8px 4px" }}>
          Section Types
        </div>

        {sectionTypes.map(st => (
          <button
            key={st.type}
            onClick={() => setSelectedType(st.type)}
            style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "8px 10px", borderRadius: 6, border: "none", cursor: "pointer",
              background: selectedType === st.type ? "var(--accent-bg, rgba(124,92,252,0.1))" : "transparent",
              color: selectedType === st.type ? "var(--accent, #7c5cfc)" : "var(--chrome-text-secondary, #666)",
              fontSize: 13, fontWeight: selectedType === st.type ? 600 : 400,
              textAlign: "left", transition: "all 0.15s",
            }}
          >
            <span>{st.type}</span>
            <span style={{
              fontSize: 10, fontWeight: 500,
              background: "var(--chrome-surface, #f0f0f0)",
              padding: "2px 6px", borderRadius: 10,
              color: "var(--chrome-text-muted, #999)",
            }}>
              {st.count}
            </span>
          </button>
        ))}

        <div style={{ marginTop: "auto", padding: "12px 8px", borderTop: "1px solid var(--chrome-border, #e5e5e5)" }}>
          <div style={{ fontSize: 11, color: "var(--chrome-text-muted, #999)" }}>
            Your session
          </div>
          <div style={{ fontSize: 20, fontWeight: 600, color: "var(--chrome-text, #333)", marginTop: 4 }}>
            {totalVotes} rated
          </div>
          <div style={{ fontSize: 11, color: "var(--chrome-text-muted, #999)", marginTop: 8 }}>
            Shortcuts: <kbd style={kbdStyle}>A</kbd> left <kbd style={kbdStyle}>D</kbd> right <kbd style={kbdStyle}>Space</kbd> skip
          </div>
        </div>
      </div>

      {/* Main area */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Header */}
        <div style={{
          padding: "16px 24px",
          borderBottom: "1px solid var(--chrome-border, #e5e5e5)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>
              Rank Sections
            </h1>
            <p style={{ fontSize: 13, color: "var(--chrome-text-secondary, #666)", margin: "4px 0 0" }}>
              {selectedType
                ? `Which ${selectedType} section is better?`
                : "Select a section type to start comparing"}
            </p>
          </div>
        </div>

        {/* Comparison area */}
        <div style={{ flex: 1, padding: 24, overflowY: "auto" }}>
          {loading && (
            <div style={{ textAlign: "center", padding: 60, color: "var(--chrome-text-muted, #999)" }}>
              Loading pair...
            </div>
          )}

          {!loading && !pair && selectedType && (
            <div style={{ textAlign: "center", padding: 60, color: "var(--chrome-text-muted, #999)" }}>
              Not enough templates of type "{selectedType}" for comparison yet.
              <br />More templates are saved automatically as you generate pages.
            </div>
          )}

          {!loading && pair && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
                {/* Section A */}
                <div style={{
                  borderRadius: 10, overflow: "hidden",
                  border: voted ? "2px solid transparent" : "2px solid var(--chrome-border, #e5e5e5)",
                  transition: "border-color 0.2s",
                }}>
                  <div style={{
                    padding: "8px 12px",
                    background: "var(--chrome-surface, #f5f5f5)",
                    borderBottom: "1px solid var(--chrome-border, #e5e5e5)",
                    fontSize: 12, fontWeight: 600, color: "var(--chrome-text-secondary, #666)",
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                  }}>
                    <span>Section A</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <button
                        onClick={() => openPreviewTab(pair.a.html)}
                        style={{
                          background: "none", border: "1px solid var(--chrome-border, #ddd)", borderRadius: 4,
                          padding: "2px 8px", cursor: "pointer", fontSize: 10, fontWeight: 500,
                          color: "var(--chrome-text-secondary, #666)", display: "flex", alignItems: "center", gap: 4,
                        }}
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                        Preview
                      </button>
                      <span style={{ fontSize: 10, color: "var(--chrome-text-muted, #999)", fontWeight: 400 }}>
                        ELO {Math.round(pair.a.elo.rating)} ({pair.a.elo.matches} matches)
                      </span>
                    </div>
                  </div>
                  {renderIframe(pair.a.html, iframeARef)}
                </div>

                {/* Section B */}
                <div style={{
                  borderRadius: 10, overflow: "hidden",
                  border: voted ? "2px solid transparent" : "2px solid var(--chrome-border, #e5e5e5)",
                  transition: "border-color 0.2s",
                }}>
                  <div style={{
                    padding: "8px 12px",
                    background: "var(--chrome-surface, #f5f5f5)",
                    borderBottom: "1px solid var(--chrome-border, #e5e5e5)",
                    fontSize: 12, fontWeight: 600, color: "var(--chrome-text-secondary, #666)",
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                  }}>
                    <span>Section B</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <button
                        onClick={() => openPreviewTab(pair.b.html)}
                        style={{
                          background: "none", border: "1px solid var(--chrome-border, #ddd)", borderRadius: 4,
                          padding: "2px 8px", cursor: "pointer", fontSize: 10, fontWeight: 500,
                          color: "var(--chrome-text-secondary, #666)", display: "flex", alignItems: "center", gap: 4,
                        }}
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                        Preview
                      </button>
                      <span style={{ fontSize: 10, color: "var(--chrome-text-muted, #999)", fontWeight: 400 }}>
                        ELO {Math.round(pair.b.elo.rating)} ({pair.b.elo.matches} matches)
                      </span>
                    </div>
                  </div>
                  {renderIframe(pair.b.html, iframeBRef)}
                </div>
              </div>

              {/* Vote buttons */}
              <div style={{ display: "flex", justifyContent: "center", gap: 12, marginBottom: 32 }}>
                <VoteButton
                  onClick={() => handleVote("a")}
                  disabled={voted}
                  shortcut="A / \u2190"
                  label="Section A"
                  accent
                />
                <VoteButton
                  onClick={() => handleVote("skip")}
                  disabled={voted}
                  shortcut="Space"
                  label="Skip"
                />
                <VoteButton
                  onClick={() => handleVote("b")}
                  disabled={voted}
                  shortcut="D / \u2192"
                  label="Section B"
                  accent
                />
              </div>
            </>
          )}

          {/* Leaderboard */}
          {selectedType && leaderboard.length > 0 && (
            <div style={{ maxWidth: 600, margin: "0 auto" }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: "var(--chrome-text-secondary, #666)" }}>
                Leaderboard — {selectedType}
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {leaderboard.map((entry, i) => (
                  <div key={entry._id} style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "8px 12px", borderRadius: 6,
                    background: i === 0 ? "var(--accent-bg, rgba(124,92,252,0.06))" : "transparent",
                    fontSize: 13,
                  }}>
                    <span style={{
                      width: 24, textAlign: "right", fontWeight: 700, fontSize: 14,
                      color: i < 3 ? "var(--accent, #7c5cfc)" : "var(--chrome-text-muted, #999)",
                    }}>
                      #{i + 1}
                    </span>
                    <span style={{ flex: 1, color: "var(--chrome-text, #333)", fontWeight: 500 }}>
                      {entry.style || entry.type}
                    </span>
                    <span style={{ fontWeight: 600, fontSize: 14, color: "var(--chrome-text, #333)", minWidth: 60, textAlign: "right" }}>
                      {entry.rating}
                    </span>
                    <span style={{ fontSize: 11, color: "var(--chrome-text-muted, #999)", minWidth: 80 }}>
                      {entry.wins}W / {entry.matches}M
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function VoteButton({ onClick, disabled, shortcut, label, accent }: {
  onClick: () => void;
  disabled: boolean;
  shortcut: string;
  label: string;
  accent?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: "10px 24px",
        borderRadius: 8,
        border: accent ? "1px solid var(--accent, #7c5cfc)" : "1px solid var(--chrome-border, #e5e5e5)",
        background: accent ? "var(--accent, #7c5cfc)" : "var(--chrome-surface, #f5f5f5)",
        color: accent ? "#fff" : "var(--chrome-text-secondary, #666)",
        fontSize: 13,
        fontWeight: 600,
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.5 : 1,
        transition: "all 0.15s",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 4,
        minWidth: 100,
      }}
    >
      <span>{label}</span>
      <span style={{ fontSize: 10, fontWeight: 400, opacity: 0.7 }}>{shortcut}</span>
    </button>
  );
}

const kbdStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "1px 5px",
  borderRadius: 3,
  border: "1px solid var(--chrome-border, #ddd)",
  background: "var(--chrome-surface, #f5f5f5)",
  fontSize: 10,
  fontFamily: "monospace",
  lineHeight: "16px",
};
