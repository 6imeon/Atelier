/**
 * Persona system for design generation.
 * Loads persona files from disk and auto-matches based on brand/industry signals.
 */
import { readFileSync, readdirSync, existsSync } from "fs";
import { resolve } from "path";
import type { ExtractedColors, ExtractedFonts } from "./brand-extractor.js";
import type { BusinessInfo, Sector, Tone } from "./business-info.js";

export interface Persona {
  id: string;
  name: string; // Designer name from the file
  content: string; // Full markdown content
}

// ─── Loading ────────────────────────────────────────────────────────

let _cachedPersonas: Persona[] | null = null;

/**
 * Find the personas directory. Checks multiple locations since the file
 * could be running from dist/ or src/ or the project root.
 */
function findPersonasDir(): string | null {
  const candidates = [
    resolve(process.cwd(), "scripts/personas"),
    resolve(process.cwd(), "../../scripts/personas"),
    resolve(process.cwd(), "../../../scripts/personas"),
  ];
  // Also try relative to this file (CommonJS)
  try {
    candidates.push(resolve(__dirname, "../../../../scripts/personas"));
    candidates.push(resolve(__dirname, "../../../scripts/personas"));
  } catch {}

  for (const dir of candidates) {
    if (existsSync(dir)) return dir;
  }
  return null;
}

export function loadPersonas(): Persona[] {
  if (_cachedPersonas) return _cachedPersonas;

  const dir = findPersonasDir();
  if (!dir) {
    console.log(`[personas] No personas directory found, using defaults`);
    _cachedPersonas = [];
    return [];
  }

  const files = readdirSync(dir).filter(f => f.endsWith(".md"));
  _cachedPersonas = files.map(f => {
    const content = readFileSync(resolve(dir, f), "utf-8");
    const nameMatch = content.match(/\*\*Name:\*\*\s*(.+)/);
    return {
      id: f.replace(".md", ""),
      name: nameMatch?.[1]?.trim() || f.replace(".md", ""),
      content,
    };
  });

  console.log(`[personas] Loaded ${_cachedPersonas.length} personas: ${_cachedPersonas.map(p => p.id).join(", ")}`);
  return _cachedPersonas;
}

export function getPersonaById(id: string): Persona | null {
  return loadPersonas().find(p => p.id === id) || null;
}

// ─── Auto-matching ──────────────────────────────────────────────────

interface BrandSignals {
  url?: string;
  brandName?: string;
  colors?: ExtractedColors;
  fonts?: ExtractedFonts;
  userPrompt?: string;
  /** Structured "what does this company do" artifact produced by
   * getOrCreateBusinessInfo. When present, sector overrides the regex
   * industry classifier and tone feeds the new businessTone signal. */
  businessInfo?: BusinessInfo | null;
}

// Keywords in URLs, brand names, or prompts that suggest an industry
const INDUSTRY_KEYWORDS: Record<string, string[]> = {
  finance:       ["bank", "invest", "capital", "wealth", "fund", "trading", "fintech", "mortgage", "insurance", "credit",
                   "financial services", "asset management", "hedge fund", "venture capital", "private equity", "stock market"],
  news:          ["news", "times", "post", "herald", "tribune", "journal", "gazette", "media", "press", "editorial", "reuters", "bloomberg",
                   "breaking news", "press release", "news desk", "investigative journalism"],
  technology:    ["tech", "software", "saas", "cloud", "api", "dev", "code", "platform", "app", "digital", "data", "cyber",
                   "machine learning", "artificial intelligence", "open source", "developer tools", "tech stack"],
  healthcare:    ["health", "medical", "pharma", "clinic", "hospital", "wellness", "therapy", "biotech", "care",
                   "patient care", "clinical trial", "drug discovery", "medical device", "health insurance", "telehealth"],
  mining:        ["mining", "mineral", "ore", "extraction", "commodit", "resource",
                   "gold mining", "iron ore", "copper mining", "rare earth"],
  environmental: ["green", "sustain", "solar", "wind", "renewable", "energy", "climate", "carbon", "eco", "environment",
                   "clean energy", "carbon neutral", "net zero", "climate change", "carbon footprint"],
  realestate:    ["property", "estate", "realtor", "housing", "apartment", "home", "rent",
                   "real estate", "open house", "square feet", "property management", "home loan"],
  ecommerce:     ["shop", "store", "buy", "retail", "commerce", "product", "cart", "clothing", "brand",
                   "add to cart", "free shipping", "buy now", "shopping cart", "order tracking", "flash sale"],
  fashion:       ["fashion", "luxury", "couture", "designer", "wear", "style", "boutique", "collection",
                   "fashion week", "runway show", "ready to wear", "haute couture"],
  automotive:    ["auto", "car", "motor", "vehicle", "drive", "tesla", "bmw", "mercedes",
                   "test drive", "electric vehicle", "self driving", "car dealer"],
  food:          ["food", "cuisine", "chef", "dining", "cafe", "coffee", "bakery", "recipe",
                   "farm to table", "meal prep", "food truck", "cooking class"],
  education:     ["university", "school", "education", "learn", "course", "academy", "student", "teach",
                   "online course", "case study", "higher education", "student loan", "study abroad"],
  sports:        ["sport", "fitness", "gym", "athletic", "team", "league", "football", "soccer", "basketball",
                   "personal trainer", "workout plan", "sports league"],
  gaming:        ["gaming", "esport", "twitch",
                   "video game", "game dev", "early access", "multiplayer", "game engine"],
  legal:         ["law", "legal", "attorney", "solicitor", "barrister", "court", "justice",
                   "law firm", "legal counsel", "case law", "intellectual property"],
  government:    ["gov", "government", "council", "ministry", "department", "federal",
                   "public service", "government agency", "civil service", "public sector"],
  logistics:     ["logistics", "shipping", "freight", "warehouse", "fleet", "transport",
                   "supply chain", "last mile", "cold chain", "freight forward"],
  travel:        ["travel", "hotel", "flight", "booking", "vacation", "tourism", "destination", "airbnb",
                   "travel guide", "all inclusive", "travel insurance", "package holiday"],
  culture:       ["museum", "gallery", "culture", "exhibit", "creative",
                   "art gallery", "design studio", "contemporary art", "visual arts", "fine art"],
  music:         ["music", "record", "album", "concert", "festival", "dj", "label", "spotify", "soundcloud",
                   "music production", "record label", "live music", "music festival"],
  hospitality:   ["hotel", "resort", "spa", "lounge", "hospitality",
                   "boutique hotel", "five star", "room service", "guest experience"],
  wellness:      ["wellness", "yoga", "meditation", "mindful", "retreat", "holistic",
                   "self care", "mental health", "wellness retreat", "sound healing"],
  architecture:  ["architect", "structure", "interior",
                   "interior design", "landscape architecture", "urban planning", "building design"],
  beauty:        ["beauty", "cosmetic", "skincare", "makeup", "fragrance", "perfume", "salon",
                   "skin care", "hair salon", "beauty brand", "clean beauty"],
  crypto:        ["crypto", "blockchain", "defi", "nft", "token", "web3", "dao", "ethereum", "bitcoin",
                   "smart contract", "decentralized finance", "crypto exchange", "token sale"],
  aerospace:     ["aerospace", "satellite", "rocket", "aviation", "nasa", "orbit", "launch",
                   "space exploration", "launch vehicle", "mission control", "space station"],
  publishing:    ["publish", "book", "magazine", "literary", "author", "editor",
                   "book review", "best seller", "publishing house", "literary agent"],
  nonprofit:     ["nonprofit", "charity", "foundation", "ngo", "donate", "cause", "aid",
                   "social impact", "make a difference", "community outreach", "volunteer program"],
  restaurant:    ["restaurant", "bistro", "diner", "eatery", "menu", "gastro",
                   "fine dining", "tasting menu", "wine list", "table reservation"],
  alcohol:       ["alcohol", "wine", "winery", "vineyard", "brewery", "beer", "craft beer", "spirits", "whiskey",
                   "whisky", "vodka", "gin", "rum", "tequila", "cocktail", "distillery", "liquor", "champagne",
                   "sommelier", "barrel aged", "single malt", "craft spirits", "taproom", "cellar"],
  film:          ["film", "movie", "cinema", "production", "director", "trailer",
                   "film production", "box office", "film festival", "short film", "film studio"],
};

