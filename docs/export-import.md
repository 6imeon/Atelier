# Export / Import

## Status

- **Phase 1 (Export + Import):** DONE
- **Phase 2 (Drag & Drop):** DONE
- **Phase 3 (Backend Persistence):** Not started (optional)

## What Was Implemented

### Phase 1 — Frontend Export/Import

**Files modified:**
- `packages/web-ui/src/stores/canvas-store.ts` — Added `AtelierExport` interface, `exportProject()` and `importProject()` store methods
- `packages/web-ui/src/components/TopBar.tsx` — Added "Export Project (.atelier)" and "Import Project (.atelier)" to export dropdown, standalone Import button (always visible), hidden file input with `.atelier` filter

**Export:** Serializes project metadata, all non-placeholder screens, design system, extracted tokens, and marks into a `.atelier` JSON file. Downloads via Blob + `URL.createObjectURL`.

**Import:** Parses `.atelier` file, validates schema version, remaps all IDs (project + screens) to avoid collisions while preserving variant parent-child relationships, loads into Zustand store, resets viewport/history, persists design system to localStorage. Shows confirmation dialog when importing over existing screens.

### Phase 2 — Drag & Drop

**Files modified:**
- `packages/web-ui/src/components/InfiniteCanvas.tsx` — Added `onDragOver`, `onDragLeave`, `onDrop` handlers with visual drop overlay ("Drop .atelier file to import")

Drop a `.atelier` file anywhere on the canvas to import. Same confirmation + error handling as the file picker.

---

## Research & Design (Original)

---

## Project State Anatomy

### What MUST Be Exported

| Data | Source | Size Estimate |
|------|--------|---------------|
| **Project metadata** | `{ id, title, createdAt, updatedAt }` | ~200 bytes |
| **Screens** (all) | `{ id, projectId, prompt, html, deviceType, x, y, width, height, parentId?, variant? }` | 10-15KB per screen |
| **Design system** | `{ seedColor, colorTheme, palette, fonts, cornerRadius, logos }` | ~2KB (more if logos have base64 data) |
| **Extracted tokens** | `{ tokens: { brandName, colors, fonts, logos, _meta }, x, y }` | ~3-5KB |
| **Marks** | `{ id, x, y, width, height, color, label? }[]` | ~100 bytes each |

### What SHOULD NOT Be Exported (session-specific)

- `viewport` (pan/zoom position) — reset on import
- `selectedScreenId`, `editingScreenId` — UI selection state
- `history`, `historyIndex` — undo/redo stack
- `agentTasks` — in-progress generation tasks
- `chatMessages` — session conversation
- `isGenerating`, `chatOpen`, `agentLogOpen` — UI flags

---

## Proposed Export Format

### File Extension

`.atelier` (JSON internally, custom extension for association)

### Schema

```typescript
interface AtelierExport {
  version: 1;                          // schema version for forward compat
  exportedAt: string;                  // ISO timestamp
  project: {
    id: string;
    title: string;
    createdAt: string;
    updatedAt: string;
  };
  designSystem: {
    seedColor: string;
    colorTheme: string;
    palette: { primary: string; secondary: string; tertiary: string; neutral: string };
    fonts: { headline: string; body: string; label: string };
    cornerRadius: string;
    logos: Array<{
      url: string;
      type: string;
      sizes?: string;
      mimeType?: string;
      data?: string;                   // base64 data URI — self-contained
    }>;
  };
  screens: Array<{
    id: string;
    prompt: string;
    html: string;                      // full HTML page
    deviceType: "MOBILE" | "DESKTOP" | "TABLET" | "AGNOSTIC";
    x: number; y: number;
    width: number; height: number;
    parentId?: string;                 // variant parent
    variant?: boolean;
    createdAt?: string;
    updatedAt?: string;
  }>;
  extractedTokens?: {
    tokens: Record<string, any>;       // brand data, _meta, etc.
    x: number; y: number;             // design card canvas position
  };
  marks: Array<{
    id: string;
    x: number; y: number;
    width: number; height: number;
    color: string;
    label?: string;
  }>;
}
```

### File Size Estimates

