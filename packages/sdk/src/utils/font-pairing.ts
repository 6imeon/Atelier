/**
 * Font Pairing Network
 *
 * Validates heading + body font pairs and suggests better alternatives
 * when the extracted pair scores below threshold.
 *
 * Based on: Hanyang University (2024) — NMF-based font pairing network
 * Top findings: serif + sans-serif pairs work best when sharing x-height proportions.
 *
 * The pairing map encodes proven combinations used by top design systems.
 */

// ─── Pairing adjacency map ───
// Each font maps to an array of good pairing partners (order = preference)
// Pairs are bidirectional: if A pairs with B, B pairs with A

const PAIR_MAP: Record<string, string[]> = {
  // Geometric sans-serif
  "montserrat":       ["merriweather", "lora", "source serif pro", "eb garamond", "roboto slab", "open sans"],
  "poppins":          ["lora", "merriweather", "source serif pro", "playfair display", "inter", "dm sans"],
  "raleway":          ["lora", "merriweather", "roboto", "open sans", "source sans"],
  "dm sans":          ["dm serif display", "dm serif text", "fraunces", "newsreader", "inter"],
  "outfit":           ["source serif pro", "lora", "newsreader", "inter"],
  "space grotesk":    ["space mono", "inter", "newsreader", "source serif pro"],
  "plus jakarta sans":["source serif pro", "lora", "newsreader", "inter", "dm serif display"],
  "sora":             ["source serif pro", "newsreader", "inter", "lora"],
  "urbanist":         ["lora", "source serif pro", "inter", "playfair display"],

  // Humanist sans-serif
  "inter":            ["playfair display", "lora", "merriweather", "source serif pro", "eb garamond", "newsreader", "fraunces", "cormorant garamond"],
  "open sans":        ["lora", "merriweather", "playfair display", "oswald", "raleway", "source serif pro"],
  "lato":             ["merriweather", "lora", "playfair display", "source serif pro"],
  "nunito":           ["lora", "merriweather", "playfair display", "eb garamond"],
  "work sans":        ["lora", "source serif pro", "merriweather", "bitter"],
  "rubik":            ["lora", "source serif pro", "merriweather", "roboto slab"],
  "manrope":          ["lora", "source serif pro", "playfair display", "newsreader"],
  "source sans":      ["source serif pro", "merriweather", "lora", "playfair display"],
  "figtree":          ["source serif pro", "lora", "newsreader", "dm serif display"],
  "satoshi":          ["source serif pro", "newsreader", "lora", "fraunces"],

  // Neo-grotesque
  "helvetica":        ["times new roman", "georgia", "garamond", "baskerville", "playfair display"],
  "arial":            ["georgia", "times new roman", "merriweather", "lora"],
  "roboto":           ["roboto slab", "lora", "merriweather", "playfair display", "source serif pro"],
  "neue haas grotesk":["playfair display", "eb garamond", "cormorant garamond", "lora"],

  // Serif — as heading fonts
  "playfair display":  ["inter", "lato", "open sans", "raleway", "source sans", "work sans", "manrope"],
  "lora":             ["inter", "open sans", "lato", "montserrat", "poppins", "work sans", "nunito", "rubik"],
  "merriweather":     ["inter", "open sans", "lato", "montserrat", "poppins", "source sans"],
  "source serif pro": ["inter", "source sans", "open sans", "work sans", "dm sans", "plus jakarta sans"],
  "eb garamond":      ["inter", "lato", "open sans", "montserrat", "nunito"],
  "cormorant garamond":["inter", "lato", "montserrat", "manrope"],
  "dm serif display": ["dm sans", "inter", "figtree", "plus jakarta sans"],
  "fraunces":         ["inter", "dm sans", "figtree", "satoshi"],
  "newsreader":       ["inter", "source sans", "dm sans", "space grotesk", "outfit", "manrope"],
  "bitter":           ["work sans", "open sans", "inter", "source sans"],
  "roboto slab":      ["roboto", "open sans", "montserrat", "rubik"],
  "georgia":          ["arial", "helvetica", "inter", "open sans"],

  // Display/specialty — as heading fonts
  "oswald":           ["open sans", "lato", "merriweather", "source sans"],
  "bebas neue":       ["inter", "open sans", "lato", "montserrat"],
  "antonio":          ["inter", "lato", "open sans"],
  "archivo black":    ["inter", "work sans", "open sans"],

  // Monospace
  "jetbrains mono":   ["inter", "source sans", "dm sans", "work sans"],
  "fira code":        ["inter", "source sans", "dm sans"],
  "space mono":       ["space grotesk", "inter", "dm sans"],
  "ibm plex mono":    ["ibm plex sans", "inter", "source sans"],
};

