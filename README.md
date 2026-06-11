# Atelier

**AI-native UI design platform.** Generate production-ready screens from natural language, redesign entire websites from a URL, and edit everything on a Figma-style infinite canvas.

[![CI](https://github.com/6imeon/Atelier/actions/workflows/ci.yml/badge.svg)](https://github.com/6imeon/Atelier/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%E2%89%A522-339933?logo=node.js&logoColor=white)](package.json)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)](tsconfig.json)

<!-- Add a hero screenshot or GIF of the canvas here:
![Atelier canvas](docs/assets/hero.png)
-->

## What it does

- **Website redesign from a URL** — paste a link and Atelier crawls the site, extracts the brand (colors, fonts, logos), auto-matches one of **52 design personas**, proposes a multi-page plan, and generates each page section-by-section with quality gates.
- **Natural language generation** — describe any screen ("a SaaS pricing page with three tiers, dark theme") and get production-ready Tailwind HTML, streamed live over SSE.
- **Infinite canvas editing** — zoom, pan, drag screens, click any element to edit it inline or with AI, swap sections from a **950+ component library**, and tune the extracted design system (palette, type pairing, shape) with changes applied to every screen in real time.
- **Built on design science** — APCA contrast validation, OKLCH perceptually-uniform palettes, font-pairing scoring, Aaker brand-personality vectors driving typography and spacing tokens, CRO rules in prompts, and a 13-rule post-generation critique.
- **Bring any model** — every pipeline stage routes to its optimal model via [OpenRouter](https://openrouter.ai) (Kimi K2.6, DeepSeek V3, Qwen3, Gemini — all overridable by env var), with automatic fallback and retry.
- **Integrates everywhere** — REST API with SSE streaming, an [MCP server](packages/mcp-server/) for Claude, a [Figma plugin](packages/figma-plugin/), and `.atelier` project export/import.

## Quick start

### Docker (recommended)

```bash
cp .env.example .env
# Add your OPENROUTER_API_KEY to .env

docker volume create atelier_atelier-data
docker compose up -d --build
```

| Service | URL |
|---------|-----|
| Web UI | http://localhost:8090 |
| API server | http://localhost:8080 |
| Crawl4AI | http://localhost:11235 |

If `ATELIER_API_KEY` is set in `.env`, the web UI shows a login page — paste the key to sign in. Leave it unset for open access (dev mode).

### Local development

```bash
npm install
cp .env.example .env   # add your OPENROUTER_API_KEY
npm run dev
```

Requires Node ≥ 22. The web UI runs on `localhost:5173` in dev mode. Append `?test=true` to try every UI feature with fixture screens — no API key or credits needed.

## How it works

```
URL or prompt
   │
   ├─ Crawl & brand extraction        colors, fonts, logos (cached 30 days)
   ├─ Persona matching                52 personas, Aaker 5D + signal scoring
   ├─ Quality pre-processing          APCA contrast · OKLCH palette · font pairing · type scale
   ├─ Plan                            multi-page proposal, user approves
   ├─ Generate                        section-by-section, 4x parallel, component references
   └─ Critique & sync                 13-rule UICrit scoring + design-system extraction
```

Every stage routes to a purpose-picked model and streams progress to the UI. User instructions ("keep the logo and colours", "only the homepage") are respected at every stage. Full pipeline details in the [reference](docs/reference.md).

## Monorepo

| Package | Description |
|---------|-------------|
| [`sdk`](packages/sdk/) | Core pipeline — crawling, brand extraction, persona engine, generation, quality gates, storage |
| [`web-ui`](packages/web-ui/) | React 19 infinite canvas app (Vite + Zustand) |
| [`api-server`](packages/api-server/) | REST API with SSE streaming, API-key and Microsoft Entra ID auth |
| [`mcp-server`](packages/mcp-server/) | Model Context Protocol server — drive Atelier from Claude |
| [`figma-plugin`](packages/figma-plugin/) | Import generated screens and design tokens into Figma |

Plus [`scripts/`](scripts/) (component generation, 52 persona definitions) and [`skills/`](skills/) (agent skills for prompt enhancement, React export, and DESIGN.md specs).

## Configuration

Only one variable is required:

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENROUTER_API_KEY` | **Yes** | OpenRouter API key for multi-model access |
| `ATELIER_API_KEY` | No | Enables Bearer auth + login page (unset = open dev mode) |
| `ATELIER_STORAGE` | No | `memory` (default) or `sqlite` |
| `MONGO_URI` | No | Optional MongoDB Atlas analytics/learning layer |
| `AUTH_MODE` | No | `apikey` (default), `entra`, or `both` — Microsoft Entra ID SSO |
| `CANVAS_MODEL_*` | No | Override the model for any pipeline stage |

See [.env.example](.env.example) for the full annotated list and the [reference](docs/reference.md#environment-variables) for every variable.

## Documentation

- [Full reference](docs/reference.md) — every feature, package, endpoint, and env var in depth
- [Persona auto-matching algorithm](docs/automatching-algorithm.md) — research and scoring model
- [Microsoft Entra ID setup](docs/entra-setup.md) — enterprise SSO configuration
- [Analytics layer](docs/database.md) — MongoDB learning-loop design
- [Export & import](docs/export-import.md) — the `.atelier` project format

## Contributing

Issues and PRs welcome. The repo uses Turborepo — `npm run build`, `npm run lint`, and `npm test` from the root cover all packages, and CI runs the same three on every push. A husky pre-commit hook runs lint-staged after `npm install`.

## License

[MIT](LICENSE)
