import { useCanvasStore, CanvasDesignSystem } from "../stores/canvas-store";
import { debugLog } from "./debug";

// ─── Color Utilities ──────────────────────────────────────────────

export function hexToHSL(hex: string): { h: number; s: number; l: number } {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

export function hslToHex(h: number, s: number, l: number): string {
  s /= 100; l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const c = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * c).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

export function generateShades(hex: string, count = 7): string[] {
  if (!hex?.startsWith("#") || hex.length < 7) return Array(count).fill("#888888");
  const { h, s } = hexToHSL(hex);
  const shades: string[] = [];
  for (let i = 0; i < count; i++) {
    const l = 95 - (i / (count - 1)) * 80;
    shades.push(hslToHex(h, s, l));
  }
  return shades;
}

export function generatePaletteFromSeed(seed: string, theme: string): Partial<CanvasDesignSystem["palette"]> {
  const hsl = hexToHSL(seed);
  switch (theme) {
    case "Tonal":
      return { primary: seed, secondary: hslToHex(hsl.h, Math.max(hsl.s - 30, 10), hsl.l + 15), tertiary: hslToHex((hsl.h + 30) % 360, hsl.s, hsl.l), neutral: hslToHex(hsl.h, 8, 90) };
    case "Vibrant":
      return { primary: seed, secondary: hslToHex((hsl.h + 120) % 360, hsl.s, hsl.l), tertiary: hslToHex((hsl.h + 240) % 360, hsl.s, hsl.l), neutral: hslToHex(hsl.h, 5, 92) };
    case "Monochrome":
      return { primary: seed, secondary: hslToHex(hsl.h, hsl.s, Math.min(hsl.l + 25, 90)), tertiary: hslToHex(hsl.h, hsl.s, Math.max(hsl.l - 20, 15)), neutral: hslToHex(hsl.h, 5, 90) };
    case "Complementary":
      return { primary: seed, secondary: hslToHex((hsl.h + 180) % 360, hsl.s, hsl.l), tertiary: hslToHex((hsl.h + 90) % 360, Math.max(hsl.s - 20, 10), hsl.l + 10), neutral: hslToHex(hsl.h, 6, 91) };
    default:
      return { primary: seed };
  }
}

// ─── Apply functions ──────────────────────────────────────────────

export function applyColorToScreens(
  oldColor: string, newColor: string,
  screens: Array<{ id: string; html: string }>,
  updateScreen: (id: string, u: { html: string }) => void,
) {
  if (!oldColor || !newColor || oldColor === newColor) return;
  const re = new RegExp(oldColor.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
  let changed = 0;
  for (const screen of screens) {
    if (!screen.html) continue;
    const updated = screen.html.replace(re, newColor.toLowerCase());
    if (updated !== screen.html) { changed++; updateScreen(screen.id, { html: updated }); }
  }
  debugLog("design", `Color replace: ${oldColor} -> ${newColor} | ${changed}/${screens.length} screens updated`);
}

export function applyFontToScreens(
  oldFont: string, newFont: string,
  screens: Array<{ id: string; html: string }>,
  updateScreen: (id: string, u: { html: string }) => void,
) {
  if (!oldFont || !newFont || oldFont === newFont) return;
  debugLog("design", `Font change: "${oldFont}" -> "${newFont}" across ${screens.length} screens`);
  const escapedOld = oldFont.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(escapedOld, "gi");
  // Also match in Google Fonts <link> URLs (font names use + for spaces)
  const oldUrlEncoded = oldFont.replace(/ /g, "+");
  const newUrlEncoded = newFont.replace(/ /g, "+");
  const urlRe = new RegExp(oldUrlEncoded.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g");

  let changed = 0;
  for (const screen of screens) {
    if (!screen.html) continue;
    let updated = screen.html;
    // Replace font name in CSS font-family declarations and inline styles
    updated = updated.replace(re, newFont);
    // Replace in Google Fonts <link> URLs
    updated = updated.replace(urlRe, newUrlEncoded);
    if (updated !== screen.html) {
      changed++;
      debugLog("design", `Screen ${screen.id}: replaced "${oldFont}" with "${newFont}"`);
      updateScreen(screen.id, { html: updated });
    }
  }
  if (changed === 0) console.warn(`[design] Font "${oldFont}" was not found in any screen HTML`);
}

export function applyRadiusToScreens(
  _oldRadius: string, newRadius: string,
  screens: Array<{ id: string; html: string }>,
  updateScreen: (id: string, u: { html: string }) => void,
) {
  if (!newRadius) return;
  const radiusMap: Record<string, string> = {
    "0px": "rounded-none", "4px": "rounded", "8px": "rounded-lg",
    "12px": "rounded-xl", "16px": "rounded-2xl", "9999px": "rounded-full",
  };
  const newClass = radiusMap[newRadius];
  if (!newClass) return;

  // All standard Tailwind radius classes that should be swapped
  const swappable = ["rounded-none", "rounded-sm", "rounded", "rounded-md", "rounded-lg", "rounded-xl", "rounded-2xl", "rounded-3xl"];
  const pattern = new RegExp(`\\b(${swappable.join("|")})\\b`, "g");

  let changed = 0;
  for (const screen of screens) {
    if (!screen.html) continue;
    let updated = screen.html;
    updated = updated.replace(pattern, newClass);
    updated = updated.replace(/\brounded-\[\d+px\]/g, newClass);
    if (updated !== screen.html) {
      changed++;
      updateScreen(screen.id, { html: updated });
    }
  }
  debugLog("design", `Radius: applied ${newClass} to ${changed} screen(s)`);
}

/** Apply multiple color replacements in one pass per screen to avoid stale-read issues */
export function applyMultiColorReplace(
  oldPalette: Record<string, string>,
  newPalette: Record<string, string>,
  updateScreen: (id: string, u: { html: string }) => void,
) {
  const keys = ["primary", "secondary", "tertiary", "neutral"] as const;
  const replacements: Array<[string, string]> = [];
  for (const key of keys) {
    if (oldPalette[key] && newPalette[key] && oldPalette[key] !== newPalette[key]) {
      replacements.push([oldPalette[key], newPalette[key]]);
    }
  }
  if (replacements.length === 0) return;
  const freshScreens = useCanvasStore.getState().screens;
  for (const screen of freshScreens) {
    if (!screen.html) continue;
    let html = screen.html;
    for (const [oldC, newC] of replacements) {
      html = html.replace(new RegExp(oldC.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), newC.toLowerCase());
    }
    if (html !== screen.html) updateScreen(screen.id, { html });
  }
}
