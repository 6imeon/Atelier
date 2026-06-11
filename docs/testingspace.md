# Testing Space — Zero-Credit Feature Testing

## Problem

Every time we need to test editing, design system, component library, or canvas features, we have to call the AI to generate pages. This burns API credits and adds ~30-60 seconds of wait time per test cycle.

## Solution

A **Test Mode** that injects pre-built HTML templates directly into the canvas store — bypassing the entire AI pipeline while exercising 100% of the same rendering, editing, and design system code paths.

---

## Architecture

### How It Works (Normal Flow)

```
User prompt → ChatPanel → API server → AI model → SSE response → addScreen() → ScreenCard renders iframe
                                                                → syncDesignSystemFromHtml() → DesignSystemCard
```

### How Test Mode Works

```
Test button → loadTestFixtures() → addScreen() → ScreenCard renders iframe (same code path)
                                 → setState({ extractedTokens }) → DesignSystemCard (same code path)
                                 → updateDesignSystem() → design system store (same code path)
```

**Key insight:** Everything downstream of `addScreen()` is identical. ScreenCard doesn't care whether HTML came from AI or a static file — it creates a blob URL and renders it in an iframe either way. Same for editing, element selection, design system, etc.

---

## What Test Mode Exercises

| Feature | Covered | How |
|---------|---------|-----|
| Screen rendering (blob URL, iframe) | Yes | Same `addScreen()` → ScreenCard path |
| Edit mode (element selection, hover outlines) | Yes | EDIT_INJECTION is injected into all iframes |
| Inline text editing | Yes | Same contentEditable flow |
| Section-level AI editing | Partial | UI works; API call will fail without server (expected) |
| Replace from Library | Yes | ComponentBrowser + replace flow is all client-side until final swap |
| Design system card (Story Mode) | Yes | extractedTokens set directly in store |
| Font changes | Yes | applyFontToScreens() operates on screen HTML in store |
| Color changes | Yes | applyColorToScreens() operates on screen HTML in store |
| Radius changes | Yes | Stored in design system, applied on next generation |
| Canvas zoom/pan | Yes | Viewport is independent of screen content |
| Undo/redo | Yes | pushHistory() works on screens array |
| Screen deletion | Yes | removeScreen() is store-only |
| Height auto-measurement | Yes | HEIGHT_SCRIPT runs in all iframes |
| Edit popup positioning | Yes | Based on click coordinates, zoom level |
| Multi-screen layout | Yes | Multiple addScreen() calls with different positions |

---

## Implementation Plan

### Option A: Dev-Only UI Button (Recommended)

Add a "Load Test Fixtures" button to the TopBar that only appears in development mode. One click populates the canvas with 3 template screens + design system card.

**Pros:** Minimal code, easy to use, no route changes, trivially removable
**Cons:** Slightly pollutes TopBar component (but behind `import.meta.env.DEV` guard)

### Option B: URL Parameter

Navigate to `?test=true` to auto-load fixtures on mount.

**Pros:** No UI changes, can be bookmarked
**Cons:** Runs on every page load with that param, harder to trigger on-demand

### Option C: Console Utility

Expose `window.__loadTestFixtures()` in dev mode.

**Pros:** Zero UI changes
**Cons:** Requires opening dev console every time, not discoverable

### Recommendation: **Option A** with **Option C** as bonus

---

## Template Fixtures Needed

### 1. Homepage Template (`test-homepage.html`)
A realistic homepage with:
- Navigation bar with logo, links
- Hero section with heading, subtext, CTA button
- Features grid (3-4 cards)
- Testimonials section
- Footer with columns

**Why:** Tests the most common page type. Has diverse element types for editing. Multiple sections for section-level operations.

### 2. About Page Template (`test-about.html`)
- Team section with cards (images, names, roles)
- Mission statement
- Timeline/history section
- Contact CTA

**Why:** Tests image-heavy layouts, card components, different section structures.

### 3. Minimal Page Template (`test-minimal.html`)
- Single section with heading and paragraph
- No external dependencies

**Why:** Fast-loading baseline. Good for isolating edit bugs without complex DOM.

### Design System Fixture
Pre-configured tokens that match the template HTML:
```typescript
{
  brandName: "Horizon Studio",
  colors: { primary: "#6366f1", secondary: "#f59e0b", accent: "#10b981" },
  fonts: { headline: "Playfair Display", body: "Inter" },
  _meta: {
    analysis: "A modern creative agency with bold indigo branding and warm amber accents",
    personaName: "The Artisan",
    proposedPages: [
      { title: "Homepage", description: "Hero + features + testimonials" },
      { title: "About", description: "Team + mission + timeline" },
      { title: "Contact", description: "Form + map + details" }
    ]
  }
}
```

**Important:** The Google Font `<link>` tags in templates must match these font names so that `syncDesignSystemFromHtml()` extracts them correctly, and `applyFontToScreens()` can find-and-replace them.

---

## File Structure

```
packages/web-ui/src/
  test-fixtures/
    index.ts              # loadTestFixtures() function
    templates/
      homepage.ts         # HTML string export
      about.ts            # HTML string export
      minimal.ts          # HTML string export
    design-tokens.ts      # Pre-configured design system data
```

