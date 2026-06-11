import { useState, useEffect, useRef } from "react";
import { useCanvasStore, type CanvasScreen } from "../stores/canvas-store";
import { sendFeedback } from "../utils/feedback";
import { API_BASE, getAuthHeaders } from "../utils/api";
import { debugLog } from "../utils/debug";

const API = API_BASE;

/** Simple markdown-like rendering: **bold**, - bullet lists, \n paragraphs */
function ChatMarkdown({ text }: { text: string }) {
  const parts = text.split("\n");
  return (
    <div>
      {parts.map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={i} style={{ height: 8 }} />;

        // Bullet list item
        if (trimmed.startsWith("- ")) {
          const content = trimmed.slice(2);
          return (
            <div key={i} style={{ display: "flex", gap: 6, padding: "2px 0" }}>
              <span style={{ color: "var(--chrome-text-muted)", flexShrink: 0 }}>-</span>
              <span dangerouslySetInnerHTML={{ __html: boldify(content) }} />
            </div>
          );
        }

        return <div key={i} style={{ padding: "2px 0" }} dangerouslySetInnerHTML={{ __html: boldify(trimmed) }} />;
      })}
    </div>
  );
}

function boldify(text: string): string {
  return text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}

const SUGGESTIONS = [
  "Create a landing page for a SaaS product",
  "Redesign https://example.com",
  "Try a different color scheme",
];

interface ProgressStage { stage: string; detail?: string; time: number; }

// Pipeline steps shown based on the type of request
const REDESIGN_STEPS = [
  { stage: "Capturing a reference", delay: 0 },
  { stage: "Building the design system", delay: 6 },
  { stage: "Mapping out the components", delay: 14 },
  { stage: "Proposing pages", delay: 22 },
];
const GENERATE_STEPS = [
  { stage: "Analyzing prompt", delay: 0 },
  { stage: "Selecting components", delay: 4 },
  { stage: "Generating layout", delay: 8 },
  { stage: "Rendering HTML", delay: 20 },
];
const MULTIPAGE_STEPS = [
  { stage: "Applying design system", delay: 0 },
  { stage: "Generating pages", delay: 5 },
];

