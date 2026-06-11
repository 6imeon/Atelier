"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractFromURL = extractFromURL;
exports.fromScreen = fromScreen;
exports.mergeDesignMds = mergeDesignMds;
exports.validateDesignMd = validateDesignMd;
/**
 * design-md skill — extract, generate, and merge DESIGN.md specifications.
 *
 * Usage:
 *   npx tsx skills/design-md/scripts/extract.ts extract --url https://example.com
 *   npx tsx skills/design-md/scripts/extract.ts from-screen <projectId> <screenId>
 *   npx tsx skills/design-md/scripts/extract.ts validate <path-to-design.md>
 */
const sdk_1 = require("@canvas-ai/sdk");
const design_system_js_1 = require("@canvas-ai/sdk/dist/models/design-system.js");
async function extractFromURL(url, projectId = "default") {
    const sdk = (0, sdk_1.getCanvasAI)();
    const ds = await sdk.project(projectId).extractDesignFromURL(url);
    return (0, design_system_js_1.toDesignMd)(ds);
}
async function fromScreen(projectId, screenId) {
    const sdk = (0, sdk_1.getCanvasAI)();
    const screen = await sdk.project(projectId).getScreen(screenId);
    if (!screen)
        throw new Error(`Screen ${screenId} not found`);
    // Use the screen's HTML to extract design tokens via the AI pipeline
    const ds = await sdk.project(projectId).extractDesignFromURL("data:text/html," + encodeURIComponent(await screen.getHtml()));
    return (0, design_system_js_1.toDesignMd)(ds);
}
function mergeDesignMds(...mds) {
    const systems = mds.map((md) => (0, design_system_js_1.parseDesignMd)(md));
    // Merge strategy: last value wins, arrays are concatenated
    const merged = {};
    for (const sys of systems) {
        if (sys.colors)
            merged.colors = { ...merged.colors, ...sys.colors };
        if (sys.typography) {
            merged.typography = {
                fontFamilies: { ...merged.typography?.fontFamilies, ...sys.typography.fontFamilies },
                scale: { ...merged.typography?.scale, ...sys.typography.scale },
            };
        }
        if (sys.spacing)
            merged.spacing = sys.spacing;
        if (sys.borderRadius)
            merged.borderRadius = { ...merged.borderRadius, ...sys.borderRadius };
        if (sys.shadows)
            merged.shadows = { ...merged.shadows, ...sys.shadows };
        if (sys.componentPatterns) {
            const existing = merged.componentPatterns ?? [];
            const newPatterns = sys.componentPatterns.filter((p) => !existing.some((e) => e.name === p.name));
            merged.componentPatterns = [...existing, ...newPatterns];
        }
    }
    return (0, design_system_js_1.toDesignMd)(merged);
}
function validateDesignMd(md) {
    const parsed = (0, design_system_js_1.parseDesignMd)(md);
    const missing = [];
    if (!parsed.colors)
        missing.push("colors");
    if (!parsed.typography)
        missing.push("typography");
    if (!parsed.spacing)
        missing.push("spacing");
    if (!parsed.borderRadius)
        missing.push("borderRadius");
    if (!parsed.shadows)
        missing.push("shadows");
    if (!parsed.componentPatterns?.length)
        missing.push("componentPatterns");
    return { valid: missing.length === 0, missing };
}
// CLI entrypoint
if (process.argv[1]?.includes("extract")) {
    const args = process.argv.slice(2);
    const action = args[0];
    (async () => {
        switch (action) {
            case "extract": {
                const url = args.includes("--url") ? args[args.indexOf("--url") + 1] : args[1];
                if (!url) {
                    console.error("Usage: extract.ts extract --url <url>");
                    process.exit(1);
                }
                const md = await extractFromURL(url);
                console.log(md);
                break;
            }
            case "from-screen": {
                const [, projectId, screenId] = args;
                if (!projectId || !screenId) {
                    console.error("Usage: extract.ts from-screen <projectId> <screenId>");
                    process.exit(1);
                }
                const md = await fromScreen(projectId, screenId);
                console.log(md);
                break;
            }
            case "validate": {
                const { readFileSync } = await import("fs");
                const filePath = args[1];
                if (!filePath) {
                    console.error("Usage: extract.ts validate <path>");
                    process.exit(1);
                }
                const md = readFileSync(filePath, "utf-8");
                const result = validateDesignMd(md);
                console.log(JSON.stringify(result, null, 2));
                process.exit(result.valid ? 0 : 1);
                break;
            }
            default:
                console.error("Actions: extract, from-screen, validate");
                process.exit(1);
        }
    })().catch((e) => { console.error(e.message); process.exit(1); });
}
//# sourceMappingURL=extract.js.map