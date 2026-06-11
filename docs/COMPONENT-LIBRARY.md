# Component Library — Hybrid AI + Asset Approach

## The Problem

Right now our AI generates HTML from scratch every time. It invents buttons, navbars, cards, and forms on every call — leading to:
- Inconsistent components across screens
- No reusable patterns
- Design system tokens suggested but not enforced
- Quality depends entirely on the model's mood

## The Hybrid Vision

Neither pure-template nor pure-AI is ideal:
- **Pure templates** = rigid, cookie-cutter sites that all look the same
- **Pure AI** = inconsistent, slow, expensive, and unpredictable quality

The hybrid approach: **AI-augmented components**. A curated library provides the structural foundation and quality floor, while AI adapts, customizes, combines, and generates new components on the fly.

```
┌──────────────────────────────────────────────────────┐
│                  Component Library                    │
│  (curated assets — the quality floor)                │
│                                                      │
│  navbars · heroes · cards · forms · footers · etc.   │
└──────────────┬───────────────────────────────────────┘
               │
       ┌───────▼────────┐
       │   AI Engine     │
       │                 │
       │  SELECT best    │ ← picks components that fit the prompt
       │  ADAPT tokens   │ ← applies brand colors, fonts, radius
       │  REWRITE copy   │ ← swaps placeholder text for real content
       │  MUTATE layout  │ ← restructures sections when needed
       │  GENERATE new   │ ← creates novel sections that don't exist
       │  BLEND styles   │ ← merges extracted site style into assets
       │                 │
       └───────┬─────────┘
               │
       ┌───────▼────────┐
       │  Final Screen   │
       │  70% library    │
       │  30% AI-gen     │
       └────────────────┘
```

## How the Hybrid Works

### Level 1: Assembly (fastest, cheapest)
The AI selects components from the library and stitches them together. It swaps placeholder text, applies design tokens, and reorders sections. No new HTML is generated — just configuration.

> **Prompt:** "Landing page for a yoga studio"
> **AI does:** Picks hero-04, features-02, testimonials-06, pricing-03, cta-01, footer-02. Swaps text. Applies earthy color palette.

### Level 2: Adaptation (moderate)
The AI uses library components as a starting point but modifies their structure — adds/removes elements, changes grid layouts, merges two components, or adjusts proportions.

> **Prompt:** "Hero section like Stripe but with a video background"
> **AI does:** Takes hero-07 (split layout), replaces the image with a video element, adjusts the overlay opacity, keeps the CTA structure.

### Level 3: Generation (most creative)
When no library component fits, the AI generates from scratch — but is still guided by the design system tokens and structural patterns it learned from the library.

> **Prompt:** "Interactive pricing calculator with sliders"
> **AI does:** No matching component exists. Generates novel HTML but uses the same spacing scale, border radius, color tokens, and typography as library components — maintaining visual consistency.

### Level 4: Learning (continuous)
When the AI generates a high-quality novel component, it can be saved back to the library as a new asset — growing the collection over time.

## Component Schema

