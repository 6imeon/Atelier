import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  autoMatchPersona,
  autoMatchPersonaDetailed,
  classifyFont,
  matchPersonaByFonts,
  scoreAllPersonas,
  cosineSimilarity,
  deltaE,
  PERSONA_AAKER_VECTORS,
  AAKER_LABELS,
  _setPersonasForTesting,
  _clearPersonaCache,
  type Persona,
  type AakerVector,
} from "../utils/personas.js";
import type { ExtractedColors, ExtractedFonts } from "../utils/brand-extractor.js";

// ─── Mock Personas ──────────────────────────────────────────────────

const MOCK_PERSONAS: Persona[] = [
  { id: "corporate-precision", name: "Corporate", content: "" },
  { id: "warm-nude", name: "Warm Nude", content: "" },
  { id: "bold-modern", name: "Bold Modern", content: "" },
  { id: "cyberpunk-futurism", name: "Cyberpunk", content: "" },
  { id: "swiss-international", name: "Swiss", content: "" },
  { id: "editorial-luxury", name: "Editorial Luxury", content: "" },
  { id: "minimal-editorial", name: "Minimal Editorial", content: "" },
  { id: "neoclassical-institutional", name: "Neoclassical", content: "" },
  { id: "organic-biomorphic", name: "Organic", content: "" },
  { id: "solarpunk", name: "Solarpunk", content: "" },
  { id: "bauhaus-functional", name: "Bauhaus", content: "" },
  { id: "techno-minimal", name: "Techno Minimal", content: "" },
  { id: "utility-industrial", name: "Utility Industrial", content: "" },
  { id: "brutalist-digital", name: "Brutalist", content: "" },
  { id: "cottagecore-digital", name: "Cottagecore", content: "" },
  { id: "wabi-sabi", name: "Wabi Sabi", content: "" },
  { id: "new-york-editorial", name: "New York Editorial", content: "" },
  { id: "editorial-magazine", name: "Editorial Magazine", content: "" },
  { id: "space-agency", name: "Space Agency", content: "" },
  { id: "pop-art-digital", name: "Pop Art", content: "" },
  { id: "mid-century-modern", name: "Mid Century", content: "" },
  { id: "art-deco-revival", name: "Art Deco", content: "" },
  { id: "nordic-noir", name: "Nordic Noir", content: "" },
  { id: "japanese-minimalism", name: "Japanese Minimalism", content: "" },
  { id: "noir-detective", name: "Noir Detective", content: "" },
  { id: "sports-dynamic", name: "Sports Dynamic", content: "" },
  { id: "memphis-postmodern", name: "Memphis Postmodern", content: "" },
  { id: "kinetic-typography", name: "Kinetic Typography", content: "" },
  { id: "afrofuturism", name: "Afrofuturism", content: "" },
  { id: "kpop-maximalism", name: "K-Pop Maximalism", content: "" },
  { id: "constructivist", name: "Constructivist", content: "" },
  { id: "desert-southwest", name: "Desert Southwest", content: "" },
  { id: "gothic-revival", name: "Gothic Revival", content: "" },
  { id: "art-nouveau-digital", name: "Art Nouveau Digital", content: "" },
];

function makeColor(h: number, s: number, l: number, hex = "#000000") {
  return { hex, hsl: { h, s, l } };
}

function makeColors(primary: ReturnType<typeof makeColor>): ExtractedColors {
  return {
    primary,
    secondary: null,
    accent: null,
    background: null,
    text: null,
    all: [],
    sections: [],
  } as unknown as ExtractedColors;
}

function makeFonts(heading?: string, body?: string): ExtractedFonts {
  return {
    heading: heading ? { family: heading, weights: ["400"], source: "google" as const, usage: "heading" as const } : null,
    body: body ? { family: body, weights: ["400"], source: "google" as const, usage: "body" as const } : null,
    all: [],
    googleFontsUrls: [],
  };
}

const PERSONA_IDS = MOCK_PERSONAS.map(p => p.id);

// ─── Font Classification Tests ──────────────────────────────────────

