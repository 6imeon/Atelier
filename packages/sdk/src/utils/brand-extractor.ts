/**
 * Brand Extractor — TypeScript port of BrandExtractor/Marque
 * Extracts colors, fonts, and logos from HTML + CSS without AI.
 * Uses regex-based CSS parsing (no browser DOM needed).
 */

// ─── Color Utilities ────────────────────────────────────────────────

export function rgbToHex(r: number, g: number, b: number): string {
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  let h = hex.replace(/^#/, "");
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  if (h.length < 6) return null;
  h = h.slice(0, 6);
  const n = parseInt(h, 16);
  if (isNaN(n)) return null;
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
    else if (max === gn) h = ((bn - rn) / d + 2) / 6;
    else h = ((rn - gn) / d + 4) / 6;
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

export interface ColorInfo {
  hex: string;
  rgb: { r: number; g: number; b: number };
  hsl: { h: number; s: number; l: number };
  source: "css" | "logo" | "visual";
}

function toColorInfo(hex: string, source: ColorInfo["source"]): ColorInfo | null {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  return { hex, rgb, hsl: rgbToHsl(rgb.r, rgb.g, rgb.b), source };
}

function parseColorToHex(color: string): string | null {
  color = color.trim().toLowerCase();
  // Hex
  const hexMatch = color.match(/^#([a-f0-9]{3,8})$/);
  if (hexMatch) {
    let h = hexMatch[1];
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    return `#${h.slice(0, 6)}`;
  }
  // rgb/rgba
  const rgbMatch = color.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*[\d.]+\s*)?\)/);
  if (rgbMatch) return rgbToHex(+rgbMatch[1], +rgbMatch[2], +rgbMatch[3]);
  return null;
}

function isNearWhite(hex: string): boolean {
  const rgb = hexToRgb(hex);
  return !!rgb && rgb.r > 230 && rgb.g > 230 && rgb.b > 230;
}

function isNearBlack(hex: string): boolean {
  const rgb = hexToRgb(hex);
  return !!rgb && rgb.r < 40 && rgb.g < 40 && rgb.b < 40;
}

function isGray(hex: string): boolean {
  const rgb = hexToRgb(hex);
  if (!rgb) return false;
  return rgbToHsl(rgb.r, rgb.g, rgb.b).s < 10;
}

function getSaturation(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  return rgbToHsl(rgb.r, rgb.g, rgb.b).s;
}

function deduplicateColors(colors: string[], threshold = 30): string[] {
  const unique: string[] = [];
  for (const color of colors) {
    const rgb = hexToRgb(color);
    if (!rgb) continue;
    const isDupe = unique.some(u => {
      const urgb = hexToRgb(u);
      return !!urgb && Math.abs(rgb.r - urgb.r) + Math.abs(rgb.g - urgb.g) + Math.abs(rgb.b - urgb.b) < threshold;
    });
    if (!isDupe) unique.push(color);
  }
  return unique;
}

// ─── Color Extraction ───────────────────────────────────────────────

export interface ColorCategory {
  label: string;
  colors: ColorInfo[];
}

export interface ExtractedColors {
  primary: ColorInfo | null;
  secondary: ColorInfo | null;
  accent: ColorInfo | null;
  background: ColorInfo | null;
  text: ColorInfo | null;
  /** Sectioned color groups for display */
  sections: ColorCategory[];
  /** Flat list of all unique colors */
  all: ColorInfo[];
  /** Detected CSS frameworks (colors may be polluted by utility classes) */
  cssFrameworks: string[];
  /** True if site is predominantly black & white (e.g. Adidas) */
  bwDominant: boolean;
}

// Browser default colors — skip when they appear only once (not intentional design)
const BROWSER_DEFAULTS = new Set([
  "#0000ee", "#551a8b", "#0000ff", "#ff0000", "#008000", "#800080",
]);

const CSS_COLOR_RE = /#[a-f0-9]{3,8}\b|rgba?\([^)]+\)|hsla?\([^)]+\)/gi;

// CSS selectors/properties that indicate brand-level colors
const BRAND_SELECTORS = /\b(brand|primary|accent|logo|theme|main|hero|banner|headline|heading|masthead)\b/i;
const CTA_SELECTORS = /\b(btn|button|cta)\b/i;
const UI_SELECTORS = /\b(border|divider|separator|surface|card|input|nav|header|footer|sidebar|menu|tab|badge|chip|tag|tooltip|modal|dialog|a\b|link)\b/i;

interface TaggedColor {
  hex: string;
  context: "brand" | "ui" | "promo";
}

/**
 * Extract colors from a CSS block and tag them by context based on surrounding selectors/property names.
 */
function extractAndTagCssColors(css: string): TaggedColor[] {
  const tagged: TaggedColor[] = [];
  // Walk through each rule block
  const ruleRe = /([^{}]+)\{([^}]+)\}/g;
  let rm: RegExpExecArray | null;
  while ((rm = ruleRe.exec(css)) !== null) {
    const selector = rm[1];
    const body = rm[2];
    const colorMatches = body.match(CSS_COLOR_RE) || [];
    for (const c of colorMatches) {
      const hex = parseColorToHex(c);
      if (!hex) continue;
      let context: TaggedColor["context"] = "promo";
      if (BRAND_SELECTORS.test(selector) || CTA_SELECTORS.test(selector)) context = "brand";
      else if (UI_SELECTORS.test(selector)) context = "ui";
      tagged.push({ hex, context });
    }
  }
  // Also pick up colors outside of rule blocks (fallback)
  const looseColors = css.match(CSS_COLOR_RE) || [];
  for (const c of looseColors) {
    const hex = parseColorToHex(c);
    if (hex && !tagged.some(t => t.hex === hex)) tagged.push({ hex, context: "promo" });
  }
  return tagged;
}

/**
 * Detect CSS frameworks from stylesheet content.
 * Their utility classes pollute color extraction with unused colors.
 */
function detectCssFrameworks(css: string): string[] {
  const frameworks: string[] = [];
  if (/--bs-|\.btn-primary|\.bg-primary/i.test(css)) frameworks.push("Bootstrap");
  if (/\.bg-blue-|\.text-gray-|\.border-red-/i.test(css)) frameworks.push("Tailwind CSS");
  if (/\.mdc-|\.mat-|\.MuiButton/i.test(css)) frameworks.push("Material UI");
  if (/\.chakra-/i.test(css)) frameworks.push("Chakra UI");
  return frameworks;
}

