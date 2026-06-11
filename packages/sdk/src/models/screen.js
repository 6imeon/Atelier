"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Screen = void 0;
const router_js_1 = require("../utils/router.js");
const prompts_js_1 = require("../utils/prompts.js");
class Screen {
    id;
    projectId;
    prompt;
    deviceType;
    _html;
    _screenshot;
    _componentTree;
    constructor(data) {
        this.id = data.id;
        this.projectId = data.projectId;
        this.prompt = data.prompt;
        this.deviceType = data.deviceType;
        this._html = data.html ?? null;
        this._screenshot = data.screenshot ?? null;
        this._componentTree = data.componentTree ?? null;
    }
    async getHtml() {
        if (this._html)
            return this._html;
        throw new Error("HTML not available");
    }
    async getScreenshot() {
        if (this._screenshot)
            return this._screenshot;
        throw new Error("Screenshot not available");
    }
    async edit(prompt, deviceType) {
        const router = (0, router_js_1.getRouter)();
        const result = await router.routeJSON("design_refine", [
            { role: "system", content: prompts_js_1.PROMPTS.REFINE_SYSTEM },
            { role: "user", content: JSON.stringify({
                    currentHtml: await this.getHtml(),
                    editRequest: prompt,
                    deviceType: deviceType ?? this.deviceType,
                }) },
        ]);
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
    async variants(prompt, opts = {}) {
        const router = (0, router_js_1.getRouter)();
        const result = await router.routeJSON("layout_generate", [
            { role: "system", content: prompts_js_1.PROMPTS.VARIANT_SYSTEM },
            { role: "user", content: JSON.stringify({
                    currentHtml: await this.getHtml(),
                    variantRequest: prompt,
                    count: opts.variantCount ?? 3,
                    creativeRange: opts.creativeRange ?? "EXPLORE",
                    aspects: opts.aspects ?? ["LAYOUT", "COLOR_SCHEME", "IMAGES", "TEXT_FONT", "TEXT_CONTENT"],
                    deviceType: this.deviceType,
                }) },
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
    async exportReact() {
        const router = (0, router_js_1.getRouter)();
        const result = await router.routeJSON("code_render", [
            { role: "system", content: prompts_js_1.PROMPTS.REACT_EXPORT_SYSTEM },
            { role: "user", content: await this.getHtml() },
        ]);
        return result.code;
    }
    toJSON() {
        return {
            id: this.id, projectId: this.projectId, prompt: this.prompt,
            html: this._html ?? "", screenshot: this._screenshot ?? undefined,
            deviceType: this.deviceType, componentTree: this._componentTree ?? undefined,
            createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        };
    }
}
exports.Screen = Screen;
//# sourceMappingURL=screen.js.map