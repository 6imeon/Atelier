/**
 * Cinematic components smoke test.
 * Loads each component into a headless browser with GSAP + ScrollTrigger,
 * captures JS errors, and verifies ScrollTrigger instances were created.
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const COMPONENTS_PATH = resolve(__dirname, "components-cinematic.json");

const SHELL = (componentHtml: string) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Cinematic test</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js"></script>
  <style>
    body { margin: 0; font-family: Inter, system-ui, sans-serif; background: #000; color: #fff; }
    /* Extra viewport padding so pinned sections have scroll room */
    .spacer { height: 300vh; background: #111; }
  </style>
</head>
<body>
  ${componentHtml}
  <div class="spacer"></div>
</body>
</html>`;

async function main() {
  const { chromium } = await import("playwright");
  const components = JSON.parse(readFileSync(COMPONENTS_PATH, "utf-8")) as Array<{
    id: string; name: string; html: string;
  }>;

  console.log(`Testing ${components.length} cinematic components in headless Chromium\n`);

  const browser = await chromium.launch({ headless: true });
  const results: Array<{ id: string; status: "PASS" | "FAIL" | "WARN"; errors: string[]; stCount: number; gsapOk: boolean }> = [];

  try {
    for (const comp of components) {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const page = await ctx.newPage();
      const consoleErrors: string[] = [];
      const pageErrors: string[] = [];

      page.on("console", msg => {
        if (msg.type() === "error") consoleErrors.push(msg.text());
      });
      page.on("pageerror", err => pageErrors.push(err.message));

      try {
        await page.setContent(SHELL(comp.html), { waitUntil: "networkidle", timeout: 15_000 });
        await page.waitForTimeout(800); // let gsap init

        const info = await page.evaluate(() => {
          const hasGsap = typeof (window as any).gsap !== "undefined";
          const hasST = typeof (window as any).ScrollTrigger !== "undefined";
          const stCount = hasST ? (window as any).ScrollTrigger.getAll().length : 0;
          return { hasGsap, hasST, stCount };
        });

        // Scroll to trigger scroll-bound effects
        await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight / 2, behavior: "instant" }));
        await page.waitForTimeout(300);
        await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
        await page.waitForTimeout(200);

        const allErrors = [...pageErrors, ...consoleErrors];
        const hasHardError = pageErrors.length > 0;
        const gsapOk = info.hasGsap && info.hasST;
        const stCount = info.stCount;

        let status: "PASS" | "FAIL" | "WARN" = "PASS";
        if (hasHardError || !gsapOk) status = "FAIL";
        else if (stCount === 0 || consoleErrors.length > 0) status = "WARN";

        results.push({ id: comp.id, status, errors: allErrors, stCount, gsapOk });

        const symbol = status === "PASS" ? "✓" : status === "WARN" ? "~" : "✗";
        const warnDetail = allErrors.length ? ` [${allErrors[0].slice(0, 80)}]` : "";
        console.log(`${symbol} ${comp.id.padEnd(40)} st=${stCount} ${status}${warnDetail}`);
      } catch (err) {
        results.push({ id: comp.id, status: "FAIL", errors: [err instanceof Error ? err.message : String(err)], stCount: 0, gsapOk: false });
        console.log(`✗ ${comp.id.padEnd(40)} FAIL [${err instanceof Error ? err.message : err}]`);
      } finally {
        await ctx.close();
      }
    }
  } finally {
    await browser.close();
  }

  // Summary
  const pass = results.filter(r => r.status === "PASS").length;
  const warn = results.filter(r => r.status === "WARN").length;
  const fail = results.filter(r => r.status === "FAIL").length;

  console.log(`\n${"=".repeat(60)}`);
  console.log(`PASS: ${pass}   WARN: ${warn}   FAIL: ${fail}   TOTAL: ${results.length}`);

  if (fail > 0) {
    console.log(`\nFailures (${fail}):`);
    results.filter(r => r.status === "FAIL").forEach(r => {
      console.log(`  ${r.id}`);
      r.errors.slice(0, 3).forEach(e => console.log(`    - ${e.slice(0, 200)}`));
    });
  }
  if (warn > 0) {
    console.log(`\nWarnings (${warn}):`);
    results.filter(r => r.status === "WARN").forEach(r => {
      console.log(`  ${r.id} st=${r.stCount}${r.errors.length ? ` - ${r.errors[0].slice(0, 100)}` : ""}`);
    });
  }
}

main().catch(err => { console.error(err); process.exit(1); });