```typescript
interface UIComponent {
  id: string;                    // "navbar-01"
  category: ComponentCategory;   // "navbar" | "hero" | "card" | ...
  name: string;                  // "Navbar — Centered with dropdown"
  description: string;           // What it does, when to use it
  html: string;                  // Complete Tailwind HTML with token placeholders
  thumbnail?: string;            // Screenshot/preview image
  tokens: {                      // Design token slots — what the AI can customize
    colors: string[];            // Which colors it uses ["primary", "surface", "text"]
    fonts: string[];             // Which font roles ["headline", "body"]
    radius: boolean;             // Uses corner radius token
  };
  slots: ComponentSlot[];        // Editable content slots the AI fills in
  variants: ComponentVariant[];  // Different versions
  tags: string[];                // ["responsive", "dark-mode", "animated"]
  source: string;                // "scraped:stripe.com" | "curated" | "ai-generated"
  quality: number;               // 1-5 rating
  adaptability: "rigid" | "flexible" | "fluid";  // How much AI can modify it
  // rigid = use as-is, just swap tokens/text
  // flexible = AI can restructure elements within the component
  // fluid = AI can heavily modify or use as inspiration only
}

interface ComponentSlot {
  name: string;                  // "headline", "cta_text", "image_url"
  type: "text" | "image" | "icon" | "list" | "richtext";
  placeholder: string;           // Default content
  required: boolean;
}

interface ComponentVariant {
  id: string;                    // "navbar-01-dark"
  name: string;                  // "Dark mode"
  html: string;                  // Variant HTML
  preview?: string;              // Screenshot
}

type ComponentCategory =
  | "navbar"      // Navigation bars, headers
  | "hero"        // Hero sections, landing headers
  | "features"    // Feature grids, icon sections
  | "cards"       // Content cards, product cards
  | "testimonials"// Reviews, quotes, social proof
  | "pricing"     // Pricing tables, plan comparisons
  | "cta"         // Call-to-action sections
  | "footer"      // Page footers
  | "forms"       // Contact forms, login, signup
  | "stats"       // Statistics, counters, metrics
  | "team"        // Team member grids
  | "gallery"     // Image galleries, portfolios
  | "faq"         // Accordion FAQs
  | "sidebar"     // Side navigation, filters
  | "modal"       // Dialogs, popups
  | "banner"      // Announcement bars, alerts
```

## Building the Database

### Phase 1: Seed from Open Source (Week 1)

Scrape high-quality free component libraries for initial content:

| Source | What to extract | Est. components |
|--------|----------------|-----------------|
| Tailwind UI (free samples) | Section components with variants | ~30 |
| HyperUI | Full Tailwind component library | ~100+ |
| Flowbite | Tailwind component blocks | ~80+ |
| Meraki UI | Clean Tailwind sections | ~50+ |
| Tailblocks | Ready-to-use Tailwind blocks | ~60+ |
| DaisyUI examples | Component patterns | ~40+ |

**Approach:**
1. Crawl each site using crawl4ai (already integrated)
2. Extract individual component HTML blocks
3. Use AI to classify into categories + identify content slots
4. Tokenize: replace hardcoded colors/fonts with design token placeholders
5. Rate adaptability (rigid/flexible/fluid) based on structural complexity
6. Generate thumbnails using Playwright
7. Store in SQLite component table

### Phase 2: AI-Powered Extraction from Production Sites (Week 2)

Scrape real production websites and extract their component patterns:

1. Maintain a list of "inspiration" URLs (Stripe, Linear, Vercel, Notion, etc.)
2. For each URL:
   - Crawl with crawl4ai
   - Use AI to identify and extract individual sections
   - Normalize to Tailwind (strip custom CSS, convert to utility classes)
   - **AI identifies content slots** — what's static structure vs dynamic content
   - Deduplicate against existing library
   - Rate quality (layout complexity, responsiveness, accessibility)

### Phase 3: Hybrid Generation Pipeline (Week 2-3)

Change the generation flow from "generate from scratch" to "hybrid assembly + generation":

**Current flow:**
```
Prompt → Intent → "Generate complete HTML from scratch" → Raw HTML
```

**New hybrid flow:**
```
Prompt → Intent
       ↓
  ┌────▼─────────────────────┐
  │  Component Selection AI   │
  │  "Which library assets    │
  │   fit this prompt?"       │
  │                           │
  │  Returns:                 │
  │  - matched components     │
  │  - gaps (no match)        │
  │  - adaptation notes       │
  └────┬─────────────────────┘
       ↓
  ┌────▼─────────────────────┐
  │  Layout Generator AI      │
  │                           │
  │  For matched sections:    │
  │  → Adapt component HTML   │
  │  → Fill content slots     │
  │  → Apply design tokens    │
  │                           │
  │  For gaps:                │
  │  → Generate new HTML      │
  │  → Match library style    │
  │                           │
  │  Final step:              │
  │  → Stitch all sections    │
  │  → Ensure consistency     │
  └────┬─────────────────────┘
       ↓
  Assembled + Generated Screen
```

