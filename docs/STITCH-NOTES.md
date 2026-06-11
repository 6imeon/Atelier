# Stitch Redesign Flow — Analysis & Improvement Checklist

## What Stitch Does (observed from screenshots)

### Phase 1: Understanding (Screenshot 1-2)
- User types "Redesign www.strattoncraig..."
- AI responds with a **conversational plan**: "I'll take a look at the current Stratton Craig website to understand their brand and layout. Then, I'll create a new design system and propose a fresh, modern redesign for their key pages."
- Shows **real-time progress steps** with spinners/checkmarks:
  - "Capturing a reference" (spinner → checkmark)
  - "Building the design system" (spinner)

### Phase 2: Design System Creation (Screenshots 3-5)
- AI creates a **named design system** — "Editorial Prestige"
- Design system card is **rich and detailed**:
  - 4 color palettes (Primary, Secondary, Tertiary, Neutral) each with **full gradient swatches** (5-6 shades per color)
  - 3 typography roles (Headline, Body, Label) with large "Aa" previews
  - **Button variants**: Primary, Secondary, Inverted, Outlined
  - **Search input** preview
  - **Icon set** previews (navigation icons, action icons)
  - **Label/tag** component preview
  - All laid out in a structured grid

### Phase 3: Page Planning (Screenshots 6-7)
- AI explains its plan in **natural language**:
  - "I've analyzed the Stratton Craig site and created a new 'Editorial Prestige' design system that feels more premium and focused."
  - "Now, I'm going to predict some shared components for the redesign and then I'll propose a set of new screens to refresh their web presence."
  - Progress: "Mapping out the components"
- Then proposes **multiple pages** with descriptions:
  - **New Homepage**: "A bold, high-impact hero section that clearly states their value proposition..."
  - **Services Overview**: "A clean, organized page that details their full range of services..."
  - **Case Studies Library**: "A professional, visually-driven gallery of their success stories..."
  - **Insights Hub**: "A modern, editorial-style blog layout to showcase their thought leadership..."
- Asks: "Shall I proceed with creating these designs?"

### Phase 4: User Confirms (Screenshot 8)
- User types "proceed"
- AI responds: "Great! I'll get started on the redesign for Stratton Craig. I'll begin by setting up a design system that reflects their professional and strategic brand, then I'll move on to designing the Homepage, Services, Case Studies, and Insights pages."
- Progress steps:
  - "Building the design system" (checkmark)
  - "Mapping out the components" (spinner)

### Phase 5: Multi-Screen Generation (Screenshots 9-12)
- Progress: "Applying the design system to the screens (0/4)"
- Canvas shows design system card + **4 screen placeholders** side by side:
  - "Editorial Prestige" (design system card)
  - "Homepage" (generating → filled)
  - "Generating Screen..." (placeholder)
  - "Generating Screen..." (placeholder)
  - "Generating Screen..." (placeholder)
- Screens fill in progressively with real content:
  - Homepage shows full page with hero, case studies, contact sections
  - "Insights Hub", "Services Overview", "Case Studies Library" generate one by one
- Progress updates: "Applying the design system to the screens (2/4)", "(3/4)"

### Phase 6: Completion (Screenshot 13)
- All 4 screens visible on canvas alongside design system card
- Chat shows completion summary:
  - "I've completed the redesign for Stratton Craig. I've created a new design system, 'Editorial Prestige', and designed the following screens for you:"
  - **Homepage**: A high-impact hero section...
  - **Insights Hub**: A modern editorial blog...
  - **Services Overview**: A clear presentation...
  - **Case Studies Library**: A professional gallery of success stories
  - "What do you think of these designs?"
- Suggestion chips appear at bottom for next actions

---

## Gap Analysis: Atelier vs Stitch

| Feature | Stitch | Atelier | Status |
|---------|--------|-----------|--------|
| Conversational AI planning | Full plan with bullet points before generating | Plan phase: analyzes site, proposes pages, asks "Shall I proceed?" | **Done** |
| Named design system | "Editorial Prestige" — creative name | AI generates creative 2-word theme name based on brand analysis | **Done** |
| Design system richness | Full gradient swatches, 5-6 shades per color, button variants, icons, labels | 4 flat color swatches, basic Aa, basic buttons | **TODO** |
| Multi-page generation | Generates 4+ pages in one request (Homepage, Services, Case Studies, Insights) | Generates 3-5 pages per redesign, each added to canvas as it completes | **Done** |
| Progress during generation | Real "Applying design system to screens (2/4)" with screens filling in live | SSE progress with real step names; screens appear as each completes | **Done** (buffered by Vite proxy) |
| Screen placeholders | Shows empty cards that fill in progressively | Screens appear on canvas as each completes | **Partial** — no empty placeholders yet |
| Page proposals before generating | Lists pages with descriptions, asks for confirmation | AI proposes pages with descriptions, user confirms with "proceed" or chips | **Done** |
| Completion summary | Natural language summary of what was created | Summary with design system name, page list, and "What do you think?" | **Done** |
| Suggestion chips after completion | Context-aware next steps | "Proceed with all pages", "Create a mobile version", "Try different color scheme", "Add FAQ page" | **Done** |
| Component mapping step | "Mapping out the components" visible step | Component selection from 184-component library integrated into pipeline | **Done** |
| Design system auto-naming | Creative theme name based on brand analysis | AI generates names like "Editorial Prestige", "Bold Navigator" | **Done** |
| Component library | Curated components for assembly | 184 components (HyperUI + AI-generated from FTSE100/S&P500 inspiration) | **Done** |
| Hybrid AI + assets | Uses pre-built components + AI generation | Hybrid assembly: library components + AI gap-filling | **Done** |

