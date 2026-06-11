import { create } from "zustand";
import { debugLog } from "../utils/debug";
import { saveDesignSystem } from "../utils/api";

export interface CanvasScreen {
  id: string; projectId: string; prompt: string; html: string;
  thumbnailUrl?: string; deviceType: "MOBILE" | "DESKTOP" | "TABLET" | "AGNOSTIC";
  x: number; y: number; width: number; height: number;
  parentId?: string; variant?: boolean;
  placeholder?: boolean; // True while screen is being generated
}

export interface CanvasMark {
  id: string; x: number; y: number; width: number; height: number;
  color: string; label?: string;
}

export interface ElementSelection {
  screenId: string;
  selector: string;
  tagName: string;
  textContent: string;
  rect: { x: number; y: number; width: number; height: number };
  clickX?: number; // Click position in iframe coordinates (Issue 83)
  clickY?: number;
  sectionSelector?: string;
  sectionTagName?: string;
  sectionPreview?: string;
}

export interface CanvasProject { id: string; title: string; screens: CanvasScreen[]; }
export interface Viewport { x: number; y: number; zoom: number; }
export interface AgentTask {
  id: string; type: string; status: "pending" | "running" | "done" | "error";
  prompt: string; result?: CanvasScreen; error?: string; startedAt: number;
}

export type CanvasTool = "select" | "pan" | "edit" | "mark";

export interface ExtractedLogoData {
  url: string;
  type: string;
  sizes?: string;
  mimeType?: string;
  data?: string; // base64 data URI
}

export interface CanvasDesignSystem {
  seedColor: string;
  colorTheme: string;
  palette: { primary: string; secondary: string; tertiary: string; neutral: string; background?: string; text?: string };
  fonts: { headline: string; body: string; label: string };
  cornerRadius: string;
  logos?: ExtractedLogoData[];
  /** Phase 5 — 3-dial parameterisation (integer 1-10). */
  dials?: { variance: number; motion: number; density: number };
}

