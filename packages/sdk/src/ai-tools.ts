/**
 * Vercel AI SDK integration:
 *   import { canvasTools } from "@canvas-ai/sdk/ai";
 *   const { text } = await generateText({ model, tools: canvasTools(), prompt: "..." });
 */

import { tool } from "ai";
import { z } from "zod";
import { CanvasAI } from "./index.js";

export function canvasTools(opts: { apiKey?: string; include?: string[] } = {}) {
  const sdk = new CanvasAI({ apiKey: opts.apiKey });

  const all: Record<string, any> = {
    create_project: tool({
      description: "Create a new design project",
      parameters: z.object({ title: z.string() }),
      execute: async ({ title }) => { const p = sdk.createProject(title); return { id: p.id, title }; },
    }),
    generate_screen: tool({
      description: "Generate a UI screen from text",
      parameters: z.object({
        projectId: z.string(), prompt: z.string(),
        deviceType: z.enum(["MOBILE","DESKTOP","TABLET","AGNOSTIC"]).default("DESKTOP"),
      }),
      execute: async ({ projectId, prompt, deviceType }) => {
        const s = await sdk.project(projectId).generate(prompt, deviceType);
        return { screenId: s.id, html: await s.getHtml() };
      },
    }),
    generate_from_image: tool({
      description: "Generate UI from a sketch/screenshot",
      parameters: z.object({
        projectId: z.string(), imageBase64: z.string(),
        prompt: z.string().optional(), deviceType: z.enum(["MOBILE","DESKTOP","TABLET","AGNOSTIC"]).default("DESKTOP"),
      }),
      execute: async ({ projectId, imageBase64, prompt, deviceType }) => {
        const s = await sdk.project(projectId).generateFromImage(imageBase64, prompt ?? "", deviceType);
        return { screenId: s.id, html: await s.getHtml() };
      },
    }),
    edit_screen: tool({
      description: "Edit a screen with a text prompt",
      parameters: z.object({ projectId: z.string(), screenId: z.string(), prompt: z.string() }),
      execute: async ({ projectId, screenId, prompt }) => {
        const scr = await sdk.project(projectId).getScreen(screenId);
        if (!scr) throw new Error("Screen not found");
        const ed = await scr.edit(prompt);
        return { screenId: ed.id, html: await ed.getHtml() };
      },
    }),
    generate_variants: tool({
      description: "Generate design variants",
      parameters: z.object({
        projectId: z.string(), screenId: z.string(), prompt: z.string(),
        variantCount: z.number().min(1).max(5).default(3),
        creativeRange: z.enum(["REFINE","EXPLORE","REIMAGINE"]).default("EXPLORE"),
      }),
      execute: async ({ projectId, screenId, prompt, variantCount, creativeRange }) => {
        const scr = await sdk.project(projectId).getScreen(screenId);
        if (!scr) throw new Error("Screen not found");
        const vars = await scr.variants(prompt, { variantCount, creativeRange });
        return Promise.all(vars.map(async v => ({ screenId: v.id, html: await v.getHtml() })));
      },
    }),
    get_screen: tool({
      description: "Get a screen's HTML",
      parameters: z.object({ projectId: z.string(), screenId: z.string() }),
      execute: async ({ projectId, screenId }) => {
        const scr = await sdk.project(projectId).getScreen(screenId);
        if (!scr) throw new Error("Screen not found");
        return { screenId: scr.id, html: await scr.getHtml(), prompt: scr.prompt };
      },
    }),
    export_react: tool({
      description: "Export a screen as React",
      parameters: z.object({ projectId: z.string(), screenId: z.string() }),
      execute: async ({ projectId, screenId }) => {
        const scr = await sdk.project(projectId).getScreen(screenId);
        if (!scr) throw new Error("Screen not found");
        return { code: await scr.exportReact() };
      },
    }),
    extract_design: tool({
      description: "Extract design tokens from a URL",
      parameters: z.object({ projectId: z.string(), url: z.string().url() }),
      execute: async ({ projectId, url }) => sdk.project(projectId).extractDesignFromURL(url),
    }),
  };

  if (opts.include) {
    const filtered: Record<string, any> = {};
    for (const n of opts.include) if (n in all) filtered[n] = all[n];
    return filtered;
  }
  return all;
}
