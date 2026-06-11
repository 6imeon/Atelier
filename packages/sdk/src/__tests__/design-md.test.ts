import { describe, it, expect } from "vitest";
import {
  parse,
  lint,
  serialize,
  contrastRatio,
  exportTailwind,
  fromExtractedDesign,
  fromCanvasDesignSystem,
  toCanvasDesignSystem,
  promptDsFormat,
  formatDialsForPrompt,
  normaliseDials,
  DEFAULT_DIALS,
  type DesignTokens,
} from "../utils/design-md.js";

const SAMPLE_DS: DesignTokens = {
  name: "sample",
  version: "alpha",
  colors: {
    primary: "#1A1C1E",
    secondary: "#6C7278",
    tertiary: "#B8422E",
    neutral: "#F7F5F2",
    background: "#F7F5F2",
    text: "#1A1C1E",
  },
  typography: {
    h1: { fontFamily: "Cabinet Grotesk", fontSize: "48px" },
    "body-md": { fontFamily: "Geist", fontSize: "16px" },
  },
  rounded: { sm: "4px", md: "8px" },
  components: {
    "button-primary": {
      backgroundColor: "{colors.tertiary}",
      textColor: "{colors.neutral}",
      rounded: "{rounded.md}",
    },
  },
};

describe("serialize + parse round-trip", () => {
  it("round-trips all top-level sections", () => {
    const md = serialize(SAMPLE_DS);
    const { ds } = parse(md);
    expect(ds.name).toBe("sample");
    expect(ds.colors.primary).toBe("#1A1C1E");
    expect(ds.colors.tertiary).toBe("#B8422E");
    expect(ds.typography?.h1.fontFamily).toBe("Cabinet Grotesk");
    expect(ds.typography?.["body-md"].fontFamily).toBe("Geist");
    expect(ds.rounded?.md).toBe("8px");
  });

  it("resolves token refs on parse", () => {
    const md = serialize(SAMPLE_DS);
    const { ds } = parse(md);
    expect(ds.components?.["button-primary"].backgroundColor).toBe("#B8422E");
    expect(ds.components?.["button-primary"].textColor).toBe("#F7F5F2");
  });

  it("handles empty input without throwing", () => {
    expect(parse("").ds.colors).toEqual({});
    expect(lint("").findings).toEqual([]);
  });
});

describe("contrast math", () => {
  it("black on white = 21", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 1);
  });
  it("#777 on white < 4.5 (fails AA)", () => {
    const ratio = contrastRatio("#777777", "#FFFFFF")!;
    expect(ratio).toBeLessThan(4.5);
    expect(ratio).toBeGreaterThan(4.0);
  });
  it("returns null for invalid hex", () => {
    expect(contrastRatio("not-a-hex", "#fff")).toBeNull();
  });
});

describe("lint rules", () => {
  it("broken-ref catches unresolved token refs", () => {
    const md = serialize({
      ...SAMPLE_DS,
      components: {
        "button-primary": {
          backgroundColor: "{colors.doesnotexist}",
        },
      },
    });
    const report = lint(md);
    const found = report.findings.filter(f => f.rule === "broken-ref");
    expect(found.length).toBe(1);
    expect(found[0].severity).toBe("error");
  });

  it("contrast-ratio catches low-contrast component pair", () => {
    const md = serialize({
      name: "low-contrast",
      colors: { primary: "#CCCCCC", secondary: "#FFFFFF" },
      components: {
        "button-muted": {
          backgroundColor: "{colors.primary}",
          textColor: "{colors.secondary}",
        },
      },
    });
    const report = lint(md);
    const found = report.findings.filter(f => f.rule === "contrast-ratio");
    expect(found.length).toBeGreaterThan(0);
    expect(found[0].severity).toBe("warning");
    expect(found[0].ratio).toBeLessThan(4.5);
  });

  it("missing-primary warns when colors exist but no primary", () => {
    const md = serialize({
      name: "no-primary",
      colors: { secondary: "#000", background: "#fff" },
    });
    const report = lint(md);
    expect(report.findings.some(f => f.rule === "missing-primary")).toBe(true);
  });

  it("missing-typography warns when colors exist but no typography", () => {
    const md = serialize({
      name: "no-typography",
      colors: { primary: "#1A1C1E" },
    });
    const report = lint(md);
    expect(report.findings.some(f => f.rule === "missing-typography")).toBe(true);
  });

  it("orphaned-tokens warns on unused color tokens", () => {
    const md = serialize({
      ...SAMPLE_DS,
      colors: { ...SAMPLE_DS.colors, unusedColor: "#123456" },
    });
    const report = lint(md);
    const found = report.findings.filter(f => f.rule === "orphaned-tokens" && f.token === "colors.unusedColor");
    expect(found.length).toBe(1);
  });

  it("produces summary counts", () => {
    const md = serialize({
      name: "broken",
      colors: { primary: "#CCC", background: "#DDD" },
      components: {
        "btn": {
          backgroundColor: "{colors.primary}",
          textColor: "{colors.missing}",
        },
      },
    });
    const report = lint(md);
    expect(report.summary.errors).toBeGreaterThan(0);
    expect(report.summary.warnings + report.summary.info).toBeGreaterThan(0);
  });
});