describe("classifyFont", () => {
  it("classifies geometric sans-serif fonts", () => {
    expect(classifyFont("Montserrat")).toBe("geometric-sans");
    expect(classifyFont("Poppins")).toBe("geometric-sans");
    expect(classifyFont("DM Sans")).toBe("geometric-sans");
  });

  it("classifies humanist sans-serif fonts", () => {
    expect(classifyFont("Inter")).toBe("humanist-sans");
    expect(classifyFont("Open Sans")).toBe("humanist-sans");
    expect(classifyFont("Lato")).toBe("humanist-sans");
  });

  it("classifies modern serif fonts", () => {
    expect(classifyFont("Playfair Display")).toBe("modern-serif");
    expect(classifyFont("Bodoni")).toBe("modern-serif");
  });

  it("classifies slab serif fonts", () => {
    expect(classifyFont("Roboto Slab")).toBe("slab-serif");
    expect(classifyFont("Arvo")).toBe("slab-serif");
  });

  it("classifies monospace fonts", () => {
    expect(classifyFont("JetBrains Mono")).toBe("monospace");
    expect(classifyFont("Fira Code")).toBe("monospace");
  });

  it("classifies display fonts", () => {
    expect(classifyFont("Bebas Neue")).toBe("display");
    expect(classifyFont("Anton")).toBe("display");
  });

  it("classifies handwriting fonts", () => {
    expect(classifyFont("Dancing Script")).toBe("handwriting");
    expect(classifyFont("Caveat")).toBe("handwriting");
  });

  it("uses heuristic fallback for unknown fonts", () => {
    expect(classifyFont("Custom Sans Pro")).toBe("humanist-sans");
    expect(classifyFont("Custom Serif Pro")).toBe("transitional-serif");
    expect(classifyFont("Custom Mono")).toBe("monospace");
  });

  it("returns null for unclassifiable fonts", () => {
    expect(classifyFont("RandomFontXYZ")).toBeNull();
  });

  it("handles quoted font names", () => {
    expect(classifyFont("'Playfair Display'")).toBe("modern-serif");
    expect(classifyFont('"Inter"')).toBe("humanist-sans");
  });
});

describe("matchPersonaByFonts", () => {
  it("returns persona affinities for geometric sans", () => {
    const result = matchPersonaByFonts(makeFonts("Montserrat", "Inter"));
    expect(result).toContain("swiss-international");
    expect(result).toContain("warm-nude");
  });

  it("returns persona affinities for modern serif heading", () => {
    const result = matchPersonaByFonts(makeFonts("Playfair Display"));
    expect(result).toContain("editorial-luxury");
    expect(result).toContain("new-york-editorial");
  });

  it("returns empty array when fonts are null", () => {
    const result = matchPersonaByFonts(makeFonts());
    expect(result).toEqual([]);
  });
});

// ─── Multi-Signal Scoring Tests ─────────────────────────────────────

