# Atelier — Architecture

## Overview

Atelier is an AI-native UI design platform. Users describe interfaces in natural language, and the system generates production-ready HTML screens rendered on an infinite canvas. The architecture is a TypeScript monorepo with five packages that communicate through a shared SDK.

```
┌─────────────────────────────────────────────────────────────┐
│                        Web UI (React)                        │
│  Infinite Canvas  ·  Floating Chat  ·  Design System Panel   │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTP (fetch)
                           ▼
┌──────────────────────────────────────────────────────────────┐
│                     API Server (Node.js)                      │
│  REST routes  ·  CORS  ·  Rate limiting  ·  Input validation  │
└──────────────────────────┬───────────────────────────────────┘
                           │ method calls
                           ▼
┌──────────────────────────────────────────────────────────────┐
│                        SDK (Core)                             │
│  CanvasAI  ·  Project  ·  Screen  ·  ModelRouter  ·  Storage  │
└────────┬─────────────────────────────────┬───────────────────┘
         │ OpenRouter API                  │ optional
         ▼                                 ▼
   ┌───────────┐                    ┌──────────────┐
   │ LLM Models │                    │ SQLite / Mem │
   └───────────┘                    └──────────────┘
```

Additionally, two integration packages sit alongside:

- **MCP Server** — exposes the SDK as Model Context Protocol tools (stdio transport) for Claude Desktop / Claude Code
- **Figma Plugin** — imports generated screens and design systems into Figma

---

## Monorepo Structure

```
atelier/
├── packages/
│   ├── sdk/            Core TypeScript SDK
│   ├── web-ui/         React + Vite + Zustand frontend
│   ├── api-server/     Node.js HTTP REST server
│   ├── mcp-server/     MCP server for Claude integration
│   └── figma-plugin/   Figma plugin (esbuild)
├── skills/             Agent skills (open standard)
│   ├── enhance-prompt/
│   ├── react-components/
│   └── design-md/
├── turbo.json          Turborepo pipeline config
└── package.json        npm workspaces root
```

**Build tool:** Turborepo with `npm workspaces`
**Task graph:** `build` depends on `^build` (packages build in dependency order), `test` depends on `build`, `dev` is persistent/uncached.

---

## Package Details

### 1. SDK (`@canvas-ai/sdk`)

The SDK is the core library. All other packages depend on it. It has zero runtime dependencies beyond `zod` for validation and the OpenRouter fetch API.

```
sdk/src/
├── index.ts                 CanvasAI class, singleton, re-exports
├── models/
│   ├── project.ts           Project — owns screens, generates via router
│   ├── screen.ts            Screen — edit, variants, export
│   └── design-system.ts     DesignSystem type, DESIGN.md parser
├── utils/
│   ├── router.ts            ModelRouter — OpenRouter multi-model routing
│   └── prompts.ts           System prompts for each pipeline stage
├── storage/
│   ├── interface.ts         StorageAdapter interface + factory
│   ├── memory.ts            In-memory implementation (dev)
│   └── sqlite.ts            SQLite implementation (production)
├── screenshot/
│   └── service.ts           Playwright-based HTML→image capture
└── ai-tools.ts              Vercel AI SDK tool definitions
```

**Key classes:**

| Class | Responsibility |
|-------|---------------|
| `CanvasAI` | Entry point. Creates/retrieves projects. Initializes router. |
| `Project` | Owns a set of screens and a design system. Orchestrates generation pipelines (text→screen, image→screen, URL→design tokens). |
| `Screen` | Single generated UI. Supports edit, variant generation, and React export. |
| `ModelRouter` | Routes requests to the optimal LLM per pipeline stage via OpenRouter. Automatic fallback, retry (max 3), streaming, JSON parsing with optional Zod validation. |
| `StorageAdapter` | Interface for persistence. Two implementations: `MemoryStorage` (Maps) and `SQLiteStorage` (better-sqlite3). |