**The system prompt becomes:**

```
You are assembling a page using a hybrid approach.

LIBRARY COMPONENTS (use these as your foundation):
[NAVBAR-01] Centered navbar with logo and dropdown — adaptability: flexible
<nav class="bg-{{surface}} shadow-sm">...</nav>

[HERO-03] Split hero with image right — adaptability: fluid
<section class="py-20 px-6">...</section>

RULES:
1. PREFER library components over generating from scratch
2. You MAY adapt flexible/fluid components: change structure, add/remove elements
3. For rigid components: only change text, colors, and images
4. When NO component fits a section, generate new HTML that matches the visual style
   of the library (same spacing scale, same radius, same shadow patterns)
5. Fill all content slots with real content from the prompt
6. Apply the design system tokens: {{primary}}, {{surface}}, {{headline_font}}, etc.
7. Mark which sections used library components vs AI-generated in HTML comments
```

### Phase 4: Component Browser + AI Customization UI (Week 3)

Add a component browser panel with AI-powered customization:

- Grid view of all components by category
- Click to preview full-size
- **"Customize with AI" button** — describe changes in natural language
  > "Make this hero section dark with a gradient background"
- **"Generate variant" button** — AI creates a new variant based on the original
- Drag onto canvas to add to a screen
- Favorite components for quick access
- Filter by category, tags, source, adaptability level
- Search by description
- **"Save to library" for AI-generated sections** — bookmark novel generations

### Phase 5: Learning Loop (Ongoing)

The library grows smarter over time:

1. **Auto-harvest**: When AI generates a novel section rated high quality, prompt user to save it back to the library
2. **Usage analytics**: Track which components get used most → prioritize similar styles for variant generation
3. **Style transfer**: Extract visual patterns from one component and apply to another category
   > "Make all our CTAs look like our hero-03 style"
4. **Cross-pollination**: AI generates new components by combining patterns from 2+ existing ones
   > hero structure + pricing layout = a hybrid comparison section
5. **Community contributions**: Users share component collections
6. **Figma import**: Import components from Figma via the plugin, auto-tokenize them

## Storage Extension

Add a `components` table to SQLite:

```sql
CREATE TABLE components (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  html TEXT NOT NULL,
  thumbnail BLOB,
  tokens TEXT,           -- JSON: { colors: [], fonts: [], radius: bool }
  slots TEXT,            -- JSON array of ComponentSlot
  variants TEXT,         -- JSON array of variants
  tags TEXT,             -- JSON array of strings
  source TEXT,           -- "scraped:url" | "curated" | "ai-generated"
  adaptability TEXT DEFAULT 'flexible',  -- rigid | flexible | fluid
  quality INTEGER DEFAULT 3,
  usage_count INTEGER DEFAULT 0,
  created_at TEXT,
  updated_at TEXT
);

CREATE INDEX idx_components_category ON components(category);
CREATE INDEX idx_components_quality ON components(quality DESC);
CREATE INDEX idx_components_usage ON components(usage_count DESC);
```

## SDK Changes

### New file: `packages/sdk/src/models/component-library.ts`