describe("scoreAllPersonas", () => {
  it("returns PersonaScore[] sorted by total descending", () => {
    const scores = scoreAllPersonas(
      { userPrompt: "redesign this investment bank website" },
      PERSONA_IDS,
    );
    expect(scores.length).toBe(PERSONA_IDS.length);
    // Should be sorted descending
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i - 1].total).toBeGreaterThanOrEqual(scores[i].total);
    }
  });

  it("has industry score > 0 for finance keywords", () => {
    const scores = scoreAllPersonas(
      { userPrompt: "redesign this investment bank wealth management website" },
      ["corporate-precision", "warm-nude"],
    );
    const corp = scores.find(s => s.personaId === "corporate-precision")!;
    expect(corp.scores.industry).toBeGreaterThan(0);
    expect(corp.scores.industry).toBeGreaterThan(
      scores.find(s => s.personaId === "warm-nude")!.scores.industry,
    );
  });

  it("has tone score > 0 for luxury keywords", () => {
    const scores = scoreAllPersonas(
      { userPrompt: "make it look luxury and elegant" },
      ["editorial-luxury", "bold-modern"],
    );
    const lux = scores.find(s => s.personaId === "editorial-luxury")!;
    expect(lux.scores.tone).toBeGreaterThan(0);
    expect(lux.scores.tone).toBeGreaterThan(
      scores.find(s => s.personaId === "bold-modern")!.scores.tone,
    );
  });

  it("has url score > 0 for .gov TLD", () => {
    const scores = scoreAllPersonas(
      { url: "https://www.agency.gov/services" },
      ["swiss-international", "cyberpunk-futurism"],
    );
    const swiss = scores.find(s => s.personaId === "swiss-international")!;
    expect(swiss.scores.url).toBeGreaterThan(0);
    expect(scores.find(s => s.personaId === "cyberpunk-futurism")!.scores.url).toBe(0);
  });

  it("has url score > 0 for /shop path", () => {
    const scores = scoreAllPersonas(
      { url: "https://www.example.com/shop/products" },
      ["warm-nude", "space-agency"],
    );
    expect(scores.find(s => s.personaId === "warm-nude")!.scores.url).toBeGreaterThan(0);
  });

  it("has color score > 0 for matching persona colors", () => {
    const scores = scoreAllPersonas(
      { colors: makeColors(makeColor(180, 90, 50)) }, // neon cyan
      ["cyberpunk-futurism", "warm-nude"],
    );
    const cyber = scores.find(s => s.personaId === "cyberpunk-futurism")!;
    expect(cyber.scores.color).toBeGreaterThan(0.5);
  });

  it("has font score > 0 for matching persona fonts", () => {
    const scores = scoreAllPersonas(
      { fonts: makeFonts("Playfair Display", "Inter") },
      ["editorial-luxury", "cyberpunk-futurism"],
    );
    const ed = scores.find(s => s.personaId === "editorial-luxury")!;
    expect(ed.scores.font).toBeGreaterThan(0);
    expect(scores.find(s => s.personaId === "cyberpunk-futurism")!.scores.font).toBe(0);
  });

  it("sets confidence as margin between #1 and #2", () => {
    const scores = scoreAllPersonas(
      { userPrompt: "redesign this investment bank website" },
      PERSONA_IDS,
    );
    expect(scores[0].confidence).toBeGreaterThan(0);
    expect(scores[0].confidence).toBeCloseTo(
      scores[0].total - scores[1].total,
      5,
    );
  });

  it("all scores are 0 when no signals", () => {
    const scores = scoreAllPersonas({}, PERSONA_IDS);
    for (const s of scores) {
      expect(s.total).toBe(0);
      expect(s.scores.industry).toBe(0);
      expect(s.scores.color).toBe(0);
      expect(s.scores.font).toBe(0);
      expect(s.scores.tone).toBe(0);
      expect(s.scores.url).toBe(0);
    }
  });

  // Multi-signal fusion: combining signals improves ranking
  it("multi-signal fusion boosts the right persona", () => {
    // Finance keywords + gold color + transitional serif = corporate-precision should dominate
    const scores = scoreAllPersonas(
      {
        userPrompt: "redesign this bank website",
        colors: makeColors(makeColor(220, 50, 25)), // navy
        fonts: makeFonts("Georgia", "Inter"),
      },
      ["corporate-precision", "warm-nude", "bold-modern", "cyberpunk-futurism"],
    );
    expect(scores[0].personaId).toBe("corporate-precision");
    // Should have contributions from multiple signals
    expect(scores[0].scores.industry).toBeGreaterThan(0);
    expect(scores[0].scores.color).toBeGreaterThan(0);
  });
});

// ─── autoMatchPersona Integration Tests ─────────────────────────────