| Project Size | Uncompressed | Gzipped |
|-------------|-------------|---------|
| 3 screens, no logos | ~40-50KB | ~10-15KB |
| 5 screens + logos | ~80-120KB | ~25-40KB |
| 10 screens + logos | ~150-200KB | ~50-70KB |

Logos with base64 `data` fields are the largest variable. Screens without screenshots stay small since HTML is plain text and compresses well.

---

## Implementation Plan

### Phase 1: Frontend-Only Export/Import (No Backend Changes)

Everything lives in the Zustand store — we can serialize and deserialize directly in the browser without touching the API.

#### Export Flow

```
User clicks "Export Project" in TopBar
  → Serialize store state to AtelierExport JSON
  → Gzip compress (optional, via CompressionStream API)
  → Download as .atelier file via Blob + URL.createObjectURL
```

**Files to modify:**
- `packages/web-ui/src/components/TopBar.tsx` — add "Export Project" menu item
- `packages/web-ui/src/stores/canvas-store.ts` — add `exportProject()` method

**Export method (~30 lines):**
```typescript
exportProject: () => {
  const st = get();
  const data: AtelierExport = {
    version: 1,
    exportedAt: new Date().toISOString(),
    project: st.project ?? { id: `proj_${Date.now()}`, title: "Untitled", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    designSystem: st.designSystem,
    screens: st.screens.map(s => ({
      id: s.id, prompt: s.prompt, html: s.html, deviceType: s.deviceType,
      x: s.x, y: s.y, width: s.width, height: s.height,
      parentId: s.parentId, variant: s.variant,
      createdAt: s.createdAt, updatedAt: s.updatedAt,
    })),
    extractedTokens: st.extractedTokens ?? undefined,
    marks: st.marks,
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${data.project.title.replace(/\s+/g, "-").toLowerCase()}-${Date.now()}.atelier`;
  a.click();
  URL.revokeObjectURL(url);
}
```

#### Import Flow

```
User clicks "Import Project" in TopBar (or drags file onto canvas)
  → File picker opens (.atelier filter)
  → Read file → JSON.parse
  → Validate schema version
  → Remap IDs (new projectId, optionally new screen IDs)
  → Load into Zustand store
  → Reset viewport to fit all screens
  → Push initial history snapshot
