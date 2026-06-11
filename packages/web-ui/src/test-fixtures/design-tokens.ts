import type { CanvasDesignSystem } from "../stores/canvas-store";

/** Design tokens that match the test template HTML (fonts, colors) */
export const testDesignTokens: Record<string, any> = {
  brandName: "Horizon Studio",
  colors: {
    primary: "#6366f1",
    secondary: "#f59e0b",
    accent: "#10b981",
    background: "#ffffff",
    text: "#111827",
  },
  fonts: {
    headline: "Playfair Display",
    body: "Inter",
  },
  logos: [],
  _meta: {
    analysis:
      "A modern creative agency blending bold indigo with warm amber accents. The palette communicates trust and energy — indigo grounds the brand in professionalism while amber sparks creativity and approachability.",
    personaName: "The Artisan",
    personaId: "artisan",
    personaContent:
      "Meticulous craft meets strategic thinking. Every pixel intentional, every interaction meaningful.",
    proposedPages: [
      { title: "Homepage", description: "Hero, services grid, featured work, testimonials, CTA" },
      { title: "About", description: "Mission, values, team profiles, stats" },
      { title: "Contact", description: "Contact form, office details, email" },
    ],
    url: "https://horizonstudio.test",
    originalBrandName: "Horizon Studio",
  },
};

/** Design system store values matching the templates */
export const testDesignSystem: Partial<CanvasDesignSystem> = {
  seedColor: "#6366f1",
  colorTheme: "Custom",
  palette: {
    primary: "#6366f1",
    secondary: "#f59e0b",
    tertiary: "#10b981",
    neutral: "#e5e7eb",
    background: "#ffffff",
    text: "#111827",
  },
  fonts: {
    headline: "Playfair Display",
    body: "Inter",
    label: "Inter",
  },
  cornerRadius: "8px",
};