describe("autoMatchPersona", () => {
  beforeEach(() => {
    _setPersonasForTesting(MOCK_PERSONAS);
  });

  afterEach(() => {
    _clearPersonaCache();
  });

  // Strong industry match
  it("matches finance industry keywords to corporate-precision", () => {
    const result = autoMatchPersona({
      url: "https://www.capital-bank.com",
      userPrompt: "redesign this investment banking wealth management website",
    });
    expect(result?.id).toBe("corporate-precision");
  });

  it("matches technology keywords to bold-modern", () => {
    const result = autoMatchPersona({
      url: "https://www.techsaas.io",
      userPrompt: "redesign this software platform",
    });
    expect(result?.id).toBe("bold-modern");
  });

  it("matches healthcare keywords", () => {
    const result = autoMatchPersona({
      url: "https://www.medclinic.com",
      userPrompt: "redesign this medical clinic patient care website",
    });
    expect(result?.id).toBe("corporate-precision");
  });

  // Word boundary matching — no false positives
  it("does NOT match 'bank' in 'riverbank'", () => {
    const result = autoMatchPersona({
      userPrompt: "redesign the riverbank nature trail website",
    });
    expect(result?.id).not.toBe("corporate-precision");
  });

  it("does NOT match 'art' in 'start' or 'party'", () => {
    const result = autoMatchPersona({
      userPrompt: "start your party planning business",
    });
    expect(result?.id).not.toBe("african-contemporary");
  });

  // Bigram keywords
  it("matches multi-word keywords like 'real estate'", () => {
    const result = autoMatchPersona({
      userPrompt: "redesign a real estate agency website",
    });
    expect(result?.id).toBe("warm-nude");
  });

  it("matches 'add to cart' for ecommerce", () => {
    const result = autoMatchPersona({
      userPrompt: "this page has add to cart and free shipping",
    });
    // Aaker: ecommerce maps to balanced Sincerity+Excitement — several warm/versatile personas fit
    expect(["warm-nude", "mid-century-modern", "cottagecore-digital"]).toContain(result?.id);
  });

  // Color-only matching
  it("matches neon colors to cyberpunk", () => {
    const result = autoMatchPersona({
      colors: makeColors(makeColor(180, 90, 50)),
    });
    expect(result?.id).toBe("cyberpunk-futurism");
  });

  it("matches earthy warm colors to warm/sincere persona", () => {
    const result = autoMatchPersona({
      colors: makeColors(makeColor(30, 40, 60)),
    });
    // Aaker: warm earth tones map to high Sincerity — cottagecore and warm-nude both score high
    expect(["warm-nude", "cottagecore-digital"]).toContain(result?.id);
  });

  // Font-only signal
  it("matches editorial persona from Playfair Display font", () => {
    const result = autoMatchPersona({
      fonts: makeFonts("Playfair Display", "Inter"),
    });
    expect(result?.id).toBe("editorial-luxury");
  });

  it("matches swiss-international from geometric sans fonts", () => {
    const result = autoMatchPersona({
      fonts: makeFonts("Montserrat", "Poppins"),
    });
    expect(result?.id).toBe("swiss-international");
  });

  // Tone-only matching
  it("matches 'luxury elegant' tone to editorial-luxury", () => {
    const result = autoMatchPersona({
      userPrompt: "make it look luxury and elegant",
    });
    expect(result?.id).toBe("editorial-luxury");
  });

  it("matches 'bold dynamic' tone to bold-modern or sports-dynamic", () => {
    const result = autoMatchPersona({
      userPrompt: "make it bold and dynamic",
    });
    expect(["bold-modern", "sports-dynamic"]).toContain(result?.id);
  });

  it("matches 'minimal clean' tone to japanese-minimalism or swiss", () => {
    const result = autoMatchPersona({
      userPrompt: "keep it minimal and clean",
    });
    expect(["japanese-minimalism", "swiss-international"]).toContain(result?.id);
  });

  // URL TLD signals
  it("boosts government persona for .gov URLs", () => {
    const result = autoMatchPersona({
      url: "https://www.services.gov/about",
    });
    expect(result?.id).toBe("swiss-international");
  });

  // Multi-signal combined
  it("uses font to disambiguate among industry candidates", () => {
    // Strong tech signal (many keywords) + monospace fonts
    // techno-minimal is in tech industry list AND monospace font affinity
    const result = autoMatchPersona({
      userPrompt: "redesign this tech software saas cloud platform for digital api development",
      fonts: makeFonts("JetBrains Mono", "Space Mono"),
    });
    expect(result?.id).toBe("techno-minimal");
  });

  it("combines industry + tone for stronger match", () => {
    // Finance + professional tone → corporate-precision should be very strong
    const result = autoMatchPersona({
      userPrompt: "redesign this professional banking website to look trustworthy",
    });
    expect(result?.id).toBe("corporate-precision");
  });

  // No signals — default fallback
  it("returns warm-nude as default fallback", () => {
    const result = autoMatchPersona({});
    expect(result?.id).toBe("warm-nude");
  });

  it("returns null when no personas loaded", () => {
    _setPersonasForTesting([]);
    const result = autoMatchPersona({ userPrompt: "test" });
    expect(result).toBeNull();
  });

  // Ambiguous multi-industry input — highest scoring wins
  it("picks the industry with the most keyword matches", () => {
    const result = autoMatchPersona({
      userPrompt: "a software tech platform for digital cloud api development",
    });
    expect(result?.id).toBe("bold-modern");
  });
});