export function extractColors(
  html: string,
  stylesheets: string[] = [],
  logoColours: string[] = [],
  computedColors: Array<{ hex: string; count: number }> = [],
): ExtractedColors {
  const brandHexes: string[] = [];
  const uiHexes: string[] = [];
  const promoHexes: string[] = [];
  const allHexColors: string[] = [];

  // Detect CSS frameworks for warning
  const allCssText = stylesheets.join("\n");
  const cssFrameworks = detectCssFrameworks(allCssText);

  // Phase 1: Extract from <style> tags with context tagging
  const styleTagRe = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  let m: RegExpExecArray | null;
  while ((m = styleTagRe.exec(html)) !== null) {
    for (const t of extractAndTagCssColors(m[1])) {
      allHexColors.push(t.hex);
      if (t.context === "brand") brandHexes.push(t.hex);
      else if (t.context === "ui") uiHexes.push(t.hex);
      else promoHexes.push(t.hex);
    }
  }

  // Phase 2: Extract from external stylesheets with context tagging
  for (const sheet of stylesheets) {
    for (const t of extractAndTagCssColors(sheet)) {
      allHexColors.push(t.hex);
      if (t.context === "brand") brandHexes.push(t.hex);
      else if (t.context === "ui") uiHexes.push(t.hex);
      else promoHexes.push(t.hex);
    }
  }

  // Phase 3: Extract from inline style attributes (all treated as promo/general)
  const styleAttrRe = /style="([^"]+)"/gi;
  while ((m = styleAttrRe.exec(html)) !== null) {
    const colorMatches = m[1].match(CSS_COLOR_RE) || [];
    for (const c of colorMatches) {
      const hex = parseColorToHex(c);
      if (hex) { allHexColors.push(hex); promoHexes.push(hex); }
    }
  }

  // Phase 4: CSS custom properties that look like brand tokens
  const varRe = /--(brand|primary|secondary|accent|color|theme)[^:]*:\s*([^;}]+)/gi;
  const allCss = stylesheets.join("\n");
  while ((m = varRe.exec(allCss)) !== null) {
    const hex = parseColorToHex(m[2].trim());
    if (hex) { brandHexes.push(hex); allHexColors.push(hex); }
  }
  // Also in embedded styles
  const embeddedCss: string[] = [];
  const stRe2 = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  while ((m = stRe2.exec(html)) !== null) embeddedCss.push(m[1]);
  const embeddedAll = embeddedCss.join("\n");
  const varRe2 = /--(brand|primary|secondary|accent|color|theme)[^:]*:\s*([^;}]+)/gi;
  while ((m = varRe2.exec(embeddedAll)) !== null) {
    const hex = parseColorToHex(m[2].trim());
    if (hex) { brandHexes.push(hex); allHexColors.push(hex); }
  }

  // Frequency tracking — computed styles weighted 10x (rendered = intentional design)
  const stylesheetFreq: Record<string, number> = {};
  for (const hex of allHexColors) stylesheetFreq[hex] = (stylesheetFreq[hex] || 0) + 1;

  const computedFreq: Record<string, number> = {};
  for (const c of computedColors) {
    const hex = parseColorToHex(c.hex);
    if (hex) computedFreq[hex] = (computedFreq[hex] || 0) + c.count;
  }

  // Combined frequency: computed × 10 + stylesheet
  const frequency: Record<string, number> = {};
  const allKeys = new Set([...Object.keys(stylesheetFreq), ...Object.keys(computedFreq)]);
  for (const hex of allKeys) {
    frequency[hex] = (computedFreq[hex] || 0) * 10 + (stylesheetFreq[hex] || 0);
  }

  // Deduplicate each category independently
  // Brand colours: keep saturated colours (filter out grays but keep white/black — they can be brand colours)
  const brandUnique = deduplicateColors(brandHexes, 25).filter(h => !isGray(h));
  const uiUnique = deduplicateColors(uiHexes, 25);
  const promoUnique = deduplicateColors(promoHexes, 25).filter(h => !isNearWhite(h) && !isNearBlack(h));

  // Sort brand by frequency first (most-used = most likely brand colour), then saturation as tiebreaker
  brandUnique.sort((a, b) => (frequency[b] || 0) - (frequency[a] || 0) || getSaturation(b) - getSaturation(a));
  promoUnique.sort((a, b) => (frequency[b] || 0) - (frequency[a] || 0) || getSaturation(b) - getSaturation(a));

  // Logo colours are the highest-confidence brand signal
  const logoUnique = logoColours.filter(h => !isNearWhite(h) && !isGray(h));

  // Build sections
  const sections: ColorCategory[] = [];

  // Merge logo colours into brand section (logo source takes priority)
  const logoBrandInfos = logoUnique.slice(0, 4).map(h => toColorInfo(h, "logo")).filter(Boolean) as ColorInfo[];
  const cssBrandInfos = brandUnique.filter(h => !logoUnique.includes(h)).slice(0, 6 - logoBrandInfos.length).map(h => toColorInfo(h, "css")).filter(Boolean) as ColorInfo[];
  const brandColors = [...logoBrandInfos, ...cssBrandInfos];
  if (brandColors.length) sections.push({ label: "Brand Colors", colors: brandColors });

  const uiColors = uiUnique.slice(0, 8).map(h => toColorInfo(h, "css")).filter(Boolean) as ColorInfo[];
  if (uiColors.length) sections.push({ label: "UI Colors", colors: uiColors });

  const promoColors = promoUnique
    .filter(h => !brandUnique.includes(h) && !uiUnique.includes(h))
    .slice(0, 8).map(h => toColorInfo(h, "css")).filter(Boolean) as ColorInfo[];
  if (promoColors.length) sections.push({ label: "Promotional Colors", colors: promoColors });

  // Overall deduplication for primary/secondary/accent picks
  const allUnique = deduplicateColors(Object.keys(frequency), 25);
  const colorful: string[] = [];
  const backgrounds: string[] = [];
  const texts: string[] = [];

  for (const hex of allUnique) {
    if (isNearWhite(hex)) backgrounds.push(hex);
    else if (isNearBlack(hex)) texts.push(hex);
    // Filter browser defaults that appear only once (not intentional design)
    else if (BROWSER_DEFAULTS.has(hex) && (frequency[hex] || 0) <= 1) continue;
    // Filter stylesheet-only colors with very low frequency (unused utility classes)
    else if (!computedFreq[hex] && (stylesheetFreq[hex] || 0) <= 2) continue;
    else if (!isGray(hex)) colorful.push(hex);
  }

  // B&W dominance detection (ported from Marque)
  // If >85% of computed styles are B&W and <50 colorful computed mentions,
  // the site is predominantly monochrome (e.g. Adidas, Apple)
  const totalComputed = Object.values(computedFreq).reduce((a, b) => a + b, 0) || 1;
  const bwComputed = Object.entries(computedFreq)
    .filter(([h]) => isNearBlack(h) || isNearWhite(h))
    .reduce((a, [, c]) => a + c, 0);
  const colorfulComputed = Object.entries(computedFreq)
    .filter(([h]) => !isNearBlack(h) && !isNearWhite(h) && !isGray(h))
    .reduce((a, [, c]) => a + c, 0);
  const bwDominant = computedColors.length > 0 && (bwComputed / totalComputed) > 0.85 && colorfulComputed < 50;

  let primary: string | null;
  let secondary: string | null;
  let accent: string | null;

  if (bwDominant) {
    // B&W site: rank colorful accents by frequency + logo bonus, then pick top 3
    console.log(`[brand-extractor] B&W dominant site detected (${Math.round(bwComputed / totalComputed * 100)}% B&W, ${colorfulComputed} colorful computed)`);
    const colorfulRanked = [...colorful].sort((a, b) => {
      const scoreA = (frequency[a] || 0) + (logoUnique.includes(a) ? 500 : 0);
      const scoreB = (frequency[b] || 0) + (logoUnique.includes(b) ? 500 : 0);
      return scoreB - scoreA || getSaturation(b) - getSaturation(a);
    });
    primary = colorfulRanked[0] || null;
    secondary = colorfulRanked[1] || null;
    accent = colorfulRanked[2] || null;
  } else {
    // Normal path: merge logo colours and CSS brand colours by scoring
    const brandCandidates = new Map<string, number>();
    for (const h of logoUnique) {
      brandCandidates.set(h, (brandCandidates.get(h) || 0) + 10);
    }
    for (const h of brandUnique.filter(h => !isNearWhite(h) && !isNearBlack(h))) {
      const freq = frequency[h] || 1;
      brandCandidates.set(h, (brandCandidates.get(h) || 0) + freq);
    }
    for (const h of colorful.filter(h => !brandCandidates.has(h))) {
      brandCandidates.set(h, 1);
    }

    const rankedColorful = [...brandCandidates.entries()]
      .sort((a, b) => b[1] - a[1] || getSaturation(b[0]) - getSaturation(a[0]))
      .map(e => e[0]);

    // High-frequency near-black/near-white can be brand colours (e.g. GitHub #010409)
    for (const h of [...texts, ...backgrounds]) {
      if ((frequency[h] || 0) >= 50 && !brandCandidates.has(h)) rankedColorful.push(h);
    }

    primary = rankedColorful[0] || null;
    secondary = rankedColorful[1] || null;
    accent = rankedColorful[2] || null;
  }

  // Log extraction results for debugging
  console.log(`[brand-extractor] Colour extraction: ${allHexColors.length} total mentions, ${Object.keys(frequency).length} unique`);
  console.log(`[brand-extractor] Tagged: ${brandHexes.length} brand, ${uiHexes.length} ui, ${promoHexes.length} promo`);
  if (computedColors.length) console.log(`[brand-extractor] Computed colors: ${Object.keys(computedFreq).length} unique (weighted 10x)`);
  if (cssFrameworks.length) console.log(`[brand-extractor] CSS frameworks detected: ${cssFrameworks.join(", ")}`);
  console.log(`[brand-extractor] Brand colours (by freq): ${brandUnique.slice(0, 6).map(h => `${h}(${frequency[h] || 0})`).join(", ")}`);
  console.log(`[brand-extractor] Primary: ${primary || "none"}, Secondary: ${secondary || "none"}, Accent: ${accent || "none"}`);
  console.log(`[brand-extractor] Final: primary=${primary}, secondary=${secondary}, accent=${accent}`);

  // Build flat all-colors list
  const allOrdered = deduplicateColors([...colorful, ...uiUnique, ...promoUnique, ...backgrounds, ...texts], 25);
  const allColors: ColorInfo[] = [];
  for (const hex of allOrdered.slice(0, 20)) {
    const info = toColorInfo(hex, "css");
    if (info) allColors.push(info);
  }

  return {
    primary: primary ? toColorInfo(primary, "css") : null,
    secondary: secondary ? toColorInfo(secondary, "css") : null,
    accent: accent ? toColorInfo(accent, "css") : null,
    background: backgrounds.length ? toColorInfo(backgrounds[0], "css") : toColorInfo("#ffffff", "css"),
    text: texts.length ? toColorInfo(texts[0], "css") : toColorInfo("#000000", "css"),
    sections,
    all: allColors,
    cssFrameworks,
    bwDominant,
  };
}

