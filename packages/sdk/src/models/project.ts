import { Screen, ScreenData, DeviceType, ComponentNode } from "./screen.js";
import { DesignSystem } from "./design-system.js";
import { ComponentLibrary } from "./component.js";
import { getRouter } from "../utils/router.js";
import { PROMPTS } from "../utils/prompts.js";
import { autoMatchPersona, buildPersonaPrompt } from "../utils/personas.js";
import type { ParsedSection } from "../utils/section-parser.js";
import { NOOP_RUN, type PipelineRun } from "../utils/logger.js";

// Re-export types/functions from extracted modules so existing imports still work
export { ConsistencyConstraints, extractConsistencyConstraints, injectWhyAttributes } from "./consistency.js";
export { classifyIndustry, detectPageType } from "./industry.js";
export {
  detectContentHint, matchComponentsForSection, detectSectionTypeFromLabel, buildSectionPrompt,
} from "./section-generator.js";

// Import for internal delegation
import {
  redesignFromURL as _redesignFromURL,
  planRedesign as _planRedesign,
  extractDesignFromURL as _extractDesignFromURL,
  type RedesignContext,
} from "./redesign.js";
import {
  generatePage as _generatePage,
  generatePageSectioned as _generatePageSectioned,
  type PageGenerationContext,
} from "./section-generator.js";
import type { ConsistencyConstraints } from "./consistency.js";

export type ProgressCallback = (stage: string, detail?: string) => void;

export interface ProjectData {
  id: string;
  title: string;
  designSystem?: DesignSystem;
  screens: ScreenData[];
  ownerId?: string | null;
  lastAccessedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UserData {
  id: string;
  entraOid?: string | null;
  email: string;
  displayName: string;
  avatarUrl?: string | null;
  createdAt: string;
  lastLogin: string;
}

export interface ListProjectsOptions {
  ownerId?: string;
  includeExpired?: boolean;
  limit?: number;
  cursor?: string;
}

export class Project {
  readonly id: string;
  readonly title: string;
  private _designSystem: DesignSystem | null;
  private _screens: Map<string, Screen>;
  private _componentLibrary: ComponentLibrary | null = null;

  constructor(data: ProjectData) {
    this.id = data.id;
    this.title = data.title;
    this._designSystem = data.designSystem ?? null;
    this._screens = new Map();
    for (const s of data.screens ?? []) this._screens.set(s.id, new Screen(s));
  }

  async screens(): Promise<Screen[]> { return [...this._screens.values()]; }
  async getScreen(id: string): Promise<Screen | null> { return this._screens.get(id) ?? null; }
  getDesignSystem(): DesignSystem | null { return this._designSystem; }
  setDesignSystem(ds: DesignSystem) { this._designSystem = ds; }
  getComponentLibrary(): ComponentLibrary | null { return this._componentLibrary; }
  setComponentLibrary(lib: ComponentLibrary) { this._componentLibrary = lib; }

  /** Build context object for redesign functions */
  private _redesignCtx(): RedesignContext {
    return {
      projectId: this.id,
      designSystem: this._designSystem,
      componentLibrary: this._componentLibrary,
      addScreen: (screen: Screen) => this._screens.set(screen.id, screen),
    };
  }

  /** Build context object for page generation functions */
  private _pageCtx(): PageGenerationContext {
    return {
      projectId: this.id,
      designSystem: this._designSystem,
      componentLibrary: this._componentLibrary,
      addScreen: (screen: Screen) => this._screens.set(screen.id, screen),
    };
  }

