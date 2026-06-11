import { chromium } from "playwright";
import { readFileSync } from "fs";

async function main() {
  const path = process.argv[2] || "/tmp/redesign-strattoncraig-v2.html";
  const html = readFileSync(path, "utf-8");
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errors: string[] = [];
  const consoleErrors: string[] = [];
  page.on("pageerror", e => errors.push(e.message));
  page.on("console", m => { if (m.type() === "error") consoleErrors.push(m.text()); });
  await page.setContent(html, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(2000);
  // Scroll to mid + back to fire scroll-bound triggers
  await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight / 2, behavior: "instant" }));
  await page.waitForTimeout(500);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.waitForTimeout(500);
  const info = await page.evaluate(() => {
    const w: any = window;
    const visibleText = (document.body.innerText || "").length;
    return {
      hasGsap: typeof w.gsap !== "undefined",
      hasST: typeof w.ScrollTrigger !== "undefined",
      triggerCount: typeof w.ScrollTrigger !== "undefined" ? w.ScrollTrigger.getAll().length : 0,
      sectionsRendered: document.querySelectorAll("section").length,
      navsRendered: document.querySelectorAll("nav").length,
      bodyTextLen: visibleText,
      hiddenElements: Array.from(document.querySelectorAll("*")).filter(el => {
        const cs = (window as any).getComputedStyle(el);
        return cs.opacity === "0" && el.children.length === 0 && (el.textContent || "").trim().length > 5;
      }).length,
    };
  });
  console.log("file:", path, "(", html.length, "bytes)");
  console.log("hasGsap:", info.hasGsap);
  console.log("hasScrollTrigger:", info.hasST);
  console.log("Active ScrollTriggers:", info.triggerCount);
  console.log("Sections rendered:", info.sectionsRendered);
  console.log("Navs rendered:", info.navsRendered);
  console.log("Visible body text:", info.bodyTextLen, "chars");
  console.log("Stuck-invisible leaf elements (opacity:0 with text):", info.hiddenElements);
  console.log("Page errors:", errors.length);
  errors.slice(0, 5).forEach(e => console.log("  -", e.slice(0, 200)));
  console.log("Console errors:", consoleErrors.length);
  consoleErrors.slice(0, 5).forEach(e => console.log("  -", e.slice(0, 200)));
  await browser.close();
}

main().catch(err => { console.error(err); process.exit(1); });