export interface PairingResult {
  heading: string;
  body: string;
  score: number;        // 0-1, 1 = perfect match
  isValid: boolean;     // score >= threshold
  suggestion?: {        // only if isValid is false
    body: string;
    reason: string;
  };
}

/**
 * Validate a heading + body font pair.
 * Returns a score (0-1) and an optional suggestion if the pair is weak.
 */
export function validatePairing(heading: string, body: string, threshold = 0.4): PairingResult {
  const h = heading.toLowerCase().trim();
  const b = body.toLowerCase().trim();

  // Same font family — always valid (weight/size differentiation is fine)
  if (h === b) {
    return { heading, body, score: 0.7, isValid: true };
  }

  // Check direct pairing
  const headingPairs = findPairs(h);
  const bodyPairs = findPairs(b);

  // Heading → body direction
  if (headingPairs.length > 0) {
    const idx = headingPairs.findIndex(p => matchFont(p, b));
    if (idx >= 0) {
      const score = 1 - (idx / headingPairs.length) * 0.5; // first = 1.0, last = 0.5
      return { heading, body, score, isValid: true };
    }
  }

  // Body → heading direction (reverse lookup)
  if (bodyPairs.length > 0) {
    const idx = bodyPairs.findIndex(p => matchFont(p, h));
    if (idx >= 0) {
      const score = 1 - (idx / bodyPairs.length) * 0.5;
      return { heading, body, score, isValid: true };
    }
  }

  // No direct pairing found — check category compatibility
  const hCat = classifyFont(h);
  const bCat = classifyFont(b);
  const catScore = categoryCompatibility(hCat, bCat);

  if (catScore >= threshold) {
    return { heading, body, score: catScore, isValid: true };
  }

  // Below threshold — suggest a better body font
  const suggestion = suggestBody(h, b);
  return {
    heading, body,
    score: catScore,
    isValid: false,
    suggestion,
  };
}

/**
 * Suggest the best body font for a given heading font.
 */
export function suggestBody(heading: string, currentBody?: string): { body: string; reason: string } {
  const h = heading.toLowerCase().trim();
  const pairs = findPairs(h);

  if (pairs.length > 0) {
    const best = pairs[0];
    return { body: titleCase(best), reason: `Top-rated pairing for ${heading}` };
  }

  // Fallback: suggest based on category contrast
  const hCat = classifyFont(h);
  if (hCat?.includes("serif") && !hCat.includes("sans")) {
    return { body: "Inter", reason: "Clean sans-serif pairs well with serif headings" };
  }
  if (hCat?.includes("sans")) {
    return { body: "Source Serif Pro", reason: "Serif body adds contrast to sans-serif headings" };
  }
  return { body: "Inter", reason: "Versatile sans-serif, pairs with most heading fonts" };
}

// ─── Helpers ───

function findPairs(font: string): string[] {
  if (PAIR_MAP[font]) return PAIR_MAP[font];
  // Partial match
  for (const [name, pairs] of Object.entries(PAIR_MAP)) {
    if (font.includes(name) || name.includes(font)) return pairs;
  }
  return [];
}

function matchFont(a: string, b: string): boolean {
  return a === b || a.includes(b) || b.includes(a);
}

type FontCat = "serif" | "sans-serif" | "monospace" | "display" | null;

function classifyFont(font: string): FontCat {
  if (/serif/i.test(font) && !/sans/i.test(font)) return "serif";
  if (/sans|inter|roboto|lato|open|work|nunito|montserrat|poppins|dm\s|outfit|manrope|figtree|urbanist|satoshi|sora|raleway|rubik|source\ssans|helvetica|arial/i.test(font)) return "sans-serif";
  if (/mono|code|consolas/i.test(font)) return "monospace";
  if (/oswald|bebas|anton|impact|archivo black/i.test(font)) return "display";
  return null;
}

function categoryCompatibility(a: FontCat, b: FontCat): number {
  if (!a || !b) return 0.3; // unknown — mild score
  if (a === b) return 0.5; // same category — ok but not ideal
  // Contrasting categories score higher
  if ((a === "serif" && b === "sans-serif") || (a === "sans-serif" && b === "serif")) return 0.6;
  if ((a === "display" && b === "sans-serif") || (a === "sans-serif" && b === "display")) return 0.5;
  if ((a === "display" && b === "serif") || (a === "serif" && b === "display")) return 0.45;
  if (a === "monospace" || b === "monospace") return 0.35;
  return 0.3;
}

function titleCase(s: string): string {
  return s.replace(/\b\w/g, c => c.toUpperCase());
}