describe("fromExtractedDesign adapter", () => {
  it("drops null slots and maps heading/body fonts", () => {
    const tokens = fromExtractedDesign({
      colors: { primary: "#1A1C1E", secondary: null, accent: "#B8422E" },
      typography: { fontFamilies: { heading: "Cabinet Grotesk", body: null } },
    }, "test");
    expect(tokens.name).toBe("test");
    expect(tokens.colors.primary).toBe("#1A1C1E");
    expect(tokens.colors.accent).toBe("#B8422E");
    expect(tokens.colors.secondary).toBeUndefined();
    expect(tokens.typography?.h1.fontFamily).toBe("Cabinet Grotesk");
    expect(tokens.typography?.["body-md"]).toBeUndefined();
  });
});

describe("exportTailwind", () => {
  it("emits a Tailwind theme-extend config", () => {
    const out = exportTailwind(SAMPLE_DS);
    expect(out).toContain("module.exports");
    expect(out).toContain("colors:");
    expect(out).toContain('primary: "#1A1C1E"');
    expect(out).toContain("fontFamily:");
    expect(out).toContain("heading:");
    expect(out).toContain('"Cabinet Grotesk"');
    expect(out).toContain("borderRadius:");
  });
});

describe("CanvasDesignSystem round-trip (Phase 3)", () => {
  const CANVAS_DS = {
    palette: {
      primary: "#6AABCF", secondary: "#D1D5DB", tertiary: "#1F2937",
      neutral: "#E5E7EB", background: "#FFFFFF", text: "#111827",
    },
    fonts: { headline: "Cabinet Grotesk", body: "Geist", label: "JetBrains Mono" },
    cornerRadius: "8px",
  };

  it("adapts Canvas palette/fonts/cornerRadius into DesignTokens", () => {
    const tokens = fromCanvasDesignSystem(CANVAS_DS, "Adidas");
    expect(tokens.name).toBe("Adidas");
    expect(tokens.colors.primary).toBe("#6AABCF");
    expect(tokens.colors.background).toBe("#FFFFFF");
    expect(tokens.typography?.h1.fontFamily).toBe("Cabinet Grotesk");
    expect(tokens.typography?.["body-md"].fontFamily).toBe("Geist");
    expect(tokens.typography?.["label-caps"].fontFamily).toBe("JetBrains Mono");
    expect(tokens.rounded?.md).toBe("8px");
  });

  it("round-trips Canvas → DesignTokens → markdown → DesignTokens → Canvas", () => {
    const tokens = fromCanvasDesignSystem(CANVAS_DS, "Adidas");
    const md = serialize(tokens, "Adidas");
    const { ds: parsed } = parse(md);
    const back = toCanvasDesignSystem(parsed);
    expect(back.palette?.primary).toBe("#6AABCF");
    expect(back.palette?.text).toBe("#111827");
    expect(back.fonts?.headline).toBe("Cabinet Grotesk");
    expect(back.fonts?.body).toBe("Geist");
    expect(back.fonts?.label).toBe("JetBrains Mono");
    expect(back.cornerRadius).toBe("8px");
  });

  it("handles missing fields gracefully (empty palette drops undefined)", () => {
    const tokens = fromCanvasDesignSystem({ palette: {}, fonts: { headline: "", body: "", label: "" } }, "Empty");
    expect(Object.keys(tokens.colors).length).toBe(0);
    expect(tokens.typography).toBeUndefined();
  });
});

