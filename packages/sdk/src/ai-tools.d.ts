/**
 * Vercel AI SDK integration:
 *   import { canvasTools } from "@canvas-ai/sdk/ai";
 *   const { text } = await generateText({ model, tools: canvasTools(), prompt: "..." });
 */
export declare function canvasTools(opts?: {
    apiKey?: string;
    include?: string[];
}): Record<string, any>;
