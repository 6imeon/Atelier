/**
 * APCA (Accessible Perceptual Contrast Algorithm) contrast validation.
 * Pure math implementation — no external dependencies.
 *
 * Validates that design system colour pairs meet accessibility contrast
 * requirements before they are used in AI-generated pages.
 */

// ─── Types ─────────────────────────────────────────────────────────────

export interface ContrastPair {
  name: string;
  text: string;
  bg: string;
  lc: number;
  required: number;
  passes: boolean;
  suggestedFix?: string;
}

export interface ContrastReport {
  pairs: ContrastPair[];
  allPass: boolean;
}

// ─── Hex ↔ RGB helpers ─────────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
  let h = hex.replace(/^#/, "");
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  h = h.slice(0, 6);
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return `#${((1 << 24) | (clamp(r) << 16) | (clamp(g) << 8) | clamp(b)).toString(16).slice(1)}`;
}

// ─── sRGB linearisation ────────────────────────────────────────────────

function sRGBtoLin(c: number): number {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

function linTosRGB(v: number): number {
  const c = v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
  return Math.max(0, Math.min(255, Math.round(c * 255)));
}

// ─── APCA luminance ────────────────────────────────────────────────────

/** Compute APCA relative luminance (Y) from sRGB hex. */
function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  let y = 0.2126729 * sRGBtoLin(r) + 0.7151522 * sRGBtoLin(g) + 0.0721750 * sRGBtoLin(b);
  // Soft clamp
  if (y < 0.022) {
    y += Math.pow(0.022 - y, 1.414);
  }
  return y;
}

// ─── SAPC constants ────────────────────────────────────────────────────

const NRM_BG_EXP = 0.56;
const NRM_TXT_EXP = 0.57;
const REV_BG_EXP = 0.65;
const REV_TXT_EXP = 0.62;
const SCALE = 1.14;
const OFFSET = 0.027;
const LOW_CLIP = 0.1;

// ─── Core APCA ─────────────────────────────────────────────────────────

/**
 * Calculate APCA Lc (Lightness Contrast) value.
 * Returns a value in the range roughly -106 to +106.
 * Positive = normal polarity (dark text on light bg).
 * Negative = reverse polarity (light text on dark bg).
 */
export function calcAPCA(textHex: string, bgHex: string): number {
  const txtY = luminance(textHex);
  const bgY = luminance(bgHex);

  let lc: number;

  if (bgY >= txtY) {
    // Normal polarity — dark text on light background
    lc = (Math.pow(bgY, NRM_BG_EXP) - Math.pow(txtY, NRM_TXT_EXP)) * SCALE;
    if (lc < LOW_CLIP) return 0;
    lc -= OFFSET;
  } else {
    // Reverse polarity — light text on dark background
    lc = (Math.pow(bgY, REV_BG_EXP) - Math.pow(txtY, REV_TXT_EXP)) * SCALE;
    if (lc > -LOW_CLIP) return 0;
    lc += OFFSET;
  }

  return lc * 100;
}

// ─── Threshold check ───────────────────────────────────────────────────

const THRESHOLDS: Record<string, number> = {
  body: 75,
  large: 60,
  nontext: 30,
};

/**
 * Check whether a text/bg pair meets a given contrast level.
 */
export function meetsContrast(
  textHex: string,
  bgHex: string,
  level: "body" | "large" | "nontext",
): boolean {
  const threshold = THRESHOLDS[level];
  return Math.abs(calcAPCA(textHex, bgHex)) >= threshold;
}

// ─── OKLCH colour-space helpers (for lightness adjustment) ─────────────

function linRGBtoXYZ(r: number, g: number, b: number): [number, number, number] {
  // sRGB linear → CIE XYZ (D65)
  const x = 0.4123908 * r + 0.3575843 * g + 0.1804808 * b;
  const y = 0.2126390 * r + 0.7151687 * g + 0.0721923 * b;
  const z = 0.0193308 * r + 0.1191950 * g + 0.9505322 * b;
  return [x, y, z];
}

function xyzToLinRGB(x: number, y: number, z: number): [number, number, number] {
  const r = 3.2409699 * x - 1.5373832 * y - 0.4986108 * z;
  const g = -0.9692436 * x + 1.8759675 * y + 0.0415551 * z;
  const b = 0.0556301 * x - 0.2039770 * y + 1.0569715 * z;
  return [r, g, b];
}

function xyzToOklab(x: number, y: number, z: number): [number, number, number] {
  const l_ = Math.cbrt(0.8189330101 * x + 0.3618667424 * y - 0.1288597137 * z);
  const m_ = Math.cbrt(0.0329845436 * x + 0.9293118715 * y + 0.0361456387 * z);
  const s_ = Math.cbrt(0.0482003018 * x + 0.2643662691 * y + 0.6338517070 * z);

  const L = 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_;
  const a = 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_;
  const b = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_;
  return [L, a, b];
}

