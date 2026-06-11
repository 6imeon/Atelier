# Generated Page Preview — Implementation Plan

## Problem

Currently, to see a generated page at full fidelity you have to **download the HTML file** and open it in a browser. The canvas iframe renders a scaled-down preview (0.3x) with ScrollTrigger neutralized, scroll events blocked, and various injection scripts that alter the rendering. There is no way to see the actual generated page as a user would experience it — full viewport, working animations, real scroll behaviour.

The download also triggers an implicit quality signal (`exported` → +1.0 to template scores), which inflates scores when users just want to preview, not actually export.

## Goal

Add a **Preview** button that opens the generated HTML in a new browser tab — full viewport, no injected scripts, real animations and scroll. No download, no quality signal. Just a clean preview.

---

## Current Data Flow

```
Generation (API) → SSE → Store (screen.html) → ScreenCard iframe (scaled, injected scripts)
                                                      ↓
                                              TopBar → Download HTML (triggers "exported" feedback)
```

## Target Data Flow

```
Generation (API) → SSE → Store (screen.html) → ScreenCard iframe (scaled, injected scripts)
                                                      ↓
                                              TopBar → Preview (new tab, no feedback signal)
                                                     → Download HTML (triggers "exported" feedback)
```

---

## Implementation

### Approach: Blob URL in New Tab

The simplest approach — no new API endpoints, no server-side changes. The HTML is already in the Zustand store as a plain string. Create a blob URL and open it in a new tab.

```typescript
const previewHtml = () => {
  for (const s of toExport) {
    const blob = new Blob([s.html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
    // Revoke after a delay to allow the tab to load
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
};
```

This gives the user the raw generated HTML — no Tailwind CDN re-injection, no ScrollTrigger neutralization, no edit/why overlay scripts. Exactly what the AI produced.

### Changes Required

#### 1. Add Preview button to TopBar export menu

**File:** `packages/web-ui/src/components/TopBar.tsx`

Add a "Preview" option alongside "Download HTML", "Copy HTML", etc. in the existing export dropdown. Position it as the **first option** since it's the most common action (view before deciding to export).

```
┌─────────────────────┐
│  Preview in Tab   ⌘P │  ← NEW (no feedback signal)
│  ─────────────────── │
│  Download HTML       │  ← existing (sends "exported" feedback)
│  Copy HTML           │
│  Export React TSX    │
│  Download Full       │
│  Copy for Figma      │
│  Export Project      │
└─────────────────────┘
```

#### 2. Add keyboard shortcut

`Cmd+P` / `Ctrl+P` — natural "preview/print" shortcut. Override the browser's print dialog since we're in a web app context.

#### 3. Add Preview button to ScreenCard actions

**File:** `packages/web-ui/src/components/ScreenCard.tsx`

The ScreenCard already has action buttons (Edit, Delete, etc.) shown on hover/select. Add a small "Preview" icon button alongside them so users can preview individual screens without selecting from the TopBar menu.

#### 4. No changes to feedback/rating system

Preview is explicitly **not an export** — it does not trigger `sendFeedback("exported", ...)`. The user is just looking, not committing. The download button retains its existing feedback signal.

---

## Detailed File Changes

### `packages/web-ui/src/components/TopBar.tsx`

1. Add `previewHtml` function (blob URL → `window.open`)
2. Add "Preview in Tab" menu item as first option in export dropdown
3. Add `Cmd+P` keyboard shortcut handler

### `packages/web-ui/src/components/ScreenCard.tsx`

1. Add preview icon button to the action bar (alongside Edit, Delete)
2. On click: `window.open(URL.createObjectURL(new Blob([screen.html])), "_blank")`

### No backend changes required

The HTML is already available client-side in the Zustand store. No new API endpoints needed.

---

## Edge Cases

1. **Multiple screens selected:** Preview opens one tab per screen (same as current download behaviour)
2. **Popup blocker:** `window.open` may be blocked if not triggered by a direct user click. The button click is a direct user action, so this should be fine. If blocked, show a toast with a link.
3. **Blob URL lifetime:** Revoke after 60s to avoid memory leaks. The tab will have already loaded by then.
4. **External resources:** The preview will load Google Fonts, Tailwind CDN, picsum.photos images etc. from external CDNs — same as the final exported file. If offline, these won't load (same as export).
5. **GSAP/ScrollTrigger:** The raw HTML includes `<script>` tags for animation libraries. In the preview tab these will execute normally — user sees real animations, real scroll behaviour. This is a feature, not a bug.

---

## Checklist

- [x] Add `previewHtml()` function to TopBar *(Done 2026-04-10)*
- [x] Add "Preview in Tab" menu item (first position in export dropdown) *(Done 2026-04-10)*
- [x] Add `Cmd+P` / `Ctrl+P` keyboard shortcut *(Done 2026-04-10)*
- [x] Add preview icon button to ScreenCard action bar *(Done 2026-04-10)*
- [x] Preview does NOT trigger `sendFeedback` — confirmed, no feedback call in `previewHtml()`
- [x] TypeScript compile clean *(Done 2026-04-10)*
- [ ] Verify: animations/scroll work in preview tab
- [ ] Verify: popup blocker handling
- [ ] Test with single screen and multi-screen selection
