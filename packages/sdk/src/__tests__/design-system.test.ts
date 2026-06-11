import { describe, it, expect } from "vitest";
import { toDesignMd, parseDesignMd, DesignSystem } from "../models/design-system.js";

const SAMPLE_DS: DesignSystem = {
  colors: {
    primary: "#E8FF59",
    secondary: "#59FFD2",
    accent: "#C59FFF",
    background: "#0A0A0F",
    surface: "#1a1a25",
    text: { primary: "#ffffff", secondary: "#aaaaaa", muted: "#555555" },
  },
  typography: {
    fontFamilies: { heading: "Inter", body: "Inter", mono: "JetBrains Mono" },
    scale: { xs: "0.75rem", sm: "0.875rem", base: "1rem", lg: "1.25rem", xl: "1.5rem" },
  },
  spacing: { unit: "4px", scale: ["4px", "8px", "12px", "16px", "24px", "32px", "48px"] },
  borderRadius: { sm: "4px", md: "8px", lg: "12px", full: "9999px" },
  shadows: { sm: "0 1px 2px rgba(0,0,0,0.1)", md: "0 4px 12px rgba(0,0,0,0.15)" },
  componentPatterns: [
    { name: "Button", description: "Primary action button", tailwindClasses: "bg-yellow-300 text-black px-6 py-2 rounded-lg font-semibold" },
  ],
};

describe("toDesignMd", () => {
  it("produces valid markdown with all sections", () => {
    const md = toDesignMd(SAMPLE_DS);
    expect(md).toContain("# DESIGN.md");
    expect(md).toContain("## Colors");
    expect(md).toContain("`#E8FF59`");
    expect(md).toContain("## Typography");
    expect(md).toContain("`Inter`");
    expect(md).toContain("### Scale");
    expect(md).toContain("## Spacing");
    expect(md).toContain("`4px`");
    expect(md).toContain("## Border Radius");
    expect(md).toContain("## Shadows");
    expect(md).toContain("## Component Patterns");
    expect(md).toContain("### Button");
  });
});

describe("parseDesignMd", () => {
  it("round-trips through toDesignMd → parseDesignMd", () => {
    const md = toDesignMd(SAMPLE_DS);
    const parsed = parseDesignMd(md);

    expect(parsed.colors?.primary).toBe("#E8FF59");
    expect(parsed.colors?.secondary).toBe("#59FFD2");
    expect(parsed.colors?.accent).toBe("#C59FFF");
    expect(parsed.colors?.background).toBe("#0A0A0F");
    expect(parsed.colors?.surface).toBe("#1a1a25");
    expect(parsed.colors?.text?.primary).toBe("#ffffff");
    expect(parsed.colors?.text?.secondary).toBe("#aaaaaa");
    expect(parsed.colors?.text?.muted).toBe("#555555");
  });

  it("parses typography section", () => {
    const md = toDesignMd(SAMPLE_DS);
    const parsed = parseDesignMd(md);

    expect(parsed.typography?.fontFamilies.heading).toBe("Inter");
    expect(parsed.typography?.fontFamilies.body).toBe("Inter");
    expect(parsed.typography?.fontFamilies.mono).toBe("JetBrains Mono");
    expect(parsed.typography?.scale?.base).toBe("1rem");
  });

  it("parses spacing section", () => {
    const md = toDesignMd(SAMPLE_DS);
    const parsed = parseDesignMd(md);

    expect(parsed.spacing?.unit).toBe("4px");
    expect(parsed.spacing?.scale).toContain("8px");
    expect(parsed.spacing?.scale?.length).toBe(7);
  });

  it("parses border radius and shadows", () => {
    const md = toDesignMd(SAMPLE_DS);
    const parsed = parseDesignMd(md);

    expect(parsed.borderRadius?.sm).toBe("4px");
    expect(parsed.borderRadius?.full).toBe("9999px");
    expect(parsed.shadows?.sm).toBe("0 1px 2px rgba(0,0,0,0.1)");
  });

  it("parses component patterns", () => {
    const md = toDesignMd(SAMPLE_DS);
    const parsed = parseDesignMd(md);

    expect(parsed.componentPatterns?.length).toBe(1);
    expect(parsed.componentPatterns?.[0].name).toBe("Button");
    expect(parsed.componentPatterns?.[0].tailwindClasses).toContain("bg-yellow-300");
  });

  it("returns empty object for empty input", () => {
    expect(parseDesignMd("")).toEqual({});
    expect(parseDesignMd("# nothing relevant")).toEqual({});
  });
});