function oklabToXYZ(L: number, a: number, b: number): [number, number, number] {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b;

  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;

  const x = 1.2270138511 * l - 0.5577999807 * m + 0.2812561490 * s;
  const y = -0.0405801784 * l + 1.1122568696 * m - 0.0716766787 * s;
  const z = -0.0763812845 * l - 0.4214819784 * m + 1.5861632204 * s;
  return [x, y, z];
}

export function hexToOklch(hex: string): [number, number, number] {
  const [r, g, b] = hexToRgb(hex);
  const rLin = sRGBtoLin(r);
  const gLin = sRGBtoLin(g);
  const bLin = sRGBtoLin(b);
  const [x, y, z] = linRGBtoXYZ(rLin, gLin, bLin);
  const [L, a, bOk] = xyzToOklab(x, y, z);
  const C = Math.sqrt(a * a + bOk * bOk);
  const H = Math.atan2(bOk, a);
  return [L, C, H];
}

export function oklchToHex(L: number, C: number, H: number): string {
  const a = C * Math.cos(H);
  const b = C * Math.sin(H);
  const [x, y, z] = oklabToXYZ(L, a, b);
  const [rLin, gLin, bLin] = xyzToLinRGB(x, y, z);
  return rgbToHex(linTosRGB(rLin), linTosRGB(gLin), linTosRGB(bLin));
}

// ─── adjustForContrast ─────────────────────────────────────────────────

/**
 * Adjust the text colour's lightness to meet a target Lc value,
 * preserving hue and chroma. Uses binary search in OKLCH space.
 * Returns the adjusted hex colour.
 */
export function adjustForContrast(
  textHex: string,
  bgHex: string,
  targetLc: number,
): string {
  const [, C, H] = hexToOklch(textHex);
  const bgLum = luminance(bgHex);
  const textLum = luminance(textHex);

  // Determine whether we should go darker or lighter
  const goLighter = bgLum < textLum; // reverse polarity — push text lighter

  let lo = 0;
  let hi = 1;

  // Binary search for L that achieves the target |Lc|
  for (let i = 0; i < 20; i++) {
    const mid = (lo + hi) / 2;
    const candidate = oklchToHex(mid, C, H);
    const lc = calcAPCA(candidate, bgHex);
    const absLc = Math.abs(lc);

    if (absLc < targetLc) {
      // Need more contrast — move text lightness away from bg lightness
      if (goLighter) lo = mid;
      else hi = mid;
    } else {
      // Enough contrast — try to stay closer to original lightness
      if (goLighter) hi = mid;
      else lo = mid;
    }
  }

  const finalL = (lo + hi) / 2;
  return oklchToHex(finalL, C, H);
}

// ─── Design-token validation ───────────────────────────────────────────

interface DesignTokenColors {
  primary?: string | null;
  secondary?: string | null;
  accent?: string | null;
  background?: string | null;
  text?: string | null;
}

/**
 * Validate all critical colour pairs from a design-token object.
 * Expects `tokens.colors` to contain at least `background` and `text` fields.
 * Returns a ContrastReport with per-pair results and suggested fixes.
 */
export function validateDesignTokenContrast(tokens: {
  colors?: DesignTokenColors;
  [key: string]: unknown;
}): ContrastReport {
  const colors = tokens?.colors;
  if (!colors) {
    return { pairs: [], allPass: true };
  }

  const bg = colors.background;
  if (!bg) {
    return { pairs: [], allPass: true };
  }

  const pairs: ContrastPair[] = [];

  const checkPair = (
    name: string,
    textHex: string | null | undefined,
    bgHex: string,
    level: "body" | "large" | "nontext",
  ) => {
    if (!textHex) return;
    const lc = calcAPCA(textHex, bgHex);
    const required = THRESHOLDS[level];
    const passes = Math.abs(lc) >= required;
    const pair: ContrastPair = {
      name,
      text: textHex,
      bg: bgHex,
      lc: Math.round(lc * 10) / 10,
      required,
      passes,
    };
    if (!passes) {
      pair.suggestedFix = adjustForContrast(textHex, bgHex, required);
    }
    pairs.push(pair);
  };

  // Body text on background — strictest requirement
  checkPair("text on background", colors.text, bg, "body");

  // Primary on background (buttons, links) — large-text threshold
  checkPair("primary on background", colors.primary, bg, "large");

  // Secondary on background — large-text threshold
  checkPair("secondary on background", colors.secondary, bg, "large");

  // Accent on background — non-text threshold (icons, badges)
  checkPair("accent on background", colors.accent, bg, "nontext");

  return {
    pairs,
    allPass: pairs.every((p) => p.passes),
  };
}