// ─── Font Extraction ────────────────────────────────────────────────

const SYSTEM_FONTS = new Set([
  "arial", "helvetica", "times new roman", "times", "courier new", "courier",
  "verdana", "georgia", "palatino", "garamond", "comic sans ms", "impact",
  "trebuchet ms", "arial black", "system-ui", "-apple-system", "segoe ui",
  "roboto", "sans-serif", "serif", "monospace", "cursive", "fantasy",
  "ui-sans-serif", "ui-serif", "ui-monospace", "inter",
]);

export interface ExtractedFont {
  family: string;
  weights: string[];
  source: "google" | "adobe" | "custom" | "system";
  usage: "heading" | "body" | "other";
}

export interface ExtractedFonts {
  heading: ExtractedFont | null;
  body: ExtractedFont | null;
  all: ExtractedFont[];
  googleFontsUrls: string[];
}

function cleanFontFamily(family: string): string {
  return family.split(",")[0].trim().replace(/['"]/g, "");
}

function buildCssVarMap(cssSources: string[]): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const css of cssSources) {
    const re = /(--[\w-]+)\s*:\s*([^;}]+)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(css)) !== null) {
      vars[m[1].trim()] = m[2].trim();
    }
  }
  return vars;
}

function resolveCssVars(value: string, varMap: Record<string, string>, depth = 0): string {
  if (depth > 3 || !value.includes("var(")) return value;
  return value.replace(/var\(\s*(--[\w-]+)\s*(?:,\s*([^)]+))?\)/g, (_, name, fallback) => {
    const resolved = varMap[name];
    if (resolved) return resolveCssVars(resolved, varMap, depth + 1);
    if (fallback) return resolveCssVars(fallback.trim(), varMap, depth + 1);
    return "";
  });
}

function parseGoogleFontsUrls(urls: string[]): Array<{ family: string; weights: string[] }> {
  const results: Array<{ family: string; weights: string[] }> = [];
  for (const url of urls) {
    const familyRe = /family=([^&]+)/g;
    let m: RegExpExecArray | null;
    while ((m = familyRe.exec(url)) !== null) {
      const raw = decodeURIComponent(m[1]);
      const parts = raw.split("@");
      const family = parts[0].split(":")[0].replace(/\+/g, " ").trim();
      if (!family) continue;
      const weights: string[] = [];
      if (parts[1]) {
        for (const part of parts[1].split(";")) {
          const segments = part.split(",");
          const w = segments[segments.length - 1];
          if (w && /^\d+$/.test(w)) weights.push(w);
        }
      }
      if (!weights.length) weights.push("400");
      const existing = results.find(r => r.family.toLowerCase() === family.toLowerCase());
      if (existing) {
        for (const w of weights) if (!existing.weights.includes(w)) existing.weights.push(w);
      } else {
        results.push({ family, weights });
      }
    }
  }
  return results;
}

function guessTagFromSelector(selector: string): string {
  const lower = selector.toLowerCase();
  const hMatch = lower.match(/\b(h[1-6])\b/);
  if (hMatch) return hMatch[1];
  if (/\bbody\b|\bhtml\b|\*/.test(lower)) return "div";
  if (/\bp\b/.test(lower)) return "p";
  if (/\ba\b/.test(lower)) return "a";
  if (/\bspan\b/.test(lower)) return "span";
  return "div";
}