describe("dials (Phase 5)", () => {
  it("normaliseDials clamps to 1-10 integer range", () => {
    expect(normaliseDials({ variance: 0, motion: 15, density: 5.7 })).toEqual({
      variance: 1, motion: 10, density: 6,
    });
  });

  it("normaliseDials falls back to DEFAULT_DIALS for undefined/NaN", () => {
    expect(normaliseDials(undefined)).toEqual(DEFAULT_DIALS);
    expect(normaliseDials({})).toEqual(DEFAULT_DIALS);
    expect(normaliseDials({ variance: Number("bad") })).toMatchObject({
      variance: DEFAULT_DIALS.variance,
    });
  });

  it("formatDialsForPrompt uses LOW/MEDIUM/HIGH bands at the right breakpoints", () => {
    const low = formatDialsForPrompt({ variance: 2, motion: 2, density: 2 });
    expect(low).toContain("DESIGN_VARIANCE = 2/10");
    expect(low).toContain("LOW (1-3) — perfect symmetry");
    const med = formatDialsForPrompt({ variance: 5, motion: 5, density: 5 });
    expect(med).toContain("MEDIUM (4-7)");
    const high = formatDialsForPrompt({ variance: 9, motion: 9, density: 9 });
    expect(high).toContain("HIGH (8-10)");
    expect(high).toContain("scroll-pinned choreography");
  });

  it("formatDialsForPrompt works with undefined (uses defaults)", () => {
    const out = formatDialsForPrompt(undefined);
    expect(out).toContain(`DESIGN_VARIANCE = ${DEFAULT_DIALS.variance}/10`);
    expect(out).toContain(`MOTION_INTENSITY = ${DEFAULT_DIALS.motion}/10`);
    expect(out).toContain(`VISUAL_DENSITY = ${DEFAULT_DIALS.density}/10`);
  });

  it("serialize/parse round-trip preserves dials", () => {
    const ds: DesignTokens = {
      colors: { primary: "#123456" },
      dials: { variance: 3, motion: 7, density: 9 },
    };
    const md = serialize(ds, "With Dials");
    expect(md).toContain("dials:");
    expect(md).toContain("variance: 3");
    expect(md).toContain("motion: 7");
    expect(md).toContain("density: 9");
    const { ds: parsed } = parse(md);
    expect(parsed.dials).toEqual({ variance: 3, motion: 7, density: 9 });
  });

  it("fromCanvasDesignSystem → toCanvasDesignSystem round-trips dials", () => {
    const canvas = {
      palette: { primary: "#123456" },
      fonts: { headline: "Geist", body: "Geist", label: "Geist" },
      dials: { variance: 2, motion: 10, density: 5 },
    };
    const tokens = fromCanvasDesignSystem(canvas, "x");
    expect(tokens.dials).toEqual({ variance: 2, motion: 10, density: 5 });
    const back = toCanvasDesignSystem(tokens);
    expect(back.dials).toEqual({ variance: 2, motion: 10, density: 5 });
  });
});

describe("promptDsFormat env flag", () => {
  it("defaults to json", () => {
    delete process.env.CANVAS_PROMPT_DS_FORMAT;
    expect(promptDsFormat()).toBe("json");
  });

  it("returns tailwind when set", () => {
    process.env.CANVAS_PROMPT_DS_FORMAT = "tailwind";
    expect(promptDsFormat()).toBe("tailwind");
    delete process.env.CANVAS_PROMPT_DS_FORMAT;
  });

  it("is case-insensitive", () => {
    process.env.CANVAS_PROMPT_DS_FORMAT = "TAILWIND";
    expect(promptDsFormat()).toBe("tailwind");
    delete process.env.CANVAS_PROMPT_DS_FORMAT;
  });
});
