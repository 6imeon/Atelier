# Atelier — Full Reference

Complete feature and architecture documentation. For a quick overview, see the [README](../README.md).

## Features

### Website Redesign

Paste a URL into the chat panel and Atelier handles the full redesign pipeline:

1. **Crawl** — Fetches the site via Crawl4AI (headless browser with 60s timeout, falls back to direct fetch with 15s timeout). Detects bot challenges (Cloudflare, reCAPTCHA) and marks as blocked.
2. **Brand extraction** — Identifies primary/secondary/accent colors from CSS, heading and body fonts from Google Fonts links, logos from image analysis, and brand name from `<title>` or `og:site_name`. Results are cached in MongoDB (30-day TTL) to skip re-extraction on subsequent visits.
3. **Persona matching** — Automatically selects one of 52 design personas using a dual-layer scoring model: an Aaker 5D intermediate representation (cosine similarity) fused with direct multi-signal matching across industry keywords, color palette, font classification, prompt tone, and URL signals (see [Persona System](#persona-system)).
4. **Quality pre-processing** — Before generation, several validation and enrichment steps run:
   - **APCA contrast validation** — Checks all text/background color pairs against APCA Lc thresholds (body≥75, large≥60). Logs suggested fixes while preserving brand colors.
   - **OKLCH palette generation** — Generates perceptually uniform 11-step color scales from brand colors with semantic tokens (bg-page, text-primary, brand-primary-hover, etc.).
   - **Font pairing validation** — Scores the heading+body font pair (0-1) using a ~60-font adjacency map. Auto-suggests a better body font if score < 0.4.
   - **Typographic scale** — Blends musical-interval ratios weighted by the persona's Aaker vector to produce 8 concrete font sizes, line-heights, and a max line length.
   - **Aaker design tokens** — Generates border-radius, spacing density, shadow depth, animation speed/easing, and letter-spacing from the Aaker personality vector.
5. **Plan** — AI proposes a multi-page redesign plan (3-5 pages) with a creative design system name and brand analysis. RALF (Retrieval-Augmented Layout Generation) injects layout examples from previous generations as hints. User approves before generation begins.
6. **Generate (section-by-section)** — Each page is parsed into sections (nav, hero, content, footer), and each section is generated independently with:
   - **Parallel batch generation** — sections are generated in batches of 4 concurrent API calls via `Promise.all`, achieving 3-4x speedup over sequential generation (typical: 2-3 minutes vs 8-10 minutes for a 10-section page)
   - Matched components from the 950+ component library as structural references
   - Few-shot template examples from analytics (RALF), fetched in parallel
   - CRO (Conversion Rate Optimization) rules: single CTA above fold, high-contrast buttons, social proof within 2 viewports, sticky nav with CTA, form fields ≤ 4
   - Content-type-specific hints (stats → counter animations, CEO interview → pull quotes, timeline → scroll-driven growth)
   - **Multi-page consistency** — After generating the first page, nav and footer HTML are extracted and reused verbatim on subsequent pages. Button styles and section padding patterns are injected as consistency constraints.
   - **Truncation recovery** — When a section exceeds the model's output token limit, a tag-stack parser closes all unclosed HTML tags in the correct nesting order, preventing broken page layouts.
7. **Post-generation quality** — UICrit runs 13 rules across CRO, hierarchy, accessibility, contrast, layout, and animation safety. Auto-fixes missing alt tags and ScrollTrigger reverse. Scores 0-10, passes at ≥6.
8. **Design system sync** — After generation, `syncDesignSystemFromHtml()` parses the actual fonts (from Google Font `<link>` tags) and colors (hex frequency ranking, skipping grays) from the generated HTML and updates the design system store.

User instructions are passed through the entire pipeline — saying "keep logos and colour" or "only the homepage" is respected at every stage.

#### Premium Scroll Mode

Toggle "Premium Scroll" in the chat panel before generating to enable scroll-locked animations on the exported page:

- Hero and content sections use GSAP ScrollTrigger with `pin: true` and `scrub: 1`
- Each section pins in place while its content animates in sequentially as the user scrolls
- Sections stay pinned for 1.5x viewport height of scrolling before releasing to the next
- Nav and footer scroll normally (not pinned)
- In the canvas iframe preview, ScrollTrigger is automatically neutralized so pinned sections render as a static preview — the full interactive scroll experience is only active in exported/downloaded HTML

### Persona System

Atelier includes 52 design personas, each defining a complete design philosophy with specific visual rules, typography choices, color palettes, CSS patterns, and constraints.

#### How Personas Work

Each persona is a markdown file in `scripts/personas/` containing:

- **Designer identity** — Name, background, career history
- **Design philosophy** — Core principles and worldview
- **Visual language** — Layout patterns, typography rules (specific typefaces, sizing, weights, line-heights), color palettes (with hex values), image/photography style, spacing scales
- **Anti-patterns** — What the persona never does (e.g. "No gradients", "No drop shadows", "Never uses stock photography")
- **CSS patterns** — Copy-paste Tailwind snippets for common elements
- **Reference brands** — Real-world examples that embody the aesthetic

#### Available Personas (52)

| Style | Personas |
|-------|----------|
| **Minimalist** | Minimal Editorial, Japanese Minimalism, Swiss International, Neo-Grotesque, Wabi-Sabi, Techno-Minimal, Scandinavian Clean |
| **Bold & Modern** | Bold Modern, Brutalist Digital, Cyberpunk Futurism, Constructivist, K-Pop Maximalism, Streetwear Culture |
| **Warm & Organic** | Warm Nude, Coastal Mediterranean, Cottagecore Digital, Tropical Modernism, Organic Biomorphic, Apothecary Botanical, Rustic Artisan |
| **Editorial** | Editorial Luxury, Editorial Magazine, New York Editorial, Nordic Noir, Noir Detective, Dark Academia |
| **Heritage & Revival** | Art Deco Revival, Art Nouveau Digital, Gothic Revival, Mid-Century Modern, Nautical Heritage, Retro Diner |
| **Corporate & Tech** | Corporate Precision, Bauhaus Functional, Neoclassical Institutional, Space Agency, Healthcare Modern, Fintech Gradient |
| **Cultural** | African Contemporary, Latin Maximalism, Afrofuturism, Moroccan Zellige, Desert Southwest, Neo-Miami |
| **Experimental** | Memphis Postmodern, Pop Art Digital, Kinetic Typography, Retro Computing, Solarpunk, Psychedelic Revival |
| **Dynamic** | Sports Dynamic, Utility Industrial |

#### Auto-Matching Algorithm

When a redesign is triggered, `autoMatchPersona()` scores every persona using a dual-layer architecture: raw signals are mapped to an intermediate **Aaker 5D brand personality vector**, which is compared against each persona's pre-scored Aaker profile via cosine similarity, then fused with direct signal match bonuses.

**Architecture:**

```
Input Signals → Feature Extraction → Aaker 5D Vector → Cosine Similarity → Final Score
                                                         + Direct Match Bonus
```

**Signal sources (used for both Aaker mapping and direct scoring):**

| Signal | Aaker Weight | How it works |
|--------|-------------|--------------|
| **Industry keywords** | 0.30 | Word-boundary regex matching across 31 industries with 250+ keywords (single-word + bigrams). Each industry has an Aaker profile and a ranked persona list. |
| **Color palette** | 0.20 | HSL analysis mapped to Aaker dimensions (hue→personality, saturation→Excitement, lightness→Sophistication) plus CIE Lab perceptual distance (CIE76) for direct matching. |
| **Font classification** | 0.15 | 8 font categories from 100+ named families, each mapped to an Aaker vector. Heading 70% / body 30% weighting. |
| **Prompt tone** | 0.25 | 45+ stylistic keywords mapped to Aaker vectors. Detects personality intent from user's prompt. |
| **URL signals** | 0.10 | 16 TLDs + 9 path patterns → industry detection → industry's Aaker profile. |

**Aaker 5D Intermediate Layer (Aaker 1997):**

Each signal produces a 5-dimension vector: `[Sincerity, Excitement, Competence, Sophistication, Ruggedness]`. These are fused into a single brand Aaker vector using weighted averaging, then compared against each persona's pre-scored vector via cosine similarity.

**Dynamic weighting** adjusts trust between Aaker similarity and direct matching based on signal count:
- 1 signal: 50% Aaker / 50% direct (single signal is too lossy for Aaker)
- 2 signals: 55% / 45%
- 3+ signals: 65% / 35% (more signals = more reliable Aaker representation)

**Scoring output:**
- `PersonaScore` includes: per-signal scores, brand Aaker vector, persona Aaker vector, cosine similarity, direct bonus, total, and confidence
- `MatchResult` returns: best persona, full score breakdown, and top 3 alternatives
- Confidence = margin between #1 and #2 ranked personas
- Low confidence (<0.15) is logged with a warning
- Falls back to Warm Nude when all scores are 0

**Explainable logging:**
```
[personas] Match: editorial-luxury (0.75) — aaker:[0.18,0.36,0.35,0.92,0.10] cos:0.99 industry:0.08 color:0.00 font:0.00 tone:1.00 url:0.00 | runner-up: art-deco-revival (0.72)
```

For full research, gap analysis, and the phased improvement roadmap, see [automatching-algorithm.md](automatching-algorithm.md).

### User Accounts & Authentication

Atelier supports Microsoft Entra ID (Azure AD) for enterprise SSO alongside API key authentication:

- **Dual auth modes** — `apikey`, `entra`, or `both` (configurable via `AUTH_MODE` env var)
- **Master gate** — set `ENTRA_ENABLED=false` (+ `VITE_ENTRA_ENABLED=false` for the web UI) to disable Microsoft sign-in entirely and fall back to API-key auth, without removing the Azure config
- **Validated local login** — API keys entered on the login page are verified against the server before the session starts
- **Single app registration** — One Azure app with App Roles (Admin, Designer, Viewer) for granular permissions
- **MSAL integration** — `@azure/msal-browser` + `@azure/msal-react` with Authorization Code + PKCE flow
- **Token handling** — `User.Read` scope for refreshable tokens, `acquireTokenSilent` with popup fallback
- **Per-user project library** — Kanban board (Active/Expiring/Critical) with cursor-based pagination
- **Auto-cleanup** — Stale projects (30+ days inactive) are automatically purged
- **Graceful fallback** — API key auth continues to work when Entra is not configured

See [entra-setup.md](entra-setup.md) for the full setup guide.

### Natural Language Generation

Describe any screen in the chat panel and get production-ready Tailwind HTML. Supports:

- Full page descriptions ("create a SaaS pricing page with three tiers")
- Component-level requests ("a testimonial carousel with photos")
- Style directives ("dark theme, rounded corners, Inter font")

Generation streams via SSE with real-time progress updates.

### Infinite Canvas

A Figma-style infinite canvas for arranging and comparing screens.

| Feature | Details |
|---------|---------|
| **Zoom** | Scroll wheel zoom-to-cursor, pinch-to-zoom on trackpad, Cmd+/- keyboard |
| **Pan** | Two-finger trackpad scroll, middle-click drag, Space+drag, or Pan tool |
| **Momentum** | Pan has inertial scrolling with friction decay |
| **Screen drag** | Click and drag any screen to reposition it on the canvas |
| **Undo/Redo** | Cmd+Z / Cmd+Shift+Z with 20-step capped history |
| **Screen cycling** | Arrow keys to cycle through screens |
| **Reset** | Cmd+0 resets viewport to origin at 1x zoom |
| **Viewport culling** | Off-screen iframes are unmounted and replaced with lightweight placeholders. 1-screen buffer zone prevents pop-in during panning. |
| **Browser zoom prevention** | Ctrl+scroll and Ctrl+/- are intercepted to prevent browser-level zoom |

### Inline Editing

Click the Edit tool (or select a screen and press Edit), then click any element on a generated page. An edit popup appears at the click position with options:

| Action | Description |
|--------|-------------|
| **Edit Text** | Makes the element `contentEditable` for direct inline typing. Changes are saved back to the screen HTML automatically. |
| **Edit with AI** | Opens a prompt input — describe what to change and AI modifies the element in context. |
| **Replace Section (AI)** | Sends the entire parent section to AI with your instructions to generate a replacement. |
| **From Library** | Opens the component browser to replace the section with a pre-built component. Auto-detects the section type (hero, testimonials, pricing, etc.) from HTML tags, CSS classes, and text content. |

The edit popup:
- Appears at the exact click position, adapts to viewport edges
- Scales inversely with zoom level so it stays readable at any zoom
- Auto-dismisses when you zoom or pan (prevents stale positioning)
- Renders via portal to `document.body` to avoid CSS transform interference

#### Section-Aware Editing

When you click an element, the edit system captures context about the nearest top-level section (direct child of `<body>`):
- Section's CSS selector (for targeted API calls)
- Section tag name (e.g. `section`, `nav`, `footer`)
- Opening tag with classes + first 200 chars of text content

This context is sent to the AI during edits so it understands which part of the page is being modified, improving edit accuracy.

#### Edit Injection Script

Each iframe has ~250 lines of JavaScript injected that:
- Highlights hovered elements with a purple dashed outline
- Generates robust CSS selectors using `CSS.escape()` for Tailwind responsive classes (e.g. `lg:grid-cols-3`)
- Only activates when edit mode is toggled (via CSS class on `<html>`)
- Handles `contentEditable` inline editing with blur/escape detection
- Sends cleaned HTML back to parent (removes injected scripts/styles, preserves user scripts)

### Screen Variants

Generate alternative designs from any existing screen:

```
POST /api/projects/:pid/screens/:sid/variants
```

| Option | Values | Description |
|--------|--------|-------------|
| **variantCount** | 1-5 (default: 3) | Number of variants to generate |
| **creativeRange** | `REFINE`, `EXPLORE`, `REIMAGINE` | How much to deviate from original |
| **aspects** | `LAYOUT`, `COLOR_SCHEME`, `IMAGES`, `TEXT_FONT`, `TEXT_CONTENT` | Which aspects to vary |

Creative ranges:
- **REFINE** — Small tweaks (color shade, spacing adjustments)
- **EXPLORE** — Moderate changes (different layout grid, alternative color scheme)
- **REIMAGINE** — Significant departures (completely different visual direction)

### Design System — Story Mode

The design system card appears on the canvas after generation. It shows the actual tokens extracted from the generated pages (not the original site).

#### Hero Section
- Brand mark (SVG icon or extracted logo)
- Brand name and persona attribution ("by The Artisan")
- Design ethos quote from the matched persona

#### Palette Story
- 2x2 grid of color cards (primary, secondary, tertiary, neutral)
- Each card shows the color swatch, role name, emotional meaning (context-aware based on persona), and hex value
- Click any swatch to open a color picker — changes apply to all screens in real-time
- Expandable shade strips for fine-tuning each color
- **Seed color** input — set a base color for palette generation
- **Harmony selector** — choose palette generation mode:
  - Custom (manual per-color control)
  - Tonal (same hue, varied saturation/lightness)
  - Vibrant (triadic — three evenly spaced hues)
  - Monochrome (single hue, varied lightness)
  - Complementary (opposite hues + accent)

Color changes are applied in a single pass per screen to avoid stale-read issues when multiple colors change simultaneously.

#### Type Pairing
- Live preview showing headline + body fonts together with sample text
- **Searchable font picker** with ~150 popular Google Fonts
- Search by name with instant filtering
- Fonts preview in their actual typeface (lazy-loaded from Google Fonts CSS — only loads fonts visible in the dropdown)
- Custom font input at the bottom — type any Google Font name not in the list
- Three font roles: Headline, Body, Label
- Font changes update both CSS `font-family` declarations and URL-encoded font names in Google Fonts `<link>` tags

#### Shape
- Corner radius selector with visual previews: None, S, M, L, XL, Full
- Descriptive labels ("Sharp edges — structured, editorial" through "Full rounding — pill-shaped")
- Changes map to Tailwind border-radius classes (`rounded-none` through `rounded-full`)

#### Page Plan
- Numbered list of proposed pages from the redesign plan
- Each entry shows title and description

#### Original Site Reference (collapsible)
- Extracted color swatches from the original site, organized by section
- Click any swatch to use it as the seed color
- Extracted logos with preview

#### DESIGN.md Export (collapsible)
- Auto-generated markdown design specification
- Includes brand analysis, persona name and ethos, color table with usage notes, typography table, radius, and page plan
- Copy to clipboard button

### Design System — Toolbar Panel

The sidebar design panel (accessible from the right toolbar) provides the same controls in a panel layout:
- Light/dark mode toggle for the UI chrome
- Seed color, color theme, and palette editing
- Font picker with search (same FontPicker component, light variant)
- Corner radius selector
- DESIGN.md tab with copy-to-clipboard

Both the canvas card and toolbar panel share the same Zustand store — changes in either are reflected everywhere and applied to all screens.

### Marks & Annotations

The Mark tool lets you draw rectangular annotations on the canvas for design feedback.

- Select the Mark tool from the toolbar, then click and drag to create an annotation box
- Each mark has a color (default: yellow #E8FF59) and can be removed individually
- "Clear all marks" appears in the toolbar when marks exist
- Marks are non-destructive — they don't modify screen HTML
- Cleared on undo/redo to prevent confusion

### Agent Task Log

Track the status of async generation operations:

- Each generation creates an `AgentTask` with status: `pending` → `running` → `done` | `error`
- Tasks track: prompt, start time, result (generated screen), and error messages
- Accessible from the chat panel via the agent log toggle
- `isGenerating` state prevents concurrent generations

### Component Library

950+ pre-built, industry-specific UI components. Available through two interfaces:

**Component Browser** (TopBar button) — Browse and preview the full library with device-responsive preview (desktop, tablet, mobile).

**Replace from Library** (Edit popup) — When editing a section, the component browser opens with intelligent category pre-filtering based on the section being replaced:
- Detects section type from HTML tags (`<nav>` = navbar, `<footer>` = footer, `<form>` = forms)
- Analyzes CSS classes for category hints (e.g. `hero`, `pricing`, `testimonial`)
- Falls back to text content analysis (e.g. "$/month" = pricing, "What clients say" = testimonials)

Categories: Hero, Features, Cards, CTA, Navbar, Footer, Testimonials, Pricing, Forms, Stats, Team, Gallery, FAQ, Sidebar, Modal, Banner.

Industries: Finance, Technology, Healthcare, E-commerce, Media, Fashion, Automotive, Travel, Education, Sports, Gaming, Fintech, SaaS, Government, Nonprofit, Insurance, Logistics, Legal, Restaurant, Architecture, Alcohol, Culture, Hospitality, Crypto, Aerospace, Publishing, Food, Film, and more.

#### Component Metadata

Each component includes:
- **Adaptability level** — `rigid` (text/color only), `flexible` (restructurable), `fluid` (use as inspiration)
- **Slots** — Editable content areas within the component
- **Variants** — Alternative designs of the same component
- **Quality rating** — 1-5 star rating
- **Usage tracking** — Popularity counter
- **Source** — `scraped:url`, `curated`, or `ai-generated`

### Iframe Rendering System

Each screen is rendered in a sandboxed iframe with several injected scripts:

| Script | Purpose |
|--------|---------|
| **Height measurement** | Reports `scrollHeight` to parent on load + delays (500ms, 2000ms for lazy images). Parent auto-adjusts screen height if it differs by >50px. Capped at 30,000px. |
| **Image fallback** | Replaces broken images with an SVG placeholder to prevent layout destruction. |
| **Render diagnostics** | Logs Tailwind CSS loading status, body colors, image counts (broken vs loaded), total height, and warnings. |
| **ScrollTrigger neutralizer** | Kills ScrollTrigger pin/scrub instances, forces opacity-0 elements visible, removes pin-spacers — so pinned sections render as a static inline preview instead of requiring scroll interaction. |
| **Wheel forwarding** | Captures wheel events inside the iframe and forwards them to the parent for canvas zoom/pan. |
| **Edit injection** | Element selection, hover highlights, inline editing, section replacement (only active in edit mode). |

All scripts are injected into `</head>` without reloading the iframe. Edit mode is toggled via a CSS class on `<html>` rather than re-injection.

### SSE Streaming

Generation endpoints use Server-Sent Events for real-time progress:

```
data: {"type":"progress","stage":"Capturing a reference","detail":"url"}
data: {"type":"progress","stage":"Building the design system"}
data: {"type":"error","error":"message"}
data: {"type":"complete","plan":{...}}
```

The frontend shows timed progress estimates that are overridden by actual server events when they arrive.

### Export & Import

Export screens and full projects from the TopBar:

| Format | Description |
|--------|-------------|
| **Download HTML** | Save each screen as a standalone `.html` file |
| **Copy HTML** | Copy raw HTML to clipboard |
| **Download React TSX** | Save as React component wrappers |
| **Download full project** | All screens in a single HTML file with tab navigation |
| **Copy for Figma** | Copy formatted HTML for pasting into Figma |
| **Export Project (.atelier)** | Save complete project state (screens, design system, tokens, marks) as a single `.atelier` file for later import |
| **Import Project (.atelier)** | Load a previously exported `.atelier` file — restores all screens, design system, and canvas layout |

#### Project Export/Import

The `.atelier` format is a JSON file containing the full project state: metadata, all screens (HTML + positions), design system settings, extracted tokens, and marks. Placeholder screens (still generating) are excluded.

On import, all IDs are remapped to avoid collisions while preserving variant parent-child relationships. The design system is persisted to localStorage. A confirmation dialog appears when importing over an existing project.

**Drag & drop:** Drop a `.atelier` file anywhere on the canvas to import — a visual overlay appears while dragging.

See [export-import.md](export-import.md) for the full design document.

### Test Mode (Development)

Test all UI features without calling AI or spending credits.

| Trigger | How |
|---------|-----|
| **TEST button** | Yellow button in TopBar (dev mode only). Toggles to red "EXIT TEST" to clear. |
| **URL parameter** | Navigate to `localhost:5173?test=true` |
| **Console** | `window.__loadTestFixtures()` / `window.__clearTestFixtures()` |

Loads 3 template screens (Homepage, About, Contact) for "Horizon Studio" + a fully configured design system card with persona metadata. All templates use matching Google Fonts (`Playfair Display` + `Inter`) and hex colors (`#6366f1`, `#f59e0b`, `#10b981`) so font/color apply, editing, and design system features work correctly.

Test fixtures are code-split via dynamic `import()` and excluded from production builds. Test screens are identified by `test_fixture_` ID prefix for clean removal.

---

## Architecture

```
atelier/
├── packages/
│   ├── sdk/              Core SDK — models, AI pipeline, storage, quality gates
│   │   └── src/utils/    contrast, color-scale, font-pairing, design-critique,
│   │                     aaker-tokens, typographic-scale, personas, prompts
│   ├── web-ui/           React infinite canvas app (Vite + Zustand)
│   ├── api-server/       REST API (Node.js HTTP, Dockerized)
│   ├── mcp-server/       Model Context Protocol server for Claude
│   └── figma-plugin/     Figma import plugin
├── scripts/
│   ├── generate-industry-components.ts   Component generator
│   ├── components.json                   Component library (550+ components)
│   ├── personas/                         52 design personas
│   ├── test-mongo.ts                     MongoDB connection test
│   ├── export-analytics.ts               Analytics data export
│   ├── COMMANDS.md                       Generation commands reference
│   └── ADDING-PERSONAS-AND-INDUSTRIES.md Checklist for adding new personas/industries
├── skills/
│   ├── enhance-prompt/   Refine rough prompts into detailed generation prompts
│   ├── react-components/ Export screens as production React/TSX components
│   └── design-md/        Extract and generate DESIGN.md specifications
├── docs/
│   ├── improvements.md   Research-backed improvements with implementation status
│   ├── database.md       MongoDB analytics layer design and checklist
│   ├── designflows.md    Generation pipeline audit, bottlenecks, and optimisation checklist
│   ├── logging.md        Structured pipeline logging plan with phase boundaries and timing
│   └── entra-setup.md    Microsoft Entra ID single app registration setup guide
├── design-explorations/  HTML mockups of UI exploration options
├── docker-compose.yml    Docker services (crawl4ai + api-server + web-ui)
├── turbo.json            Turborepo pipeline config
└── package.json          Workspace root
```

## Packages

### `@canvas-ai/sdk`

Core TypeScript SDK for AI-powered UI generation and website redesign.

- **Website redesign pipeline** — Crawl a URL via Crawl4AI, extract design tokens, auto-match a design persona, plan multi-page redesign, generate each page section-by-section with branding
- **Multi-model routing** via OpenRouter — each pipeline stage routes to the optimal model with automatic fallback and empty-response retry
- **Design system as AI constraint** — `MANDATORY DESIGN SYSTEM` block in generation prompts enforces exact colors, fonts, and radius
- **Persona engine** — 52 design personas with Aaker 5D intermediate representation and dual-layer scoring (cosine similarity + direct signal matching)
- **Aaker-driven tokens** — Persona's Aaker vector generates typographic scale, border-radius, spacing density, shadows, animation easing, and letter-spacing
- **Color science** — OKLCH perceptually uniform palette generation, APCA contrast validation with auto-fix, font pairing network (~60 fonts)
- **Quality gates** — CRO rules in prompts, UICrit post-generation critique (13 rules, auto-fix), multi-page nav/footer consistency
- **Component library** — Load, search, customize, and generate components by category/industry
- **Storage adapters** — In-memory (dev) or SQLite (persistent)
- **Analytics layer** — Optional MongoDB Atlas integration for generation logging, brand cache, layout examples (RALF), section templates, and user feedback

### `@canvas-ai/web-ui`

Dark-themed infinite canvas application built with React 19 and Zustand.

Key components:

| Component | File | Purpose |
|-----------|------|---------|
| `InfiniteCanvas` | `InfiniteCanvas.tsx` | Canvas container with transform layer, dot grid, drag & drop import, viewport culling, empty state |
| `ScreenCard` | `ScreenCard.tsx` | Iframe rendering, edit mode, element selection, injected scripts, visibility-aware (off-screen screens render as lightweight placeholders) |
| `ChatPanel` | `ChatPanel.tsx` | Chat input, generation orchestration, SSE handling, design system sync |
| `DesignSystemCard` | `DesignSystemCard.tsx` | Story Mode canvas card with palette, fonts, shape, page plan |
| `DesignPanel` | `DesignPanel.tsx` | Sidebar design system editor |
| `FontPicker` | `FontPicker.tsx` | Searchable Google Fonts picker with lazy preview loading |
| `ComponentBrowser` | `ComponentBrowser.tsx` | Full component library browser |
| `TopBar` | `TopBar.tsx` | Project title, edit/clear buttons, export/import dropdown, test mode |
| `Toolbar` | `Toolbar.tsx` | Tool selector (Select, Pan, Edit, Mark) |
| `RightToolbar` | `RightToolbar.tsx` | Zoom controls, design panel toggle |

State management: Single Zustand store (`canvas-store.ts`) managing screens, viewport, design system (persisted to localStorage), history (20-step cap), marks, agent tasks, chat messages, editing state, and project export/import.

### `@canvas-ai/api-server`

HTTP REST API with SSE streaming for long-running generation tasks.

| Endpoint | Description |
|----------|-------------|
| `POST /api/projects` | Create project |
| `POST /api/projects/:pid/screens/generate` | Generate screen from prompt (SSE) |
| `POST /api/projects/:pid/screens/from-image` | Generate from uploaded image |
| `POST /api/projects/:pid/screens/:sid/edit` | Edit existing screen (supports section-level targeting) |
| `POST /api/projects/:pid/screens/:sid/variants` | Generate variants (REFINE/EXPLORE/REIMAGINE) |
| `GET /api/projects/:pid/screens/:sid/export/react` | Export as React component |
| `POST /api/projects/:pid/redesign/plan` | Plan website redesign (SSE) — returns proposed pages for approval |
| `POST /api/projects/:pid/redesign/generate` | Generate redesigned pages (SSE) — executes approved plan |
| `POST /api/projects/:pid/design-system/extract` | Extract design tokens from URL |
| `GET /api/components` | List components (filter by category/search) |
| `GET /api/components/stats` | Component library statistics |
| `POST /api/components/generate` | Generate component from description |
| `GET /api/me` | Get authenticated user profile and roles |
| `DELETE /api/projects/:pid` | Delete project (owner only) |
| `POST /api/projects/:pid/touch` | Update project last-accessed timestamp |
| `POST /api/feedback` | Log user feedback (export, edit, variant, delete) — triggers quality gate for section template saving |
| `GET /api/analytics/stats` | MongoDB analytics dashboard (per-collection counts, storage usage) |

### `@canvas-ai/mcp-server`

Model Context Protocol server for direct Claude integration. Exposes these tools over stdio transport:

| Tool | Description |
|------|-------------|
| `create_project` | Create a new project |
| `generate_screen` | Generate screen from text prompt |
| `generate_from_image` | Generate from sketch/screenshot (base64) |
| `edit_screen` | Edit an existing screen |
| `generate_variants` | Generate design variants |
| `get_screen` | Retrieve screen HTML |
| `list_screens` | List all screens in a project |
| `export_react` | Export screen as React TSX |
| `extract_design_system` | Extract design tokens from a URL |

### `@canvas-ai/figma-plugin`

Figma plugin for importing generated designs:

- **Import Screen** — Sends screen to Figma as a frame with device-aware sizing (Mobile 390x844, Tablet 820x1180, Desktop 1440x900) and label text
- **Import Design System** — Creates Figma paint styles from design tokens in a hierarchy (`Atelier/Primary`, `Atelier/Text/Primary`, etc.)

---

## Multi-Model Pipeline

Each generation request flows through specialized pipeline stages, each routed to the optimal model:

| Stage | Primary Model | Fallback | Purpose |
|-------|--------------|----------|---------|
| `intent_parse` | DeepSeek V3 | Qwen3 235B | Analyze user intent, plan pages |
| `vision_interpret` | Kimi K2.6 | Kimi K2.5 | Interpret uploaded images/screenshots |
| `layout_generate` | Kimi K2.6 | Kimi K2.5 | Generate full-page HTML layout |
| `section_generate` | Kimi K2.6 | Kimi K2.5 | Generate individual page sections (nav, hero, content, footer) |
| `design_refine` | Kimi K2.6 | Kimi K2.5 | Apply edits, refinements, redesigns |
| `code_render` | DeepSeek V3 | Gemini 2.5 Flash | Fast code generation |
| `design_extract` | DeepSeek V3 | Qwen3 235B | Extract design tokens from HTML/CSS |
| `section_classify` | DeepSeek V3 | Qwen3 235B | Classify page sections during parsing |
| `animation_brief` | Qwen3 VL 235B | Gemini 2.5 Flash | Generate animation briefs for premium scroll |

All models are configurable via environment variables. The router includes automatic fallback to alternative models, retry on empty responses, a 20-minute timeout with automatic fallback, and a 30-second heartbeat log so long-running requests are visible in logs.

## Component Library

### Generate more components

```bash
# Auto-picks industry, writes directly to components.json (file-locked, multi-terminal safe)
npx tsx scripts/generate-industry-components.ts

# See what's remaining
npx tsx scripts/generate-industry-components.ts --list-industries

# Target a specific industry
npx tsx scripts/generate-industry-components.ts --industry finance
```

See [scripts/COMMANDS.md](../scripts/COMMANDS.md) for the full reference.

## Analytics & Learning Layer

Optional MongoDB Atlas integration that collects generation data for continuous improvement. Fully non-blocking — all writes use `.catch()` so analytics never delays the generation pipeline. Enabled by setting `MONGO_URI` in `.env`.

| Collection | Purpose | TTL |
|------------|---------|-----|
| `generation_logs` | Every AI call: pipeline stage, model, prompt/response lengths, latency, token counts | 90 days |
| `brand_cache` | Extracted brand data cached by domain to skip re-extraction | 30-day staleness check |
| `layout_examples` | RALF — section sequences by industry/page type, retrieved as few-shot hints during planning | None |
| `section_templates` | High-quality section HTML saved on positive user feedback (export/edit/variant), with quality scores | None |
| `user_feedback` | Export, edit, variant, and delete events from the frontend | None |
| `prompt_history` | Schema reserved for future prompt evolution tracking | — |

**Quality gate:** Section templates are only saved when users take positive actions (export, edit, create variant) — not on every generation. Quality scores are adjusted upward on positive feedback and downward on deletes.

**Scripts:**
- `npx tsx scripts/test-mongo.ts` — Test connection and basic operations
- `npx tsx scripts/export-analytics.ts [collection]` — Export data to timestamped JSON

See [docs/database.md](database.md) for the full implementation checklist.

## Design Quality Pipeline

Multiple validation and enrichment steps run before, during, and after generation:

| Stage | System | What it does |
|-------|--------|--------------|
| **Pre-generation** | APCA Contrast | Validates text/background color pairs against APCA Lc thresholds. Logs suggestions while preserving brand colors. |
| **Pre-generation** | OKLCH Palette | Generates 11-step perceptually uniform scales from brand colors. Semantic tokens (bg-page, text-primary, brand-primary-hover). |
| **Pre-generation** | Font Pairing | Scores heading+body pair (0-1) via adjacency map of ~60 fonts. Auto-suggests better body font if score < 0.4. |
| **Pre-generation** | Typographic Scale | Aaker vector → musical-interval ratio blend → 8 concrete sizes + line-heights + max line length. |
| **Pre-generation** | Aaker Design Tokens | Aaker vector → border-radius, spacing density, shadow depth, animation speed/easing, letter-spacing. |
| **In-prompt** | CRO Rules | 8 evidence-based conversion rules injected as `<cro-rules>` block + role-specific hints for nav and hero. |
| **Post-generation** | UICrit | 13 rules across CRO, hierarchy, accessibility, contrast, layout, animation safety. Auto-fixes (alt tags, ScrollTrigger). Score 0-10. |
| **Cross-page** | Consistency | First page's nav/footer reused on subsequent pages. Button and padding patterns injected as constraints. |

## Docker Services

| Service | Port | Description |
|---------|------|-------------|
| `crawl4ai` | 11235 | Web scraping service for website redesign (headless browser) |
| `api-server` | 8080 | Main API server (SQLite storage, connects to crawl4ai) |
| `web-ui` | 8090 | React canvas app served via nginx (built with `VITE_*` vars baked in) |

```bash
docker compose up -d --build    # Start/rebuild
docker compose logs -f          # View logs
docker compose stop             # Stop (preserves containers)
docker compose down             # Stop and remove containers
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENROUTER_API_KEY` | Yes | OpenRouter API key for multi-model access |
| `ATELIER_API_KEY` | No | API auth key — if set, the API requires `Authorization: Bearer <key>` and the web UI shows a login page. Unset = open access (dev mode) |
| `ATELIER_STORAGE` | No | Storage backend: `memory` (default) or `sqlite` |
| `ATELIER_STORAGE_PATH` | No | SQLite database path (default: `./data/canvas.db`) |
| `CRAWL4AI_URL` | No | Crawl4AI service URL (auto-set in Docker) |
| `WEB_PORT` / `API_PORT` / `CRAWL4AI_PORT` | No | Host port overrides for Docker (defaults: 8090 / 8080 / 11235) |
| `CANVAS_MODEL_INTENT_PARSE` | No | Override model for intent parsing |
| `CANVAS_MODEL_VISION_INTERPRET` | No | Override model for image interpretation |
| `CANVAS_MODEL_LAYOUT_GENERATE` | No | Override model for layout generation |
| `CANVAS_MODEL_DESIGN_REFINE` | No | Override model for design refinement |
| `CANVAS_MODEL_CODE_RENDER` | No | Override model for code rendering |
| `CANVAS_MODEL_DESIGN_EXTRACT` | No | Override model for token extraction |
| `MONGO_URI` | No | MongoDB Atlas connection string for analytics/learning layer |
| `CORS_ORIGINS` | No | Comma-separated allowed origins (default: `localhost:5173,localhost:8080`) |
| `AUTH_MODE` | No | Authentication mode: `apikey`, `entra`, or `both` (default: `apikey`) |
| `ENTRA_ENABLED` | No | Master gate for Microsoft sign-in — `false` disables Entra and falls back to API-key auth regardless of `AUTH_MODE` (default: `true`) |
| `VITE_ENTRA_ENABLED` | No | Same gate for the web UI — `false` hides the Microsoft button (default: `true`) |
| `AZURE_TENANT_ID` | No | Microsoft Entra ID tenant ID (required when AUTH_MODE includes `entra`) |
| `AZURE_CLIENT_ID` | No | Microsoft Entra ID app registration client ID |
| `VITE_AZURE_CLIENT_ID` | No | Client ID for frontend MSAL (same root `.env` — Vite reads it at build time) |
| `VITE_AZURE_TENANT_ID` | No | Tenant ID for frontend MSAL (same root `.env` — Vite reads it at build time) |

## Skills

Skills follow the [Agent Skills open standard](https://github.com/anthropics/agent-skills) — each contains a `SKILL.md` manifest, `scripts/`, `resources/`, and `examples/`.

| Skill | Description |
|-------|-------------|
| `enhance-prompt` | Expand brief prompts into detailed, model-ready generation prompts |
| `react-components` | Export screens as typed React/TSX components with optional splitting |
| `design-md` | Extract, generate, and merge DESIGN.md design system specs |

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd+0` | Reset viewport to origin at 1x zoom |
| `Cmd+=` / `Cmd+-` | Zoom in / out |
| `Cmd+Z` | Undo |
| `Cmd+Shift+Z` | Redo |
| `Space + drag` | Pan canvas |
| `Arrow keys` | Cycle through screens |
| `Escape` | Exit edit mode / deselect element / deselect screen |
| `Delete` / `Backspace` | Remove selected screen |
| `Middle-click + drag` | Pan canvas (any tool) |