export function extractFonts(html: string): ExtractedFonts {
  // Detect Google Fonts URLs
  const googleFontsUrls: string[] = [];
  const linkRe = /<link[^>]+href="([^"]*fonts\.googleapis\.com[^"]*)"[^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = linkRe.exec(html)) !== null) googleFontsUrls.push(m[1]);

  // Also from @import in style tags
  const importRe = /@import\s+url\(\s*['"]?(https?:\/\/fonts\.googleapis\.com[^'"\s)]+)['"]?\s*\)/gi;
  while ((m = importRe.exec(html)) !== null) googleFontsUrls.push(m[1]);

  // Detect Adobe Fonts
  const hasAdobe = /use\.typekit\.net|fonts\.adobe\.com/i.test(html);

  // Collect all CSS sources
  const cssSources: string[] = [];
  const styleTagRe = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  while ((m = styleTagRe.exec(html)) !== null) cssSources.push(m[1]);

  const cssVarMap = buildCssVarMap(cssSources);

  // Extract @font-face declarations
  const fontFaces: Array<{ family: string; weight: string }> = [];
  for (const css of cssSources) {
    const ffRe = /@font-face\s*\{([^}]+)\}/gi;
    let fm: RegExpExecArray | null;
    while ((fm = ffRe.exec(css)) !== null) {
      const block = fm[1];
      const familyMatch = block.match(/font-family\s*:\s*['"]?([^;'"]+)['"]?\s*;/i);
      const weightMatch = block.match(/font-weight\s*:\s*([^;]+);/i);
      if (familyMatch) {
        fontFaces.push({
          family: familyMatch[1].trim().replace(/['"]/g, ""),
          weight: weightMatch ? weightMatch[1].trim() : "400",
        });
      }
    }
  }

  // Extract font-family from CSS rules
  const fontMap: Record<string, { weights: Set<string>; tags: Set<string>; count: number }> = {};

  for (const css of cssSources) {
    const ffRe = /font-family\s*:\s*([^;}"]+)/gi;
    let fm: RegExpExecArray | null;
    while ((fm = ffRe.exec(css)) !== null) {
      const before = css.slice(0, fm.index);
      const lastBrace = before.lastIndexOf("{");
      let selector = "";
      if (lastBrace >= 0) {
        const lastClose = before.lastIndexOf("}", lastBrace);
        selector = before.slice(lastClose + 1, lastBrace).trim();
      }
      const tag = guessTagFromSelector(selector);
      let family = fm[1].trim();
      if (family.includes("var(")) family = resolveCssVars(family, cssVarMap);
      const clean = cleanFontFamily(family);
      if (!clean || clean === "inherit" || clean === "initial" || clean.startsWith("var(")) continue;
      if (!fontMap[clean]) fontMap[clean] = { weights: new Set(), tags: new Set(), count: 0 };
      fontMap[clean].weights.add("400");
      fontMap[clean].tags.add(tag);
      fontMap[clean].count++;
    }
  }

  // Extract from inline styles
  const inlineRe = /style="[^"]*font-family\s*:\s*([^;"]+)/gi;
  while ((m = inlineRe.exec(html)) !== null) {
    let family = m[1].trim();
    if (family.includes("var(")) family = resolveCssVars(family, cssVarMap);
    const clean = cleanFontFamily(family);
    if (!clean || clean === "inherit" || clean === "initial") continue;
    if (!fontMap[clean]) fontMap[clean] = { weights: new Set(), tags: new Set(), count: 0 };
    fontMap[clean].weights.add("400");
    fontMap[clean].tags.add("div");
    fontMap[clean].count++;
  }

  // Parse Google Fonts
  const parsedGoogle = parseGoogleFontsUrls(googleFontsUrls);
  const googleFamilies = new Set(parsedGoogle.map(f => f.family.toLowerCase()));

  for (const gf of parsedGoogle) {
    if (fontMap[gf.family]) {
      for (const w of gf.weights) fontMap[gf.family].weights.add(w);
    } else {
      fontMap[gf.family] = { weights: new Set(gf.weights), tags: new Set(["h1"]), count: 1 };
    }
  }

  // Add @font-face families
  for (const ff of fontFaces) {
    if (!fontMap[ff.family]) fontMap[ff.family] = { weights: new Set([ff.weight]), tags: new Set(["div"]), count: 1 };
  }

  // Build results
  const fontFaceNames = new Set(fontFaces.map(f => f.family.toLowerCase()));
  const headingTags = new Set(["h1", "h2", "h3", "h4", "h5", "h6"]);
  const bodyTags = new Set(["p", "span", "li", "a", "div"]);

  const fonts: ExtractedFont[] = [];
  for (const [family, data] of Object.entries(fontMap)) {
    const lower = family.toLowerCase();
    let source: ExtractedFont["source"];
    if (SYSTEM_FONTS.has(lower)) source = "system";
    else if (googleFamilies.has(lower)) source = "google";
    else if (hasAdobe && fontFaceNames.has(lower)) source = "adobe";
    else source = "custom";

    const isHeading = [...data.tags].some(t => headingTags.has(t));
    const isBody = [...data.tags].some(t => bodyTags.has(t));

    fonts.push({
      family,
      weights: [...data.weights].sort(),
      source,
      usage: isHeading ? "heading" : isBody ? "body" : "other",
    });
  }

  // Sort: non-system first
  fonts.sort((a, b) => (a.source === "system" ? 1 : 0) - (b.source === "system" ? 1 : 0));

  const nonSystem = fonts.filter(f => f.source !== "system");

  let heading = fonts.find(f => f.usage === "heading" && f.source !== "system")
    || fonts.find(f => f.usage === "heading") || null;
  let body = fonts.find(f => f.usage === "body" && f.source !== "system")
    || fonts.find(f => f.usage === "body") || null;

  if (nonSystem.length === 1) {
    heading = heading || nonSystem[0];
    body = body || nonSystem[0];
  }
  if (!heading && nonSystem.length) heading = nonSystem[0];
  if (!body && nonSystem.length) body = nonSystem.length > 1 ? nonSystem[1] : nonSystem[0];

  return { heading, body, all: fonts, googleFontsUrls };
}

// ─── Raster Image Colour Extraction ─────────────────────────────────

/**
 * Extract dominant colours from a raster image (PNG/JPEG) stored as base64 data URI.
 * Uses simple pixel sampling + frequency counting (no external deps).
 * Works by decoding raw pixel data from uncompressed BMP-style representation,
 * or by scanning the base64 for PNG PLTE chunks (palette-based PNGs).
 */
function extractColoursFromRasterBase64(dataUri: string): string[] {
  try {
    const b64 = dataUri.replace(/^data:[^,]+,/, "");
    const buf = Buffer.from(b64, "base64");

    // Strategy 1: PNG PLTE chunk (palette-based PNGs like favicons)
    // PLTE chunk contains raw RGB triplets - the most reliable for icons
    const plteColours = extractFromPngPalette(buf);
    if (plteColours.length > 0) return plteColours;

    // Strategy 2: Sample raw pixel bytes from PNG IDAT data
    // For truecolor PNGs, sample the uncompressed pixel data
    const sampledColours = samplePngPixels(buf);
    if (sampledColours.length > 0) return sampledColours;

    return [];
  } catch {
    return [];
  }
}

/**
 * Extract colours from PNG PLTE chunk (palette-based PNGs).
 * Most favicons and touch icons use indexed colour mode.
 */
function extractFromPngPalette(buf: Buffer): string[] {
  // PNG signature: 89 50 4E 47 0D 0A 1A 0A
  if (buf.length < 8 || buf[0] !== 0x89 || buf[1] !== 0x50) return [];

  const colours: string[] = [];
  let offset = 8; // skip signature

  while (offset < buf.length - 8) {
    const length = buf.readUInt32BE(offset);
    const type = buf.toString("ascii", offset + 4, offset + 8);

    if (type === "PLTE") {
      // PLTE chunk: sequence of RGB triplets
      const data = buf.subarray(offset + 8, offset + 8 + length);
      for (let i = 0; i < data.length - 2; i += 3) {
        const hex = rgbToHex(data[i], data[i + 1], data[i + 2]);
        if (!isNearWhite(hex) && !isGray(hex)) colours.push(hex);
      }
      break;
    }

    offset += 12 + length; // 4 length + 4 type + data + 4 CRC
  }

  return deduplicateColors(colours, 30);
}

/**
 * Sample pixels from PNG IDAT data using zlib decompression.
 * Extracts dominant colours via frequency counting.
 */
function samplePngPixels(buf: Buffer): string[] {
  if (buf.length < 8 || buf[0] !== 0x89 || buf[1] !== 0x50) return [];

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy Node-only load; a top-level import would pull zlib into browser bundles
    const zlib = require("zlib");

    // Parse IHDR for image dimensions and colour type
    let width = 0, height = 0, colourType = 0;
    let offset = 8;

    while (offset < buf.length - 8) {
      const length = buf.readUInt32BE(offset);
      const type = buf.toString("ascii", offset + 4, offset + 8);

      if (type === "IHDR") {
        width = buf.readUInt32BE(offset + 8);
        height = buf.readUInt32BE(offset + 12);
        // buf[offset + 16] is bitDepth (unused)
        colourType = buf[offset + 17];
        break;
      }
      offset += 12 + length;
    }

    if (width === 0 || colourType < 2) return []; // not truecolour

    // Collect all IDAT chunks
    const idatChunks: Buffer[] = [];
    offset = 8;
    while (offset < buf.length - 8) {
      const length = buf.readUInt32BE(offset);
      const type = buf.toString("ascii", offset + 4, offset + 8);
      if (type === "IDAT") {
        idatChunks.push(buf.subarray(offset + 8, offset + 8 + length));
      }
      offset += 12 + length;
    }

    if (idatChunks.length === 0) return [];

    const compressed = Buffer.concat(idatChunks);
    const raw = zlib.inflateSync(compressed);

    // Parse pixel data (each row starts with a filter byte)
    const channels = colourType === 6 ? 4 : 3; // RGBA or RGB
    const stride = 1 + width * channels; // filter byte + pixel data
    const colourFreq = new Map<string, number>();

    // Sample every 2nd pixel on every 2nd row for performance
    for (let y = 0; y < height && y * stride < raw.length; y += 2) {
      const rowStart = y * stride + 1; // skip filter byte
      for (let x = 0; x < width; x += 2) {
        const pixelStart = rowStart + x * channels;
        if (pixelStart + 2 >= raw.length) break;
        const r = raw[pixelStart];
        const g = raw[pixelStart + 1];
        const b = raw[pixelStart + 2];
        // Skip transparent pixels (alpha < 128)
        if (channels === 4 && pixelStart + 3 < raw.length && raw[pixelStart + 3] < 128) continue;
        const hex = rgbToHex(r, g, b);
        colourFreq.set(hex, (colourFreq.get(hex) || 0) + 1);
      }
    }

    // Rank by frequency, skip white/gray
    const ranked = [...colourFreq.entries()]
      .filter(([h]) => !isNearWhite(h) && !isGray(h))
      .sort((a, b) => b[1] - a[1])
      .map(e => e[0]);

    return deduplicateColors(ranked.slice(0, 10), 30);
  } catch {
    return [];
  }
}

// ─── Logo Colour Extraction ─────────────────────────────────────────

/**
 * Extract colours from SVG content (inline or fetched).
 * Looks for fill, stroke, stop-color attributes and style properties.
 */
function extractColoursFromSvg(svgContent: string): string[] {
  const colours: string[] = [];
  // fill="...", stroke="...", stop-color="..."
  const attrRe = /(?:fill|stroke|stop-color)=["']([^"']+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = attrRe.exec(svgContent)) !== null) {
    const hex = parseColorToHex(m[1]);
    if (hex && !isNearWhite(hex) && hex !== "#000000") colours.push(hex);
  }
  // fill:...; stroke:...; in inline style attributes
  const styleRe = /(?:fill|stroke|stop-color)\s*:\s*([^;"]+)/gi;
  while ((m = styleRe.exec(svgContent)) !== null) {
    const hex = parseColorToHex(m[1].trim());
    if (hex && !isNearWhite(hex) && hex !== "#000000") colours.push(hex);
  }
  return deduplicateColors(colours, 25);
}

/**
 * Extract colours from all logo sources:
 * 1. Inline SVGs in HTML that match logo patterns
 * 2. Fetched SVG logo data (base64)
 * 3. Meta theme-color tag
 */
function extractLogoColours(html: string, logos: Array<{ data?: string; mimeType?: string; url: string; type?: string }>): string[] {
  const colours: string[] = [];

  // 1. Inline SVGs near logo elements (header SVGs, logo containers)
  const inlineSvgRe = /<(?:a|div|span|header|nav)[^>]*(?:logo|brand|site-mark|navbar-brand)[^>]*>[\s\S]*?(<svg[\s\S]*?<\/svg>)/gi;
  let m: RegExpExecArray | null;
  while ((m = inlineSvgRe.exec(html)) !== null) {
    colours.push(...extractColoursFromSvg(m[1]));
  }

  // 2. Any SVG in the first <header> or <nav> (likely the logo)
  const headerSvgRe = /<(?:header|nav)\b[^>]*>[\s\S]*?(<svg[\s\S]*?<\/svg>)/i;
  const headerSvgMatch = html.match(headerSvgRe);
  if (headerSvgMatch) {
    colours.push(...extractColoursFromSvg(headerSvgMatch[1]));
  }

  // 3. Fetched logos - SVG or raster
  for (const logo of logos) {
    if (!logo.data) continue;
    if (logo.mimeType?.includes("svg") || logo.url.endsWith(".svg")) {
      // SVG: parse fill/stroke attributes
      try {
        const b64 = logo.data.replace(/^data:[^,]+,/, "");
        const svgText = Buffer.from(b64, "base64").toString("utf-8");
        colours.push(...extractColoursFromSvg(svgText));
      } catch {}
    } else if (logo.mimeType?.includes("png") || logo.mimeType?.includes("icon") || logo.url.endsWith(".png") || logo.url.endsWith(".ico")) {
      // Raster PNG/ICO: extract dominant pixel colours
      const rasterColours = extractColoursFromRasterBase64(logo.data);
      // Only keep vivid colours from raster (filter out anti-aliasing noise and pale washed-out pixels)
      const saturated = rasterColours.filter(h => {
        const rgb = hexToRgb(h);
        if (!rgb) return false;
        const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
        // Require very high saturation AND mid-range lightness
        // Anti-aliased pixels have moderate saturation (40-60%) and are light (l>70)
        // Real brand colours are vivid: s>70 and l between 20-65
        return hsl.s > 70 && hsl.l > 20 && hsl.l < 65;
      });
      if (saturated.length > 0) {
        console.log(`[brand-extractor] Raster logo colours (${logo.type}): ${saturated.slice(0, 5).join(", ")}`);
        colours.push(...saturated);
      }
    }
  }

  // 4. Meta theme-color (very reliable brand indicator)
  const themeColorRe = /<meta[^>]+name=["']theme-color["'][^>]+content=["']([^"']+)["']/i;
  const themeMatch = html.match(themeColorRe);
  if (themeMatch) {
    const hex = parseColorToHex(themeMatch[1].trim());
    if (hex) colours.push(hex);
  }
  // Reversed attribute order
  const themeColorRe2 = /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']theme-color["']/i;
  const themeMatch2 = html.match(themeColorRe2);
  if (themeMatch2) {
    const hex = parseColorToHex(themeMatch2[1].trim());
    if (hex) colours.push(hex);
  }

  // Sort by saturation descending (most vivid = most likely the actual brand colour, not anti-aliasing)
  const sorted = [...new Set(colours)].sort((a, b) => getSaturation(b) - getSaturation(a));
  return deduplicateColors(sorted, 40); // higher threshold to merge anti-aliased variants
}

// ─── Logo Extraction ────────────────────────────────────────────────

export interface ExtractedLogo {
  url: string;
  type: "svg-icon" | "apple-touch-icon" | "favicon" | "semantic-logo";
  sizes?: string;
  mimeType?: string;
  data?: string; // base64 data URI (populated after fetching)
}

// Patterns that indicate a logo is NOT the company's own logo
const PARTNER_LOGO_RE = /partner|sponsor|client|customer|trust|integration|app.?store|google.?play|badge|award|certif|powered|payment|visa|mastercard|amex|paypal|stripe-badge/i;
// Patterns that indicate a logo IS the company's own
const OWN_LOGO_RE = /\blogo\b|brand|company|site.?logo|header.?logo|navbar.?logo|main.?logo/i;

/**
 * Determine if an image URL or its attributes suggest it's the site's own logo (not a partner/badge).
 */
function isOwnLogo(src: string, alt: string, classes: string, id: string, baseUrl: string): boolean {
  const allText = `${src} ${alt} ${classes} ${id}`.toLowerCase();
  // Reject if it matches partner patterns
  if (PARTNER_LOGO_RE.test(allText)) return false;
  // Reject if hosted on a different domain (likely partner/third-party)
  try {
    const imgHost = new URL(src.startsWith("http") ? src : new URL(src, baseUrl).href).hostname;
    const siteHost = new URL(baseUrl).hostname.replace("www.", "");
    // Allow same domain or CDN subdomains
    if (!imgHost.includes(siteHost) && !siteHost.includes(imgHost.replace("www.", "")) &&
        !imgHost.includes("cdn") && !imgHost.includes("static") && !imgHost.includes("asset") &&
        !imgHost.includes("img") && !imgHost.includes("media")) {
      return false;
    }
  } catch {}
  // Accept if it matches own-logo patterns
  if (OWN_LOGO_RE.test(allText)) return true;
  return false;
}

export function extractLogos(html: string, baseUrl: string): ExtractedLogo[] {
  const logos: ExtractedLogo[] = [];
  const seen = new Set<string>();

  function resolveUrl(href: string): string {
    if (!href) return "";
    if (href.startsWith("http://") || href.startsWith("https://") || href.startsWith("//")) {
      return href.startsWith("//") ? `https:${href}` : href;
    }
    try {
      return new URL(href, baseUrl).href;
    } catch {
      return "";
    }
  }

  function add(href: string, type: ExtractedLogo["type"], sizes?: string, mimeType?: string) {
    const url = resolveUrl(href);
    if (!url || seen.has(url)) return;
    seen.add(url);
    const logo: ExtractedLogo = { url, type };
    if (sizes) logo.sizes = sizes;
    if (mimeType) logo.mimeType = mimeType;
    logos.push(logo);
  }

  /** Capture an inline SVG as a base64 data URI logo (ported from Marque) */
  function addInlineSvg(svgContent: string, type: ExtractedLogo["type"]) {
    const key = `inline-svg:${svgContent.slice(0, 200)}`;
    if (seen.has(key)) return;
    seen.add(key);
    const b64 = Buffer.from(svgContent, "utf-8").toString("base64");
    logos.push({
      url: baseUrl,
      type,
      mimeType: "image/svg+xml",
      data: `data:image/svg+xml;base64,${b64}`,
    });
  }

  let m: RegExpExecArray | null;

  // 1. Semantic logos: images/SVGs with "logo" or "brand" in attributes, inside header/nav/banner
  //    (ported from Marque — checks aria-label, role, and captures inline SVGs)
  const containerRe = /<(header|nav)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  while ((m = containerRe.exec(html)) !== null) {
    const containerHtml = m[2];
    // Check <img> tags with logo/brand signals
    const imgTagRe = /<img\s[^>]*>/gi;
    let im: RegExpExecArray | null;
    while ((im = imgTagRe.exec(containerHtml)) !== null) {
      const tag = im[0];
      const srcMatch = tag.match(/src=["']([^"']+)["']/i);
      const altMatch = tag.match(/alt=["']([^"']+)["']/i);
      const classMatch = tag.match(/class=["']([^"']+)["']/i);
      const idMatch = tag.match(/id=["']([^"']+)["']/i);
      const ariaMatch = tag.match(/aria-label=["']([^"']+)["']/i);
      const allAttrs = `${srcMatch?.[1] || ""} ${altMatch?.[1] || ""} ${classMatch?.[1] || ""} ${idMatch?.[1] || ""} ${ariaMatch?.[1] || ""}`.toLowerCase();
      if (allAttrs.includes("logo") || allAttrs.includes("brand")) {
        if (srcMatch) add(srcMatch[1], "semantic-logo");
      }
    }
    // Check inline <svg> tags with logo/brand signals (ported from Marque)
    const svgRe = /<svg[\s\S]*?<\/svg>/gi;
    let sm: RegExpExecArray | null;
    while ((sm = svgRe.exec(containerHtml)) !== null) {
      const svgTag = sm[0];
      // Check surrounding context or SVG's own attributes for logo signals
      const svgStart = sm.index;
      const contextBefore = containerHtml.slice(Math.max(0, svgStart - 200), svgStart).toLowerCase();
      const svgAttrs = svgTag.slice(0, Math.min(300, svgTag.indexOf(">") + 1)).toLowerCase();
      if (contextBefore.includes("logo") || contextBefore.includes("brand") ||
          svgAttrs.includes("logo") || svgAttrs.includes("brand")) {
        addInlineSvg(svgTag, "semantic-logo");
      }
    }
  }

  // 2. Header/nav first image or SVG fallback (if no semantic logo found)
  if (!logos.some(l => l.type === "semantic-logo")) {
    // Try first <img> in header/nav
    const headerImgRe = /<(?:header|nav)[^>]*>[\s\S]*?<img[^>]+src=["']([^"']+)["'][^>]*>/i;
    const headerMatch = html.match(headerImgRe);
    if (headerMatch) {
      add(headerMatch[1], "semantic-logo");
    } else {
      // Try first <svg> in header/nav (many modern sites use inline SVG logos)
      const headerSvgRe = /<(?:header|nav)\b[^>]*>[\s\S]*?(<svg[\s\S]*?<\/svg>)/i;
      const svgMatch = html.match(headerSvgRe);
      if (svgMatch) addInlineSvg(svgMatch[1], "semantic-logo");
    }
  }

  // 3. Semantic logo: images outside header/nav with "logo" in attributes, same domain
  const imgRe = /<img\s[^>]*>/gi;
  let semanticCount = logos.filter(l => l.type === "semantic-logo").length;
  while ((m = imgRe.exec(html)) !== null && semanticCount < 3) {
    const tag = m[0];
    const srcMatch = tag.match(/src=["']([^"']+)["']/i);
    const altMatch = tag.match(/alt=["']([^"']+)["']/i);
    const classMatch = tag.match(/class=["']([^"']+)["']/i);
    const idMatch = tag.match(/id=["']([^"']+)["']/i);
    if (!srcMatch) continue;
    const src = srcMatch[1];
    const alt = altMatch?.[1] || "";
    const cls = classMatch?.[1] || "";
    const id = idMatch?.[1] || "";
    if (isOwnLogo(src, alt, cls, id, baseUrl)) {
      add(src, "semantic-logo");
      semanticCount++;
    }
  }

  // 4. SVG favicon (highest quality icon)
  const svgIconRe = /<link[^>]+rel="icon"[^>]+type="image\/svg\+xml"[^>]+href="([^"]+)"/gi;
  while ((m = svgIconRe.exec(html)) !== null) add(m[1], "svg-icon", undefined, "image/svg+xml");
  const svgIconRe2 = /<link[^>]+href="([^"]+)"[^>]+rel="icon"[^>]+type="image\/svg\+xml"/gi;
  while ((m = svgIconRe2.exec(html)) !== null) add(m[1], "svg-icon", undefined, "image/svg+xml");

  // 5. Apple touch icon
  const appleRe = /<link[^>]+rel="apple-touch-icon(?:-precomposed)?"[^>]+href="([^"]+)"(?:[^>]+sizes="([^"]+)")?[^>]*>/gi;
  while ((m = appleRe.exec(html)) !== null) add(m[1], "apple-touch-icon", m[2]);

  // 6. Standard favicons — sorted by size, largest first
  const favRe = /<link[^>]+rel="(?:shortcut\s+)?icon"[^>]+href="([^"]+)"(?:[^>]+sizes="([^"]+)")?[^>]*>/gi;
  const favicons: Array<{ href: string; sizes?: string; size: number }> = [];
  while ((m = favRe.exec(html)) !== null) {
    const sizes = m[2];
    let size = 0;
    if (sizes) { const s = parseInt(sizes.split("x")[0]); if (!isNaN(s)) size = s; }
    favicons.push({ href: m[1], sizes, size });
  }
  favicons.sort((a, b) => b.size - a.size);
  if (favicons.length) add(favicons[0].href, "favicon", favicons[0].sizes);

  // 7. Fallback: /favicon.ico
  add("/favicon.ico", "favicon");

  return logos;
}