function GeneratingOverlay({ prompt, stages, mode }: { prompt: string; stages: ProgressStage[]; mode: "generate" | "redesign" | "multipage" }) {
  const [elapsed, setElapsed] = useState(0);
  const [activeStep, setActiveStep] = useState(0);
  const [collapsed, setCollapsed] = useState(false);

  const pipelineSteps = mode === "redesign" ? REDESIGN_STEPS : mode === "multipage" ? MULTIPAGE_STEPS : GENERATE_STEPS;

  useEffect(() => {
    const t = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const next = pipelineSteps.findIndex(s => s.delay > elapsed);
    const current = next === -1 ? pipelineSteps.length - 1 : Math.max(0, next - 1);
    setActiveStep(current);
  }, [elapsed, pipelineSteps]);

  const displaySteps = stages.length > 0 ? stages.map(s => s.stage) : pipelineSteps.map(s => s.stage);
  const currentIdx = stages.length > 0 ? stages.length - 1 : activeStep;
  const totalSteps = displaySteps.length;
  const progressPct = totalSteps > 0 ? Math.round(((currentIdx + 0.5) / totalSteps) * 100) : 0;

  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  const timeStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;

  return (
    <div style={{
      position: "fixed", bottom: 20, left: 20, zIndex: 200,
      width: 280, background: "var(--chrome-bg, #141416)",
      borderRadius: 14, border: "1px solid var(--chrome-border, rgba(255,255,255,0.06))",
      boxShadow: "0 12px 40px rgba(0,0,0,0.5)",
      backdropFilter: "blur(20px)", overflow: "hidden",
      animation: "fadeUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
      fontFamily: "'Inter', system-ui, sans-serif",
    }}>
      {/* Header */}
      <div
        onClick={() => setCollapsed(c => !c)}
        style={{
          padding: "10px 14px", display: "flex", alignItems: "center", gap: 8,
          borderBottom: collapsed ? "none" : "1px solid var(--chrome-border, rgba(255,255,255,0.06))",
          cursor: "pointer", userSelect: "none",
        }}
      >
        <div style={{
          width: 14, height: 14, borderRadius: "50%", flexShrink: 0,
          border: "2px solid var(--chrome-border, rgba(255,255,255,0.1))",
          borderTopColor: "var(--accent, #6366f1)",
          animation: "spin 0.8s linear infinite",
        }} />
        <span style={{
          fontSize: 12, fontWeight: 600, flex: 1,
          color: "var(--chrome-text, #fff)",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {prompt.slice(0, 25)}{prompt.length > 25 ? "..." : ""}
        </span>
        <span style={{ fontSize: 10, color: "var(--chrome-text-muted, rgba(255,255,255,0.25))" }}>
          {currentIdx + 1}/{totalSteps}
        </span>
        <span style={{
          fontSize: 14, color: "var(--chrome-text-muted, rgba(255,255,255,0.3))",
          transform: collapsed ? "rotate(-90deg)" : "none",
          transition: "transform 0.2s",
        }}>
          −
        </span>
      </div>

      {/* Steps (collapsible) */}
      {!collapsed && (
        <div style={{ padding: "10px 14px", display: "flex", flexDirection: "column", gap: 5 }}>
          {displaySteps.map((step, i) => {
            const isDone = i < currentIdx;
            const isActive = i === currentIdx;
            return (
              <div key={i} style={{
                display: "flex", alignItems: "center", gap: 7, fontSize: 11,
                animation: `slideIn 0.3s ease ${i * 0.05}s both`,
              }}>
                {isDone ? (
                  <span style={{ color: "#22c55e", fontSize: 12, width: 10, textAlign: "center", flexShrink: 0 }}>✓</span>
                ) : isActive ? (
                  <div style={{
                    width: 10, height: 10, borderRadius: "50%", flexShrink: 0,
                    border: "1.5px solid var(--chrome-border, rgba(255,255,255,0.1))",
                    borderTopColor: "var(--accent, #6366f1)",
                    animation: "spin 0.8s linear infinite",
                  }} />
                ) : (
                  <div style={{
                    width: 10, height: 10, borderRadius: "50%", flexShrink: 0,
                    background: "var(--chrome-border, rgba(255,255,255,0.06))",
                  }} />
                )}
                <span style={{
                  color: isDone
                    ? "var(--chrome-text-muted, rgba(255,255,255,0.35))"
                    : isActive
                      ? "var(--chrome-text, rgba(255,255,255,0.9))"
                      : "var(--chrome-text-muted, rgba(255,255,255,0.15))",
                  fontWeight: isActive ? 500 : 400,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {step}
                </span>
                {isDone && stages[i]?.detail && (
                  <span style={{ marginLeft: "auto", fontSize: 9, color: "var(--chrome-text-muted, rgba(255,255,255,0.15))" }}>
                    {stages[i].detail}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Progress bar + timer */}
      <div style={{ padding: "0 14px 10px", display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{
          flex: 1, height: 3,
          background: "var(--chrome-border, rgba(255,255,255,0.06))",
          borderRadius: 3, overflow: "hidden",
        }}>
          <div style={{
            height: "100%", width: `${progressPct}%`,
            background: "var(--accent, #6366f1)",
            borderRadius: 3, transition: "width 0.5s ease",
          }} />
        </div>
        <span style={{ fontSize: 9, color: "var(--chrome-text-muted, rgba(255,255,255,0.25))", whiteSpace: "nowrap" }}>
          {timeStr}
        </span>
      </div>
    </div>
  );
}

// Pending redesign plan waiting for user confirmation
interface RedesignPlan {
  url: string;
  brandName: string;
  designSystemName: string;
  analysis: string;
  proposedPages: Array<{ title: string; description: string }>;
  designTokens: Record<string, any>;
  fetchedContent: { textContent: string; stripped: string; fetchSucceeded: boolean };
}

// Helper: parse SSE events from response text
function parseSSE(text: string): any[] {
  const events: any[] = [];
  // SSE events are separated by \n\n — split on that first
  const blocks = text.split("\n\n");
  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;
    // Each block should be "data: {json}"
    const dataPrefix = "data: ";
    const idx = trimmed.indexOf(dataPrefix);
    if (idx === -1) continue;
    const jsonStr = trimmed.slice(idx + dataPrefix.length);
    try { events.push(JSON.parse(jsonStr)); }
    catch {
      console.warn("[parseSSE] Failed to parse:", jsonStr.slice(0, 100));
    }
  }
  return events;
}

export function ChatPanel() {
  const { chatMessages, addChatMessage, startGeneration, completeTask, failTask, project, createProject, designSystem, panTo, zoomTo, selectScreen, selectedScreenId, screens, agentTasks, agentLogOpen, toggleAgentLog, updateDesignSystem, addScreenSilent, removeScreenSilent, pushHistory, setScreenEditLoading } = useCanvasStore();
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 100) + "px";
  }, [input]);
  const [loading, setLoading] = useState(false);
  const [loadingPrompt, setLoadingPrompt] = useState("");
  const [loadingMode, setLoadingMode] = useState<"generate" | "redesign" | "multipage">("generate");
  const [progressStages, setProgressStages] = useState<ProgressStage[]>([]);
  const [pendingPlan, setPendingPlan] = useState<RedesignPlan | null>(null);
  const [toastDismissed, setToastDismissed] = useState(false);
  const [premiumScroll, setPremiumScroll] = useState(false);

  // Reset toast when new assistant message arrives
  useEffect(() => { setToastDismissed(false); }, [chatMessages.length]);

  const contextScreen = selectedScreenId ? screens.find(s => s.id === selectedScreenId) : null;

  // Extract actual fonts and colors from generated HTML and update the design system store
  const syncDesignSystemFromHtml = (html: string) => {
    if (!html || html.length < 100) return;
    try {
      // Extract Google Fonts from <link> tags
      const fontMatches = html.match(/fonts\.googleapis\.com\/css2\?family=([^"&]+)/g);
      const extractedFonts: string[] = [];
      if (fontMatches) {
        for (const m of fontMatches) {
          const families = m.replace(/fonts\.googleapis\.com\/css2\?family=/, "").split("&family=");
          for (const f of families) {
            const name = decodeURIComponent(f.split(":")[0]).replace(/\+/g, " ");
            if (name && !extractedFonts.includes(name)) extractedFonts.push(name);
          }
        }
      }

      // Extract hex colors (from inline styles, CSS, Tailwind [#xxx] brackets)
      const hexMatches = html.match(/#[0-9a-fA-F]{6}/g) || [];
      // Count frequency to rank by importance - keep ALL colours including blacks/whites
      const colorFreq = new Map<string, number>();
      const SKIP = new Set(["#f5f5f5", "#e5e7eb", "#d1d5db", "#9ca3af", "#6b7280", "#4b5563", "#374151"]);
      for (const c of hexMatches) {
        const lower = c.toLowerCase();
        if (SKIP.has(lower)) continue;
        colorFreq.set(lower, (colorFreq.get(lower) || 0) + 1);
      }
      // Separate into chromatic (has hue) and achromatic (black/white/gray)
      const isChromatic = (hex: string) => {
        const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        return (max - min) > 20; // saturation threshold
      };
      const chromatic = [...colorFreq.entries()].filter(([c]) => isChromatic(c)).sort((a, b) => b[1] - a[1]).map(e => e[0]);
      const achromatic = [...colorFreq.entries()].filter(([c]) => !isChromatic(c)).sort((a, b) => b[1] - a[1]).map(e => e[0]);
      // Primary/secondary from chromatic colours; neutral from achromatic
      const rankedColors = chromatic.length > 0 ? chromatic : [...colorFreq.entries()].sort((a, b) => b[1] - a[1]).map(e => e[0]);

      // Update design system with extracted values
      const updates: Partial<typeof designSystem> = {};
      if (extractedFonts.length >= 1) {
        updates.fonts = {
          headline: extractedFonts[0],
          body: extractedFonts[1] || extractedFonts[0],
          label: extractedFonts[2] || extractedFonts[1] || extractedFonts[0],
        };
      }
      if (rankedColors.length >= 2) {
        updates.palette = {
          ...designSystem.palette,
          primary: rankedColors[0],
          secondary: rankedColors[1],
          tertiary: rankedColors[2] || rankedColors[1],
          neutral: achromatic[0] || rankedColors[3] || designSystem.palette.neutral,
        };
        updates.seedColor = rankedColors[0];
        updates.colorTheme = "Custom";
      }
      if (Object.keys(updates).length > 0) {
        debugLog("design-sync", "Syncing design system from generated HTML:", { fonts: updates.fonts, primaryColor: updates.palette?.primary });
        updateDesignSystem(updates as any);
      }
    } catch (err) {
      console.warn("[design-sync] Failed to extract tokens from HTML:", err);
    }
  };

  const pendingAutoSendRef = useRef<string | null>(null);
  const pendingEditContextRef = useRef<{ elementSelector: string; elementTag: string; sectionSelector: string | null; sectionHtml: string | null } | null>(null);
  const sendRef = useRef<(text?: string, editContext?: typeof pendingEditContextRef.current) => void>(() => {});
  const abortRef = useRef<AbortController | null>(null);

  // Abort any in-flight request on unmount
  useEffect(() => {
    return () => { abortRef.current?.abort(); };
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      const text = detail?.text;
      if (text) {
        if (detail?.autoSend) {
          // Store for auto-send — the send function will pick it up on next render
          pendingAutoSendRef.current = text;
          pendingEditContextRef.current = detail.editContext || null;
          setInput(text); // Also set input to trigger re-render
        } else {
          setInput(text);
        }
      }
    };
    window.addEventListener("canvas-populate-chat", handler);
    return () => window.removeEventListener("canvas-populate-chat", handler);
  }, []);

  // Detect URL in prompt
  const detectUrl = (text: string): string | undefined => {
    // Match full URLs: https://example.com
    const full = text.match(/https?:\/\/[^\s,)]+/);
    if (full) return full[0];
    // Match www. prefixed: www.example.com
    const www = text.match(/www\.[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(?:\.[a-zA-Z]{2,})?(?:\/[^\s,)]*)?/);
    if (www) return `https://${www[0]}`;
    // Match bare domains ONLY if they look like "redesign example.com" or "example.co.uk"
    // Must have redesign/rebuild/redo keyword nearby, or the domain is the entire input
    const redesignMatch = text.match(/(?:redesign|rebuild|redo|remake|refresh)\s+([a-zA-Z0-9-]+(?:\.[a-zA-Z]{2,})+)/i);
    if (redesignMatch) return `https://${redesignMatch[1]}`;
    return undefined;
  };

  // Place a screen on the canvas grid
  const placeScreen = (index: number) => {
    const screenW = 1440, screenH = 4000, gap = 40, gridOffsetX = 630;
    const cardW = screenW * 0.3;
    const currentCount = useCanvasStore.getState().screens.length;
    const total = currentCount + index;
    const col = total % 3, row = Math.floor(total / 3);
    const x = col * (cardW + gap) + gridOffsetX;
    const y = row * (screenH * 0.3 + gap + 40) + gap;
    return { x, y, width: screenW, height: screenH, cardW };
  };

  // === PHASE 1: Plan a redesign (when URL detected) ===
  const planRedesign = async (url: string, prompt: string) => {
    let pid = project?.id;
    if (!pid) { createProject("Untitled"); pid = useCanvasStore.getState().project!.id; }

    setLoadingPrompt(prompt);
    setProgressStages([]);
    setLoadingMode("redesign");
    // Clear old design system card
    useCanvasStore.setState({ extractedTokens: null });
    setLoading(true);

    try {
      addChatMessage("user", prompt);
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const res = await fetch(`${API}/api/projects/${pid}/redesign/plan`, {
        method: "POST", headers: await getAuthHeaders(),
        body: JSON.stringify({ url, prompt, premiumScroll }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(await res.text());

      const responseText = await res.text();
      const events = parseSSE(responseText);
      for (const e of events) {
        if (e.type === "progress") setProgressStages(prev => [...prev, { stage: e.stage, detail: e.detail, time: Date.now() }]);
        if (e.type === "error") throw new Error(e.error);
      }

      const complete = events.find(e => e.type === "complete");
      if (!complete?.plan) throw new Error("No plan received");

      const plan: RedesignPlan = { url, ...complete.plan };
      setPendingPlan(plan);

      // Show plan in chat like Stitch does
      const pageList = plan.proposedPages.map(p => `- **${p.title}**: ${p.description}`).join("\n");
      addChatMessage("assistant",
        `I've analyzed the ${plan.brandName} site and created a new "${plan.designSystemName}" design system. ${plan.analysis}\n\nI'm proposing these pages:\n\n${pageList}\n\nShall I proceed with creating these designs?`
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      console.error("[ChatPanel] Planning failed:", msg);
      addChatMessage("assistant", `Planning failed: ${msg}`);
    } finally { setLoading(false); setLoadingPrompt(""); }
  };

  // === PHASE 2: Execute multi-page generation (after user confirms) ===
  const executeRedesign = async (plan: RedesignPlan) => {
    let pid = project?.id;
    if (!pid) { createProject("Untitled"); pid = useCanvasStore.getState().project!.id; }

    setPendingPlan(null);
    setLoadingPrompt(`Redesigning ${plan.brandName}`);
    setProgressStages([]);
    setLoadingMode("multipage");
    // Clear old design system card so it doesn't overlap
    useCanvasStore.setState({ extractedTokens: null });
    const task = startGeneration(`Redesign ${plan.brandName}`);
    setLoading(true);

    try {
      // Place design system card
      const firstPos = placeScreen(0);
      const dsCardX = firstPos.x - 560 - 30;
      const dsTokens = plan.designTokens;
      // Design tokens available in dsTokens

      // Extract colors, fonts, logos from brand data
      const rawColors = (dsTokens as any)?.colors || {};
      const extractedPalette = {
        primary: rawColors.primary || null,
        secondary: rawColors.secondary || rawColors.accent || null,
        tertiary: rawColors.accent || rawColors.tertiary || null,
        neutral: rawColors.background || rawColors.neutral || null,
        background: rawColors.background || null,
        text: rawColors.text || null,
      };
      const hasColors = Object.values(extractedPalette).some(c => c);
      if (hasColors) {
        updateDesignSystem({
          palette: {
            primary: extractedPalette.primary || designSystem.palette.primary,
            secondary: extractedPalette.secondary || designSystem.palette.secondary,
            tertiary: extractedPalette.tertiary || designSystem.palette.tertiary,
            neutral: extractedPalette.neutral || designSystem.palette.neutral,
            background: extractedPalette.background || undefined,
            text: extractedPalette.text || undefined,
          },
          fonts: {
            headline: (dsTokens as any)?.typography?.fontFamilies?.heading || designSystem.fonts.headline,
            body: (dsTokens as any)?.typography?.fontFamilies?.body || designSystem.fonts.body,
            label: designSystem.fonts.label,
          },
          logos: ((dsTokens as any)?.logos || []),
        });
      }
      useCanvasStore.setState({
        extractedTokens: { tokens: { ...dsTokens, brandName: plan.designSystemName }, x: dsCardX, y: firstPos.y },
      });

      // Add placeholder screens to canvas before generation starts
      // Use silent methods to avoid polluting undo history with intermediate states
      pushHistory(); // Single snapshot before generation
      const placeholderIds: string[] = [];
      // Cache positions upfront so they don't shift as screens are added/removed
      const cachedPositions = plan.proposedPages.map((_: any, i: number) => placeScreen(i));
      for (let i = 0; i < plan.proposedPages.length; i++) {
        const pos = cachedPositions[i];
        const phId = `ph_${Date.now()}_${i}`;
        placeholderIds.push(phId);
        addScreenSilent({
          id: phId, projectId: pid!, prompt: plan.proposedPages[i].title,
          html: "", deviceType: "DESKTOP",
          x: pos.x, y: pos.y, width: pos.width, height: pos.height,
          placeholder: true,
        });
      }

      // Pan to show placeholders + design card
      const vw = window.innerWidth, vh = window.innerHeight;
      panTo(vw / 2 - firstPos.x, vh / 2 - firstPos.y - 100);
      zoomTo(0.5);

      // Call multi-page generate endpoint
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const res = await fetch(`${API}/api/projects/${pid}/redesign/generate`, {
        method: "POST", headers: await getAuthHeaders(),
        body: JSON.stringify({
          url: plan.url,
          pages: plan.proposedPages,
          brandName: plan.brandName,
          designTokens: plan.designTokens,
          fetchedContent: plan.fetchedContent,
          deviceType: "DESKTOP",
          premiumScroll,
        }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(await res.text());

      // Stream SSE events — render each page on the canvas as soon as it arrives
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let lastScreenId = "";

      const processEvent = (e: any) => {
        if (e.type === "progress") {
          setProgressStages(prev => [...prev, { stage: e.stage, detail: e.detail, time: Date.now() }]);
        }
        if (e.type === "screen") {
          // Replace placeholder with real screen (silent to avoid intermediate undo states)
          const phId = placeholderIds[e.index];
          if (phId) {
            removeScreenSilent(phId);
          }
          const pos = cachedPositions[e.index] || placeScreen(e.index);
          const sid = e.screenId ?? `scr_${Date.now()}_${e.index}`;
          addScreenSilent({
            id: sid, projectId: pid!, prompt: `${plan.brandName} — ${e.title}`,
            html: e.html ?? "", deviceType: "DESKTOP",
            x: pos.x, y: pos.y, width: pos.width, height: pos.height,
          });
          // Sync design system from the first generated screen's actual HTML
          if (!lastScreenId && e.html) syncDesignSystemFromHtml(e.html);
          lastScreenId = sid;
        }
        if (e.type === "error") throw new Error(e.error);
      };

      // Read stream chunks and process SSE events as they arrive
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // SSE events are separated by \n\n — process complete events from buffer
        let boundary = buffer.indexOf("\n\n");
        while (boundary !== -1) {
          const block = buffer.slice(0, boundary).trim();
          buffer = buffer.slice(boundary + 2);
          if (block) {
            const dataPrefix = "data: ";
            const idx = block.indexOf(dataPrefix);
            if (idx !== -1) {
              const jsonStr = block.slice(idx + dataPrefix.length);
              try { processEvent(JSON.parse(jsonStr)); }
              catch { console.warn("[SSE] Failed to parse:", jsonStr.slice(0, 100)); }
            }
          }
          boundary = buffer.indexOf("\n\n");
        }
      }

      // Snapshot after generation so Ctrl+Z undoes the whole batch, not individual screens
      pushHistory();

      // Complete the task (without adding another screen)
      if (lastScreenId) {
        failTask(task.id, ""); // Just mark task as done without adding screen
      }

      // Summary message
      const pageNames = plan.proposedPages.map(p => p.title).join(", ");
      addChatMessage("assistant",
        `I've completed the redesign for ${plan.brandName}. I created a "${plan.designSystemName}" design system and designed the following screens: ${pageNames}.\n\nWhat do you think of these designs?`
      );

      // Pan to show all screens
      panTo(window.innerWidth / 2 - firstPos.x, window.innerHeight / 2 - firstPos.y - 100);
      zoomTo(0.6);
      if (lastScreenId) selectScreen(lastScreenId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      console.error("[ChatPanel] Multi-page generation failed:", msg);
      failTask(task.id, msg);
      addChatMessage("assistant", `Generation failed: ${msg}`);
    } finally { setLoading(false); setLoadingPrompt(""); }
  };

  // === Generate a variant of an existing screen ===
  const generateVariant = async (sourceScreen: CanvasScreen, prompt: string) => {
    const pid = project?.id;
    if (!pid) return;

    setLoadingPrompt(`Variant: ${sourceScreen.prompt.slice(0, 30)}`);
    setProgressStages([]);
    setLoadingMode("generate");
    setLoading(true);
    try {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const res = await fetch(`${API}/api/projects/${pid}/screens/${sourceScreen.id}/variants`, {
        method: "POST", headers: await getAuthHeaders(),
        body: JSON.stringify({ prompt, variantCount: 1, creativeRange: "EXPLORE", currentHtml: sourceScreen.html }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(await res.text());
      const variants = await res.json();
      if (!Array.isArray(variants) || variants.length === 0) throw new Error("No variant returned");

      const { addScreen } = useCanvasStore.getState();
      pushHistory();
      const SCALE = 0.3;
      variants.forEach((v: { screenId: string; html: string }, i: number) => {
        addScreen({
          id: v.screenId || `scr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          projectId: pid!,
          prompt: `${sourceScreen.prompt} — Variant ${i + 1}`,
          html: v.html,
          deviceType: sourceScreen.deviceType,
          x: sourceScreen.x + (sourceScreen.width * SCALE + 40) * (i + 1),
          y: sourceScreen.y,
          width: sourceScreen.width,
          height: sourceScreen.height,
          parentId: sourceScreen.id,
          variant: true,
        });
      });
      addChatMessage("assistant", `Created ${variants.length} variant${variants.length > 1 ? "s" : ""} of "${sourceScreen.prompt.slice(0, 40)}". Original is unchanged.`);
      sendFeedback(pid!, sourceScreen.id, "variant_created", { html: variants[0]?.html });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      console.error("[ChatPanel] Variant failed:", msg);
      addChatMessage("assistant", `Variant generation failed: ${msg}`);
    } finally { setLoading(false); setLoadingPrompt(""); }
  };

  // === Single page generation (non-URL prompts) ===
  const generateSingle = async (prompt: string, fullPrompt: string, sourceUrl?: string) => {
    let pid = project?.id;
    if (!pid) { createProject("Untitled"); pid = useCanvasStore.getState().project!.id; }

    setLoadingPrompt(prompt);
    setProgressStages([]);
    setLoadingMode("generate");
    const task = startGeneration(prompt);
    setLoading(true);
    try {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const res = await fetch(`${API}/api/projects/${pid}/screens/generate`, {
        method: "POST", headers: await getAuthHeaders(),
        body: JSON.stringify({
          prompt: fullPrompt, deviceType: "DESKTOP", sourceUrl, premiumScroll,
          designSystem: { colors: designSystem.palette, fonts: designSystem.fonts, cornerRadius: designSystem.cornerRadius },
        }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(await res.text());

      const events = parseSSE(await res.text());
      for (const e of events) {
        if (e.type === "progress") setProgressStages(prev => [...prev, { stage: e.stage, detail: e.detail, time: Date.now() }]);
        if (e.type === "error") throw new Error(e.error);
      }

      const data = events.find(e => e.type === "complete");
      if (!data) throw new Error("No response received");

      const pos = placeScreen(0);
      const screenId = data.screenId ?? `scr_${Date.now()}`;
      completeTask(task.id, {
        id: screenId, projectId: pid!, prompt, html: data.html ?? "",
        deviceType: "DESKTOP", x: pos.x, y: pos.y, width: pos.width, height: pos.height,
      });

      // Design system card
      let brandName = "Design System";
      if (data.designTokens?.brandName) brandName = data.designTokens.brandName;
      const dsCardX = pos.x - 560 - 30;
      useCanvasStore.setState({
        extractedTokens: { tokens: { ...(data.designTokens || {}), brandName }, x: dsCardX, y: pos.y },
      });

      // Sync design system from the generated HTML's actual fonts/colors
      if (data.html) syncDesignSystemFromHtml(data.html);

      addChatMessage("assistant", `Generated: "${prompt.slice(0, 80)}"`);
      const vw = window.innerWidth, vh = window.innerHeight;
      panTo(vw / 2 - pos.x - pos.cardW / 2, vh / 2 - pos.y - 100);
      zoomTo(1);
      selectScreen(screenId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      console.error("[ChatPanel] Generation failed:", msg);
      failTask(task.id, msg);
      addChatMessage("assistant", `Generation failed: ${msg}`);
    } finally { setLoading(false); setLoadingPrompt(""); }
  };

  // === Edit an existing screen in-place ===
  const editExistingScreen = async (screenId: string, prompt: string, editContext?: { elementSelector: string; elementTag: string; sectionSelector: string | null; sectionHtml: string | null } | null) => {
    const pid = project?.id;
    if (!pid) {
      console.warn("[ChatPanel] edit aborted: no project id");
      return;
    }

    debugLog("ChatPanel", "editExistingScreen:", screenId, "prompt:", prompt.slice(0, 60));
    setLoadingPrompt(prompt);
    setProgressStages([]);
    setLoadingMode("generate");
    setLoading(true);
    setScreenEditLoading(screenId);
    try {
      const currentScreen = useCanvasStore.getState().screens.find(s => s.id === screenId);
      if (!currentScreen?.html) throw new Error("Screen not found or has no HTML content");

      // Build request body — include section context for targeted edits (Issue 44)
      const requestBody: Record<string, unknown> = { prompt, currentHtml: currentScreen.html };
      if (editContext?.sectionSelector) {
        requestBody.sectionSelector = editContext.sectionSelector;
        requestBody.elementSelector = editContext.elementSelector;
        requestBody.elementTag = editContext.elementTag;
      }

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const res = await fetch(`${API}/api/projects/${pid}/screens/${screenId}/edit`, {
        method: "POST", headers: await getAuthHeaders(),
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      if (data.html && typeof data.html === "string" && data.html.trim().length > 50) {
        const { updateScreen, addScreen } = useCanvasStore.getState();
        pushHistory(); // Save pre-edit state so Ctrl+Z can undo

        // Variants: create a new screen next to the original instead of replacing
        const isVariant = /variant/i.test(prompt);
        if (isVariant && currentScreen) {
          const SCALE = 0.3;
          const newId = `scr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
          addScreen({
            id: newId,
            projectId: pid!,
            prompt: `${currentScreen.prompt} — Variant`,
            html: data.html,
            deviceType: currentScreen.deviceType,
            x: currentScreen.x + currentScreen.width * SCALE + 40,
            y: currentScreen.y,
            width: currentScreen.width,
            height: currentScreen.height,
            parentId: screenId,
            variant: true,
          });
          addChatMessage("assistant", `Created a variant of "${currentScreen.prompt.slice(0, 40)}". The original is unchanged.`);
        } else {
          updateScreen(screenId, { html: data.html });
          sendFeedback(pid!, screenId, "edited", { editDelta: { htmlDiffSize: Math.abs(data.html.length - (currentScreen?.html?.length || 0)) }, html: data.html });
          addChatMessage("assistant", `Updated the screen with your changes.`);
        }
      } else if (data.error) {
        throw new Error(data.error);
      } else {
        throw new Error("Edit returned empty content — try again");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      console.error("[ChatPanel] Edit failed:", msg);
      addChatMessage("assistant", `Edit failed: ${msg}`);
    } finally { setLoading(false); setLoadingPrompt(""); setScreenEditLoading(null); }
  };

  // === Main send handler ===
  const send = async (text?: string, editContext?: typeof pendingEditContextRef.current) => {
    const prompt = (text ?? input).trim();
    if (!prompt || loading) return;
    setInput("");

    // Check if user is confirming a pending plan
    if (pendingPlan && /^(proceed|yes|go|do it|create|generate|start|ok|sure|confirm)/i.test(prompt)) {
      addChatMessage("user", prompt);
      addChatMessage("assistant", `Great! I'll get started on the redesign for ${pendingPlan.brandName}. I'll begin by setting up a design system that reflects their brand, then I'll move on to designing the ${pendingPlan.proposedPages.map(p => p.title).join(", ")} pages.`);
      executeRedesign(pendingPlan);
      return;
    }

    // If a screen is selected and requesting a variant, use the variants endpoint
    if (contextScreen && /variant/i.test(prompt)) {
      addChatMessage("user", prompt);
      generateVariant(contextScreen, prompt);
      return;
    }

    // If a screen is selected, use the edit endpoint to modify it in-place
    if (contextScreen) {
      addChatMessage("user", `Edit: ${prompt}`);
      editExistingScreen(contextScreen.id, prompt, editContext);
      return;
    }

    const sourceUrl = detectUrl(prompt);

    // URL detected → use planning flow (like Stitch)
    if (sourceUrl) {
      planRedesign(sourceUrl, prompt);
      return;
    }

    // Non-URL prompt → single generation
    addChatMessage("user", prompt);
    generateSingle(prompt, prompt, sourceUrl);
  };

  // Keep sendRef pointing to the latest send function
  sendRef.current = send;

  // Auto-send: when a pending auto-send is queued, fire send() on next render
  useEffect(() => {
    if (pendingAutoSendRef.current && !loading) {
      const text = pendingAutoSendRef.current;
      const ctx = pendingEditContextRef.current;
      pendingAutoSendRef.current = null;
      pendingEditContextRef.current = null;
      sendRef.current(text, ctx);
    }
  });

  const lastUserMsg = [...chatMessages].reverse().find(m => m.role === "user")?.content;
  const lastAssistantMsg = [...chatMessages].reverse().find(m => m.role === "assistant")?.content;

  return (
    <>
      {/* Full-screen generation overlay */}
      {loading && <GeneratingOverlay prompt={loadingPrompt} stages={progressStages} mode={loadingMode} />}

      {/* AI message toast — compact, dismissible, bottom-left */}
      {lastAssistantMsg && !loading && !toastDismissed && (
        <div style={{
          position: "fixed", bottom: 60, left: 16, zIndex: 100,
          width: 340, maxHeight: 200, overflowY: "auto", overscrollBehavior: "contain",
          background: "var(--chrome-surface)", borderRadius: 12,
          border: "1px solid var(--chrome-border)", boxShadow: "var(--shadow-md)",
          padding: "12px 14px", animation: "fadeUp 0.2s ease",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
            <div style={{ fontSize: 12, color: "var(--chrome-text)", lineHeight: 1.5, flex: 1 }}>
              <ChatMarkdown text={lastAssistantMsg} />
            </div>
            <button onClick={() => setToastDismissed(true)} style={{
              background: "none", border: "none", color: "var(--chrome-text-muted)", cursor: "pointer",
              padding: 0, flexShrink: 0, marginTop: 2,
            }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Floating input — bottom center */}
      <div style={{
        position: "fixed", bottom: 16, left: "50%", transform: "translateX(-50%)",
        zIndex: 100, display: "flex", flexDirection: "column", alignItems: "center",
        width: 580,
      }}>
        {/* Suggestion chips — context-aware */}
        {!loading && (
          <div style={{
            display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap", justifyContent: "center",
          }}>
            {/* Pending plan: show proceed/modify options */}
            {pendingPlan ? (
              <>
                {pendingPlan.proposedPages.length > 1 ? (
                  <>
                    <SuggestionChip label="Proceed with all pages" onClick={() => send("proceed")} accent />
                    <SuggestionChip label="Just the homepage" onClick={() => {
                      setPendingPlan({ ...pendingPlan, proposedPages: pendingPlan.proposedPages.filter(p => p.title === "Homepage").slice(0, 1) });
                      send("proceed");
                    }} />
                  </>
                ) : (
                  <SuggestionChip label="Proceed" onClick={() => send("proceed")} accent />
                )}
                <SuggestionChip label="Try a different style" onClick={() => send("Try a different design style")} />
              </>
            ) : chatMessages.length === 0 ? (
              /* Initial suggestions */
              <>
                {SUGGESTIONS.map((s, i) => <SuggestionChip key={i} label={s} onClick={() => send(s)} />)}
              </>
            ) : screens.length > 0 ? (
              /* Post-generation suggestions */
              <>
                <SuggestionChip label="Create a mobile version" onClick={() => send("Create a mobile version of the homepage")} />
                <SuggestionChip label="Try a different color scheme" onClick={() => send("Try a different color scheme")} />
                <SuggestionChip label="Add an FAQ page" onClick={() => send("Add an FAQ page")} />
              </>
            ) : null}
          </div>
        )}

        {/* Input bar */}
        <div style={{
          width: "100%", display: "flex", flexDirection: "column",
          background: "var(--chrome-surface)", borderRadius: 14,
          border: loading ? "1px solid var(--accent)" : "1px solid var(--chrome-border)",
          boxShadow: "var(--shadow-lg)",
          transition: "border-color 0.2s",
        }}>
          {/* Context chip — shows selected screen */}
          {contextScreen && !loading && (
            <div style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "8px 10px 0 14px",
            }}>
              <div style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "4px 8px 4px 10px", borderRadius: 8,
                background: "var(--accent-bg)", border: "1px solid var(--accent)",
                fontSize: 12, color: "var(--accent-text)", fontWeight: 500,
                maxWidth: 300, overflow: "hidden",
              }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ flexShrink: 0 }}>
                  <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/>
                </svg>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {contextScreen.prompt.slice(0, 35)}{contextScreen.prompt.length > 35 ? "…" : ""}
                </span>
                <button onClick={() => selectScreen(null)} style={{
                  background: "none", border: "none", color: "var(--accent-text)", cursor: "pointer",
                  padding: 0, display: "flex", flexShrink: 0, opacity: 0.7,
                }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
              <span style={{ fontSize: 11, color: "var(--chrome-text-muted)" }}>Editing this screen</span>
            </div>
          )}

          {/* Options row */}
          <div style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "4px 18px 0",
          }}>
            <label style={{
              display: "flex", alignItems: "center", gap: 6, cursor: "pointer",
              fontSize: 12, color: premiumScroll ? "var(--accent)" : "var(--chrome-text-muted)",
              userSelect: "none", transition: "color 0.15s",
            }}>
              <div
                onClick={() => setPremiumScroll(!premiumScroll)}
                style={{
                  width: 28, height: 16, borderRadius: 8, position: "relative",
                  background: premiumScroll ? "var(--accent)" : "var(--chrome-border)",
                  transition: "background 0.2s", cursor: "pointer",
                }}
              >
                <div style={{
                  width: 12, height: 12, borderRadius: 6, background: "white",
                  position: "absolute", top: 2,
                  left: premiumScroll ? 14 : 2,
                  transition: "left 0.2s",
                }} />
              </div>
              Premium Scroll
            </label>
          </div>

          {/* Input row */}
          <div style={{
            display: "flex", alignItems: "flex-end", gap: 8,
            padding: "10px 10px 10px 18px",
          }}>
            {loading ? (
              <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{
                  width: 14, height: 14, borderRadius: "50%",
                  border: "2px solid var(--chrome-border)", borderTopColor: "var(--accent)",
                  animation: "spin 1s linear infinite",
                }} />
                <span style={{ fontSize: 13, color: "var(--chrome-text-muted)" }}>Generating...</span>
              </div>
            ) : (
              <textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
                }}
                placeholder={contextScreen ? "Describe the change..." : "Describe a UI, paste a URL to redesign, or edit a screen..."}
                disabled={loading}
                rows={1}
                style={{
                  flex: 1, border: "none", outline: "none", fontSize: 14, fontFamily: "inherit",
                  color: "var(--chrome-text)", background: "transparent",
                  resize: "none", lineHeight: "20px", maxHeight: 100, overflowY: "auto",
                  padding: 0, margin: 0,
                }} />
            )}
            <button onClick={() => send()} disabled={loading || !input.trim()} aria-label="Send" style={{
              width: 32, height: 32, borderRadius: 10, border: "none", flexShrink: 0,
              background: input.trim() && !loading ? "var(--accent)" : "transparent",
              color: input.trim() && !loading ? "white" : "var(--chrome-text-muted)",
              cursor: input.trim() && !loading ? "pointer" : "default",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "all 0.15s",
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Bottom row: model indicator */}
        <div style={{
          width: "100%", display: "flex", alignItems: "center", justifyContent: "center",
          padding: "6px 8px 0", fontSize: 11, color: "var(--chrome-text-muted)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: loading ? "var(--accent)" : "#22c55e", transition: "background 0.3s" }} />
            <span style={{ fontWeight: 500 }}>{loading ? "Processing" : "OpenRouter"}</span>
          </div>
        </div>
      </div>

      {/* Completed task pill — bottom left */}
      {lastUserMsg && !loading && (
        <div style={{
          position: "fixed", bottom: 16, left: 16, zIndex: 100,
          display: "flex", alignItems: "center", gap: 8,
          padding: "8px 14px", borderRadius: 20,
          background: "var(--chrome-surface)", border: "1px solid var(--chrome-border)",
          boxShadow: "var(--shadow-md)", cursor: "pointer",
          animation: "fadeUp 0.3s ease", maxWidth: 240,
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
          <span style={{ fontSize: 12, color: "var(--chrome-text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {lastUserMsg.slice(0, 30)}{lastUserMsg.length > 30 ? "…" : ""}
          </span>
        </div>
      )}

      {/* Agent log — bottom left above pill */}
      <div style={{
        position: "fixed", bottom: loading ? 16 : 52, left: 16, zIndex: 99,
      }}>
        <div onClick={toggleAgentLog} style={{
          display: "flex", alignItems: "center", gap: 6, cursor: "pointer",
          fontSize: 12, color: "var(--chrome-text-muted)", padding: "4px 0",
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4"/>
          </svg>
          Agent log {agentTasks.length > 0 && `(${agentTasks.length})`}
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            style={{ transform: agentLogOpen ? "rotate(0)" : "rotate(180deg)", transition: "transform 0.2s" }}>
            <polyline points="18 15 12 9 6 15"/>
          </svg>
        </div>

        {agentLogOpen && agentTasks.length > 0 && (
          <div style={{
            marginTop: 6, padding: 10, borderRadius: 10, maxHeight: 200, overflowY: "auto", overscrollBehavior: "contain",
            background: "var(--chrome-surface)", border: "1px solid var(--chrome-border)",
            boxShadow: "var(--shadow-md)", animation: "fadeUp 0.15s ease", width: 260,
          }}>
            {agentTasks.slice().reverse().map(t => (
              <div key={t.id} style={{
                display: "flex", alignItems: "center", gap: 8, padding: "6px 0",
                borderBottom: "1px solid var(--chrome-border)", fontSize: 11,
              }}>
                <div style={{
                  width: 6, height: 6, borderRadius: "50%", flexShrink: 0,
                  background: t.status === "done" ? "#22c55e" : t.status === "error" ? "#ef4444" : "var(--accent)",
                  animation: t.status === "running" ? "pulse 2s infinite" : "none",
                }} />
                <span style={{ color: "var(--chrome-text-secondary)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {t.prompt.slice(0, 40)}{t.prompt.length > 40 ? "..." : ""}
                </span>
                <span style={{ color: "var(--chrome-text-muted)", fontSize: 10, flexShrink: 0 }}>
                  {t.status === "done" ? "done" : t.status === "error" ? "failed" : "running"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function SuggestionChip({ label, onClick, accent }: { label: string; onClick: () => void; accent?: boolean }) {
  return (
    <button onClick={onClick} style={{
      padding: "6px 14px", borderRadius: 20, cursor: "pointer",
      border: accent ? "1px solid var(--accent)" : "1px solid var(--chrome-border)",
      background: accent ? "var(--accent)" : "var(--chrome-surface)",
      color: accent ? "white" : "var(--chrome-text-secondary)",
      fontSize: 12, fontFamily: "inherit", fontWeight: accent ? 600 : 400,
      transition: "all 0.15s", backdropFilter: "blur(12px)",
    }}>
      {label}
    </button>
  );
}