  async generate(prompt: string, deviceType: DeviceType = "DESKTOP", onProgress?: ProgressCallback, logger?: PipelineRun): Promise<Screen> {
    const log = logger || NOOP_RUN;
    const router = getRouter();
    const lib = this._componentLibrary;
    const hasComponents = lib && lib.all().length > 0;

    // Step 1: Parse intent + plan sections
    onProgress?.("Analyzing prompt...");
    const intent = await router.routeJSON("intent_parse", [
      { role: "system", content: PROMPTS.INTENT_SYSTEM },
      { role: "user", content: prompt },
    ]);

    // Step 2: Plan section layout (AI decides which sections to include)
    onProgress?.("Planning sections...");
    const planResult = await router.routeJSON<{ sections: Array<{ type: string; label: string; description: string }> }>("intent_parse", [
      { role: "system", content: `You are a web page structure planner. Given a page request, output a JSON object with a "sections" array. Each section has:
- "type": one of "navbar", "hero", "features", "cards", "testimonials", "pricing", "cta", "footer", "stats", "team", "gallery", "faq", "forms", "banner"
- "label": a short descriptive label (e.g. "Hero with CTA", "Feature Grid")
- "description": what content this section should contain

Plan 6-10 sections for a complete, professional page. Always start with navbar and end with footer.` },
      { role: "user", content: prompt },
    ]);

    const sections = planResult.sections ?? [];
    if (sections.length < 3) {
      // Fallback: if planning fails, generate as single page
      log.info(`Section planning returned ${sections.length} sections — using single-call`);
      return this._generateSingleCall(prompt, intent, deviceType, onProgress);
    }
    log.info(`Planned ${sections.length} sections: ${sections.map(s => s.type).join(", ")}`);

    // Step 3: Match persona + components
    const persona = autoMatchPersona({ userPrompt: prompt });
    const personaPrefix = persona ? buildPersonaPrompt(persona) : "";
    onProgress?.("Matching design persona...", persona ? `${persona.name} (matched)` : "Default style");

    let componentContext = "";
    if (hasComponents) {
      onProgress?.("Selecting components...", `${lib.all().length} in library`);
      try {
        const selection = await lib.selectForPrompt(prompt);
        componentContext = lib.toPromptContext(selection);
        for (const { component } of selection.matched) lib.recordUsage(component.id);
        onProgress?.("Components matched", `${selection.matched.length} matched, ${selection.gaps.length} gaps`);
        log.debug(`Selected ${selection.matched.length} components, ${selection.gaps.length} gaps`);
      } catch { /* proceed without components */ }
    }

    // Step 4: Generate each section
    onProgress?.(`Generating ${sections.length} sections...`, sections.map(s => s.type).join(", "));
    const generatedSections: string[] = [];
    for (let i = 0; i < sections.length; i++) {
      const sec = sections[i];
      onProgress?.(`Section ${i + 1}/${sections.length}: ${sec.type}`, sec.label);

      const sectionPrompt = `${personaPrefix}
Generate a SINGLE HTML section for a web page.
Section type: ${sec.type}
Section purpose: ${sec.label} — ${sec.description}
Overall page context: ${prompt}
Device: ${deviceType}
Design system: ${JSON.stringify(this._designSystem ?? {})}
${componentContext ? `\nAvailable components:\n${componentContext}` : ""}

Rules:
- Output ONLY the <section>, <nav>, <header>, or <footer> element — no <html>, <head>, <body>, or <style> tags
- Use Tailwind CSS classes exclusively
- Include data-why-type="${sec.type}" data-why-label="${sec.label}" attributes on the root element
${persona ? `- Design persona: ${persona.name}` : ""}
- Use realistic placeholder content (not Lorem ipsum)
- Include responsive classes (mobile-first)`;

      try {
        const result = await router.routeJSON<{ html: string }>("section_generate", [
          { role: "system", content: PROMPTS.SECTION_GENERATE_SYSTEM ?? "You generate individual HTML sections using Tailwind CSS. Return JSON with an \"html\" field containing the section HTML." },
          { role: "user", content: sectionPrompt },
        ]);
        let html = result.html || "";
        html = html.replace(/^```html?\s*/i, "").replace(/```\s*$/, "").trim();
        if (html.length > 50) {
          // Wrap inline scripts in IIFE to avoid variable collisions between sections
          html = html.replace(/<script>(?!.*<\/script>.*<script>)([\s\S]*?)<\/script>/gi, (_m, body) => {
            return `<script>(function(){${body}})()</script>`;
          });
          generatedSections.push(html);
          onProgress?.(`Section ${i + 1}/${sections.length} complete`, `${sec.type} — ${html.length} chars`);
        } else {
          log.warn(`Section ${i + 1} (${sec.type}) returned short HTML, skipping`);
          onProgress?.(`Section ${i + 1}/${sections.length} skipped`, `${sec.type} — too short`);
        }
      } catch (err) {
        log.warn(`Section ${i + 1} (${sec.type}) failed: ${err instanceof Error ? err.message : err}`);
        onProgress?.(`Section ${i + 1}/${sections.length} failed`, sec.type);
      }
    }

    if (generatedSections.length < 2) {
      log.warn(`Only ${generatedSections.length} sections — falling back to single-call`);
      return this._generateSingleCall(prompt, intent, deviceType, onProgress);
    }

    // Step 5: Assemble into full page
    onProgress?.("Assembling page...");
    const assembledHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${typeof (intent as any)?.pageTitle === "string" ? (intent as any).pageTitle : "Generated Page"}</title>
<script src="https://cdn.tailwindcss.com"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js"></script>
<link href="https://fonts.googleapis.com/css2?family=${encodeURIComponent(this._designSystem?.typography?.fontFamilies?.heading || "Inter")}:wght@300;400;500;600;700;800;900&family=${encodeURIComponent(this._designSystem?.typography?.fontFamilies?.body || "Inter")}:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<style>body { font-family: '${this._designSystem?.typography?.fontFamilies?.body || "Inter"}', sans-serif; margin: 0; } h1,h2,h3,h4,h5,h6 { font-family: '${this._designSystem?.typography?.fontFamilies?.heading || "Inter"}', sans-serif; }</style>
</head>
<body>
${generatedSections.join("\n\n")}
</body>
</html>`;

    onProgress?.("Complete!");
    const id = `scr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const screen = new Screen({
      id, projectId: this.id, prompt, html: assembledHtml, deviceType,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    });
    this._screens.set(id, screen);
    return screen;
  }