// ─── Aaker Layer Tests ──────────────────────────────────────────────

describe("cosineSimilarity", () => {
  it("returns 1.0 for identical vectors", () => {
    const v: AakerVector = [0.5, 0.8, 0.3, 0.7, 0.2];
    expect(cosineSimilarity(v, v)).toBeCloseTo(1.0, 5);
  });

  it("returns 0 when one vector is all zeros", () => {
    expect(cosineSimilarity([0, 0, 0, 0, 0], [0.5, 0.5, 0.5, 0.5, 0.5])).toBe(0);
  });

  it("returns higher similarity for closer vectors", () => {
    const target: AakerVector = [0.2, 0.9, 0.4, 0.3, 0.5]; // cyberpunk-like
    const close: AakerVector = [0.1, 0.8, 0.5, 0.3, 0.4];  // similar
    const far: AakerVector = [0.9, 0.1, 0.3, 0.2, 0.1];    // opposite (sincere)
    expect(cosineSimilarity(target, close)).toBeGreaterThan(cosineSimilarity(target, far));
  });

  it("is symmetric", () => {
    const a: AakerVector = [0.3, 0.7, 0.5, 0.4, 0.6];
    const b: AakerVector = [0.8, 0.2, 0.3, 0.9, 0.1];
    expect(cosineSimilarity(a, b)).toBeCloseTo(cosineSimilarity(b, a), 10);
  });
});

describe("deltaE (CIE Lab color distance)", () => {
  it("returns 0 for identical colors", () => {
    expect(deltaE("#FF0000", "#FF0000")).toBeCloseTo(0, 1);
  });

  it("returns small distance for similar colors", () => {
    const dist = deltaE("#FF0000", "#EE1100");
    expect(dist).toBeLessThan(10);
  });

  it("returns large distance for different colors", () => {
    const dist = deltaE("#FF0000", "#0000FF"); // red vs blue
    expect(dist).toBeGreaterThan(50);
  });

  it("returns 100 for invalid hex", () => {
    expect(deltaE("invalid", "#FF0000")).toBe(100);
  });

  it("black vs white has large distance", () => {
    const dist = deltaE("#000000", "#FFFFFF");
    expect(dist).toBeGreaterThan(90);
  });
});

