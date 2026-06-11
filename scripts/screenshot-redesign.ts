import { chromium } from "playwright";
import { readFileSync, mkdirSync } from "fs";

async function main() {
  const path = process.argv[2] || "/tmp/redesign-strattoncraig-v2.html";
  const outDir = "/tmp/redesign-shots";
  mkdirSync(outDir, { recursive: true });

  const html = readFileSync(path, "utf-8");
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.setContent(html, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(2500);

  // Slow scroll through each viewport so cinematic timelines fire
  const scrollHeight = await page.evaluate(() => document.documentElement.scrollHeight);
  const vh = 900;
  console.log(`Scroll height: ${scrollHeight}px (${Math.ceil(scrollHeight / vh)} viewports)`);

  // 1. Full-page screenshot for layout overview
  await page.screenshot({ path: `${outDir}/full-page.png`, fullPage: true });
  console.log(`✓ ${outDir}/full-page.png (full page)`);

  // 2. Per-viewport screenshots while scrolling top → bottom
  let shotIdx = 0;
  for (let y = 0; y < scrollHeight; y += vh) {
    await page.evaluate((scrollY) => window.scrollTo({ top: scrollY, behavior: "instant" }), y);
    await page.waitForTimeout(800); // let scrub animations settle
    shotIdx++;
    const file = `${outDir}/scroll-${String(shotIdx).padStart(2, "0")}.png`;
    await page.screenshot({ path: file, fullPage: false });
    console.log(`✓ ${file} (scroll y=${y})`);
  }

  await browser.close();
  console.log(`\nAll screenshots in ${outDir}/`);
}

main().catch(err => { console.error(err); process.exit(1); });