interface CanvasState {
  project: CanvasProject | null;
  screens: CanvasScreen[];
  selectedScreenId: string | null;
  viewport: Viewport;
  activeTool: CanvasTool;
  designPanelOpen: boolean;
  designSystem: CanvasDesignSystem;
  marks: CanvasMark[];
  editingScreenId: string | null;
  selectedElement: ElementSelection | null;
  extractedTokens: { tokens: Record<string, any>; x: number; y: number } | null;
  agentTasks: AgentTask[];
  isGenerating: boolean;
  chatMessages: Array<{ role: "user" | "assistant"; content: string }>;
  chatOpen: boolean;
  agentLogOpen: boolean;
  screenEditLoading: string | null; // screenId of screen currently being AI-edited
  whyMode: boolean; // "Why" overlay mode — shows design rationale on hover/click
  history: CanvasScreen[][];
  historyIndex: number;
  setScreenEditLoading: (id: string | null) => void;
  toggleWhyMode: () => void;
  setTool: (t: CanvasTool) => void;
  toggleDesignPanel: () => void;
  updateDesignSystem: (ds: Partial<CanvasDesignSystem>) => void;
  setProject: (p: CanvasProject) => void;
  createProject: (title: string) => void;
  addScreen: (s: CanvasScreen) => void;
  addScreenSilent: (s: CanvasScreen) => void;
  updateScreen: (id: string, u: Partial<CanvasScreen>) => void;
  removeScreen: (id: string) => void;
  removeScreenSilent: (id: string) => void;
  selectScreen: (id: string | null) => void;
  setEditingScreen: (id: string | null) => void;
  setSelectedElement: (el: ElementSelection | null) => void;
  addMark: (m: CanvasMark) => void;
  removeMark: (id: string) => void;
  clearMarks: () => void;
  panTo: (x: number, y: number) => void;
  zoomTo: (z: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetViewport: () => void;
  startGeneration: (prompt: string) => AgentTask;
  completeTask: (taskId: string, result: CanvasScreen) => void;
  failTask: (taskId: string, error: string) => void;
  addChatMessage: (role: "user" | "assistant", content: string) => void;
  toggleChat: () => void;
  toggleAgentLog: () => void;
  pushHistory: () => void;
  undo: () => void;
  redo: () => void;
  exportProject: () => void;
  importProject: (data: AtelierExport) => void;
}

export interface AtelierExport {
  version: 1;
  exportedAt: string;
  project: {
    id: string;
    title: string;
    createdAt?: string;
    updatedAt?: string;
  };
  designSystem: CanvasDesignSystem;
  screens: Array<{
    id: string;
    prompt: string;
    html: string;
    deviceType: "MOBILE" | "DESKTOP" | "TABLET" | "AGNOSTIC";
    x: number; y: number;
    width: number; height: number;
    parentId?: string;
    variant?: boolean;
    createdAt?: string;
    updatedAt?: string;
  }>;
  extractedTokens?: {
    tokens: Record<string, any>;
    x: number; y: number;
  };
  marks: Array<{
    id: string;
    x: number; y: number;
    width: number; height: number;
    color: string;
    label?: string;
  }>;
}

const DEFAULT_DESIGN: CanvasDesignSystem = {
  seedColor: "#967A4F", colorTheme: "Custom",
  palette: { primary: "#967A4F", secondary: "#d1d5db", tertiary: "#1f2937", neutral: "#e5e7eb" },
  // Geist / Cabinet Grotesk / JetBrains Mono — modern, premium defaults that
  // don't scream "AI prototype". Inter is deliberately out; it's the single
  // most ubiquitous AI-default font and instantly signals generic output.
  // Brand extraction overrides these per-project when real fonts are found.
  fonts: { headline: "Cabinet Grotesk", body: "Geist", label: "JetBrains Mono" },
  cornerRadius: "8px",
  // Phase 5 baseline: taste-skill's recommended defaults. High variance +
  // moderate motion + moderate density. Users tune per project.
  dials: { variance: 8, motion: 6, density: 4 },
};

const LEGACY_DS_KEY = "atelier-design-system";

function dsKeyFor(pid: string): string {
  return `atelier-design-system:${pid}`;
}

// Read the per-project design-system cache from localStorage, merged over
// DEFAULT_DESIGN so schema additions don't lose fields.
export function loadDesignSystemForProject(pid: string): CanvasDesignSystem {
  try {
    const saved = localStorage.getItem(dsKeyFor(pid));
    if (saved) return { ...DEFAULT_DESIGN, ...JSON.parse(saved) };
  } catch {}
  return DEFAULT_DESIGN;
}

// Read the legacy (pre-per-project) localStorage blob. Used once during
// migration to seed the first project that has no server-persisted DS.
export function readLegacyDesignSystem(): CanvasDesignSystem | null {
  try {
    const saved = localStorage.getItem(LEGACY_DS_KEY);
    if (saved) return { ...DEFAULT_DESIGN, ...JSON.parse(saved) };
  } catch {}
  return null;
}

export function clearLegacyDesignSystem(): void {
  try { localStorage.removeItem(LEGACY_DS_KEY); } catch {}
}

// Trailing-edge debounced server PUT. One timer per project id; switching
// projects cancels the pending write for the previous project to avoid
// cross-project writes.
const pendingSaves = new Map<string, ReturnType<typeof setTimeout>>();
function scheduleDesignSystemPut(pid: string, ds: CanvasDesignSystem) {
  const prev = pendingSaves.get(pid);
  if (prev) clearTimeout(prev);
  const t = setTimeout(() => {
    pendingSaves.delete(pid);
    saveDesignSystem(pid, ds).catch(err => {
      debugLog("designSystem", `saveDesignSystem(${pid}) failed: ${String(err)}`);
    });
  }, 400);
  pendingSaves.set(pid, t);
}

export function cancelPendingDesignSystemSaves() {
  for (const t of pendingSaves.values()) clearTimeout(t);
  pendingSaves.clear();
}

export const useCanvasStore = create<CanvasState>((set, get) => ({
  project: null, screens: [], selectedScreenId: null,
  viewport: { x: 0, y: 0, zoom: 1 },
  activeTool: "select" as CanvasTool,
  designPanelOpen: false,
  designSystem: DEFAULT_DESIGN,
  marks: [], editingScreenId: null, selectedElement: null, extractedTokens: null, screenEditLoading: null,
  whyMode: false,
  agentTasks: [], isGenerating: false,
  chatMessages: [], chatOpen: true, agentLogOpen: false,
  history: [], historyIndex: -1,

  setScreenEditLoading: (id) => set({ screenEditLoading: id }),
  toggleWhyMode: () => set((st) => ({ whyMode: !st.whyMode })),
  setTool: (t) => set({ activeTool: t }),
  toggleDesignPanel: () => set((st) => ({ designPanelOpen: !st.designPanelOpen })),
  updateDesignSystem: (ds) => set((st) => {
    const updated = { ...st.designSystem, ...ds };
    const pid = st.project?.id;
    if (pid) {
      try { localStorage.setItem(dsKeyFor(pid), JSON.stringify(updated)); } catch {}
      scheduleDesignSystemPut(pid, updated);
    }
    return { designSystem: updated };
  }),

  setProject: (p) => set((st) => {
    const switchingProject = st.project?.id !== p.id;
    if (switchingProject) cancelPendingDesignSystemSaves();
    return {
      project: p,
      screens: p.screens,
      // Reset project-scoped state so Project A's card/marks/selection can't
      // leak into Project B. The loader in App.tsx rehydrates from the server.
      ...(switchingProject ? {
        designSystem: DEFAULT_DESIGN,
        extractedTokens: null,
        marks: [],
        selectedScreenId: null,
        editingScreenId: null,
      } : {}),
    };
  }),
  createProject: (title) => {
    cancelPendingDesignSystemSaves();
    set({
      project: { id: `proj_${Date.now()}`, title, screens: [] },
      screens: [],
      selectedScreenId: null,
      viewport: { x: 0, y: 0, zoom: 1 },
      designSystem: DEFAULT_DESIGN,
      extractedTokens: null,
      marks: [],
    });
  },

  addScreen: (s) => { get().pushHistory(); set((st) => ({ screens: [...st.screens, s] })); },
  addScreenSilent: (s) => set((st) => ({ screens: [...st.screens, s] })),
  updateScreen: (id, u) => set((st) => ({ screens: st.screens.map(s => s.id === id ? { ...s, ...u } : s) })),
  removeScreen: (id) => { get().pushHistory(); set((st) => ({ screens: st.screens.filter(s => s.id !== id), selectedScreenId: st.selectedScreenId === id ? null : st.selectedScreenId })); },
  removeScreenSilent: (id) => set((st) => ({ screens: st.screens.filter(s => s.id !== id), selectedScreenId: st.selectedScreenId === id ? null : st.selectedScreenId })),
  selectScreen: (id) => set({ selectedScreenId: id }),
  setEditingScreen: (id) => set({ editingScreenId: id, selectedElement: null }),
  setSelectedElement: (el) => set({ selectedElement: el }),
  addMark: (m) => set((st) => ({ marks: [...st.marks, m] })),
  removeMark: (id) => set((st) => ({ marks: st.marks.filter(m => m.id !== id) })),
  clearMarks: () => set({ marks: [] }),

  panTo: (x, y) => set((st) => ({ viewport: { ...st.viewport, x, y } })),
  zoomTo: (z) => set((st) => ({ viewport: { ...st.viewport, zoom: Math.max(0.1, Math.min(3, z)) } })),
  zoomIn: () => {
    const v = get().viewport;
    const newZoom = Math.min(3, v.zoom * 1.2);
    const cx = window.innerWidth / 2;
    const cy = 48 + (window.innerHeight - 48) / 2; // Account for 48px TopBar
    const scale = newZoom / v.zoom;
    set({ viewport: { x: cx - (cx - v.x) * scale, y: cy - (cy - v.y) * scale, zoom: newZoom } });
  },
  zoomOut: () => {
    const v = get().viewport;
    const newZoom = Math.max(0.1, v.zoom / 1.2);
    const cx = window.innerWidth / 2;
    const cy = 48 + (window.innerHeight - 48) / 2; // Account for 48px TopBar
    const scale = newZoom / v.zoom;
    set({ viewport: { x: cx - (cx - v.x) * scale, y: cy - (cy - v.y) * scale, zoom: newZoom } });
  },
  resetViewport: () => set({ viewport: { x: 0, y: 0, zoom: 1 } }),

  startGeneration: (prompt) => {
    const t: AgentTask = { id: `task_${Date.now()}`, type: "generate", status: "running", prompt, startedAt: Date.now() };
    set((st) => ({ agentTasks: [...st.agentTasks, t], isGenerating: true }));
    return t;
  },
  completeTask: (tid, result) => set((st) => ({
    agentTasks: st.agentTasks.map(t => t.id === tid ? { ...t, status: "done" as const, result } : t),
    screens: [...st.screens, result],
    isGenerating: st.agentTasks.some(t => t.id !== tid && t.status === "running"),
  })),
  failTask: (tid, error) => set((st) => ({
    agentTasks: st.agentTasks.map(t => t.id === tid ? { ...t, status: "error" as const, error } : t),
    isGenerating: st.agentTasks.some(t => t.id !== tid && t.status === "running"),
  })),

  addChatMessage: (role, content) => set((st) => ({ chatMessages: [...st.chatMessages, { role, content }] })),
  toggleChat: () => set((st) => ({ chatOpen: !st.chatOpen })),
  toggleAgentLog: () => set((st) => ({ agentLogOpen: !st.agentLogOpen })),

  pushHistory: () => set((st) => {
    const MAX_HISTORY = 20;
    const newHistory = [...st.history.slice(0, st.historyIndex + 1), [...st.screens]];
    // Cap history depth to prevent unbounded memory growth
    if (newHistory.length > MAX_HISTORY) {
      const trimmed = newHistory.slice(newHistory.length - MAX_HISTORY);
      debugLog("undo", `pushHistory: ${st.screens.length} screens, depth=${trimmed.length} (trimmed)`);
      return { history: trimmed, historyIndex: trimmed.length - 1 };
    }
    debugLog("undo", `pushHistory: ${st.screens.length} screens, depth=${newHistory.length}, index=${newHistory.length - 1}`);
    return { history: newHistory, historyIndex: newHistory.length - 1 };
  }),
  undo: () => set((st) => {
    if (st.historyIndex <= 0) {
      debugLog("undo", `undo: nothing to undo (index=${st.historyIndex}, depth=${st.history.length})`);
      return st;
    }
    const target = st.history[st.historyIndex - 1];
    debugLog("undo", `undo: ${st.screens.length} screens -> ${target.length} screens (index ${st.historyIndex} -> ${st.historyIndex - 1})`);
    return { screens: [...target], historyIndex: st.historyIndex - 1, marks: [] };
  }),
  redo: () => set((st) => {
    if (st.historyIndex >= st.history.length - 1) return st;
    const target = st.history[st.historyIndex + 1];
    debugLog("undo", `redo: ${st.screens.length} screens -> ${target.length} screens (index ${st.historyIndex} -> ${st.historyIndex + 1})`);
    return { screens: [...target], historyIndex: st.historyIndex + 1, marks: [] };
  }),

  exportProject: () => {
    const st = get();
    const data: AtelierExport = {
      version: 1,
      exportedAt: new Date().toISOString(),
      project: st.project
        ? { id: st.project.id, title: st.project.title }
        : { id: `proj_${Date.now()}`, title: "Untitled" },
      designSystem: st.designSystem,
      screens: st.screens
        .filter(s => !s.placeholder)
        .map(s => ({
          id: s.id, prompt: s.prompt, html: s.html, deviceType: s.deviceType,
          x: s.x, y: s.y, width: s.width, height: s.height,
          parentId: s.parentId, variant: s.variant,
        })),
      extractedTokens: st.extractedTokens ?? undefined,
      marks: st.marks,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(data.project.title || "project").replace(/\s+/g, "-").toLowerCase()}-${Date.now()}.atelier`;
    a.click();
    URL.revokeObjectURL(url);
  },

  importProject: (data: AtelierExport) => {
    if (data.version !== 1) throw new Error(`Unsupported export version: ${data.version}`);

    const newProjectId = `proj_${Date.now()}`;

    // Remap screen IDs preserving variant parent relationships
    const idMap = new Map<string, string>();
    const screens: CanvasScreen[] = data.screens.map(s => {
      const newId = `scr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      idMap.set(s.id, newId);
      return { ...s, id: newId, projectId: newProjectId };
    });

    for (const s of screens) {
      if (s.parentId && idMap.has(s.parentId)) {
        s.parentId = idMap.get(s.parentId);
      }
    }

    set({
      project: { id: newProjectId, title: data.project.title, screens: [] },
      screens,
      designSystem: data.designSystem,
      extractedTokens: data.extractedTokens ?? null,
      marks: data.marks ?? [],
      viewport: { x: 0, y: 0, zoom: 1 },
      selectedScreenId: null,
      editingScreenId: null,
      history: [screens],
      historyIndex: 0,
      agentTasks: [],
      chatMessages: [],
    });

    try { localStorage.setItem(dsKeyFor(newProjectId), JSON.stringify(data.designSystem)); } catch {}
    // Persist imported design system to the server for the new pid (best-effort).
    scheduleDesignSystemPut(newProjectId, data.designSystem);
    debugLog("import", `Loaded project "${data.project.title}" with ${screens.length} screens`);
  },
}));