---

## Improvement Checklist

### Priority 1: Conversational Planning Flow
- [x] **AI plan before generating**: When user asks to redesign a URL, AI analyzes site, creates design system, proposes 3-5 pages
- [x] **Confirmation step**: Shows plan and asks "Shall I proceed?", with suggestion chips
- [x] **Natural language responses**: AI talks like a designer — analysis, proposals, completion summary

### Priority 2: Multi-Page Generation
- [x] **Generate multiple screens per request**: Redesign produces 3-5 pages (Homepage, Services, Case Studies, etc.)
- [ ] **Screen placeholders on canvas**: Show empty cards with titles ("Homepage", "Generating...") that fill in as each page completes
- [x] **Progressive screen generation**: Screens added to canvas one by one as each completes
- [x] **Page-specific prompts**: Each page gets tailored content and structure

### Priority 3: Rich Design System Card
- [ ] **Full color gradient swatches**: Show 5-6 shade variations per color (light→dark), not just flat swatches
- [x] **Creative design system naming**: AI generates a theme name like "Editorial Prestige" based on brand analysis
- [ ] **More component previews**: Add icon set preview, label/tag preview, inverted button variant
- [ ] **Larger, more detailed card**: Match Stitch's rich grid layout with more UI element previews

### Priority 4: Real-Time Progress
- [x] **Live progress with actual step names**: SSE events from server show real pipeline steps
- [x] **Screens appear progressively**: Each screen added to canvas as it's generated
- [ ] **Visible pipeline steps with checkmarks**: Show completed steps (Capturing reference ✓, Building design system ✓, Mapping components ⟳)

### Priority 5: Post-Generation UX
- [x] **Completion summary in chat**: Natural language description with design system name and page list
- [x] **Suggestion chips**: Context-aware follow-up actions (mobile version, color scheme, FAQ page)
- [x] **"What do you think?" prompt**: Invites user feedback after generation

### Priority 6: Design System Intelligence
- [x] **Auto-generate design system name**: Creative 2-word name based on brand personality
- [ ] **Extract more tokens from source sites**: Shadows, spacing scale, border styles, icon style preferences
- [ ] **Design system drives component selection**: Match components to design system mood/style, not just colors

### Priority 7: Chat Improvements
- [x] **AI thinks out loud**: Shows analysis and reasoning in chat before generating
- [ ] **Collapsible detail sections**: Long AI responses should have expandable sections
- [ ] **Chat history persistence**: Maintain conversation context across sessions
- [ ] **Markdown rendering in chat**: Bold, lists, and formatting in AI responses

### Priority 8: Canvas Polish
- [ ] **Screen placeholders**: Empty cards with titles and shimmer animation while generating
- [ ] **Zoom-to-fit all screens**: Button to auto-zoom to show all generated screens
- [ ] **Screen reordering**: Drag screens to reorder on canvas
- [ ] **Screen labels always visible**: Page title labels above each screen (Homepage, Services, etc.)

---

## UI Redesign Tokens (Stitch-Inspired)

Migrated from dark neon theme to clean light/dark design system.

| Token | Light | Dark |
|-------|-------|------|
| `--bg` | `#f5f5f7` | `#111113` |
| `--bg-surface` | `#ffffff` | `#1c1c1e` |
| `--border` | `rgba(0,0,0,0.06)` | `rgba(255,255,255,0.06)` |
| `--text-primary` | `#1d1d1f` | `#f5f5f7` |
| `--text-secondary` | `#6b7280` | `#9ca3af` |
| `--accent` | `#6366f1` | `#818cf8` |

### Design Decisions
- Sans-serif (Inter) everywhere — no monospace in UI chrome
- Single accent: indigo `#6366f1` (light) / `#818cf8` (dark)
- SVG line icons (1.5px stroke) — no emoji
- Actions hidden until hover/selection
- Generous padding: 16-24px, whisper shadows, no glows
- Dark mode via `data-theme="dark"` on `<html>`