/**
 * Fetch logo images and embed as base64 data URIs.
 * Runs in Node.js (uses fetch API).
 */
export async function fetchLogoData(logos: ExtractedLogo[], maxLogos = 6): Promise<ExtractedLogo[]> {
  const results: ExtractedLogo[] = [];
  let fetched = 0;

  for (const logo of logos) {
    if (fetched >= maxLogos) { results.push(logo); continue; }
    // Inline SVGs already have embedded data — pass through
    if (logo.data) { results.push(logo); fetched++; continue; }
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const origin = new URL(logo.url).origin;
      const res = await fetch(logo.url, {
        signal: controller.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
          "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
          "Referer": origin + "/",
        },
      });
      clearTimeout(timeout);
      if (!res.ok) { results.push(logo); continue; }
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.byteLength < 10) { results.push(logo); continue; }
      // Strip charset from content-type (e.g. "image/png;charset=utf-8")
      let contentType = (res.headers.get("content-type") || "image/png").split(";")[0].trim();

      // Convert ICO to PNG for reliable browser display (ported from Marque)
      const isIco = contentType === "image/x-icon" || contentType === "image/vnd.microsoft.icon" || logo.url.split("?")[0].endsWith(".ico");
      const finalBuf = buf;
      if (isIco) {
        try {
          // ICO files are often valid PNGs inside — check PNG signature
          if (buf[0] === 0x89 && buf[1] === 0x50) {
            contentType = "image/png"; // It's actually a PNG
          }
          // Otherwise just serve as-is (browser can usually handle ICO)
        } catch {}
      }

      const b64 = finalBuf.toString("base64");
      results.push({
        ...logo,
        mimeType: logo.mimeType || contentType,
        data: `data:${contentType};base64,${b64}`,
      });
      fetched++;
    } catch {
      results.push(logo);
    }
  }
  return results;
}

