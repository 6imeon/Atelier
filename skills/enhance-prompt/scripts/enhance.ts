/**
 * enhance-prompt skill — expands brief UI descriptions into detailed generation prompts.
 *
 * Usage:
 *   npx tsx skills/enhance-prompt/scripts/enhance.ts "a settings page"
 *   npx tsx skills/enhance-prompt/scripts/enhance.ts "dashboard" --device MOBILE --style minimal
 */
import { getCanvasAI } from "@canvas-ai/sdk";
import { getRouter } from "@canvas-ai/sdk/dist/utils/router.js";
import { PROMPTS } from "@canvas-ai/sdk/dist/utils/prompts.js";

interface EnhanceResult {
  original: string;
  enhanced: string;
  components: string[];
  layoutHint: string;
  confidence: number;
}

export async function enhancePrompt(
  prompt: string,
  opts: { device?: string; style?: string } = {},
): Promise<EnhanceResult> {
  const router = getRouter();
  const device = opts.device ?? "DESKTOP";
  const styleHint = opts.style ? ` Style preference: ${opts.style}.` : "";

  const intent = await router.routeJSON<{
    platform: string;
    appType: string;
    components: string[];
    style: Record<string, unknown>;
    layout: string;
    constraints: string[];
  }>("intent_parse", [
    { role: "system", content: PROMPTS.INTENT_SYSTEM },
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
