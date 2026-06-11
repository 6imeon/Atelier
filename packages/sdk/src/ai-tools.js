"use strict";
/**
 * Vercel AI SDK integration:
 *   import { canvasTools } from "@canvas-ai/sdk/ai";
 *   const { text } = await generateText({ model, tools: canvasTools(), prompt: "..." });
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.canvasTools = canvasTools;
const ai_1 = require("ai");
const zod_1 = require("zod");
const index_js_1 = require("./index.js");
function canvasTools(opts = {}) {
    const sdk = new index_js_1.CanvasAI({ apiKey: opts.apiKey });
    const all = {
        create_project: (0, ai_1.tool)({
            description: "Create a new design project",
            parameters: zod_1.z.object({ title: zod_1.z.string() }),
            execute: async ({ title }) => { const p = sdk.createProject(title); return { id: p.id, title }; },
        }),
        generate_screen: (0, ai_1.tool)({
            description: "Generate a UI screen from text",
            parameters: zod_1.z.object({
                projectId: zod_1.z.string(), prompt: zod_1.z.string(),
                deviceType: zod_1.z.enum(["MOBILE", "DESKTOP", "TABLET", "AGNOSTIC"]).default("DESKTOP"),
            }),
            execute: async ({ projectId, prompt, deviceType }) => {
                const s = await sdk.project(projectId).generate(prompt, deviceType);
                return { screenId: s.id, html: await s.getHtml() };
            },
        }),
        generate_from_image: (0, ai_1.tool)({
            description: "Generate UI from a sketch/screenshot",
            parameters: zod_1.z.object({
                projectId: zod_1.z.string(), imageBase64: zod_1.z.string(),
                prompt: zod_1.z.string().optional(), deviceType: zod_1.z.enum(["MOBILE", "DESKTOP", "TABLET", "AGNOSTIC"]).default("DESKTOP"),
            }),
            execute: async ({ projectId, imageBase64, prompt, deviceType }) => {
                const s = await sdk.project(projectId).generateFromImage(imageBase64, prompt ?? "", deviceType);
                return { screenId: s.id, html: await s.getHtml() };
            },
        }),
        edit_screen: (0, ai_1.tool)({
            description: "Edit a screen with a text prompt",
            parameters: zod_1.z.object({ projectId: zod_1.z.string(), screenId: zod_1.z.string(), prompt: zod_1.z.string() }),
            execute: async ({ projectId, screenId, prompt }) => {
                const scr = await sdk.project(projectId).getScreen(screenId);
                if (!scr)
                    throw new Error("Screen not found");
                const ed = await scr.edit(prompt);
                return { screenId: ed.id, html: await ed.getHtml() };
            },
        }),
        generate_variants: (0, ai_1.tool)({
            description: "Generate design variants",
            parameters: zod_1.z.object({
                projectId: zod_1.z.string(), screenId: zod_1.z.string(), prompt: zod_1.z.string(),
                variantCount: zod_1.z.number().min(1).max(5).default(3),
                creativeRange: zod_1.z.enum(["REFINE", "EXPLORE", "REIMAGINE"]).default("EXPLORE"),
            }),
            execute: async ({ projectId, screenId, prompt, variantCount, creativeRange }) => {
                const scr = await sdk.project(projectId).getScreen(screenId);
                if (!scr)
                    throw new Error("Screen not found");
                const vars = await scr.variants(prompt, { variantCount, creativeRange });
                return Promise.all(vars.map(async (v) => ({ screenId: v.id, html: await v.getHtml() })));
            },
        }),
        get_screen: (0, ai_1.tool)({
            description: "Get a screen's HTML",
            parameters: zod_1.z.object({ projectId: zod_1.z.string(), screenId: zod_1.z.string() }),
            execute: async ({ projectId, screenId }) => {
                const scr = await sdk.project(projectId).getScreen(screenId);
                if (!scr)
                    throw new Error("Screen not found");
                return { screenId: scr.id, html: await scr.getHtml(), prompt: scr.prompt };
            },
        }),
        export_react: (0, ai_1.tool)({
            description: "Export a screen as React",
            parameters: zod_1.z.object({ projectId: zod_1.z.string(), screenId: zod_1.z.string() }),
            execute: async ({ projectId, screenId }) => {
                const scr = await sdk.project(projectId).getScreen(screenId);
                if (!scr)
                    throw new Error("Screen not found");
                return { code: await scr.exportReact() };
            },
        }),
        extract_design: (0, ai_1.tool)({
            description: "Extract design tokens from a URL",
            parameters: zod_1.z.object({ projectId: zod_1.z.string(), url: zod_1.z.string().url() }),
            execute: async ({ projectId, url }) => sdk.project(projectId).extractDesignFromURL(url),
        }),
    };
    if (opts.include) {
        const filtered = {};
        for (const n of opts.include)
            if (n in all)
                filtered[n] = all[n];
        return filtered;
    }
    return all;
}
//# sourceMappingURL=ai-tools.js.map