```typescript
class ComponentLibrary {
  // Load all components for a category
  async getByCategory(cat: ComponentCategory): Promise<UIComponent[]>

  // Search components by description
  async search(query: string): Promise<UIComponent[]>

  // AI-powered: select best components for a prompt + identify gaps
  async selectForPrompt(intent: object, count?: number): Promise<{
    matched: Array<{ component: UIComponent; adaptationNotes: string }>;
    gaps: string[];  // sections that need AI generation
  }>

  // Scrape a URL and extract components
  async extractFromURL(url: string): Promise<UIComponent[]>

  // AI: generate variants of an existing component
  async generateVariants(component: UIComponent, count: number): Promise<ComponentVariant[]>

  // AI: customize a component with natural language
  async customizeComponent(component: UIComponent, instruction: string): Promise<UIComponent>

  // AI: generate a brand-new component for a gap
  async generateComponent(description: string, styleReference?: UIComponent): Promise<UIComponent>

  // Format components as prompt context for the layout generator
  toPromptContext(components: UIComponent[]): string

  // Save an AI-generated section back to the library
  async saveToLibrary(html: string, category: ComponentCategory): Promise<UIComponent>

  // Track usage
  async recordUsage(componentId: string): Promise<void>
}
```

### Prompt modification

The layout generator prompt includes matched components + gap instructions:

```
HYBRID ASSEMBLY INSTRUCTIONS:

=== LIBRARY COMPONENTS (adapt and use these) ===

[NAVBAR-01] Centered navbar — adaptability: flexible
Slots: {logo_text}, {nav_items}, {cta_text}
<nav class="bg-white shadow-sm">...</nav>

[HERO-03] Split hero with image — adaptability: fluid
Slots: {headline}, {subheadline}, {cta_text}, {image_url}
<section class="py-20 px-6">...</section>

=== SECTIONS TO GENERATE (no matching component) ===
- Interactive pricing calculator with sliders
- Client logo ticker/marquee

=== DESIGN SYSTEM ===
Primary: #2563eb | Surface: #ffffff | Text: #1a1a2e
Headline font: Inter 700 | Body: Inter 400
Corner radius: 8px

Assemble the page:
1. Use library components as the foundation — fill their slots with real content
2. Adapt flexible/fluid components to fit the design better
3. Generate new HTML for the gap sections, matching the library's visual style
4. Apply all design tokens consistently
5. Add <!-- component:navbar-01 --> comments to mark library usage
6. Add <!-- ai-generated --> comments for novel sections
```

## Cost Impact

- **Reduced token usage**: Library components are pre-built, AI outputs less HTML
- **Better quality**: Proven components as the floor, AI creativity as the ceiling
- **Faster generation**: Less to generate = faster response
- **More consistent**: Shared design language across library + AI sections
- **Continuous improvement**: Library grows from AI output + user contributions

Estimated: **50-70% fewer output tokens** for assembly-heavy pages, **20-30% fewer** for creative/novel pages.

## File Changes Summary

| File | Change |
|------|--------|
| `packages/sdk/src/models/component-library.ts` | **New** — ComponentLibrary class with hybrid methods |
| `packages/sdk/src/storage/interface.ts` | Add component CRUD + usage tracking |
| `packages/sdk/src/storage/sqlite.ts` | Add components table + queries |
| `packages/sdk/src/storage/memory.ts` | Add in-memory component store |
| `packages/sdk/src/utils/prompts.ts` | Update LAYOUT_SYSTEM for hybrid assembly |
| `packages/sdk/src/models/project.ts` | Load + select components before generation |
| `packages/sdk/src/index.ts` | Export ComponentLibrary |
| `packages/api-server/src/index.ts` | Add /api/components endpoints |
| `packages/web-ui/src/components/ComponentBrowser.tsx` | **New** — Browse/search/customize UI |
| `packages/web-ui/src/stores/canvas-store.ts` | Add component state |
| `scripts/seed-components.ts` | **New** — Scraper to build initial library |

## Priority Order

1. **Schema + storage** — Define the component type with slots + adaptability, add to SQLite
2. **Seed script** — Scrape HyperUI/Tailblocks, AI-tokenize + classify ~100+ components
3. **Hybrid prompt integration** — Component selection → assembly + gap generation pipeline
4. **Component browser UI** — Browse, preview, AI-customize, drag-to-canvas
5. **Save-to-library flow** — Bookmark AI-generated sections back into the database
6. **Learning loop** — Usage tracking, auto-harvest, variant generation, style transfer