// ─── External Stylesheet Fetching ───────────────────────────────────

/**
 * Extract external stylesheet URLs from HTML and fetch their contents.
 */
export function extractStylesheetUrls(html: string, baseUrl: string): string[] {
  const urls: string[] = [];
  const seen = new Set<string>();
  // <link rel="stylesheet" href="...">
  const linkRe = /<link[^>]+rel=["']stylesheet["'][^>]+href=["']([^"']+)["'][^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = linkRe.exec(html)) !== null) {
    const href = m[1];
    if (href.includes("fonts.googleapis.com")) continue; // Google Fonts handled separately
    try {
      const full = href.startsWith("http") ? href : new URL(href, baseUrl).href;
      if (!seen.has(full)) { seen.add(full); urls.push(full); }
    } catch {}
  }
  // Also reversed attribute order
  const linkRe2 = /<link[^>]+href=["']([^"']+)["'][^>]+rel=["']stylesheet["'][^>]*>/gi;
  while ((m = linkRe2.exec(html)) !== null) {
    const href = m[1];
    if (href.includes("fonts.googleapis.com")) continue;
    try {
      const full = href.startsWith("http") ? href : new URL(href, baseUrl).href;
      if (!seen.has(full)) { seen.add(full); urls.push(full); }
    } catch {}
  }
  // @import url(...) in <style> tags
  const importRe = /@import\s+(?:url\(\s*)?['"]?([^'"\s);]+)['"]?\s*\)?/gi;
  const styleTagRe = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  while ((m = styleTagRe.exec(html)) !== null) {
    let im: RegExpExecArray | null;
    while ((im = importRe.exec(m[1])) !== null) {
      const href = im[1];
      if (href.includes("fonts.googleapis.com")) continue;
      try {
        const full = href.startsWith("http") ? href : new URL(href, baseUrl).href;
        if (!seen.has(full)) { seen.add(full); urls.push(full); }
      } catch {}
    }
  }
  return urls;
}

/**
 * Fetch external stylesheets (up to maxSheets, max 500KB each).
 */
export async function fetchExternalStylesheets(urls: string[], maxSheets = 15): Promise<string[]> {
  const results: string[] = [];
  for (const url of urls.slice(0, maxSheets)) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
          "Accept": "text/css,*/*",
        },
      });
      clearTimeout(timeout);
      if (!res.ok) continue;
      const text = await res.text();
      if (text.length < 500_000) results.push(text);
    } catch {}
  }
  return results;
}