Using `.ts` files with exported strings (not `.html` files) so they're bundled by Vite and tree-shaken in production.

---

## Implementation Details

### `test-fixtures/index.ts`

```typescript
import { useCanvasStore } from "../stores/canvas-store";
import { homepageHtml } from "./templates/homepage";
import { aboutHtml } from "./templates/about";
import { minimalHtml } from "./templates/minimal";
import { testDesignTokens, testDesignSystem } from "./design-tokens";

export function loadTestFixtures() {
  const store = useCanvasStore.getState();

  // Clear existing screens
  store.screens.forEach(s => store.removeScreen(s.id));

  // Create project if needed
  if (!store.project) {
    store.createProject("Test Project");
  }

  const pid = useCanvasStore.getState().project!.id;

  // Screen placement (matches ChatPanel's placeScreen logic)
  const screenW = 1440, screenH = 4000, gap = 40, gridOffsetX = 630;
  const cardW = screenW * 0.3;

  const templates = [
    { name: "Homepage", html: homepageHtml },
    { name: "About", html: aboutHtml },
    { name: "Minimal", html: minimalHtml },
  ];

  templates.forEach((t, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    store.addScreen({
      id: `test_${i}_${Date.now()}`,
      projectId: pid,
      prompt: `Test: ${t.name}`,
      html: t.html,
      deviceType: "DESKTOP",
      x: col * (cardW + gap) + gridOffsetX,
      y: row * (screenH * 0.3 + gap + 40) + gap,
      width: screenW,
      height: screenH,
    });
  });

  // Set design system tokens (shows DesignSystemCard)
  useCanvasStore.setState({
    extractedTokens: {
      tokens: testDesignTokens,
      x: 50,
      y: 40,
    },
  });

  // Update design system store (affects font/color apply)
  store.updateDesignSystem(testDesignSystem);

  console.log("[TestMode] Loaded 3 test screens + design system");
}
```

### TopBar Integration

```tsx
// In TopBar.tsx, add inside the toolbar row:
{import.meta.env.DEV && (
  <button
    onClick={() => {
      import("../test-fixtures").then(m => m.loadTestFixtures());
    }}
    style={{
      padding: "4px 10px", fontSize: 11, borderRadius: 6,
      background: "#fbbf24", color: "#1f2937", border: "none",
      cursor: "pointer", fontWeight: 600,
    }}
    title="Load test screens without AI generation"
  >
    TEST
  </button>
)}
```

Using dynamic `import()` so test fixtures are code-split and never included in production bundles.

### Console Utility (Bonus)

```typescript
// In main.tsx, add:
if (import.meta.env.DEV) {
  (window as any).__loadTestFixtures = () => {
    import("./test-fixtures").then(m => m.loadTestFixtures());
  };
}
```

---

## Template Requirements

Each HTML template must include:

1. **Full HTML document** with `<!DOCTYPE html>`, `<html>`, `<head>`, `<body>`
2. **Google Fonts `<link>` tags** matching the design system fonts (Playfair Display, Inter)
3. **Hex colors** matching the design system palette (#6366f1, #f59e0b, #10b981)
4. **Multiple top-level sections** (for section-level editing tests)
5. **Diverse elements:** headings, paragraphs, buttons, images (placeholder), links, lists, cards
6. **Tailwind-style classes** (the editing system uses class-based selectors)
7. **Inline styles** (some editing operations target inline styles)
8. **Realistic content** — not lorem ipsum, but real-sounding copy so visual testing is meaningful
9. **Responsive classes** (like `lg:grid-cols-3`) to test CSS.escape() in selector generation

---

## Production Safety

| Guard | How |
|-------|-----|
| `import.meta.env.DEV` | Button only renders in dev mode |
| Dynamic `import()` | Test fixtures are code-split, excluded from prod bundle by Vite |
| No API calls | Test mode is entirely client-side |
| No localStorage pollution | Uses same store, same persistence — clears cleanly |
| Reversible | Undo (Ctrl+Z) reverts all addScreen calls; or just refresh |

---

## What This Does NOT Test

These features require a running API server and will need separate testing:

| Feature | Why | Workaround |
|---------|-----|------------|
| AI page generation | Requires OpenRouter API key + credits | N/A — this is what we're avoiding |
| AI section editing | Requires API server to process edit request | Mock the API response in dev server |
| URL crawling (crawl4ai) | Requires API server + crawler | N/A |
| Plan redesign flow | Requires full API pipeline | N/A |
| SSE streaming progress | Requires API server | Could add mock SSE endpoint in Vite dev server |

For API-dependent features, a future enhancement could add a **mock API mode** in the Vite dev server that returns pre-recorded responses. But the current scope (client-side test fixtures) covers ~80% of testable features.

---

## Usage

```
1. Start dev server: cd packages/web-ui && npm run dev
2. Open browser: http://localhost:5173
3. Click the yellow "TEST" button in the top bar
4. Three screens + design system card appear instantly
5. Test any feature: editing, design system, zoom, component library, etc.
6. Ctrl+Z to undo, or refresh to reset
```
