/**
 * Component Library types and ComponentLibrary class for hybrid AI + asset approach.
 */
import { getRouter } from "../utils/router.js";
import { PROMPTS } from "../utils/prompts.js";

// --- Types ---

export type ComponentCategory =
  | "navbar" | "hero" | "features" | "cards" | "testimonials"
  | "pricing" | "cta" | "footer" | "forms" | "stats"
  | "team" | "gallery" | "faq" | "sidebar" | "modal" | "banner"
  | "carousel";

export type Adaptability = "rigid" | "flexible" | "fluid";

export interface ComponentSlot {
  name: string;       // "headline", "cta_text", "image_url"
  type: "text" | "image" | "icon" | "list" | "richtext";
  placeholder: string; // Default content
  required: boolean;
}

export interface ComponentVariant {
  id: string;
  name: string;
  html: string;
  preview?: string;
}

export interface UIComponentData {
  id: string;
  category: ComponentCategory;
  name: string;
  description: string;
  html: string;
  thumbnail?: string;
  tokens: {
    colors: string[];
    fonts: string[];
    radius: boolean;
  };
  slots: ComponentSlot[];
  variants: ComponentVariant[];
  tags: string[];
  source: string;        // "scraped:url" | "curated" | "ai-generated"
  adaptability: Adaptability;
  quality: number;       // 1-5
  positiveRatings: number;
  negativeRatings: number;
  compositeScore: number;
  elo: { rating: number; matches: number; wins: number; sigma: number };
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ComponentSelection {
  matched: Array<{
    component: UIComponentData;
    adaptationNotes: string;
  }>;
  gaps: string[];
}

// --- ComponentLibrary class ---

export class ComponentLibrary {
  private _components: Map<string, UIComponentData> = new Map();

  /** Load components from an array (e.g., from storage) */
  load(components: UIComponentData[]) {
    for (const c of components) this._components.set(c.id, c);
  }

  /** Add a single component */
  add(component: UIComponentData) {
    this._components.set(component.id, component);
  }

  /** Get all components */
  all(): UIComponentData[] {
    return [...this._components.values()];
  }

  /** Get components by category */
  getByCategory(category: ComponentCategory): UIComponentData[] {
    return this.all().filter(c => c.category === category);
  }

  /** Search components by description/name/tags */
  search(query: string): UIComponentData[] {
    const q = query.toLowerCase();
    return this.all().filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.description.toLowerCase().includes(q) ||
      c.tags.some(t => t.toLowerCase().includes(q))
    );
  }

  /** Get top components by usage */
  topUsed(limit = 10): UIComponentData[] {
    return this.all().sort((a, b) => b.usageCount - a.usageCount).slice(0, limit);
  }

  /** AI-powered: select best components for a prompt and identify gaps */
  async selectForPrompt(prompt: string, designContext?: string): Promise<ComponentSelection> {
    const router = getRouter();
    // Build a compact catalog: id, category, name, description, adaptability
    const catalog = this.all()
      .filter(c => c.quality >= 3)
      .sort((a, b) => {
        // Prefer higher ELO, then compositeScore, then quality
        const eloA = a.elo?.rating ?? 1500;
        const eloB = b.elo?.rating ?? 1500;
        return (eloB - eloA) || (b.compositeScore - a.compositeScore) || (b.quality - a.quality);
      })
      .map(c => `[${c.id}] ${c.category} — ${c.name} (${c.adaptability}): ${c.description}`)
      .join("\n");

    if (!catalog) {
      return { matched: [], gaps: ["full page — no components in library"] };
    }

    const result = await router.routeJSON<{
      selections: Array<{ id: string; reason: string; adaptationNotes: string }>;
      gaps: string[];
    }>("intent_parse", [
      { role: "system", content: `You are a UI component selector. Given a user's page request and a component catalog, select the best components to assemble the page and identify any gaps.

Return JSON: { "selections": [{ "id": "component-id", "reason": "why this fits", "adaptationNotes": "how to adapt it" }], "gaps": ["description of sections that need AI generation"] }

Select 4-8 components that together form a complete page. Order them top-to-bottom as they'd appear on the page.` },
      { role: "user", content: `PAGE REQUEST: ${prompt}
${designContext ? `\nDESIGN CONTEXT: ${designContext}` : ""}

AVAILABLE COMPONENTS:
${catalog}` },
    ]);

    const matched = result.selections
      .map(s => {
        const component = this._components.get(s.id);
        if (!component) return null;
        return { component, adaptationNotes: s.adaptationNotes };
      })
      .filter((m): m is NonNullable<typeof m> => m !== null);

    return { matched, gaps: result.gaps || [] };
  }

