import { getRouter } from "../utils/router.js";
import { PROMPTS } from "../utils/prompts.js";

export type DeviceType = "MOBILE" | "DESKTOP" | "TABLET" | "AGNOSTIC";
export type CreativeRange = "REFINE" | "EXPLORE" | "REIMAGINE";
export type DesignAspect = "LAYOUT" | "COLOR_SCHEME" | "IMAGES" | "TEXT_FONT" | "TEXT_CONTENT";

export interface VariantOptions {
  variantCount?: number;
  creativeRange?: CreativeRange;
  aspects?: DesignAspect[];
}

export interface ComponentNode {
  type: string;
  props: Record<string, unknown>;
  children?: ComponentNode[];
  styles?: Record<string, string>;
}

export interface ScreenData {
  id: string;
  projectId: string;
  prompt: string;
  html: string;
  screenshot?: string;
  deviceType: DeviceType;
  designTokens?: Record<string, unknown>;
  componentTree?: ComponentNode;
  createdAt: string;
  updatedAt: string;
}

export class Screen {
  readonly id: string;
  readonly projectId: string;
  readonly prompt: string;
  readonly deviceType: DeviceType;
  private _html: string | null;
  private _screenshot: string | null;
  private _componentTree: ComponentNode | null;

  constructor(data: ScreenData) {
    this.id = data.id;
    this.projectId = data.projectId;
    this.prompt = data.prompt;
    this.deviceType = data.deviceType;
    this._html = data.html ?? null;
    this._screenshot = data.screenshot ?? null;
    this._componentTree = data.componentTree ?? null;
  }

  async getHtml(): Promise<string> {
    if (this._html) return this._html;
    throw new Error("HTML not available");
  }

  async getScreenshot(): Promise<string> {
    if (this._screenshot) return this._screenshot;
    throw new Error("Screenshot not available");
  }

  async edit(prompt: string, deviceType?: DeviceType): Promise<Screen> {
    const router = getRouter();
    const result = await router.routeJSON<{ html: string; componentTree?: ComponentNode }>(
      "design_refine",
      [
        { role: "system", content: PROMPTS.REFINE_SYSTEM },
        { role: "user", content: JSON.stringify({
          currentHtml: await this.getHtml(),
          editRequest: prompt,
          deviceType: deviceType ?? this.deviceType,
        })},
      ]
    );
    return new Screen({
      id: `${this.id}_edit_${Date.now()}`,
      projectId: this.projectId,
      prompt: `${this.prompt} → ${prompt}`,
      html: result.html,
      deviceType: deviceType ?? this.deviceType,
      componentTree: result.componentTree,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  async variants(prompt: string, opts: VariantOptions = {}): Promise<Screen[]> {
    const router = getRouter();
    const result = await router.routeJSON<{
      variants: Array<{ html: string; componentTree?: ComponentNode }>;
    }>("layout_generate", [
      { role: "system", content: PROMPTS.VARIANT_SYSTEM },
      { role: "user", content: JSON.stringify({
        currentHtml: await this.getHtml(),
        variantRequest: prompt,
        count: opts.variantCount ?? 3,
        creativeRange: opts.creativeRange ?? "EXPLORE",
        aspects: opts.aspects ?? ["LAYOUT","COLOR_SCHEME","IMAGES","TEXT_FONT","TEXT_CONTENT"],
        deviceType: this.deviceType,
      })},
    ]);
    return result.variants.map((v, i) => new Screen({
      id: `${this.id}_var${i}_${Date.now()}`,
      projectId: this.projectId,
      prompt: `${this.prompt} → variant: ${prompt}`,
      html: v.html,
      deviceType: this.deviceType,
      componentTree: v.componentTree,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));
  }

  async exportReact(): Promise<string> {
    const router = getRouter();
    const result = await router.routeJSON<{ code: string }>("code_render", [
      { role: "system", content: PROMPTS.REACT_EXPORT_SYSTEM },
      { role: "user", content: await this.getHtml() },
    ]);
    return result.code;
  }

  toJSON(): ScreenData {
    return {
      id: this.id, projectId: this.projectId, prompt: this.prompt,
      html: this._html ?? "", screenshot: this._screenshot ?? undefined,
      deviceType: this.deviceType, componentTree: this._componentTree ?? undefined,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
  }
}