**Exports:** The SDK exposes sub-path exports for tree-shaking:
- `@canvas-ai/sdk` — core classes
- `@canvas-ai/sdk/ai` — Vercel AI SDK tools
- `@canvas-ai/sdk/storage/*` — storage adapters

---

### 2. Web UI (`@canvas-ai/web-ui`)

Single-page React 19 application with Zustand 5 for state management, built with Vite 6.

```
web-ui/src/
├── main.tsx                 Entry point, theme init, dev console export
├── App.tsx                  Root layout (TopBar + Canvas + overlays)
├── theme.ts                 Light/dark mode Zustand store
├── stores/
│   └── canvas-store.ts      Central Zustand store (all app state)
├── hooks/
│   └── useCanvas.ts         Canvas pointer/touch/keyboard interaction
└── components/
    ├── InfiniteCanvas.tsx    Dot grid + transform layer + empty state
    ├── ScreenCard.tsx        iframe preview + hover actions
    ├── ChatPanel.tsx         Floating bottom-center input + suggestions
    ├── ResultPanel.tsx       Left-side generation summary panel
    ├── TopBar.tsx            Fixed top navigation bar
    ├── Toolbar.tsx           Bottom-right zoom controls
    ├── RightToolbar.tsx      Vertical tool selector (right edge)
    └── DesignPanel.tsx       Design system editor (slides out)
```

**State architecture:** Single Zustand store (`canvas-store.ts`) holds everything:

```
┌─ CanvasStore ─────────────────────────────────────┐
│  project          Current project metadata         │
│  screens[]        All generated screens             │
│  selectedScreenId Currently selected screen         │
│  viewport         Camera { x, y, zoom }             │
│  activeTool       "select" | "pan" | "edit" | "mark"│
│  designSystem     Colors, fonts, corner radius      │
│  designPanelOpen  Design panel visibility           │
│  agentTasks[]     Generation task tracking           │
│  chatMessages[]   Chat history                      │
│  history[]        Undo/redo stack                   │
│  isGenerating     Loading state                    │
└───────────────────────────────────────────────────┘
```

**Canvas interaction (`useCanvas.ts`):**
- Pointer events for pan/drag/select based on active tool
- Touch events for pinch-to-zoom and two-finger pan
- Momentum scrolling (friction: 0.92, min velocity: 0.5px)
- Zoom-to-cursor on Ctrl/Cmd+scroll
- Keyboard shortcuts: arrow keys (cycle screens), Delete (remove), Cmd+Z (undo), Space (pan mode), Escape (deselect)

**Rendering pipeline:**
1. Canvas div captures all pointer/touch/wheel events
2. Dot grid background scales and repositions with viewport
3. Transform layer applies `translate(x, y) scale(zoom)` to position all screens
4. Each `ScreenCard` renders HTML in an iframe via Blob URL (isolated origin, no sandbox needed)
5. Cards show at 0.25 scale with hover-reveal action buttons

**CSS variables system** (defined in `index.html`):
- `--chrome-*` — app chrome (always dark)
- `--canvas-bg`, `--dot-grid` — canvas appearance
- `--accent` — brand color
- `--shadow-*` — elevation levels
- `data-theme` attribute toggles light/dark for canvas content

**Dev server:** Vite on port 5173, proxies `/api/*` to `localhost:8080`.

---

### 3. API Server (`@canvas-ai/api-server`)

Minimal Node.js HTTP server (no framework). Custom router with regex pattern matching.