// Industry → best persona matches (first = strongest match)
const INDUSTRY_PERSONA_MAP: Record<string, string[]> = {
  finance:       ["corporate-precision", "neoclassical-institutional", "swiss-international", "fintech-gradient"],
  news:          ["editorial-magazine", "new-york-editorial", "corporate-precision", "swiss-international"],
  mining:        ["corporate-precision", "utility-industrial", "swiss-international"],
  environmental: ["solarpunk", "organic-biomorphic", "warm-nude", "japanese-minimalism"],
  technology:    ["bold-modern", "swiss-international", "bauhaus-functional", "techno-minimal"],
  healthcare:    ["healthcare-modern", "corporate-precision", "warm-nude", "organic-biomorphic"],
  realestate:    ["warm-nude", "art-deco-revival", "coastal-mediterranean", "nordic-noir"],
  ecommerce:     ["warm-nude", "mid-century-modern", "pop-art-digital", "kpop-maximalism"],
  fashion:       ["editorial-luxury", "japanese-minimalism", "streetwear-culture", "nordic-noir"],
  automotive:    ["editorial-luxury", "bold-modern", "noir-detective", "space-agency"],
  food:          ["warm-nude", "mid-century-modern", "cottagecore-digital", "retro-diner"],
  education:     ["dark-academia", "swiss-international", "memphis-postmodern", "scandinavian-clean"],
  sports:        ["sports-dynamic", "bold-modern", "constructivist", "pop-art-digital"],
  gaming:        ["cyberpunk-futurism", "bold-modern", "memphis-postmodern", "afrofuturism"],
  legal:         ["neoclassical-institutional", "corporate-precision", "swiss-international"],
  government:    ["swiss-international", "neoclassical-institutional", "utility-industrial", "space-agency"],
  logistics:     ["utility-industrial", "bauhaus-functional", "bold-modern", "space-agency"],
  travel:        ["coastal-mediterranean", "tropical-modernism", "warm-nude", "art-deco-revival"],
  culture:       ["african-contemporary", "brutalist-digital", "editorial-magazine", "wabi-sabi"],
  music:         ["techno-minimal", "kpop-maximalism", "psychedelic-revival", "afrofuturism"],
  hospitality:   ["art-deco-revival", "coastal-mediterranean", "neo-miami", "nordic-noir"],
  wellness:      ["japanese-minimalism", "wabi-sabi", "apothecary-botanical", "organic-biomorphic"],
  architecture:  ["nordic-noir", "constructivist", "swiss-international", "wabi-sabi"],
  beauty:        ["warm-nude", "cottagecore-digital", "kpop-maximalism", "art-nouveau-digital"],
  crypto:        ["cyberpunk-futurism", "fintech-gradient", "bold-modern", "space-agency"],
  aerospace:     ["space-agency", "utility-industrial", "bold-modern", "cyberpunk-futurism"],
  publishing:    ["new-york-editorial", "editorial-magazine", "dark-academia", "neoclassical-institutional"],
  nonprofit:     ["solarpunk", "warm-nude", "african-contemporary", "organic-biomorphic"],
  restaurant:    ["warm-nude", "retro-diner", "moroccan-zellige", "tropical-modernism"],
  alcohol:       ["editorial-luxury", "art-deco-revival", "rustic-artisan", "noir-detective"],
  film:          ["noir-detective", "editorial-luxury", "kinetic-typography", "gothic-revival"],
};

// ─── Font Classification ─────────────────────────────────────────────

type FontCategory = "geometric-sans" | "humanist-sans" | "modern-serif" | "transitional-serif" | "slab-serif" | "monospace" | "display" | "handwriting";

// Classify a font family name into one of 8 categories
const FONT_CLASSIFICATION: Record<string, FontCategory> = {
  // Geometric sans-serif
  "futura": "geometric-sans", "century gothic": "geometric-sans", "avenir": "geometric-sans",
  "montserrat": "geometric-sans", "poppins": "geometric-sans", "raleway": "geometric-sans",
  "quicksand": "geometric-sans", "comfortaa": "geometric-sans", "josefin sans": "geometric-sans",
  "spartan": "geometric-sans", "dm sans": "geometric-sans", "outfit": "geometric-sans",
  "plus jakarta sans": "geometric-sans", "space grotesk": "geometric-sans", "urbanist": "geometric-sans",
  "lexend": "geometric-sans", "sora": "geometric-sans", "red hat display": "geometric-sans",

  // Humanist sans-serif
  "gill sans": "humanist-sans", "frutiger": "humanist-sans", "myriad": "humanist-sans",
  "open sans": "humanist-sans", "lato": "humanist-sans", "nunito": "humanist-sans",
  "rubik": "humanist-sans", "work sans": "humanist-sans", "source sans": "humanist-sans",
  "inter": "humanist-sans", "manrope": "humanist-sans", "albert sans": "humanist-sans",
  "be vietnam pro": "humanist-sans", "figtree": "humanist-sans", "general sans": "humanist-sans",
  "cabinet grotesk": "humanist-sans", "satoshi": "humanist-sans", "switzer": "humanist-sans",

  // Modern serif (high contrast, thin serifs)
  "didot": "modern-serif", "bodoni": "modern-serif", "playfair display": "modern-serif",
  "cormorant": "modern-serif", "noto serif display": "modern-serif", "yeseva one": "modern-serif",
  "dm serif display": "modern-serif", "fraunces": "modern-serif",

  // Transitional serif
  "times": "transitional-serif", "times new roman": "transitional-serif", "georgia": "transitional-serif",
  "baskerville": "transitional-serif", "libre baskerville": "transitional-serif",
  "lora": "transitional-serif", "merriweather": "transitional-serif", "noto serif": "transitional-serif",
  "source serif": "transitional-serif", "crimson text": "transitional-serif",
  "crimson pro": "transitional-serif", "pt serif": "transitional-serif",
  "eb garamond": "transitional-serif", "cormorant garamond": "transitional-serif",

  // Slab serif
  "rockwell": "slab-serif", "courier": "slab-serif", "roboto slab": "slab-serif",
  "arvo": "slab-serif", "zilla slab": "slab-serif", "bitter": "slab-serif",
  "crete round": "slab-serif", "alfa slab one": "slab-serif",

  // Monospace
  "courier new": "monospace", "consolas": "monospace", "fira code": "monospace",
  "jetbrains mono": "monospace", "source code pro": "monospace", "ibm plex mono": "monospace",
  "space mono": "monospace", "roboto mono": "monospace", "dm mono": "monospace",

  // Display / expressive
  "impact": "display", "anton": "display", "bebas neue": "display", "oswald": "display",
  "archivo black": "display", "black ops one": "display", "righteous": "display",
  "permanent marker": "display", "bungee": "display", "press start 2p": "display",
  "monoton": "display", "six caps": "display", "passion one": "display",

  // Handwriting / script
  "dancing script": "handwriting", "pacifico": "handwriting", "lobster": "handwriting",
  "great vibes": "handwriting", "sacramento": "handwriting", "allura": "handwriting",
  "kaushan script": "handwriting", "caveat": "handwriting", "indie flower": "handwriting",
  "patrick hand": "handwriting", "amatic sc": "handwriting",
};

// Map font categories to persona affinities (first = strongest)
const FONT_PERSONA_AFFINITY: Record<FontCategory, string[]> = {
  "geometric-sans":    ["swiss-international", "bauhaus-functional", "bold-modern", "corporate-precision", "techno-minimal"],
  "humanist-sans":     ["warm-nude", "organic-biomorphic", "solarpunk", "cottagecore-digital", "mid-century-modern"],
  "modern-serif":      ["editorial-luxury", "new-york-editorial", "editorial-magazine", "art-deco-revival", "nordic-noir"],
  "transitional-serif": ["neoclassical-institutional", "corporate-precision", "nautical-heritage", "gothic-revival"],
  "slab-serif":        ["utility-industrial", "constructivist", "brutalist-digital", "desert-southwest"],
  "monospace":         ["techno-minimal", "cyberpunk-futurism", "brutalist-digital", "space-agency"],
  "display":           ["bold-modern", "pop-art-digital", "kpop-maximalism", "memphis-postmodern", "kinetic-typography"],
  "handwriting":       ["cottagecore-digital", "wabi-sabi", "warm-nude", "art-nouveau-digital"],
};

