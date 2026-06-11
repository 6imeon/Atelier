/**
 * Track 1B verification — end-to-end test of screenshot capture + animation brief.
 *
 * Tests:
 * 1. captureUrlScrollSequence — headless browser navigates to URL, captures 6 frames
 * 2. generateAnimationBrief — multimodal LLM reverse-engineers effects from frames
 *
 * Usage: npx tsx scripts/verify-track1b.ts
 *   Set OPENROUTER_API_KEY in env to run the brief step.
 */

import { ScreenshotService } from "../packages/sdk/src/screenshot/service.js";
import { generateAnimationBrief } from "../packages/sdk/src/utils/section-classifier.js";
import { getRouter } from "../packages/sdk/src/utils/router.js";

const URL = process.argv[2] || "https://strattoncraig.com";

async function main() {
  console.log(`\n${"=".repeat(72)}`);
  console.log(`Track 1B verification — ${URL}`);
  console.log("=".repeat(72));

  // Step 1: Capture scroll sequence
  console.log(`\n[1/2] Capturing 6-frame scroll sequence...`);
  const svc = new ScreenshotService();
  const t0 = Date.now();
  const seq = await svc.captureUrlScrollSequence(URL, { width: 1440, scale: 1, delayMs: 2000 });
  const captureMs = Date.now() - t0;
  console.log(`  OK: ${seq.buffers.length} frames in ${captureMs}ms`);
  console.log(`  viewport=${seq.width}x900, page height=${seq.height}px`);
  seq.buffers.forEach((b, i) => {
    console.log(`  frame ${i + 1} [${seq.labels[i].padEnd(15)}]: ${Math.round(b.length / 1024)}KB`);
  });

  // Step 2: Generate animation brief
  if (!process.env.OPENROUTER_API_KEY) {
    console.log(`\n[2/2] SKIPPED — no OPENROUTER_API_KEY set. Capture path verified; brief path requires a key.`);
    await svc.close();
    return;
  }

  console.log(`\n[2/2] Generating animation brief via multimodal LLM...`);
  const router = getRouter();
  const t1 = Date.now();
  try {
    const brief = await generateAnimationBrief(router, seq.buffers, seq.labels, "page", []);
    const briefMs = Date.now() - t1;
    console.log(`  OK in ${briefMs}ms`);
    console.log(`\n  Style:      ${brief.animationStyle}`);
    console.log(`  Complexity: ${brief.complexity}`);
    console.log(`  Libraries:  ${brief.libraries.join(", ") || "(none)"}`);
    console.log(`  Effects:    ${brief.effects.length}`);
    brief.effects.slice(0, 8).forEach((e, i) => {
      console.log(`    ${i + 1}. ${e.element}: ${e.animation}`);
      console.log(`       trigger=${e.trigger} timing=${e.timing}`);
      console.log(`       ${e.detail}`);
    });
  } catch (err) {
    console.error(`  FAILED: ${err instanceof Error ? err.message : err}`);
  }

  await svc.close();
}

main().catch(err => { console.error(err); process.exit(1); });