**Routes:**

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/health` | Health check |
| `POST` | `/api/projects` | Create project |
| `POST` | `/api/projects/:pid/screens/generate` | Generate screen from text |
| `POST` | `/api/projects/:pid/screens/from-image` | Generate from image |
| `POST` | `/api/projects/:pid/screens/:sid/edit` | Edit existing screen |
| `POST` | `/api/projects/:pid/screens/:sid/variants` | Generate variants |
| `GET` | `/api/projects/:pid/screens/:sid/export/react` | Export as React |
| `GET` | `/api/projects/:pid/screens/:sid` | Get screen HTML |
| `GET` | `/api/projects/:pid/screens` | List screens (paginated) |
| `GET` | `/api/assets/:key` | Serve stored assets |
| `POST` | `/api/projects/:pid/design-system/extract` | Extract tokens from URL |

**Protections:** CORS allowlist, per-IP rate limiting (30 req/min), input validation, graceful shutdown on SIGINT/SIGTERM.

---

### 4. MCP Server (`@canvas-ai/mcp-server`)

Exposes the SDK as 9 MCP tools over stdio transport. Compatible with Claude Desktop and Claude Code.

**Tools:** `create_project`, `generate_screen`, `generate_from_image`, `edit_screen`, `generate_variants`, `get_screen`, `list_screens`, `export_react`, `extract_design_system`

Each tool wraps the corresponding SDK method and returns JSON text content.

---

### 5. Figma Plugin (`@canvas-ai/figma-plugin`)

esbuild-bundled plugin for importing Atelier outputs into Figma.

**Capabilities:**
- `import-screen` — Creates a Figma frame with device-specific dimensions (390x844 mobile, 1440x900 desktop, etc.) and text content
- `import-design-system` — Creates Figma paint styles from design tokens (hex→RGB conversion)

---

## Data Flow

### Generation (text → screen)

```
User types prompt in ChatPanel
        │
        ▼
ChatPanel.send() ─── POST /api/projects/:pid/screens/generate
        │                          │
        │                          ▼
        │                  sdk.project(pid).generate(prompt)
        │                          │
        │                  ┌───────┴───────┐
        │                  │ intent_parse  │ Extract requirements (JSON)
        │                  └───────┬───────┘
        │                          │
        │                  ┌───────┴──────────┐
        │                  │ layout_generate  │ Generate HTML + Tailwind
        │                  └───────┬──────────┘
        │                          │
        │                          ▼
        │                  Screen object created
        │                          │
        ▼                          ▼
completeTask() ◄──── { screenId, html }
        │
        ▼
Screen added to store → renders on canvas
```

### Edit flow

```
User clicks Edit on ScreenCard
        │
        ▼
addChatMessage("Edit: ...") → triggers send()
        │
        ▼
POST /api/.../edit → screen.edit(prompt)
        │
        ▼
design_refine stage → updated HTML
        │
        ▼
New screen added to canvas (preserves original)
```

### Design system flow

```
DesignPanel ──── updateDesignSystem() ──── Zustand store
                                              │
                                              ▼
                                   Passed to generate() calls
                                   as context for LLM prompts
```

---

## Storage

Two interchangeable backends behind the `StorageAdapter` interface:

| Backend | When | How |
|---------|------|-----|
| `MemoryStorage` | Development, testing | In-memory Maps, lost on restart |
| `SQLiteStorage` | Production | `better-sqlite3`, tables: `projects`, `screens`, `assets` |

Configured via `ATELIER_STORAGE` env var (`memory` or `sqlite`).

---

## Skills

Three agent skills following the [open standard](https://github.com/anthropics/agent-skills):

| Skill | Purpose |
|-------|---------|
| `enhance-prompt` | Expands brief prompts into detailed generation instructions |
| `react-components` | Exports screens as typed React/TSX components |
| `design-md` | Extracts, generates, and merges DESIGN.md specs |

Each has a `SKILL.md` manifest, `scripts/` directory, and `examples/`.

---

## Key Design Decisions

1. **Blob URL iframes** for screen previews — provides origin isolation without sandbox attribute restrictions that block CSS/JS rendering
2. **Single Zustand store** — all state in one place for simplicity and undo/redo support
3. **No framework for API server** — Node.js `http` module with custom router keeps dependencies minimal
4. **Multi-model routing** — different LLMs for different pipeline stages (intent parsing vs layout generation vs code rendering) optimizes for quality and cost
5. **CSS variables for theming** — app chrome stays dark always, canvas content respects light/dark theme
6. **Momentum scrolling** — velocity tracking during drag with friction decay on release for natural feel