// ─── Explicit Brand Signals (Developer-Declared) ────────────────────

interface ExplicitSignals {
  themeColor: string | null;       // <meta name="theme-color">
  manifestColor: string | null;    // manifest.json theme_color
  tileColor: string | null;        // <meta name="msapplication-TileColor">
  cssCustomProps: string[];        // CSS custom properties like --primary, --brand-color
}

/**
 * Extract explicit brand colour signals from HTML meta tags.
 * These are colours developers have intentionally declared as their brand colour.
 */
function extractExplicitSignals(html: string): Omit<ExplicitSignals, "manifestColor"> {
  let m: RegExpExecArray | null;

  // 1. <meta name="theme-color"> (highest reliability when present)
  let themeColor: string | null = null;
  const themeRe1 = /<meta[^>]+name=["']theme-color["'][^>]+content=["']([^"']+)["']/i;
  const themeRe2 = /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']theme-color["']/i;
  const tm1 = html.match(themeRe1);
  const tm2 = html.match(themeRe2);
  const rawTheme = tm1?.[1] || tm2?.[1];
  if (rawTheme) themeColor = parseColorToHex(rawTheme.trim());

  // 2. <meta name="msapplication-TileColor">
  let tileColor: string | null = null;
  const tileRe1 = /<meta[^>]+name=["']msapplication-TileColor["'][^>]+content=["']([^"']+)["']/i;
  const tileRe2 = /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']msapplication-TileColor["']/i;
  const tl1 = html.match(tileRe1);
  const tl2 = html.match(tileRe2);
  const rawTile = tl1?.[1] || tl2?.[1];
  if (rawTile) tileColor = parseColorToHex(rawTile.trim());

  // 3. CSS custom properties with brand-like names from embedded styles
  const cssCustomProps: string[] = [];
  const embeddedCss: string[] = [];
  const stRe = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  while ((m = stRe.exec(html)) !== null) embeddedCss.push(m[1]);
  const allEmbedded = embeddedCss.join("\n");

  // Broader pattern matching for custom properties
  const propPatterns = [
    /--(brand|primary|main|accent|theme)[-_]?(?:color|colour)?(?:[-_]\w+)?:\s*([^;}]+)/gi,
    /--(?:color|colour)[-_](?:brand|primary|main|accent|theme)(?:[-_]\w+)?:\s*([^;}]+)/gi,
    /--(?:dt|ds|ui|app|site)[-_](?:color|colour)?[-_]?(?:primary|brand|accent|main)(?:[-_]\w+)?:\s*([^;}]+)/gi,
  ];

  for (const re of propPatterns) {
    while ((m = re.exec(allEmbedded)) !== null) {
      const val = m[m.length - 1].trim(); // last capture group
      const hex = parseColorToHex(val);
      if (hex && !isNearWhite(hex) && !isGray(hex)) cssCustomProps.push(hex);
    }
  }

  return { themeColor, tileColor, cssCustomProps: deduplicateColors(cssCustomProps, 25) };
}

/**
 * Fetch manifest.json and extract theme_color.
 */
