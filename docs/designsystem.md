# Design System — Architecture Review & Improvements

## Status: Implemented

The core problems have been addressed. Below is the original analysis followed by what was built.

---

## Original Problem

The design system was fundamentally disconnected from the generated pages. It showed tokens extracted from the **original site** (the one being redesigned), but the AI generated pages with **completely different fonts and colors**.

### Data Flow (Before)

```
Original Site → extractBrandDataFull() → designTokens (original fonts/colors)
    ↓                                          ↓
DesignSystemCard (shows original values)   AI prompt (receives as context, ignores)
    ↓                                          ↓
User changes "dashicons" → "Inter"        Generated HTML uses "Poppins", Tailwind classes
    ↓
find-replace("dashicons") → NOT FOUND → silent failure
```

### Data Flow (After)

```
Original Site → extractBrandDataFull() → reference tokens (collapsible section)
    ↓
AI generates HTML → syncDesignSystemFromHtml() → parses actual fonts/colors
    ↓
DesignSystemCard shows GENERATED page's values (fonts, colors from HTML)
    ↓
User changes "Poppins" → "Inter" → find-replace works (value exists in HTML)
    ↓
Next generation receives design system as MANDATORY constraint → AI uses exact values
```

---

## What Was Built

### 1. Post-Generation Token Extraction (DONE)
**File:** `ChatPanel.tsx` — `syncDesignSystemFromHtml()`

After each page generation (both single-page and multi-page), the generated HTML is parsed to extract:
- Google Font `<link>` tags → actual font families used (headline, body, label)
- Hex colors by frequency → primary, secondary, tertiary (skipping common grays/black/white)

These values update the design system store, so the card shows what's actually in the pages.

### 2. Design System as AI Constraint (DONE)
**File:** `project.ts` — `generatePage()` system prompt

When generating pages, if a design system is set, the AI receives a `MANDATORY DESIGN SYSTEM` block:
```
- Primary color: #c4856a (use for CTAs, links, key accents, buttons)
- Secondary color: #2a2018 (use for supporting elements)
- Heading font: "Playfair Display" (load via Google Fonts)
- Body font: "Inter" (load via Google Fonts)
- Corner radius: 8px
```

This ensures consistent generation across pages and makes the design system actually control output.

### 3. Smarter Font Apply (DONE)
**File:** `DesignSystemCard.tsx` — `applyFontToScreens()`

Font replacement now handles:
- Font name in CSS `font-family` declarations
- Font name in inline styles
- URL-encoded font name in Google Fonts `<link>` tags (e.g. `Playfair+Display` → `Inter`)

### 4. Story Mode UI (DONE)
**File:** `DesignSystemCard.tsx` — complete rewrite

The design system card is now a "Story Mode" design brief:
- **Hero section** with brand mark, persona name, and design ethos quote
- **Palette Story** — 2x2 grid of color cards with emotional meanings, shade strips, seed + harmony controls
- **Type Pairing** — live preview showing headline + body fonts together with real text
- **Shape** — radius selector with descriptive labels
- **Page Plan** — numbered list of proposed pages
- **Original Site Reference** — collapsible section with extracted colors/logos from the original site
- **DESIGN.md** — collapsible exportable markdown

### 5. Two-Layer Architecture (DONE)
**File:** `DesignSystemCard.tsx`

- **Layer 1 (Active):** Main card shows the generated page's actual tokens. Changes apply to screens.
- **Layer 2 (Reference):** Collapsible "Original Site Reference" at the bottom shows extracted colors/logos from the original site. Click any swatch to use it as seed color.

---

## Files Modified

| File | Change |
|------|--------|
| `ChatPanel.tsx` | Added `syncDesignSystemFromHtml()` — parses generated HTML for actual fonts/colors, updates design system store |
| `DesignSystemCard.tsx` | Complete rewrite as Story Mode UI with two-layer architecture |
| `project.ts` | Added MANDATORY DESIGN SYSTEM constraint to `generatePage()` prompts |
| `DesignSystemCard.tsx` | `applyFontToScreens()` now handles Google Fonts `<link>` URL replacement |

## Remaining Improvements (Future)

- **Per-screen design tokens** — store `screen.designTokens` with parsed values from each screen's HTML
- **Color format handling** — `applyColorToScreens` could also handle `rgb()`, Tailwind named classes
- **DesignPanel sidebar** — update to match Story Mode design (currently still old UI)
- **Live binding indicators** — show which tokens are actually found in screen HTML (Option C from explorations)