describe("PERSONA_AAKER_VECTORS", () => {
  it("has vectors for all 52 personas", () => {
    expect(Object.keys(PERSONA_AAKER_VECTORS).length).toBe(52);
  });

  it("all vectors have 5 dimensions", () => {
    for (const [id, vec] of Object.entries(PERSONA_AAKER_VECTORS)) {
      expect(vec.length).toBe(5);
      for (const v of vec) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
  });

  it("has correct labels", () => {
    expect(AAKER_LABELS).toEqual(["sincerity", "excitement", "competence", "sophistication", "ruggedness"]);
  });

  it("warm-nude has high sincerity", () => {
    expect(PERSONA_AAKER_VECTORS["warm-nude"][0]).toBeGreaterThanOrEqual(0.7);
  });

  it("cyberpunk-futurism has high excitement", () => {
    expect(PERSONA_AAKER_VECTORS["cyberpunk-futurism"][1]).toBeGreaterThanOrEqual(0.8);
  });

  it("corporate-precision has high competence", () => {
    expect(PERSONA_AAKER_VECTORS["corporate-precision"][2]).toBeGreaterThanOrEqual(0.8);
  });

  it("editorial-luxury has high sophistication", () => {
    expect(PERSONA_AAKER_VECTORS["editorial-luxury"][3]).toBeGreaterThanOrEqual(0.8);
  });

  it("utility-industrial has high ruggedness", () => {
    expect(PERSONA_AAKER_VECTORS["utility-industrial"][4]).toBeGreaterThanOrEqual(0.8);
  });
});

describe("Aaker scoring in scoreAllPersonas", () => {
  it("includes Aaker fields in PersonaScore", () => {
    const scores = scoreAllPersonas(
      { userPrompt: "make it luxury and elegant" },
      ["editorial-luxury", "bold-modern"],
    );
    expect(scores[0].aaker).toBeDefined();
    expect(scores[0].aaker.length).toBe(5);
    expect(scores[0].brandAaker).toBeDefined();
    expect(scores[0].brandAaker.length).toBe(5);
    expect(scores[0].similarity).toBeGreaterThan(0);
    expect(typeof scores[0].directBonus).toBe("number");
  });

  it("brandAaker reflects tone signals", () => {
    const scores = scoreAllPersonas(
      { userPrompt: "luxury elegant sophisticated premium" },
      ["editorial-luxury"],
    );
    const brand = scores[0].brandAaker;
    // Sophistication (index 3) should be the dominant dimension
    expect(brand[3]).toBeGreaterThan(brand[0]); // > sincerity
    expect(brand[3]).toBeGreaterThan(brand[1]); // > excitement
    expect(brand[3]).toBeGreaterThan(brand[4]); // > ruggedness
  });

  it("luxury restaurant matches sophisticated+sincere persona over purely exciting one", () => {
    const scores = scoreAllPersonas(
      {
        userPrompt: "redesign this luxury fine dining restaurant with elegant tasting menu",
      },
      ["editorial-luxury", "art-deco-revival", "pop-art-digital", "memphis-postmodern"],
    );
    // Luxury restaurant: high Sophistication from tone + Sincerity from food industry
    // Should favor editorial-luxury or art-deco (both high Sophistication)
    // Should NOT favor pop-art or memphis (high Excitement, low Sophistication)
    expect(["editorial-luxury", "art-deco-revival"]).toContain(scores[0].personaId);
  });

  it("Aaker similarity is higher for matching personality profiles", () => {
    const scores = scoreAllPersonas(
      { userPrompt: "rugged industrial raw outdoor adventure" },
      ["utility-industrial", "editorial-luxury"],
    );
    const indust = scores.find(s => s.personaId === "utility-industrial")!;
    const luxury = scores.find(s => s.personaId === "editorial-luxury")!;
    expect(indust.similarity).toBeGreaterThan(luxury.similarity);
  });
});

describe("autoMatchPersonaDetailed", () => {
  beforeEach(() => {
    _setPersonasForTesting(MOCK_PERSONAS);
  });

  afterEach(() => {
    _clearPersonaCache();
  });

  it("returns MatchResult with alternatives", () => {
    const result = autoMatchPersonaDetailed({
      userPrompt: "redesign this professional banking website",
    });
    expect(result).not.toBeNull();
    expect(result!.persona.id).toBe("corporate-precision");
    expect(result!.score.personaId).toBe("corporate-precision");
    expect(result!.alternatives.length).toBe(3);
    // Alternatives should not include the winner
    expect(result!.alternatives.every(a => a.personaId !== "corporate-precision")).toBe(true);
  });

  it("returns null when no personas", () => {
    _setPersonasForTesting([]);
    expect(autoMatchPersonaDetailed({ userPrompt: "test" })).toBeNull();
  });
});