  /** Fallback: single-call generation (no sections) */
  private async _generateSingleCall(prompt: string, intent: unknown, deviceType: DeviceType, onProgress?: ProgressCallback): Promise<Screen> {
    const router = getRouter();
    const persona = autoMatchPersona({ userPrompt: prompt });
    const personaPrefix = persona ? buildPersonaPrompt(persona) : "";
    const systemPrompt = personaPrefix + PROMPTS.LAYOUT_SYSTEM;

    onProgress?.("Generating layout...", "This may take a minute");
    const result = await router.routeJSON<{
      html: string; componentTree?: ComponentNode; designTokens?: Record<string, unknown>;
    }>("layout_generate", [
      { role: "system", content: systemPrompt },
      { role: "user", content: JSON.stringify({ intent, designSystem: this._designSystem, deviceType }) },
    ]);
    onProgress?.("Complete!");
    const id = `scr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const screen = new Screen({
      id, projectId: this.id, prompt, html: result.html, deviceType,
      componentTree: result.componentTree,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    });
    this._screens.set(id, screen);
    return screen;
  }

  async generateFromImage(imageBase64: string, prompt = "", deviceType: DeviceType = "DESKTOP"): Promise<Screen> {
    const router = getRouter();
    const vis = await router.routeJSON("vision_interpret", [{
      role: "user",
      content: [
        { type: "image_url", image_url: { url: `data:image/png;base64,${imageBase64}` } },
        { type: "text", text: prompt ? `Analyze this UI. Context: ${prompt}` : "Analyze this UI in detail." },
      ],
    }]);
    let intent = {};
    if (prompt) {
      intent = await router.routeJSON("intent_parse", [
        { role: "system", content: PROMPTS.INTENT_SYSTEM },
        { role: "user", content: prompt },
      ]);
    }
    const result = await router.routeJSON<{ html: string; componentTree?: ComponentNode }>(
      "layout_generate",
      [
        { role: "system", content: PROMPTS.LAYOUT_SYSTEM },
        { role: "user", content: JSON.stringify({ intent, visualContext: vis, designSystem: this._designSystem, deviceType }) },
      ]
    );
    const id = `scr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const screen = new Screen({
      id, projectId: this.id, prompt: prompt || "[from image]", html: result.html,
      deviceType, componentTree: result.componentTree,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    });
    this._screens.set(id, screen);
    return screen;
  }

  async redesignFromURL(url: string, prompt: string, deviceType: DeviceType = "DESKTOP", onProgress?: ProgressCallback, premiumScroll?: boolean, logger?: PipelineRun): Promise<Screen> {
    return _redesignFromURL(this._redesignCtx(), url, prompt, deviceType, onProgress, premiumScroll, logger);
  }

  async planRedesign(url: string, userPrompt?: string, onProgress?: ProgressCallback, logger?: PipelineRun): Promise<{
    brandName: string;
    designSystemName: string;
    analysis: string;
    proposedPages: Array<{ title: string; description: string }>;
    designTokens: Record<string, unknown>;
    fetchedContent: { textContent: string; stripped: string; fetchSucceeded: boolean; parsedSections?: ParsedSection[]; sourceImages?: string[]; sourceVideos?: string[]; businessInfo?: import("../utils/business-info.js").BusinessInfo | null };
  }> {
    return _planRedesign(this._redesignCtx(), url, userPrompt, onProgress, logger);
  }

  async generatePage(
    url: string,
    pageTitle: string,
    pageDescription: string,
    brandName: string,
    fetchedContent: { textContent: string; stripped: string; fetchSucceeded: boolean; parsedSections?: ParsedSection[]; sourceImages?: string[]; sourceVideos?: string[]; businessInfo?: import("../utils/business-info.js").BusinessInfo | null },
    designTokens: Record<string, unknown>,
    deviceType: DeviceType = "DESKTOP",
    onProgress?: ProgressCallback,
  ): Promise<Screen> {
    return _generatePage(this._pageCtx(), url, pageTitle, pageDescription, brandName, fetchedContent, designTokens, deviceType, onProgress);
  }

  async generatePageSectioned(
    url: string,
    pageTitle: string,
    pageDescription: string,
    brandName: string,
    fetchedContent: { textContent: string; stripped: string; fetchSucceeded: boolean; parsedSections?: ParsedSection[]; sourceImages?: string[]; sourceVideos?: string[]; businessInfo?: import("../utils/business-info.js").BusinessInfo | null },
    designTokens: Record<string, unknown>,
    deviceType: DeviceType = "DESKTOP",
    onProgress?: ProgressCallback,
    consistencyConstraints?: ConsistencyConstraints,
    premiumScroll?: boolean,
    logger?: PipelineRun,
  ): Promise<Screen> {
    return _generatePageSectioned(this._pageCtx(), url, pageTitle, pageDescription, brandName, fetchedContent, designTokens, deviceType, onProgress, consistencyConstraints, premiumScroll, logger, fetchedContent.businessInfo);
  }

  async extractDesignFromURL(url: string): Promise<Record<string, unknown>> {
    return _extractDesignFromURL(url);
  }

  toJSON(): ProjectData {
    return {
      id: this.id, title: this.title, designSystem: this._designSystem ?? undefined,
      screens: [...this._screens.values()].map(s => s.toJSON()),
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
  }
}