export function classifyFont(fontFamily: string): FontCategory | null {
  const lower = fontFamily.toLowerCase().replace(/['",]/g, "").trim();
  // Direct lookup
  if (FONT_CLASSIFICATION[lower]) return FONT_CLASSIFICATION[lower];
  // Partial match (e.g. "Playfair Display" in "Playfair Display, serif")
  for (const [name, cat] of Object.entries(FONT_CLASSIFICATION)) {
    if (lower.includes(name) || name.includes(lower)) return cat;
  }
  // Heuristic fallback based on generic family
  if (/\bserif\b/.test(lower) && !/\bsans\b/.test(lower)) return "transitional-serif";
  if (/\bsans\b/.test(lower)) return "humanist-sans";
  if (/\bmono\b/.test(lower)) return "monospace";
  return null;
}

// Get persona affinities from extracted fonts
export function matchPersonaByFonts(fonts: ExtractedFonts): string[] {
  const candidates: string[] = [];
  const fontNames = [fonts.heading?.family, fonts.body?.family].filter(Boolean) as string[];

  for (const name of fontNames) {
    const cat = classifyFont(name);
    if (cat && FONT_PERSONA_AFFINITY[cat]) {
      candidates.push(...FONT_PERSONA_AFFINITY[cat]);
    }
  }
  return candidates;
}

// ─── Aaker Brand Personality Dimensions ──────────────────────────────
// Based on Aaker (1997) — 5 dimensions of brand personality.
// Each vector: [Sincerity, Excitement, Competence, Sophistication, Ruggedness]

export type AakerVector = [number, number, number, number, number];
export const AAKER_LABELS = ["sincerity", "excitement", "competence", "sophistication", "ruggedness"] as const;

// Pre-scored Aaker vectors for all 42 personas (3.1)
export const PERSONA_AAKER_VECTORS: Record<string, AakerVector> = {
  "warm-nude":                  [0.8, 0.2, 0.4, 0.6, 0.1],
  "bold-modern":                [0.2, 0.8, 0.5, 0.3, 0.4],
  "corporate-precision":        [0.4, 0.1, 0.9, 0.5, 0.2],
  "editorial-luxury":           [0.2, 0.3, 0.5, 0.9, 0.1],
  "swiss-international":        [0.3, 0.2, 0.8, 0.6, 0.2],
  "minimal-editorial":          [0.3, 0.2, 0.6, 0.8, 0.1],
  "brutalist-digital":          [0.1, 0.6, 0.3, 0.2, 0.8],
  "japanese-minimalism":        [0.6, 0.1, 0.5, 0.7, 0.2],
  "memphis-postmodern":         [0.3, 0.9, 0.2, 0.2, 0.3],
  "art-deco-revival":           [0.3, 0.4, 0.5, 0.9, 0.2],
  "bauhaus-functional":         [0.3, 0.3, 0.8, 0.5, 0.3],
  "cyberpunk-futurism":         [0.1, 0.9, 0.4, 0.3, 0.5],
  "mid-century-modern":         [0.5, 0.4, 0.5, 0.6, 0.2],
  "african-contemporary":       [0.5, 0.6, 0.3, 0.5, 0.4],
  "retro-computing":            [0.3, 0.6, 0.4, 0.1, 0.3],
  "organic-biomorphic":         [0.7, 0.4, 0.4, 0.4, 0.3],
  "editorial-magazine":         [0.3, 0.4, 0.6, 0.7, 0.1],
  "neoclassical-institutional": [0.4, 0.1, 0.8, 0.7, 0.2],
  "latin-maximalism":           [0.4, 0.8, 0.2, 0.4, 0.3],
  "utility-industrial":         [0.3, 0.2, 0.6, 0.1, 0.9],
  "neo-grotesque":              [0.2, 0.3, 0.7, 0.5, 0.3],
  "sports-dynamic":             [0.3, 0.9, 0.5, 0.1, 0.6],
  "nordic-noir":                [0.2, 0.3, 0.6, 0.8, 0.3],
  "tropical-modernism":         [0.6, 0.6, 0.3, 0.4, 0.3],
  "art-nouveau-digital":        [0.5, 0.4, 0.4, 0.8, 0.2],
  "constructivist":             [0.2, 0.7, 0.5, 0.3, 0.6],
  "coastal-mediterranean":      [0.7, 0.4, 0.3, 0.5, 0.2],
  "gothic-revival":             [0.2, 0.5, 0.4, 0.7, 0.5],
  "kinetic-typography":         [0.2, 0.7, 0.5, 0.5, 0.2],
  "desert-southwest":           [0.5, 0.3, 0.3, 0.3, 0.8],
  "techno-minimal":             [0.1, 0.5, 0.7, 0.5, 0.2],
  "cottagecore-digital":        [0.9, 0.3, 0.2, 0.3, 0.3],
  "afrofuturism":               [0.3, 0.8, 0.4, 0.5, 0.4],
  "wabi-sabi":                  [0.8, 0.1, 0.3, 0.6, 0.4],
  "pop-art-digital":            [0.3, 0.9, 0.2, 0.2, 0.2],
  "nautical-heritage":          [0.5, 0.3, 0.6, 0.5, 0.6],
  "kpop-maximalism":            [0.3, 0.9, 0.2, 0.3, 0.1],
  "noir-detective":             [0.1, 0.4, 0.5, 0.7, 0.5],
  "solarpunk":                  [0.7, 0.6, 0.5, 0.3, 0.3],
  "moroccan-zellige":           [0.5, 0.5, 0.3, 0.7, 0.4],
  "space-agency":               [0.2, 0.6, 0.8, 0.4, 0.4],
  "new-york-editorial":         [0.2, 0.4, 0.6, 0.8, 0.1],
  "apothecary-botanical":       [0.7, 0.2, 0.5, 0.7, 0.3],
  "streetwear-culture":         [0.2, 0.9, 0.3, 0.4, 0.6],
  "scandinavian-clean":         [0.6, 0.2, 0.7, 0.7, 0.2],
  "dark-academia":              [0.4, 0.2, 0.7, 0.8, 0.3],
  "retro-diner":                [0.6, 0.8, 0.3, 0.2, 0.3],
  "healthcare-modern":          [0.6, 0.2, 0.9, 0.4, 0.1],
  "psychedelic-revival":        [0.3, 0.9, 0.1, 0.3, 0.3],
  "fintech-gradient":           [0.2, 0.6, 0.8, 0.5, 0.2],
  "rustic-artisan":             [0.7, 0.3, 0.4, 0.3, 0.8],
  "neo-miami":                  [0.3, 0.7, 0.4, 0.8, 0.2],
};

// ─── 3.2 Color → Aaker Mapping (Labrecque & Milne 2012) ─────────────
// Maps HSL color properties to Aaker personality dimensions

function colorToAaker(colors: ExtractedColors | undefined): AakerVector | null {
  if (!colors?.primary) return null;
  const { h, s, l } = colors.primary.hsl;

  // Start with neutral vector
  const v: AakerVector = [0, 0, 0, 0, 0];

  // Hue-based contributions
  if (h >= 0 && h < 30 || h >= 330) {
    // Red/warm → Excitement + some Ruggedness
    v[1] += 0.5; v[4] += 0.2;
  } else if (h >= 30 && h < 70) {
    // Orange/yellow → Sincerity + Excitement
    v[0] += 0.5; v[1] += 0.3;
  } else if (h >= 70 && h < 160) {
    // Green → Sincerity + some Competence
    v[0] += 0.4; v[2] += 0.3;
  } else if (h >= 160 && h < 260) {
    // Blue/cyan → Competence + Sophistication
    v[2] += 0.5; v[3] += 0.3;
  } else if (h >= 260 && h < 330) {
    // Purple/magenta → Sophistication + Excitement
    v[3] += 0.4; v[1] += 0.4;
  }

  // Saturation modifiers
  if (s > 70) {
    v[1] += 0.5; // High saturation → strong Excitement (neon, vivid)
  } else if (s < 20) {
    v[3] += 0.3; // Low saturation → Sophistication (muted, refined)
  }

  // Lightness modifiers
  if (l < 20) {
    v[3] += 0.3; v[4] += 0.2; // Very dark → Sophistication + Ruggedness
  } else if (l > 80) {
    v[0] += 0.2; // Very light → Sincerity (airy, open)
  }

  // Earth tones: warm hue + medium-low sat → Ruggedness
  if (h >= 15 && h < 50 && s >= 20 && s <= 60 && l >= 25 && l <= 55) {
    v[4] += 0.4; // Earth tones → Ruggedness
    v[0] += 0.2; // Also warm/sincere
  }

  // Normalize to 0-1 range
  const max = Math.max(...v, 0.01);
  return v.map(x => x / max) as AakerVector;
}

// ─── 3.3 Font → Aaker Mapping (Shaikh et al. 2006) ──────────────────

const FONT_CATEGORY_AAKER: Record<FontCategory, AakerVector> = {
  "humanist-sans":      [0.7, 0.3, 0.5, 0.3, 0.2],  // Friendly, approachable
  "geometric-sans":     [0.2, 0.3, 0.8, 0.5, 0.2],  // Precise, systematic
  "modern-serif":       [0.2, 0.3, 0.4, 0.9, 0.1],  // Elegant, refined
  "transitional-serif": [0.4, 0.1, 0.7, 0.6, 0.3],  // Trustworthy, established
  "slab-serif":         [0.3, 0.3, 0.5, 0.2, 0.8],  // Strong, grounded
  "monospace":          [0.1, 0.4, 0.8, 0.3, 0.3],  // Technical, analytical
  "display":            [0.2, 0.9, 0.2, 0.3, 0.4],  // Bold, attention-grabbing
  "handwriting":        [0.8, 0.4, 0.1, 0.3, 0.2],  // Personal, authentic
};

function fontToAaker(fonts: ExtractedFonts | undefined): AakerVector | null {
  if (!fonts) return null;

  const entries: { name: string; weight: number }[] = [];
  if (fonts.heading?.family) entries.push({ name: fonts.heading.family, weight: 0.7 });
  if (fonts.body?.family) entries.push({ name: fonts.body.family, weight: 0.3 });
  if (entries.length === 0) return null;
  if (entries.length === 1) entries[0].weight = 1.0;

  const v: AakerVector = [0, 0, 0, 0, 0];
  let totalWeight = 0;

  for (const { name, weight } of entries) {
    const cat = classifyFont(name);
    if (!cat || !FONT_CATEGORY_AAKER[cat]) continue;
    const aaker = FONT_CATEGORY_AAKER[cat];
    for (let i = 0; i < 5; i++) v[i] += aaker[i] * weight;
    totalWeight += weight;
  }

  if (totalWeight === 0) return null;
  return v.map(x => x / totalWeight) as AakerVector;
}

// ─── 3.4 Industry → Aaker Norms ─────────────────────────────────────

const INDUSTRY_AAKER: Record<string, AakerVector> = {
  finance:       [0.3, 0.1, 0.9, 0.6, 0.2],
  news:          [0.3, 0.3, 0.7, 0.5, 0.2],
  technology:    [0.2, 0.6, 0.8, 0.4, 0.2],
  healthcare:    [0.7, 0.1, 0.8, 0.3, 0.1],
  mining:        [0.2, 0.2, 0.6, 0.1, 0.9],
  environmental: [0.7, 0.4, 0.5, 0.3, 0.3],
  realestate:    [0.5, 0.2, 0.6, 0.6, 0.2],
  ecommerce:     [0.4, 0.5, 0.5, 0.4, 0.2],
  fashion:       [0.2, 0.5, 0.3, 0.9, 0.1],
  automotive:    [0.2, 0.6, 0.6, 0.5, 0.5],
  food:          [0.7, 0.4, 0.4, 0.4, 0.2],
  education:     [0.6, 0.4, 0.7, 0.3, 0.1],
  sports:        [0.3, 0.9, 0.5, 0.1, 0.7],
  gaming:        [0.2, 0.9, 0.3, 0.2, 0.4],
  legal:         [0.3, 0.1, 0.9, 0.7, 0.2],
  government:    [0.4, 0.1, 0.8, 0.4, 0.3],
  logistics:     [0.3, 0.2, 0.7, 0.2, 0.7],
  travel:        [0.6, 0.6, 0.4, 0.5, 0.3],
  culture:       [0.5, 0.5, 0.4, 0.7, 0.2],
  music:         [0.3, 0.8, 0.3, 0.4, 0.3],
  hospitality:   [0.6, 0.3, 0.5, 0.7, 0.1],
  wellness:      [0.8, 0.2, 0.4, 0.5, 0.2],
  architecture:  [0.3, 0.3, 0.7, 0.7, 0.4],
  beauty:        [0.5, 0.4, 0.3, 0.8, 0.1],
  crypto:        [0.1, 0.8, 0.5, 0.3, 0.4],
  aerospace:     [0.2, 0.6, 0.8, 0.4, 0.5],
  publishing:    [0.4, 0.3, 0.6, 0.7, 0.1],
  nonprofit:     [0.8, 0.3, 0.5, 0.3, 0.2],
  restaurant:    [0.6, 0.4, 0.4, 0.6, 0.2],
  alcohol:       [0.3, 0.4, 0.4, 0.8, 0.4],
  film:          [0.3, 0.6, 0.4, 0.7, 0.3],
};

function industryToAaker(searchText: string): AakerVector | null {
  // Detect industries from text (same logic as scoreIndustry)
  const matched: { industry: string; strength: number }[] = [];
  for (const [industry, keywords] of Object.entries(INDUSTRY_KEYWORDS)) {
    const hits = keywords.filter(kw => {
      if (kw.includes(" ")) return searchText.includes(kw);
      return new RegExp(`\\b${kw}\\b`).test(searchText);
    }).length;
    if (hits > 0) matched.push({ industry, strength: hits / keywords.length });
  }

  if (matched.length === 0) return null;

  // Weighted average of matched industry Aaker vectors
  const v: AakerVector = [0, 0, 0, 0, 0];
  let totalStrength = 0;
  for (const { industry, strength } of matched) {
    const aaker = INDUSTRY_AAKER[industry];
    if (!aaker) continue;
    for (let i = 0; i < 5; i++) v[i] += aaker[i] * strength;
    totalStrength += strength;
  }

  if (totalStrength === 0) return null;
  return v.map(x => x / totalStrength) as AakerVector;
}

// ─── 3.5 Tone → Aaker Mapping ───────────────────────────────────────

const TONE_AAKER: Record<string, AakerVector> = {
  // Sincerity keywords
  "warm": [0.9, 0.1, 0.2, 0.3, 0.1], "friendly": [0.9, 0.2, 0.3, 0.2, 0.1],
  "welcoming": [0.8, 0.2, 0.3, 0.3, 0.1], "cozy": [0.9, 0.1, 0.2, 0.2, 0.2],
  "honest": [0.9, 0.1, 0.5, 0.2, 0.3], "sincere": [1.0, 0.1, 0.4, 0.2, 0.1],
  "wholesome": [0.9, 0.2, 0.3, 0.1, 0.2], "approachable": [0.8, 0.3, 0.3, 0.2, 0.1],
  // Excitement keywords
  "bold": [0.1, 0.9, 0.3, 0.2, 0.4], "striking": [0.1, 0.8, 0.3, 0.3, 0.4],
  "dynamic": [0.2, 0.8, 0.4, 0.2, 0.3], "energetic": [0.2, 0.9, 0.3, 0.1, 0.3],
  "vibrant": [0.3, 0.9, 0.2, 0.2, 0.2], "playful": [0.4, 0.8, 0.2, 0.1, 0.2],
  "fun": [0.4, 0.8, 0.2, 0.1, 0.1], "creative": [0.3, 0.7, 0.3, 0.4, 0.2],
  "innovative": [0.1, 0.7, 0.6, 0.3, 0.2], "futuristic": [0.1, 0.8, 0.5, 0.3, 0.3],
  // Competence keywords
  "professional": [0.3, 0.1, 0.9, 0.5, 0.2], "corporate": [0.2, 0.1, 0.9, 0.4, 0.2],
  "reliable": [0.4, 0.1, 0.8, 0.3, 0.3], "trustworthy": [0.5, 0.1, 0.9, 0.3, 0.2],
  "formal": [0.2, 0.1, 0.7, 0.7, 0.2], "clean": [0.3, 0.2, 0.7, 0.5, 0.1],
  "modern": [0.2, 0.5, 0.6, 0.5, 0.2], "minimal": [0.2, 0.2, 0.6, 0.7, 0.1],
  "simple": [0.4, 0.1, 0.6, 0.4, 0.1],
  // Sophistication keywords
  "luxury": [0.1, 0.2, 0.4, 1.0, 0.1], "elegant": [0.2, 0.2, 0.4, 0.9, 0.1],
  "premium": [0.2, 0.2, 0.5, 0.9, 0.1], "sophisticated": [0.2, 0.2, 0.5, 1.0, 0.1],
  "refined": [0.3, 0.1, 0.5, 0.9, 0.1], "editorial": [0.2, 0.3, 0.5, 0.8, 0.1],
  "classic": [0.4, 0.1, 0.6, 0.7, 0.3], "upscale": [0.2, 0.2, 0.5, 0.9, 0.1],
  // Ruggedness keywords
  "rugged": [0.2, 0.3, 0.4, 0.1, 1.0], "industrial": [0.1, 0.3, 0.5, 0.1, 0.9],
  "raw": [0.1, 0.4, 0.3, 0.1, 0.9], "tough": [0.1, 0.4, 0.3, 0.1, 0.9],
  "outdoors": [0.4, 0.4, 0.3, 0.1, 0.8], "earthy": [0.5, 0.2, 0.3, 0.2, 0.8],
  // Mixed
  "dark": [0.1, 0.4, 0.4, 0.6, 0.5], "moody": [0.1, 0.4, 0.3, 0.6, 0.5],
  "mysterious": [0.1, 0.5, 0.3, 0.7, 0.4], "retro": [0.4, 0.5, 0.3, 0.4, 0.3],
  "vintage": [0.5, 0.3, 0.3, 0.5, 0.3], "natural": [0.6, 0.3, 0.4, 0.3, 0.4],
  "organic": [0.6, 0.3, 0.3, 0.4, 0.4], "sustainable": [0.7, 0.3, 0.5, 0.3, 0.3],
};

function toneToAaker(prompt: string): AakerVector | null {
  if (!prompt) return null;
  const lower = prompt.toLowerCase();

  const v: AakerVector = [0, 0, 0, 0, 0];
  let matches = 0;

  for (const [keyword, aaker] of Object.entries(TONE_AAKER)) {
    if (!new RegExp(`\\b${keyword}\\b`).test(lower)) continue;
    for (let i = 0; i < 5; i++) v[i] += aaker[i];
    matches++;
  }

  if (matches === 0) return null;
  // Average across matched keywords
  return v.map(x => x / matches) as AakerVector;
}

// ─── URL → Aaker (via industry detection) ───────────────────────────

function urlToAaker(url: string): AakerVector | null {
  if (!url) return null;
  const lower = url.toLowerCase();

  let detectedIndustry: string | null = null;

  for (const [tld, industry] of Object.entries(TLD_INDUSTRY)) {
    if (new RegExp(`${tld.replace(".", "\\.")}(\\/|$|\\?)`).test(lower)) {
      detectedIndustry = industry;
      break;
    }
  }

  if (!detectedIndustry) {
    for (const [pattern, industry] of PATH_INDUSTRY) {
      if (pattern.test(lower)) {
        detectedIndustry = industry;
        break;
      }
    }
  }

  if (!detectedIndustry) return null;
  return INDUSTRY_AAKER[detectedIndustry] || null;
}

// ─── 3.7 CIE Lab Color Distance ─────────────────────────────────────
// Perceptual color distance using CIE76 (Euclidean in Lab space)

function hexToRgb(hex: string): [number, number, number] | null {
  const m = hex.match(/^#?([0-9a-f]{6})$/i);
  if (!m) return null;
  return [parseInt(m[1].slice(0, 2), 16), parseInt(m[1].slice(2, 4), 16), parseInt(m[1].slice(4, 6), 16)];
}

function rgbToLab(r: number, g: number, b: number): [number, number, number] {
  // sRGB → linear
  let rl = r / 255, gl = g / 255, bl = b / 255;
  rl = rl > 0.04045 ? Math.pow((rl + 0.055) / 1.055, 2.4) : rl / 12.92;
  gl = gl > 0.04045 ? Math.pow((gl + 0.055) / 1.055, 2.4) : gl / 12.92;
  bl = bl > 0.04045 ? Math.pow((bl + 0.055) / 1.055, 2.4) : bl / 12.92;

  // Linear RGB → XYZ (D65 illuminant)
  const x = (rl * 0.4124564 + gl * 0.3575761 + bl * 0.1804375) / 0.95047;
  const y = (rl * 0.2126729 + gl * 0.7151522 + bl * 0.0721750) / 1.0;
  const z = (rl * 0.0193339 + gl * 0.1191920 + bl * 0.9503041) / 1.08883;

  // XYZ → Lab
  const f = (t: number) => t > 0.008856 ? Math.cbrt(t) : (7.787 * t + 16 / 116);
  const L = 116 * f(y) - 16;
  const a = 500 * (f(x) - f(y));
  const bLab = 200 * (f(y) - f(z));
  return [L, a, bLab];
}

export function deltaE(hex1: string, hex2: string): number {
  const rgb1 = hexToRgb(hex1);
  const rgb2 = hexToRgb(hex2);
  if (!rgb1 || !rgb2) return 100; // max distance on failure
  const [L1, a1, b1] = rgbToLab(...rgb1);
  const [L2, a2, b2] = rgbToLab(...rgb2);
  return Math.sqrt((L1 - L2) ** 2 + (a1 - a2) ** 2 + (b1 - b2) ** 2);
}

// ─── Cosine Similarity ──────────────────────────────────────────────

export function cosineSimilarity(a: AakerVector, b: AakerVector): number {
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < 5; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

// ─── BusinessInfo → Aaker biases (used when signals.businessInfo set) ──
// Sourced from Aaker 5D brand-personality research: finance/legal →
// competence; luxury/fashion → sophistication; outdoor/auto → ruggedness;
// consumer/kids → sincerity; entertainment/beauty → excitement.

const SECTOR_AAKER: Record<Sector, AakerVector> = {
  finance:               [0.3, 0.1, 0.9, 0.6, 0.2],
  healthcare:            [0.7, 0.1, 0.8, 0.3, 0.1],
  ecommerce:             [0.4, 0.5, 0.5, 0.4, 0.2],
  saas:                  [0.2, 0.5, 0.8, 0.4, 0.2],
  "enterprise-tech":     [0.2, 0.3, 0.9, 0.5, 0.3],
  "creative-agency":     [0.3, 0.7, 0.4, 0.7, 0.2],
  "editorial-media":     [0.3, 0.4, 0.6, 0.7, 0.1],
  education:             [0.6, 0.3, 0.7, 0.3, 0.1],
  "food-beverage":       [0.7, 0.4, 0.4, 0.4, 0.2],
  "real-estate":         [0.5, 0.2, 0.6, 0.6, 0.2],
  "travel-hospitality":  [0.6, 0.6, 0.4, 0.5, 0.3],
  "professional-services": [0.3, 0.1, 0.9, 0.7, 0.2],
  entertainment:         [0.3, 0.9, 0.3, 0.3, 0.3],
  nonprofit:             [0.8, 0.3, 0.5, 0.3, 0.2],
  "luxury-retail":       [0.2, 0.4, 0.4, 0.95, 0.1],
  "consumer-goods":      [0.6, 0.4, 0.5, 0.3, 0.3],
  industrial:            [0.3, 0.2, 0.7, 0.1, 0.9],
  automotive:            [0.2, 0.6, 0.6, 0.5, 0.7],
  "fitness-wellness":    [0.5, 0.7, 0.6, 0.3, 0.5],
  // Consumer-brand cluster — split out of the overloaded consumer-goods bucket
  sportswear:            [0.3, 0.9, 0.7, 0.2, 0.8],
  "beauty-cosmetics":    [0.4, 0.7, 0.5, 0.85, 0.1],
  "fashion-apparel":     [0.3, 0.6, 0.5, 0.75, 0.2],
  // Tech sub-slices
  gaming:                [0.2, 0.95, 0.6, 0.3, 0.6],
  "hardware-consumer":   [0.3, 0.5, 0.9, 0.8, 0.2],
  "dev-tools":           [0.2, 0.5, 0.95, 0.5, 0.3],
  // Formal / institutional
  legal:                 [0.3, 0.05, 0.95, 0.7, 0.2],
  "government-public":   [0.6, 0.1, 0.9, 0.4, 0.2],
  // Emerging + specialty
  "crypto-web3":         [0.2, 0.8, 0.8, 0.5, 0.5],
  "logistics-shipping":  [0.3, 0.2, 0.85, 0.2, 0.85],
  "music-audio":         [0.4, 0.9, 0.5, 0.6, 0.3],
  general:               [0.3, 0.3, 0.5, 0.4, 0.3],
};

// ─── Sector → persona affinity (direct override of Aaker fusion) ───────
// When the Aaker fusion layer gets dragged toward the center by a misleading
// color/font signal (adidas → light blue → "techy" personas instead of
// sports-dynamic), we apply a direct bonus to personas that are strongly
// associated with the classified sector. Sparse by design — only encoded
// for sectors where we have clear domain knowledge. Missing entries fall
// back to pure Aaker scoring.
//
// Bonus magnitude scales with classifier confidence:
//   total += SECTOR_AFFINITY_BONUS * businessInfo.confidence
// At bonus=0.15 and conf=0.90 that's +0.135 — enough to shift a persona
// from the alternatives list to #1 without overwhelming a strong cosine match.
const SECTOR_AFFINITY_BONUS = 0.15;

const SECTOR_PERSONA_AFFINITY: Partial<Record<Sector, string[]>> = {
  sportswear:          ["sports-dynamic", "streetwear-culture", "kinetic-typography", "bold-modern"],
  "crypto-web3":       ["cyberpunk-futurism", "fintech-gradient", "neo-grotesque", "techno-minimal"],
  "dev-tools":         ["techno-minimal", "neo-grotesque", "swiss-international", "corporate-precision"],
  gaming:              ["cyberpunk-futurism", "kpop-maximalism", "pop-art-digital", "retro-computing"],
  "hardware-consumer": ["swiss-international", "neo-grotesque", "japanese-minimalism", "techno-minimal"],
};

const TONE_AAKER_BIAS: Record<Tone, AakerVector> = {
  "formal-corporate":    [0.2, 0.1, 0.9, 0.5, 0.2],
  "technical-precise":   [0.1, 0.2, 0.9, 0.3, 0.3],
  "warm-approachable":   [0.9, 0.3, 0.5, 0.2, 0.3],
  "bold-confident":      [0.2, 0.8, 0.7, 0.4, 0.6],
  "playful-energetic":   [0.6, 0.95, 0.3, 0.1, 0.2],
  "aspirational-luxury": [0.2, 0.4, 0.5, 0.95, 0.2],
  "editorial-thoughtful": [0.5, 0.3, 0.7, 0.8, 0.2],
  "neutral":             [0.3, 0.3, 0.5, 0.4, 0.2],
};

// ─── Aaker Vector Fusion ────────────────────────────────────────────
// Rebalanced to make room for businessTone (crawled-site voice) without
// letting any single signal dominate. Sums to 1.00. Industry still the
// strongest signal, but when businessInfo is present its sector comes
// from an LLM classifier instead of a keyword regex.

const AAKER_SIGNAL_WEIGHTS = {
  industry:     0.30,
  tone:         0.20,
  businessTone: 0.15,
  color:        0.15,
  font:         0.10,
  url:          0.10,
};

function fuseAakerVectors(
  vectors: { vector: AakerVector; weight: number }[]
): AakerVector {
  const v: AakerVector = [0, 0, 0, 0, 0];
  let totalWeight = 0;

  for (const { vector, weight } of vectors) {
    for (let i = 0; i < 5; i++) v[i] += vector[i] * weight;
    totalWeight += weight;
  }

  if (totalWeight === 0) return [0.2, 0.2, 0.2, 0.2, 0.2]; // neutral fallback
  return v.map(x => x / totalWeight) as AakerVector;
}

// ─── Multi-Signal Scoring Model (Aaker-based) ───────────────────────

export interface PersonaScore {
  personaId: string;
  scores: {
    industry: number;  // 0-1 (direct signal score, kept for explainability)
    color: number;     // 0-1
    font: number;      // 0-1
    tone: number;      // 0-1
    url: number;       // 0-1
  };
  aaker: AakerVector;       // persona's pre-scored Aaker vector
  brandAaker: AakerVector;  // computed brand Aaker vector
  similarity: number;       // cosine similarity (0-1)
  directBonus: number;      // strong single-signal bonus
  total: number;            // final score (similarity + directBonus)
  confidence: number;       // margin between this and runner-up (set after ranking)
}

// Direct scoring weights (kept for bonus calculation)
const SIGNAL_WEIGHTS = {
  industry: 0.35,
  color: 0.25,
  font: 0.15,
  tone: 0.15,
  url: 0.10,
};

// ─── 2.2 Industry Scoring ────────────────────────────────────────────

function scoreIndustry(searchText: string, personaId: string): number {
  // Detect all industries and their match strengths
  const industryScores: Record<string, number> = {};
  for (const [industry, keywords] of Object.entries(INDUSTRY_KEYWORDS)) {
    const matched = keywords.filter(kw => {
      if (kw.includes(" ")) return searchText.includes(kw);
      return new RegExp(`\\b${kw}\\b`).test(searchText);
    }).length;
    if (matched > 0) {
      industryScores[industry] = matched / keywords.length;
    }
  }

  // Sum the persona's affinity across all matched industries
  let score = 0;
  for (const [industry, strength] of Object.entries(industryScores)) {
    const personaList = INDUSTRY_PERSONA_MAP[industry];
    if (!personaList) continue;
    const rank = personaList.indexOf(personaId);
    if (rank === -1) continue;
    // Position-based affinity: 1st = 1.0, 2nd = 0.7, 3rd = 0.4, 4th = 0.2
    const positionWeight = [1.0, 0.7, 0.4, 0.2][rank] ?? 0.1;
    score += strength * positionWeight;
  }

  // Normalize: cap at 1.0
  return Math.min(score, 1.0);
}

// ─── 2.3 Prompt Tone Extraction ──────────────────────────────────────

// Tone keywords → persona affinities (first = strongest)
const TONE_PERSONA_AFFINITY: Record<string, string[]> = {
  // Professional / corporate
  "professional":  ["corporate-precision", "swiss-international", "neoclassical-institutional"],
  "corporate":     ["corporate-precision", "swiss-international", "neoclassical-institutional"],
  "formal":        ["neoclassical-institutional", "corporate-precision", "swiss-international"],
  "trustworthy":   ["corporate-precision", "neoclassical-institutional", "swiss-international"],
  "reliable":      ["corporate-precision", "swiss-international", "utility-industrial"],
  // Minimal / clean
  "minimal":       ["japanese-minimalism", "swiss-international", "wabi-sabi", "minimal-editorial"],
  "clean":         ["swiss-international", "japanese-minimalism", "minimal-editorial", "bauhaus-functional"],
  "simple":        ["japanese-minimalism", "swiss-international", "minimal-editorial"],
  "understated":   ["wabi-sabi", "japanese-minimalism", "nordic-noir"],
  // Bold / energetic
  "bold":          ["bold-modern", "constructivist", "pop-art-digital", "kpop-maximalism"],
  "striking":      ["bold-modern", "brutalist-digital", "constructivist"],
  "dynamic":       ["sports-dynamic", "bold-modern", "kinetic-typography"],
  "energetic":     ["sports-dynamic", "pop-art-digital", "kpop-maximalism"],
  "vibrant":       ["pop-art-digital", "kpop-maximalism", "afrofuturism", "memphis-postmodern"],
  // Luxury / elegant
  "luxury":        ["editorial-luxury", "art-deco-revival", "nordic-noir"],
  "elegant":       ["editorial-luxury", "art-deco-revival", "art-nouveau-digital"],
  "premium":       ["editorial-luxury", "nordic-noir", "art-deco-revival"],
  "sophisticated": ["editorial-luxury", "nordic-noir", "new-york-editorial"],
  "refined":       ["editorial-luxury", "neoclassical-institutional", "new-york-editorial"],
  // Playful / fun
  "playful":       ["memphis-postmodern", "pop-art-digital", "cottagecore-digital"],
  "fun":           ["memphis-postmodern", "pop-art-digital", "kpop-maximalism"],
  "quirky":        ["memphis-postmodern", "brutalist-digital", "pop-art-digital"],
  "creative":      ["memphis-postmodern", "afrofuturism", "kinetic-typography"],
  // Warm / friendly
  "warm":          ["warm-nude", "cottagecore-digital", "mid-century-modern"],
  "friendly":      ["warm-nude", "organic-biomorphic", "cottagecore-digital"],
  "welcoming":     ["warm-nude", "cottagecore-digital", "organic-biomorphic"],
  "cozy":          ["cottagecore-digital", "warm-nude", "wabi-sabi"],
  // Editorial / magazine
  "editorial":     ["editorial-magazine", "new-york-editorial", "editorial-luxury"],
  "magazine":      ["editorial-magazine", "new-york-editorial", "editorial-luxury"],
  "journalistic":  ["editorial-magazine", "new-york-editorial", "swiss-international"],
  // Tech / futuristic
  "futuristic":    ["cyberpunk-futurism", "space-agency", "techno-minimal"],
  "modern":        ["bold-modern", "techno-minimal", "swiss-international"],
  "innovative":    ["bold-modern", "techno-minimal", "space-agency"],
  "cutting-edge":  ["cyberpunk-futurism", "techno-minimal", "bold-modern"],
  // Natural / organic
  "natural":       ["organic-biomorphic", "solarpunk", "wabi-sabi"],
  "organic":       ["organic-biomorphic", "wabi-sabi", "solarpunk"],
  "earthy":        ["desert-southwest", "wabi-sabi", "warm-nude"],
  "sustainable":   ["solarpunk", "organic-biomorphic", "warm-nude"],
  // Dark / moody
  "dark":          ["noir-detective", "nordic-noir", "cyberpunk-futurism"],
  "moody":         ["noir-detective", "nordic-noir", "gothic-revival"],
  "mysterious":    ["noir-detective", "gothic-revival", "nordic-noir"],
  // Retro / vintage
  "retro":         ["mid-century-modern", "art-deco-revival", "memphis-postmodern"],
  "vintage":       ["mid-century-modern", "art-deco-revival", "cottagecore-digital"],
  "classic":       ["neoclassical-institutional", "nautical-heritage", "art-deco-revival"],
  // Industrial / rugged
  "industrial":    ["utility-industrial", "brutalist-digital", "constructivist"],
  "rugged":        ["utility-industrial", "desert-southwest", "brutalist-digital"],
  "raw":           ["brutalist-digital", "utility-industrial", "constructivist"],
};

function scoreTone(prompt: string, personaId: string): number {
  if (!prompt) return 0;
  const lower = prompt.toLowerCase();
  let totalWeight = 0;
  let matchCount = 0;

  for (const [keyword, personas] of Object.entries(TONE_PERSONA_AFFINITY)) {
    if (!new RegExp(`\\b${keyword}\\b`).test(lower)) continue;
    matchCount++;
    const rank = personas.indexOf(personaId);
    if (rank === -1) continue;
    const positionWeight = [1.0, 0.7, 0.4][rank] ?? 0.1;
    totalWeight += positionWeight;
  }

  if (matchCount === 0) return 0;
  // Normalize by number of tone keywords matched (max contribution per keyword = 1.0)
  return Math.min(totalWeight / matchCount, 1.0);
}

// ─── 2.4 URL Domain Signals ─────────────────────────────────────────

// TLD → industry mapping
const TLD_INDUSTRY: Record<string, string> = {
  ".gov": "government", ".gov.uk": "government", ".gov.au": "government",
  ".edu": "education", ".ac.uk": "education",
  ".org": "nonprofit",
  ".io": "technology",
  ".ai": "technology",
  ".dev": "technology",
  ".app": "technology",
  ".health": "healthcare",
  ".law": "legal",
  ".bank": "finance",
  ".shop": "ecommerce",
  ".store": "ecommerce",
  ".travel": "travel",
  ".museum": "culture",
  ".film": "film",
};

// Path patterns → industry
const PATH_INDUSTRY: [RegExp, string][] = [
  [/\/shop\b|\/products?\b|\/cart\b|\/checkout\b/, "ecommerce"],
  [/\/patients?\b|\/health\b|\/clinical\b/, "healthcare"],
  [/\/courses?\b|\/learn\b|\/students?\b/, "education"],
  [/\/news\b|\/articles?\b|\/press\b/, "news"],
  [/\/blog\b|\/posts?\b/, "publishing"],
  [/\/donate\b|\/volunteer\b/, "nonprofit"],
  [/\/menu\b|\/reserv\b/, "restaurant"],
  [/\/listings?\b|\/properties\b/, "realestate"],
  [/\/games?\b|\/play\b/, "gaming"],
];

function scoreUrl(url: string, personaId: string): number {
  if (!url) return 0;
  const lower = url.toLowerCase();

  let detectedIndustry: string | null = null;

  // Check TLDs (most specific first)
  for (const [tld, industry] of Object.entries(TLD_INDUSTRY)) {
    // Match TLD before the first / after domain
    if (new RegExp(`${tld.replace(".", "\\.")}(\\/|$|\\?)`).test(lower)) {
      detectedIndustry = industry;
      break;
    }
  }

  // Check path patterns if no TLD match
  if (!detectedIndustry) {
    for (const [pattern, industry] of PATH_INDUSTRY) {
      if (pattern.test(lower)) {
        detectedIndustry = industry;
        break;
      }
    }
  }

  if (!detectedIndustry) return 0;

  // Map detected industry to persona score
  const personaList = INDUSTRY_PERSONA_MAP[detectedIndustry];
  if (!personaList) return 0;
  const rank = personaList.indexOf(personaId);
  if (rank === -1) return 0;
  return [1.0, 0.7, 0.4, 0.2][rank] ?? 0.1;
}

// ─── 2.5 Color Scoring ──────────────────────────────────────────────

// Reference color profiles for personas (HSL ranges that match well)
// Each entry: [hueMin, hueMax, satMin, satMax, lightMin, lightMax]
type HSLRange = [number, number, number, number, number, number];

const PERSONA_COLOR_PROFILES: Record<string, HSLRange[]> = {
  "warm-nude":                [[15, 45, 10, 60, 40, 85], [0, 30, 5, 30, 60, 90]],
  "bold-modern":              [[0, 30, 70, 100, 30, 60], [330, 360, 70, 100, 30, 60], [50, 70, 70, 100, 40, 60]],  // saturated reds/yellows
  "corporate-precision":      [[210, 240, 30, 80, 15, 45], [35, 55, 40, 80, 40, 60]],  // navy + gold
  "cyberpunk-futurism":       [[170, 200, 70, 100, 40, 70], [290, 330, 70, 100, 40, 70]],  // neon cyan/magenta
  "swiss-international":      [[0, 360, 0, 15, 0, 100]],  // achromatic
  "minimal-editorial":        [[0, 360, 0, 15, 0, 100]],  // achromatic
  "editorial-luxury":         [[0, 0, 0, 5, 0, 15], [40, 50, 50, 90, 40, 60]],  // black + gold
  "japanese-minimalism":      [[0, 360, 0, 20, 70, 95]],  // muted, light
  "nordic-noir":              [[200, 230, 10, 40, 10, 40]],  // dark cool blues
  "solarpunk":                [[80, 160, 40, 80, 40, 70]],  // green spectrum
  "organic-biomorphic":       [[80, 170, 30, 70, 40, 70]],  // natural greens
  "cottagecore-digital":      [[20, 60, 20, 50, 60, 85], [330, 360, 20, 50, 60, 85]],  // soft pastels
  "mid-century-modern":       [[15, 45, 50, 80, 40, 65], [170, 200, 30, 60, 40, 60]],  // burnt orange + teal
  "brutalist-digital":        [[0, 360, 0, 10, 0, 20]],  // near black
  "art-deco-revival":         [[40, 55, 60, 100, 40, 60], [0, 0, 0, 0, 0, 15]],  // gold + black
  "pop-art-digital":          [[0, 60, 80, 100, 45, 65], [200, 260, 80, 100, 45, 65]],  // saturated primaries
  "wabi-sabi":                [[20, 50, 10, 30, 50, 80]],  // muted earth
  "constructivist":           [[0, 10, 70, 100, 40, 55]],  // red
  "neoclassical-institutional": [[210, 230, 20, 50, 20, 40], [35, 50, 30, 60, 50, 70]],  // navy + cream
  "utility-industrial":       [[30, 60, 10, 40, 30, 60], [0, 360, 0, 10, 30, 60]],  // khaki/gray
  "techno-minimal":           [[0, 360, 0, 20, 5, 25]],  // dark minimal
  "space-agency":             [[210, 240, 40, 80, 15, 40]],  // deep blue
  "afrofuturism":             [[40, 55, 60, 100, 40, 60], [270, 300, 50, 80, 30, 60]],  // gold + purple
  "memphis-postmodern":       [[0, 360, 60, 100, 50, 70]],  // multi-color saturated
  "kpop-maximalism":          [[290, 340, 50, 100, 50, 75]],  // pink/magenta
  "kinetic-typography":       [[0, 360, 0, 15, 0, 100]],  // monochrome focus
};

function scoreColor(colors: ExtractedColors | undefined, personaId: string): number {
  if (!colors?.primary) return 0;

  const profiles = PERSONA_COLOR_PROFILES[personaId];
  if (!profiles) return 0;

  const { h, s, l } = colors.primary.hsl;
  let bestMatch = 0;

  for (const [hMin, hMax, sMin, sMax, lMin, lMax] of profiles) {
    // Handle hue wrapping (e.g., 330-30 for reds)
    const hueMatch = hMin <= hMax
      ? (h >= hMin && h <= hMax)
      : (h >= hMin || h <= hMax);
    const satMatch = s >= sMin && s <= sMax;
    const lightMatch = l >= lMin && l <= lMax;

    if (hueMatch && satMatch && lightMatch) {
      bestMatch = 1.0;
      break;
    }

    // Partial match: how close are we to the range?
    let hDist = 0;
    if (hMin <= hMax) {
      if (h < hMin) hDist = Math.min(hMin - h, 360 - hMin + h);
      else if (h > hMax) hDist = Math.min(h - hMax, 360 - h + hMax);
    }
    const sDist = s < sMin ? sMin - s : s > sMax ? s - sMax : 0;
    const lDist = l < lMin ? lMin - l : l > lMax ? l - lMax : 0;

    // Combined distance (hue has more range so normalize)
    const dist = (hDist / 180) + (sDist / 100) + (lDist / 100);
    const partial = Math.max(0, 1.0 - dist);
    bestMatch = Math.max(bestMatch, partial);
  }

  return bestMatch;
}

// ─── 2.6 Font Scoring ───────────────────────────────────────────────

function scoreFont(fonts: ExtractedFonts | undefined, personaId: string): number {
  if (!fonts) return 0;

  // Heading fonts are stronger personality signals than body fonts
  const entries: { name: string; weight: number }[] = [];
  if (fonts.heading?.family) entries.push({ name: fonts.heading.family, weight: 0.7 });
  if (fonts.body?.family) entries.push({ name: fonts.body.family, weight: 0.3 });
  if (entries.length === 0) return 0;

  // If only one font, it gets full weight
  if (entries.length === 1) entries[0].weight = 1.0;

  let totalScore = 0;

  for (const { name, weight } of entries) {
    const cat = classifyFont(name);
    if (!cat) continue;
    const affinities = FONT_PERSONA_AFFINITY[cat];
    if (!affinities) continue;
    const rank = affinities.indexOf(personaId);
    if (rank === -1) continue;
    const rankScore = [1.0, 0.7, 0.4, 0.2, 0.1][rank] ?? 0.05;
    totalScore += rankScore * weight;
  }

  return Math.min(totalScore, 1.0);
}

// ─── 2.7 Weighted Fusion (Aaker-based) ──────────────────────────────

export function scoreAllPersonas(signals: BrandSignals, personaIds: string[]): PersonaScore[] {
  const searchText = [
    signals.url || "",
    signals.brandName || "",
    signals.userPrompt || "",
  ].join(" ").toLowerCase();

  // Step 1: Compute brand Aaker vector from all signals
  const aakerVectors: { vector: AakerVector; weight: number }[] = [];

  // Industry: prefer LLM-classified sector over regex keyword guess when
  // businessInfo is available. Scale by confidence so thin classifications
  // don't over-bias.
  if (signals.businessInfo && signals.businessInfo.sector !== "general") {
    const sectorVec = SECTOR_AAKER[signals.businessInfo.sector];
    const confWeight = AAKER_SIGNAL_WEIGHTS.industry * Math.max(0.3, signals.businessInfo.confidence);
    aakerVectors.push({ vector: sectorVec, weight: confWeight });
  } else {
    const indAaker = industryToAaker(searchText);
    if (indAaker) aakerVectors.push({ vector: indAaker, weight: AAKER_SIGNAL_WEIGHTS.industry });
  }

  const colAaker = colorToAaker(signals.colors);
  if (colAaker) aakerVectors.push({ vector: colAaker, weight: AAKER_SIGNAL_WEIGHTS.color });

  const fntAaker = fontToAaker(signals.fonts);
  if (fntAaker) aakerVectors.push({ vector: fntAaker, weight: AAKER_SIGNAL_WEIGHTS.font });

  const tonAaker = toneToAaker(signals.userPrompt || "");
  if (tonAaker) aakerVectors.push({ vector: tonAaker, weight: AAKER_SIGNAL_WEIGHTS.tone });

  // businessTone: site-derived voice from the classifier. Separate from
  // userPrompt tone so both contribute when the user's request and the
  // crawled site express different moods. When the classifier is very
  // confident (>=0.85), boost the weight by 1.8x so a strong semantic
  // signal can override a misleading color/font match (adidas case).
  if (signals.businessInfo && signals.businessInfo.tone !== "neutral") {
    const bizTone = TONE_AAKER_BIAS[signals.businessInfo.tone];
    const conf = signals.businessInfo.confidence;
    const toneMultiplier = conf >= 0.85 ? 1.8 : Math.max(0.3, conf);
    const confWeight = AAKER_SIGNAL_WEIGHTS.businessTone * toneMultiplier;
    aakerVectors.push({ vector: bizTone, weight: confWeight });
  }

  const urlAak = urlToAaker(signals.url || "");
  if (urlAak) aakerVectors.push({ vector: urlAak, weight: AAKER_SIGNAL_WEIGHTS.url });

  const hasSignals = aakerVectors.length > 0;
  const brandAaker = fuseAakerVectors(aakerVectors);

  // Step 2: Score each persona
  const scores: PersonaScore[] = personaIds.map(personaId => {
    // Direct signal scores (kept for explainability + direct match bonus)
    const industryScore = scoreIndustry(searchText, personaId);
    const colorScore = scoreColor(signals.colors, personaId);
    const fontScore = scoreFont(signals.fonts, personaId);
    const toneScore = scoreTone(signals.userPrompt || "", personaId);
    const urlScore = scoreUrl(signals.url || "", personaId);

    // If no signals at all, return zero total (triggers fallback)
    if (!hasSignals) {
      return {
        personaId,
        scores: { industry: 0, color: 0, font: 0, tone: 0, url: 0 },
        aaker: PERSONA_AAKER_VECTORS[personaId] || [0.2, 0.2, 0.2, 0.2, 0.2] as AakerVector,
        brandAaker,
        similarity: 0,
        directBonus: 0,
        total: 0,
        confidence: 0,
      };
    }

    // Aaker cosine similarity
    const personaAaker = PERSONA_AAKER_VECTORS[personaId] || [0.2, 0.2, 0.2, 0.2, 0.2] as AakerVector;
    const similarity = cosineSimilarity(brandAaker, personaAaker);

    // Direct match bonus: strong single-signal matches get a boost
    // This prevents the Aaker layer from overriding very clear direct matches
    const directWeighted =
      industryScore * SIGNAL_WEIGHTS.industry +
      colorScore * SIGNAL_WEIGHTS.color +
      fontScore * SIGNAL_WEIGHTS.font +
      toneScore * SIGNAL_WEIGHTS.tone +
      urlScore * SIGNAL_WEIGHTS.url;

    // Dynamic weighting: more signals → trust Aaker more; fewer → trust direct more
    // 1 signal: 50/50, 2 signals: 55/45, 3+: 65/35
    const aakerWeight = aakerVectors.length >= 3 ? 0.65 : aakerVectors.length >= 2 ? 0.55 : 0.50;
    const directWeight = 1.0 - aakerWeight;
    const directBonus = directWeighted * directWeight;

    // Sector affinity: when BusinessInfo classified a sector we have strong
    // domain knowledge for, boost personas in that sector's affinity list.
    // This overrides Aaker fusion when a misleading color/font signal pulls
    // the fused vector toward an unrelated "techy" persona.
    let affinityBonus = 0;
    if (signals.businessInfo && signals.businessInfo.sector !== "general") {
      const affinityList = SECTOR_PERSONA_AFFINITY[signals.businessInfo.sector];
      if (affinityList && affinityList.includes(personaId)) {
        affinityBonus = SECTOR_AFFINITY_BONUS * signals.businessInfo.confidence;
      }
    }

    const total = similarity * aakerWeight + directBonus + affinityBonus;

    return {
      personaId,
      scores: { industry: industryScore, color: colorScore, font: fontScore, tone: toneScore, url: urlScore },
      aaker: personaAaker,
      brandAaker,
      similarity,
      directBonus,
      total,
      confidence: 0,
    };
  });

  // Sort by total score descending
  scores.sort((a, b) => b.total - a.total);

  // Set confidence as margin between #1 and #2
  if (scores.length >= 2) {
    scores[0].confidence = scores[0].total - scores[1].total;
  } else if (scores.length === 1) {
    scores[0].confidence = scores[0].total;
  }

  return scores;
}

export interface MatchResult {
  persona: Persona;
  score: PersonaScore;
  alternatives: PersonaScore[]; // top 3 alternatives (excluding winner)
}

/**
 * Auto-detect the best persona based on brand signals.
 * Uses Aaker 5D intermediate representation with cosine similarity scoring.
 */
export function autoMatchPersona(signals: BrandSignals): Persona | null {
  const result = autoMatchPersonaDetailed(signals);
  return result?.persona || null;
}

/**
 * Detailed auto-match returning full scoring info including alternatives.
 */
export function autoMatchPersonaDetailed(signals: BrandSignals): MatchResult | null {
  const personas = loadPersonas();
  if (!personas.length) return null;

  const personaIds = personas.map(p => p.id);
  const ranked = scoreAllPersonas(signals, personaIds);

  // Find the best scoring persona that exists in our loaded set
  const best = ranked[0];
  if (!best || best.total === 0) {
    // No signals at all — default fallback
    const fallback = personas.find(p => p.id === "warm-nude") || personas.find(p => p.id === "minimal-editorial") || personas[0];
    if (fallback) {
      console.log(`[personas] Fallback persona="${fallback.id}" (${fallback.name}) — no signals detected`);
    }
    return fallback ? { persona: fallback, score: best || ranked[0], alternatives: ranked.slice(1, 4) } : null;
  }

  const found = personas.find(p => p.id === best.personaId);
  if (!found) return null;

  const alternatives = ranked.slice(1, 4); // top 3 alternatives

  // Logging with Aaker breakdown
  const runner = ranked[1];
  const { industry, color, font, tone, url } = best.scores;
  const directBreakdown = `industry:${industry.toFixed(2)} color:${color.toFixed(2)} font:${font.toFixed(2)} tone:${tone.toFixed(2)} url:${url.toFixed(2)}`;
  const aakerStr = `aaker:[${best.brandAaker.map(v => v.toFixed(2)).join(",")}]`;
  const cosStr = `cos:${best.similarity.toFixed(2)}`;
  const runnerInfo = runner ? ` | runner-up: ${runner.personaId} (${runner.total.toFixed(2)})` : "";
  // High confidence (>0.07) = auto-select. Low confidence = warn.
  const confidenceLabel = best.confidence > 0.07 ? "" : " ⚠ LOW CONFIDENCE";
  console.log(`[personas] Match: ${best.personaId} (${best.total.toFixed(2)}) — ${aakerStr} ${cosStr} ${directBreakdown}${runnerInfo}${confidenceLabel}`);

  if (confidenceLabel) {
    console.log(`[personas] Alternatives: ${alternatives.map(a => `${a.personaId}(${a.total.toFixed(2)})`).join(", ")}`);
  }

  return { persona: found, score: best, alternatives };
}

// ─── Test Helpers ────────────────────────────────────────────────────

/** Inject mock personas for testing (bypasses filesystem loading) */
export function _setPersonasForTesting(personas: Persona[]): void {
  _cachedPersonas = personas;
}

/** Clear cached personas (restore filesystem loading) */
export function _clearPersonaCache(): void {
  _cachedPersonas = null;
}

// ─── Prompt Injection ───────────────────────────────────────────────

/**
 * Build a persona preamble to prepend to system prompts.
 * This transforms a generic AI prompt into a persona-driven one.
 */
export function buildPersonaPrompt(persona: Persona, opts?: { isRedesign?: boolean }): string {
  const colorOverride = opts?.isRedesign
    ? `\nIMPORTANT: This is a REDESIGN of an existing site. The brand's EXTRACTED colors, fonts, and visual identity from the DESIGN TOKENS take absolute priority over this persona's palette. Use the persona for layout philosophy, spacing, hierarchy, and constraints — but use the EXTRACTED brand colors and fonts, NOT the persona's defaults.`
    : "";

  return `DESIGN PERSONA — You MUST fully embody this designer's philosophy, ${opts?.isRedesign ? "" : "palette, "}typography, spacing, and constraints. Design as this person would. Follow their "NEVER does" list strictly.
${colorOverride}
${persona.content}

ANTI-AI-LOOK RULES — These are mandatory regardless of persona:
- Do NOT over-use gradients. Flat colors are more professional.
- Do NOT add decorative SVG blobs, waves, or abstract shapes unless the persona explicitly calls for them.
- Do NOT use overly saturated neon colors unless the persona specifies them.
- Do NOT give every card heavy box-shadows. Prefer the persona's specified border/shadow approach.
- Do NOT repeat the same card layout 3+ times with only text changes. Vary hierarchy.
- Do NOT center-align everything. Follow the persona's layout rules.
- Do NOT over-decorate. If in doubt, leave it out.

`;
}