  /**
   * Format selected components as prompt context for the layout generator.
   * Only sends the HTML for matched components, not the entire library.
   */
  toPromptContext(selection: ComponentSelection): string {
    if (selection.matched.length === 0 && selection.gaps.length === 0) return "";

    let ctx = "=== LIBRARY COMPONENTS (use these as your foundation) ===\n\n";

    for (const { component, adaptationNotes } of selection.matched) {
      ctx += `[${component.id}] ${component.name} — adaptability: ${component.adaptability}\n`;
      if (component.slots.length > 0) {
        ctx += `Slots: ${component.slots.map(s => `{${s.name}}`).join(", ")}\n`;
      }
      if (adaptationNotes) {
        ctx += `Adaptation: ${adaptationNotes}\n`;
      }
      // Truncate very long HTML to save tokens
      const html = component.html.length > 3000
        ? component.html.slice(0, 3000) + "\n<!-- truncated -->"
        : component.html;
      ctx += html + "\n\n";
    }

    if (selection.gaps.length > 0) {
      ctx += "=== SECTIONS TO GENERATE (no matching component) ===\n";
      for (const gap of selection.gaps) {
        ctx += `- ${gap}\n`;
      }
      ctx += "\n";
    }

    return ctx;
  }

  /** AI: customize a component with natural language */
  async customizeComponent(component: UIComponentData, instruction: string): Promise<string> {
    const router = getRouter();
    const result = await router.routeJSON<{ html: string }>("design_refine", [
      { role: "system", content: `You are a UI component customizer. Given a Tailwind HTML component and a modification instruction, return the modified HTML.
Return JSON: { "html": "...modified HTML..." }
Preserve the overall structure and Tailwind classes. Only modify what's requested.` },
      { role: "user", content: `COMPONENT: ${component.name}\n\nHTML:\n${component.html}\n\nINSTRUCTION: ${instruction}` },
    ]);
    return result.html;
  }

  /** AI: generate a new component from description, optionally matching a style reference */
  async generateComponent(
    description: string,
    category: ComponentCategory,
    styleReference?: UIComponentData
  ): Promise<UIComponentData> {
    const router = getRouter();
    const refCtx = styleReference
      ? `\n\nMATCH THIS STYLE (same spacing, radius, shadows, color patterns):\n${styleReference.html.slice(0, 2000)}`
      : "";

    const result = await router.routeJSON<{ html: string; name: string; description: string; tags: string[] }>(
      "layout_generate",
      [
        { role: "system", content: `Generate a single UI section component using Tailwind CSS.
Return JSON: { "html": "...complete section HTML...", "name": "Component Name", "description": "What it does", "tags": ["tag1", "tag2"] }
Use <script src="https://cdn.tailwindcss.com"></script> is NOT needed — just the section HTML.
Make it responsive, accessible, and production-quality.${refCtx}` },
        { role: "user", content: `Generate a ${category} component: ${description}` },
      ]
    );

    const id = `${category}-gen-${Date.now()}`;
    return {
      id,
      category,
      name: result.name || description.slice(0, 50),
      description: result.description || description,
      html: result.html,
      tokens: { colors: ["primary", "surface", "text"], fonts: ["headline", "body"], radius: true },
      slots: [],
      variants: [],
      tags: result.tags || [],
      source: "ai-generated",
      adaptability: "fluid",
      quality: 3,
      positiveRatings: 0,
      negativeRatings: 0,
      compositeScore: 3,
      elo: { rating: 1500, matches: 0, wins: 0, sigma: 350 },
      usageCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  /** Record that a component was used in a generation */
  recordUsage(componentId: string) {
    const c = this._components.get(componentId);
    if (c) c.usageCount++;
  }

  /** Get library stats */
  stats(): { total: number; byCategory: Record<string, number>; bySource: Record<string, number> } {
    const byCategory: Record<string, number> = {};
    const bySource: Record<string, number> = {};
    for (const c of this._components.values()) {
      byCategory[c.category] = (byCategory[c.category] || 0) + 1;
      bySource[c.source] = (bySource[c.source] || 0) + 1;
    }
    return { total: this._components.size, byCategory, bySource };
  }
}
