import { chromium } from "playwright";
import { readFileSync } from "fs";

async function main() {
  const html = readFileSync("/tmp/redesign-strattoncraig-v2.html", "utf-8");
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.setContent(html, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(2000);

  // Slow scroll through the entire page so cinematic scroll-bound timelines fire
  const scrollHeight = await page.evaluate(() => document.documentElement.scrollHeight);
  const viewportHeight = 900;
  for (let y = 0; y <= scrollHeight; y += viewportHeight / 2) {
    await page.evaluate((scrollY) => window.scrollTo({ top: scrollY, behavior: "instant" }), y);
    await page.waitForTimeout(150);
  }
  // End at the bottom — SCRUB animations complete their reveal at end positions
  await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" }));
  await page.waitForTimeout(500);

  const stuck = await page.evaluate(() => {
    const results: Array<{ tag: string; className: string; text: string; opacity: string; transform: string; inlineStyle: string }> = [];
    document.querySelectorAll("*").forEach((el: any) => {
      const cs = window.getComputedStyle(el);
      const text = (el.textContent || "").trim();
      if (cs.opacity === "0" && text.length > 5 && el.children.length === 0) {
        results.push({
          tag: el.tagName,
          className: el.className?.toString().slice(0, 80) || "",
          text: text.slice(0, 60),
          opacity: cs.opacity,
          transform: cs.transform.slice(0, 60),
          inlineStyle: el.getAttribute("style")?.slice(0, 100) || "",
        });
      }
    });
    return results;
  });

  console.log("Stuck-invisible elements:", stuck.length);
  stuck.slice(0, 20).forEach((s, i) => {
    console.log(`\n${i + 1}. <${s.tag}> "${s.text}"`);
    console.log(`   class: ${s.className}`);
    console.log(`   style: ${s.inlineStyle}`);
    console.log(`   computed: opacity=${s.opacity} transform=${s.transform}`);
  });

  await browser.close();
}

main().catch(err => { console.error(err); process.exit(1); });