```

**Files to modify:**
- `packages/web-ui/src/components/TopBar.tsx` — add "Import Project" menu item + hidden file input
- `packages/web-ui/src/stores/canvas-store.ts` — add `importProject(data: AtelierExport)` method

**Import method (~40 lines):**
```typescript
importProject: (data: AtelierExport) => {
  // Validate
  if (data.version !== 1) throw new Error(`Unsupported export version: ${data.version}`);

  // Remap project ID
  const newProjectId = `proj_${Date.now()}`;

  // Remap screen IDs (preserving variant parent relationships)
  const idMap = new Map<string, string>();
  const screens = data.screens.map(s => {
    const newId = `scr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    idMap.set(s.id, newId);
    return { ...s, id: newId, projectId: newProjectId };
  });

  // Fix variant parentId references
  for (const s of screens) {
    if (s.parentId && idMap.has(s.parentId)) {
      s.parentId = idMap.get(s.parentId);
    }
  }

  // Load state
  set({
    project: { ...data.project, id: newProjectId },
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

  // Persist design system to localStorage
  try { localStorage.setItem("atelier-design-system", JSON.stringify(data.designSystem)); } catch {}
}
```

### Phase 2: Drag & Drop Import (Enhancement)

Allow dragging a `.atelier` file onto the canvas to import.

**Files to modify:**
- `packages/web-ui/src/components/InfiniteCanvas.tsx` — add `onDragOver` + `onDrop` handlers

```typescript
onDrop={(e) => {
  e.preventDefault();
  const file = e.dataTransfer.files[0];
  if (file?.name.endsWith(".atelier")) {
    const reader = new FileReader();
    reader.onload = () => {
      const data = JSON.parse(reader.result as string);
      useCanvasStore.getState().importProject(data);
    };
    reader.readAsText(file);
  }
}}
```

### Phase 3: Backend Persistence (Optional)

Add API endpoints for server-side project storage, enabling project listing and cloud persistence.

**New endpoints:**
```
GET    /api/projects                    — list all projects
GET    /api/projects/:pid               — get project with all screens
GET    /api/projects/:pid/export        — download full export JSON
POST   /api/projects/import             — import from JSON body
DELETE /api/projects/:pid               — delete project
```

**Files to modify:**
- `packages/api-server/src/index.ts` — add endpoints
- `packages/sdk/src/models/project.ts` — add `toExport()` and `static fromExport()` methods
- `packages/sdk/src/storage/interface.ts` — add `listProjects()` if missing

---

## Edge Cases & Considerations

### ID Collisions

On import, all IDs are regenerated to avoid collisions with existing screens. The ID map preserves variant parent-child relationships.

### Logo Persistence

Logos can exist as:
1. **`data` field** (base64 data URI) — fully self-contained, always works
2. **`url` field** (remote URL) — depends on source domain being accessible

Export prioritizes `data` when available. On import, if `data` is missing and `url` is unreachable, the logo is silently dropped.

### HTML Self-Containment

Screen HTML references external CDNs:
- `https://cdn.tailwindcss.com` — Tailwind CSS
- `https://fonts.googleapis.com` — Google Fonts
- `https://placehold.co/...` — placeholder images

These are stable CDN URLs that will work across sessions. No action needed.

### Large Projects

For projects with 20+ screens, the JSON file could exceed 500KB uncompressed. Options:
- **Gzip compression** via the browser's `CompressionStream` API (reduces ~70%)
- **Streaming JSON parse** for very large files (unlikely to be needed)
- **Lazy screenshot loading** — exclude screenshots from export by default, add a checkbox

### Version Migration

The `version: 1` field in the export schema enables forward compatibility. If the schema changes in the future, import can detect the version and run migration logic.

### Concurrent Generation State

If screens are still generating (placeholder screens with `placeholder: true`), export should either:
- **Skip placeholders** (recommended) — only export completed screens
- **Warn the user** that generation is in progress

---

## UX Design

### Export

Add to the existing TopBar export dropdown:
```
Export ▾
  ├── Download HTML
  ├── Copy HTML
  ├── Download React TSX
  ├── Download Full Project
  ├── Copy for Figma
  ├── ─────────────────
  └── Export Project (.atelier)     ← NEW
```

### Import

Two entry points:
1. **TopBar menu item**: "Import Project" opens a file picker
2. **Drag & drop**: Drop `.atelier` file onto the canvas (Phase 2)
3. **Empty state**: When no screens exist, show "Import a project" link alongside the existing empty state

### Confirmation Dialog

On import, if screens already exist on the canvas:
```
┌─────────────────────────────────────┐
│  Import Project                     │
│                                     │
│  This will replace the current      │
│  project with "Brand X Redesign".   │
│                                     │
│  5 screens, design system, and      │
│  3 annotations will be loaded.      │
│                                     │
│  [Cancel]          [Import]         │
└─────────────────────────────────────┘
```

---

## Effort Estimate

| Phase | Scope | Files Changed |
|-------|-------|---------------|
| **Phase 1** | Export + Import (core) | `canvas-store.ts`, `TopBar.tsx` |
| **Phase 2** | Drag & drop | `InfiniteCanvas.tsx` |
| **Phase 3** | Backend persistence | `index.ts`, `project.ts`, `interface.ts` |

Phase 1 is the minimum viable feature. Phase 2 is a small enhancement. Phase 3 is a larger effort that enables cloud persistence and project management.

---

## Summary

The export/import feature is straightforward to implement because:

1. **All project state lives in a single Zustand store** — one source of truth, easy to serialize
2. **No binary blobs** — logos use base64 strings, screenshots are optional, HTML is plain text
3. **External dependencies are CDN URLs** — Tailwind and Google Fonts work anywhere
4. **The SDK already has `toJSON()` on Project** — partial serialization exists
5. **File sizes are small** — a typical 5-screen project is 30-40KB compressed

The main complexity is ID remapping on import to avoid collisions, and that's ~10 lines of code.
