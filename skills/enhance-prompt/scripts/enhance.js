"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.enhancePrompt = enhancePrompt;
const router_js_1 = require("@canvas-ai/sdk/dist/utils/router.js");
const prompts_js_1 = require("@canvas-ai/sdk/dist/utils/prompts.js");
async function enhancePrompt(prompt, opts = {}) {
    const router = (0, router_js_1.getRouter)();
    const device = opts.device ?? "DESKTOP";
    const styleHint = opts.style ? ` Style preference: ${opts.style}.` : "";
    const intent = await router.routeJSON("intent_parse", [
        { role: "system", content: prompts_js_1.PROMPTS.INTENT_SYSTEM },
        { role: "user", content: `${prompt}. Target device: ${device}.${styleHint}` },
    ]);
    const components = intent.components ?? [];
    const layout = intent.layout ?? "single-page";
    const enhanced = [
        `A ${device.toLowerCase()} ${intent.appType ?? "application"} screen:`,
        prompt,
        components.length ? `Key components: ${components.join(", ")}.` : "",
        `Layout: ${layout}.`,
        intent.style ? `Style: ${JSON.stringify(intent.style)}.` : "",
        styleHint,
        `Use Tailwind CSS. Make it production-quality with proper spacing, typography hierarchy, and responsive design.`,
    ]
        .filter(Boolean)
        .join(" ");
    return {
        original: prompt,
        enhanced,
        components,
        layoutHint: layout,
        confidence: components.length > 0 ? 0.9 : 0.7,
    };
}
// CLI entrypoint
if (process.argv[1]?.includes("enhance")) {
    const args = process.argv.slice(2);
    const prompt = args.find((a) => !a.startsWith("--")) ?? "";
    const device = args.includes("--device") ? args[args.indexOf("--device") + 1] : undefined;
    const style = args.includes("--style") ? args[args.indexOf("--style") + 1] : undefined;
    if (!prompt) {
        console.error("Usage: enhance.ts <prompt> [--device DESKTOP] [--style minimal]");
        process.exit(1);
    }
    enhancePrompt(prompt, { device, style })
        .then((r) => console.log(JSON.stringify(r, null, 2)))
        .catch((e) => {
        console.error(e.message);
        process.exit(1);
    });
}
//# sourceMappingURL=enhance.js.map