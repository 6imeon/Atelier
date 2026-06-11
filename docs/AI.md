# Atelier — AI System Design

## How the AI Works

Atelier uses a **multi-stage pipeline** where each stage is routed to a different LLM optimized for that task. All model calls go through [OpenRouter](https://openrouter.ai/), which provides a unified API across providers (Anthropic, OpenAI, Google).

---

## Pipeline Architecture

A single user prompt flows through multiple specialized stages before becoming a rendered screen:

```
"Create a dashboard with analytics charts"
                │
                ▼
┌──────────────────────────────────────┐
│  Stage 1: INTENT PARSE               │
│  Model: Claude Sonnet 4              │
│  Temp: 0.1  ·  Max: 1K tokens       │
│                                      │
│  Extracts structured requirements:   │
│  - Platform (mobile/desktop/tablet)  │
│  - App type                          │
│  - Components list with priorities   │
│  - Style preferences                 │
│  - Layout structure                  │
│  - Constraints                       │
│  Output: JSON                        │
└──────────────┬───────────────────────┘
               │
               ▼
┌──────────────────────────────────────┐
│  Stage 2: LAYOUT GENERATE            │
│  Model: Claude Opus 4                │
│  Temp: 0.7  ·  Max: 8K tokens       │
│                                      │
│  Generates complete HTML + Tailwind: │
│  - Semantic HTML structure           │
│  - Responsive Tailwind classes       │
│  - Realistic placeholder content     │
│  - Accessibility (aria-labels)       │
│  - Design system integration         │
│  Output: { html, componentTree,      │
│            designTokens }            │
└──────────────┬───────────────────────┘
               │
               ▼
         Screen created
         Rendered in iframe on canvas
```

---

## All Pipeline Stages

Default models are cost-optimized (~80% cheaper than all-premium). Every stage can be overridden via `CANVAS_MODEL_<STAGE>` env vars.

| Stage | Primary Model | Fallback Model | Temp | Max Tokens | Purpose |
|-------|--------------|----------------|------|------------|---------|
| `intent_parse` | DeepSeek V3 | Qwen 3 235B | 0.1 | 1,000 | Extract structured requirements from natural language |
| `vision_interpret` | Qwen VL2.5 72B | Gemini 2.5 Flash | 0.3 | 4,000 | Analyze uploaded sketches, wireframes, screenshots |
| `layout_generate` | Claude Sonnet 4 | DeepSeek V3 | 0.7 | 8,000 | Generate complete HTML+Tailwind UI |
| `design_refine` | DeepSeek V3 | Qwen 3 235B | 0.4 | 4,000 | Apply targeted edits to existing HTML |
| `code_render` | DeepSeek V3 | Gemini 2.5 Flash | 0.1 | 8,000 | Convert HTML to React/TypeScript |
| `design_extract` | DeepSeek V3 | Qwen 3 235B | 0.2 | 4,000 | Extract design tokens from webpage HTML |

### Why this model mix?

- **Layout generation** is the only stage that justifies a premium model — it needs strong spatial reasoning and clean HTML/Tailwind output. Claude Sonnet 4 hits the sweet spot of quality vs cost.
- **Intent parsing, refine, code render, extract** are all structured input→output tasks where DeepSeek V3 performs comparably to premium models at ~10x lower cost.
- **Vision** uses Qwen VL2.5 which has strong multimodal capabilities for wireframe/sketch analysis at a fraction of GPT-4o's cost.
- Fallbacks use a different provider for redundancy — if DeepSeek is down, Qwen picks up, and vice versa.

### Upgrading to premium models

To swap any stage back to a premium model, set the env var:

```bash
# Use Opus for highest quality layout generation
CANVAS_MODEL_LAYOUT_GENERATE=anthropic/claude-opus-4

# Use GPT-4o for vision if Qwen VL isn't accurate enough
CANVAS_MODEL_VISION_INTERPRET=openai/gpt-4o
```

---

## Model Router (`ModelRouter`)

The router handles all communication with OpenRouter. It provides:

### Automatic Fallback
If the primary model fails (HTTP error or network error), the router automatically retries with the fallback model. Max 3 retries total.

```
Claude Opus 4 ── fails ──▶ Claude Sonnet 4 ── fails ──▶ RouterError
```

### Three Response Modes

1. **`route()`** — Raw HTTP response. Used when you need full control.
2. **`routeJSON()`** — Parses response as JSON, strips markdown fences, optional Zod schema validation.
3. **`routeStream()`** — AsyncGenerator yielding content deltas. SSE parsing of OpenRouter streaming responses.

### Request Format
All requests go to `https://openrouter.ai/api/v1/chat/completions` with:
- `Authorization: Bearer <OPENROUTER_API_KEY>`
- `X-Title: Atelier`
- Standard OpenAI-compatible chat completion body

---

## Generation Flows

### 1. Text → Screen (Primary Flow)

```typescript
// What happens when user types "Create a login page"

// Stage 1: Parse intent
intent = routeJSON("intent_parse", [
  { role: "system", content: INTENT_SYSTEM_PROMPT },
  { role: "user", content: "Create a login page" }
])
// Returns: { platform: "desktop", components: [...], style: {...} }

// Stage 2: Generate HTML
result = routeJSON("layout_generate", [
  { role: "system", content: LAYOUT_SYSTEM_PROMPT },
  { role: "user", content: JSON.stringify({
    intent,
    designSystem,  // from project's design system
    deviceType: "DESKTOP"
  })}
])
// Returns: { html: "<complete page>", componentTree: {...} }
```

### 2. Image → Screen

For sketch/wireframe/screenshot uploads:

```
Image (base64) ──▶ vision_interpret ──▶ Visual context JSON
                                              │
User prompt (optional) ──▶ intent_parse ──────┤
                                              │
                                              ▼
                                    layout_generate
                                    (with both contexts)
                                              │
                                              ▼
                                        Screen HTML
```

The vision model analyzes the image structure (layout regions, components, colors, hierarchy), then the layout generator combines visual context with text intent to produce HTML.

### 3. Edit Screen

Targeted modifications to existing screens:

```
Current HTML + Edit request ──▶ design_refine ──▶ Updated HTML
```

The refine prompt includes the current HTML and the edit instruction. The model applies surgical changes while preserving the overall design system.

### 4. Generate Variants

Creates multiple variations of an existing screen:

```
Current HTML + Variant request ──▶ layout_generate (variant mode)
                                        │
                                        ▼
                                  1-5 variant HTMLs
```

Supports three creative ranges:
- **REFINE** — Small tweaks (colors, spacing, minor layout shifts)
- **EXPLORE** — Moderate changes (different component arrangements, alternate styles)
- **REIMAGINE** — Significant departures (completely different approaches to the same brief)

And five design aspects to vary:
- `LAYOUT` — Page structure and component arrangement
- `COLOR_SCHEME` — Color palette and contrast
- `IMAGES` — Image choices and placement
- `TEXT_FONT` — Typography selections
- `TEXT_CONTENT` — Copy and content variations

### 5. Export to React

Mechanical conversion of generated HTML to React components:

```
HTML + Tailwind ──▶ code_render ──▶ TSX component
```

Output is a functional React component with TypeScript types, hooks, Tailwind classes, and default export.

### 6. Extract Design System from URL

Fetches a webpage and extracts design tokens:

```
URL ──▶ fetch HTML (10s timeout) ──▶ design_extract ──▶ DesignSystem JSON
```

Extracts: colors, typography (families, scale), spacing, border-radius, shadows, and component patterns.

---

## System Prompts

Each pipeline stage has a specialized system prompt (defined in `prompts.ts`):

| Prompt | Key Instructions |
|--------|-----------------|
| `INTENT_SYSTEM` | Extract platform, app type, components (with priority), style preferences, layout structure, constraints. Return JSON only. |
| `VISION_SYSTEM` | Describe layout regions, component positions, color scheme, visual hierarchy from an image. Return JSON only. |
| `LAYOUT_SYSTEM` | Generate complete HTML with Tailwind CDN, semantic elements, responsive design, realistic content, aria-labels. Return JSON with `html`, `componentTree`, `designTokens`. |
| `REFINE_SYSTEM` | Apply targeted edits preserving design system. Return updated HTML with change summary. |
| `VARIANT_SYSTEM` | Generate variants at specified creative range (REFINE/EXPLORE/REIMAGINE). Return array of variant HTMLs with descriptions. |
| `REACT_EXPORT_SYSTEM` | Convert HTML+Tailwind to clean React/TypeScript. Functional components, hooks, default export. |
| `EXTRACT_SYSTEM` | Extract design tokens: colors, typography, spacing, border-radius, shadows, component patterns. |

All prompts enforce **JSON-only output** to enable reliable parsing.

---

## Design System Integration

The design system flows through the entire AI pipeline:

```
DesignPanel (UI)
    │
    ▼
Zustand store: designSystem
    │ { seedColor, palette, fonts, cornerRadius }
    │
    ▼
ChatPanel.send() ──▶ API ──▶ project.generate()
    │
    ▼
Included in layout_generate prompt context:
    { intent, designSystem, deviceType }
    │
    ▼
LLM uses design tokens to generate
consistent HTML with matching colors,
fonts, and border-radius values
```

The `DesignSystem` type in the SDK supports:
- Colors (primary, secondary, accent, background, surface, error)
- Typography (font families, size scale, weights, line heights)
- Spacing scale
- Border radius values
- Shadow definitions
- Component patterns with Tailwind class mappings

---

## Integration Points

### Vercel AI SDK (`ai-tools.ts`)

The SDK exposes all capabilities as Zod-validated tools compatible with Vercel's `generateText()`:

```typescript
import { canvasTools } from "@canvas-ai/sdk/ai";
import { generateText } from "ai";

const { text } = await generateText({
  model: yourModel,
  tools: canvasTools({ apiKey: "sk-or-..." }),
  prompt: "Create a dashboard with user analytics"
});
```

Available tools: `create_project`, `generate_screen`, `generate_from_image`, `edit_screen`, `generate_variants`, `get_screen`, `export_react`, `extract_design`.

### MCP Server

Same tool set exposed over Model Context Protocol (stdio transport). Add to Claude Desktop config:

```json
{
  "mcpServers": {
    "atelier": {
      "command": "node",
      "args": ["packages/mcp-server/dist/index.js"],
      "env": { "OPENROUTER_API_KEY": "sk-or-..." }
    }
  }
}
```

---

## Configuration

### Required Environment

```bash
OPENROUTER_API_KEY=sk-or-v1-xxxxxxxxxxxxx  # Required for all AI features
```

### Optional Environment

```bash
ATELIER_STORAGE=memory          # "memory" (default) or "sqlite"
ATELIER_STORAGE_PATH=./data/canvas.db  # SQLite database path
PORT=8080                      # API server port
CORS_ORIGINS=http://localhost:5173  # Allowed CORS origins
```

---

## Cost & Performance Considerations

- **Intent parsing** (Sonnet, 0.1 temp, 1K max) — fast and cheap, ~0.5s
- **Layout generation** (Opus, 0.7 temp, 8K max) — slower and most expensive, ~5-15s. This is the bottleneck.
- **Edits** (Sonnet, 0.4 temp, 4K max) — moderate cost, ~2-5s
- **Variants** generate 1-5 screens in one call — multiplied cost but single round-trip
- **React export** (Haiku, 0.1 temp, 8K max) — cheapest and fastest, ~1-3s

The multi-model approach optimizes the cost/quality tradeoff: expensive models only where quality matters most (layout generation), cheap models for mechanical tasks (code rendering, extraction).

---

## Future Considerations

- **Streaming generation** — `routeStream()` is implemented but not yet wired to the UI. Would allow progressive HTML rendering as the model generates.
- **Screenshot service** — Playwright-based `screenshot/service.ts` exists for HTML→image capture. Could enable visual thumbnails on the canvas instead of live iframes.
- **Design system propagation** — Currently passed as prompt context. Could be enforced post-generation via HTML transformation.
- **Multi-turn editing** — Currently each edit is a single turn. Conversation history could improve multi-step refinements.
- **Caching** — Identical prompts with identical design systems could be cached to avoid redundant API calls.