async function fetchManifestColor(html: string, pageUrl: string): Promise<string | null> {
  // Find manifest link
  const manifestRe1 = /<link[^>]+rel=["']manifest["'][^>]+href=["']([^"']+)["']/i;
  const manifestRe2 = /<link[^>]+href=["']([^"']+)["'][^>]+rel=["']manifest["']/i;
  const mm1 = html.match(manifestRe1);
  const mm2 = html.match(manifestRe2);
  const manifestHref = mm1?.[1] || mm2?.[1];
  if (!manifestHref) return null;

  try {
    const manifestUrl = manifestHref.startsWith("http") ? manifestHref : new URL(manifestHref, pageUrl).href;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(manifestUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "Accept": "application/json,*/*",
      },
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const text = await res.text();
    const manifest = JSON.parse(text);
    const raw = manifest.theme_color || manifest.background_color;
    if (raw) return parseColorToHex(String(raw).trim());
  } catch {}
  return null;
}

// ─── Combined Extraction ────────────────────────────────────────────

export interface BrandData {
  colors: ExtractedColors;
  fonts: ExtractedFonts;
  logos: ExtractedLogo[];
}

/**
 * Extract brand data (colors, fonts, logos) from HTML only (no network).
 * For best results, use extractBrandDataFull which also fetches external stylesheets and logos.
 */
export function extractBrandData(html: string, pageUrl: string): BrandData {
  return {
    colors: extractColors(html),
    fonts: extractFonts(html),
    logos: extractLogos(html, pageUrl),
  };
}

/**
 * Full extraction with cascading waterfall priority:
 *   1. Explicit developer signals (theme-color, manifest, TileColor)
 *   2. CSS custom properties (--primary, --brand-color)
 *   3. Logo/favicon pixel analysis
 *   4. CSS frequency analysis (selector-based tagging)
 *
 * Earlier signals override later ones for primary/secondary selection.
 *
 * If `analytics` is provided, checks MongoDB cache first and stores result after extraction.
 */
export async function extractBrandDataFull(
  html: string,
  pageUrl: string,
  computedColors: Array<{ hex: string; count: number }> = [],
  analytics?: import("../storage/interface.js").AnalyticsAdapter | null,
): Promise<BrandData> {
  // ── Cache check ──
  const domain = (() => { try { return new URL(pageUrl).hostname.replace(/^www\./, ""); } catch { return ""; } })();
  if (analytics && domain) {
    try {
      const cached = await analytics.getBrandCache(domain);
      if (cached) {
        console.log(`[brand-extractor] Cache hit for ${domain} (useCount: ${cached.useCount})`);
        // Reconstruct BrandData from cache
        const primary = cached.colors.primary ? toColorInfo(cached.colors.primary, "css") : null;
        const secondary = cached.colors.secondary ? toColorInfo(cached.colors.secondary, "css") : null;
        const accent = cached.colors.accent ? toColorInfo(cached.colors.accent, "css") : null;
        const allCached = cached.colors.all.map(c => toColorInfo(c.hex, "css")).filter(Boolean) as ColorInfo[];

        // Reconstruct fonts from cache (don't re-extract from raw HTML — external CSS won't be there)
        const cachedFonts = extractFonts(html); // inline fonts as baseline
        if (cached.fonts?.heading && !cachedFonts.heading) {
          cachedFonts.heading = {
            family: cached.fonts.heading.family,
            weights: cached.fonts.heading.weight ? [cached.fonts.heading.weight] : ["400"],
            source: (cached.fonts.heading.source as ExtractedFont["source"]) || "custom",
            usage: "heading",
          };
          cachedFonts.all.push(cachedFonts.heading);
        }
        if (cached.fonts?.body && !cachedFonts.body) {
          cachedFonts.body = {
            family: cached.fonts.body.family,
            weights: cached.fonts.body.weight ? [cached.fonts.body.weight] : ["400"],
            source: (cached.fonts.body.source as ExtractedFont["source"]) || "custom",
            usage: "body",
          };
          cachedFonts.all.push(cachedFonts.body);
        }
        // Build Google Fonts URL from cached fonts if none found in HTML
        if (cachedFonts.googleFontsUrls.length === 0) {
          const families: string[] = [];
          if (cachedFonts.heading) families.push(cachedFonts.heading.family.replace(/ /g, "+") + ":wght@400;700");
          if (cachedFonts.body && cachedFonts.body.family !== cachedFonts.heading?.family) {
            families.push(cachedFonts.body.family.replace(/ /g, "+") + ":wght@400;500;700");
          }
          if (families.length > 0) {
            cachedFonts.googleFontsUrls.push(`https://fonts.googleapis.com/css2?${families.map(f => "family=" + f).join("&")}&display=swap`);
          }
        }

        // Fetch logo data (base64) — cache only stores URLs, not binary
        const logos = extractLogos(html, pageUrl);
        const fetchedLogos = await fetchLogoData(logos);

        return {
          colors: { primary, secondary, accent, background: null, text: null, sections: [], all: allCached, cssFrameworks: [], bwDominant: false },
          fonts: cachedFonts,
          logos: fetchedLogos,
        };
      }
    } catch (err) {
      console.warn(`[brand-extractor] Cache lookup failed for ${domain}:`, err instanceof Error ? err.message : err);
    }
  }

  // ── Step 1: Explicit developer signals ──
  const explicit = extractExplicitSignals(html);
  const manifestColor = await fetchManifestColor(html, pageUrl);
  const explicitSignals: ExplicitSignals = { ...explicit, manifestColor };

  // Log what we found
  const explicitFound: string[] = [];
  if (explicitSignals.themeColor) explicitFound.push(`theme-color: ${explicitSignals.themeColor}`);
  if (explicitSignals.manifestColor) explicitFound.push(`manifest: ${explicitSignals.manifestColor}`);
  if (explicitSignals.tileColor) explicitFound.push(`tile-color: ${explicitSignals.tileColor}`);
  if (explicitSignals.cssCustomProps.length) explicitFound.push(`css-vars: ${explicitSignals.cssCustomProps.slice(0, 3).join(", ")}`);
  if (explicitFound.length) {
    console.log(`[brand-extractor] Explicit signals: ${explicitFound.join(" | ")}`);
  }

  // ── Step 2: Fetch stylesheets ──
  const cssUrls = extractStylesheetUrls(html, pageUrl);
  console.log(`[brand-extractor] Found ${cssUrls.length} external stylesheets`);
  const externalCSS = await fetchExternalStylesheets(cssUrls);
  console.log(`[brand-extractor] Fetched ${externalCSS.length} stylesheets (${externalCSS.reduce((a, c) => a + c.length, 0)} chars total)`);

  // Also scan external CSS for custom properties
  for (const sheet of externalCSS) {
    const propRe = /--(brand|primary|main|accent|theme)[-_]?(?:color|colour)?(?:[-_]\w+)?:\s*([^;}]+)/gi;
    let m: RegExpExecArray | null;
    while ((m = propRe.exec(sheet)) !== null) {
      const hex = parseColorToHex(m[2].trim());
      if (hex && !isNearWhite(hex) && !isGray(hex) && !explicitSignals.cssCustomProps.includes(hex)) {
        explicitSignals.cssCustomProps.push(hex);
      }
    }
  }

  // ── Step 3: Logo/favicon analysis ──
  const combinedHtml = html + "\n<style>\n" + externalCSS.join("\n") + "\n</style>";
  const logos = extractLogos(html, pageUrl);
  const fetchedLogos = await fetchLogoData(logos);
  const logoColours = extractLogoColours(html, fetchedLogos);
  if (logoColours.length > 0) {
    console.log(`[brand-extractor] Logo colours extracted: ${logoColours.join(", ")}`);
  }

  // ── Step 4: CSS frequency analysis with computed color weighting ──
  const colors = extractColors(combinedHtml, externalCSS, logoColours, computedColors);

  // ── Step 5: Apply cascading override ──
  // Prefer the first CHROMATIC explicit signal (has actual hue/saturation)
  // Fall back to achromatic only if no chromatic signal exists
  const allExplicit = [
    explicitSignals.themeColor,
    explicitSignals.manifestColor,
    explicitSignals.tileColor,
    ...(explicitSignals.cssCustomProps),
  ].filter(Boolean) as string[];

  const chromaticExplicit = allExplicit.filter(h => !isNearWhite(h) && !isNearBlack(h) && !isGray(h));
  const achromaticExplicit = allExplicit.filter(h => isNearWhite(h) || isNearBlack(h) || isGray(h));

  // Chromatic explicit signal wins; fall back to achromatic if none
  const cascadePrimary = chromaticExplicit[0] || achromaticExplicit[0] || null;

  if (cascadePrimary) {
    const info = toColorInfo(cascadePrimary, "css");
    if (info) {
      // Only override if the explicit signal is chromatic (not black/white)
      // For monochrome explicit signals, keep them but check for a secondary chromatic colour
      const isChromatic = !isNearWhite(cascadePrimary) && !isNearBlack(cascadePrimary) && !isGray(cascadePrimary);
      if (isChromatic) {
        console.log(`[brand-extractor] Cascade override: primary set to ${cascadePrimary} (explicit signal)`);
        // Push existing primary to secondary if it's different
        if (colors.primary && colors.primary.hex !== cascadePrimary) {
          if (!colors.secondary || colors.secondary.hex === colors.primary.hex) {
            colors.secondary = colors.primary;
          }
        }
        colors.primary = info;
      } else {
        // Monochrome explicit signal (black/white)
        // Only use as primary if there's no chromatic CSS colour already extracted
        if (colors.primary && !isNearWhite(colors.primary.hex) && !isNearBlack(colors.primary.hex) && !isGray(colors.primary.hex)) {
          // CSS already found a chromatic primary - keep it, don't override with monochrome
          console.log(`[brand-extractor] Cascade: monochrome signal (${cascadePrimary}) skipped - keeping chromatic CSS primary ${colors.primary.hex}`);
        } else {
          console.log(`[brand-extractor] Cascade: monochrome brand detected (${cascadePrimary}), no chromatic CSS primary found`);
          if (colors.primary) {
            colors.accent = colors.accent || colors.primary;
          }
          colors.primary = info;
        }
      }
    }
  }

  // Second explicit signal becomes secondary if available
  const cascadeSecondary =
    (explicitSignals.cssCustomProps.length > 1 ? explicitSignals.cssCustomProps[1] : null) ||
    (explicitSignals.themeColor && explicitSignals.manifestColor && explicitSignals.manifestColor !== explicitSignals.themeColor ? explicitSignals.manifestColor : null);
  if (cascadeSecondary && cascadeSecondary !== cascadePrimary) {
    const info = toColorInfo(cascadeSecondary, "css");
    if (info && !isGray(cascadeSecondary)) {
      colors.secondary = info;
    }
  }

  // Add explicit signals to the "Brand Colors" section for display
  const explicitBrandInfos: ColorInfo[] = [];
  for (const hex of [explicitSignals.themeColor, explicitSignals.manifestColor, explicitSignals.tileColor, ...explicitSignals.cssCustomProps]) {
    if (hex && !isGray(hex)) {
      const info = toColorInfo(hex, "css");
      if (info && !explicitBrandInfos.some(e => e.hex === hex)) explicitBrandInfos.push(info);
    }
  }
  if (explicitBrandInfos.length > 0) {
    const existingBrand = colors.sections.find(s => s.label === "Brand Colors");
    if (existingBrand) {
      // Prepend explicit colours (deduped)
      const existingHexes = new Set(existingBrand.colors.map(c => c.hex));
      const newOnes = explicitBrandInfos.filter(c => !existingHexes.has(c.hex));
      existingBrand.colors = [...newOnes, ...existingBrand.colors];
    } else {
      colors.sections.unshift({ label: "Brand Colors", colors: explicitBrandInfos });
    }
  }

  console.log(`[brand-extractor] Final: primary=${colors.primary?.hex || "none"}, secondary=${colors.secondary?.hex || "none"}, accent=${colors.accent?.hex || "none"}`);

  const fonts = extractFonts(combinedHtml);
  const result: BrandData = { colors, fonts, logos: fetchedLogos };

  // ── Cache write ──
  if (analytics && domain) {
    analytics.setBrandCache(domain, {
      domain,
      url: pageUrl,
      colors: {
        primary: colors.primary?.hex || "",
        secondary: colors.secondary?.hex,
        accent: colors.accent?.hex,
        all: colors.all.map(c => ({ hex: c.hex, frequency: 0, logoBonus: 0, label: c.source })),
      },
      fonts: {
        heading: fonts.heading ? { family: fonts.heading.family, weight: fonts.heading.weights?.[0], source: fonts.heading.source } : undefined,
        body: fonts.body ? { family: fonts.body.family, weight: fonts.body.weights?.[0], source: fonts.body.source } : undefined,
      },
      logoUrl: fetchedLogos[0]?.url,
      sectionTypes: colors.sections.map(s => s.label),
      extractedAt: new Date().toISOString(),
      lastUsed: new Date().toISOString(),
      useCount: 1,
    }).catch(err => console.warn(`[brand-extractor] Cache write failed for ${domain}:`, err instanceof Error ? err.message : err));
  }

  return result;
}
