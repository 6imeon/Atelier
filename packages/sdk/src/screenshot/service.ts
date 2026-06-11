import { StorageAdapter } from "../storage/interface.js";

export interface ScreenshotResult { buffer: Buffer; width: number; height: number; assetKey: string; }

const PRESETS: Record<string, { w: number; h: number }> = {
  MOBILE: { w: 390, h: 844 }, TABLET: { w: 820, h: 1180 },
  DESKTOP: { w: 1440, h: 900 }, AGNOSTIC: { w: 1280, h: 800 },
};

export class ScreenshotService {
  private browser: any = null;
  private storage: StorageAdapter | null;

  constructor(storage?: StorageAdapter) { this.storage = storage ?? null; }

  private async ensureBrowser() {
    if (this.browser) return this.browser;
    try {
      const { chromium } = await import("playwright");
      this.browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
      return this.browser;
    } catch { throw new Error("Run: npm install playwright && npx playwright install chromium"); }
  }

  async capture(html: string, device = "DESKTOP", scale = 2): Promise<ScreenshotResult> {
    const browser = await this.ensureBrowser();
    const p = PRESETS[device] ?? PRESETS.DESKTOP;
    const ctx = await browser.newContext({ viewport: { width: p.w, height: p.h }, deviceScaleFactor: scale });
    const page = await ctx.newPage();
    const full = html.includes("<html") ? html :
      `<!DOCTYPE html><html><head><meta charset="UTF-8"><script src="https://cdn.tailwindcss.com"></script></head><body style="margin:0">${html}</body></html>`;
    await page.setContent(full, { waitUntil: "networkidle", timeout: 15_000 });
    await page.waitForTimeout(500);
    const buffer = await page.screenshot({ fullPage: false, type: "png" });
    await ctx.close();
    const key = `shot_${Date.now()}.png`;
    if (this.storage) await this.storage.saveAsset(key, buffer);
    return { buffer, width: p.w, height: p.h, assetKey: key };
  }

  async thumbnail(html: string, device = "DESKTOP"): Promise<ScreenshotResult> {
    return this.capture(html, device, 1);
  }

  /**
   * Capture a scroll sequence: screenshots at load, after 2s delay, and at
   * scroll positions 25%, 50%, 75%, 100%. Returns 6 buffers (ephemeral).
   * Used by the component engine for animation brief generation.
   */
  async captureScrollSequence(
    html: string,
    opts: { width?: number; scale?: number; delayMs?: number } = {},
  ): Promise<{ buffers: Buffer[]; labels: string[]; width: number; height: number }> {
    const browser = await this.ensureBrowser();
    const width = opts.width ?? 1440;
    const scale = opts.scale ?? 1;
    const delayMs = opts.delayMs ?? 2000;

    const ctx = await browser.newContext({
      viewport: { width, height: 900 },
      deviceScaleFactor: scale,
    });
    const page = await ctx.newPage();

    const full = html.includes("<html") ? html :
      `<!DOCTYPE html><html><head><meta charset="UTF-8"><script src="https://cdn.tailwindcss.com"></script></head><body style="margin:0">${html}</body></html>`;

    await page.setContent(full, { waitUntil: "networkidle", timeout: 20_000 });

    const buffers: Buffer[] = [];
    const labels: string[] = [];

    // Frame 1: at load (t=0)
    buffers.push(await page.screenshot({ fullPage: false, type: "png" }));
    labels.push("load-t0");

    // Frame 2: after delay (initial animations complete)
    await page.waitForTimeout(delayMs);
    buffers.push(await page.screenshot({ fullPage: false, type: "png" }));
    labels.push(`load-t${delayMs}ms`);

    // Frames 3-6: scroll to 25%, 50%, 75%, 100%
    const scrollHeight = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
    const positions = [0.25, 0.5, 0.75, 1.0];

    for (const pct of positions) {
      const scrollY = Math.round(scrollHeight * pct);
      await page.evaluate((y: number) => window.scrollTo({ top: y, behavior: "instant" }), scrollY);
      // Small delay for scroll-triggered animations to fire
      await page.waitForTimeout(500);
      buffers.push(await page.screenshot({ fullPage: false, type: "png" }));
      labels.push(`scroll-${Math.round(pct * 100)}%`);
    }

    const pageHeight = scrollHeight + 900;
    await ctx.close();

    return { buffers, labels, width, height: pageHeight };
  }

  /**
   * Navigate to a real URL and capture a 6-frame scroll sequence.
   * Used by the redesign pipeline (Track 1B) to feed a multimodal LLM that
   * reverse-engineers animation effects from the source site.
   *
   * Buffers are in-memory only — they are NEVER written to disk. The caller
   * is expected to consume them immediately and let them GC after the
   * animation brief LLM call returns.
   */
  async captureUrlScrollSequence(
    url: string,
    opts: { width?: number; scale?: number; delayMs?: number; navTimeoutMs?: number } = {},
  ): Promise<{ buffers: Buffer[]; labels: string[]; width: number; height: number }> {
    const browser = await this.ensureBrowser();
    const width = opts.width ?? 1440;
    const scale = opts.scale ?? 1;
    const delayMs = opts.delayMs ?? 2000;
    const navTimeoutMs = opts.navTimeoutMs ?? 30_000;

    const ctx = await browser.newContext({
      viewport: { width, height: 900 },
      deviceScaleFactor: scale,
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    });
    const page = await ctx.newPage();

    try {
      await page.goto(url, { waitUntil: "networkidle", timeout: navTimeoutMs });
    } catch {
      // networkidle can hang on heavy SPAs — fall back to domcontentloaded
      try {
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: navTimeoutMs });
        await page.waitForTimeout(2000);
      } catch (err) {
        await ctx.close();
        throw new Error(`Failed to navigate to ${url}: ${err instanceof Error ? err.message : err}`);
      }
    }

    // Dismiss common cookie banners
    try {
      await page.evaluate(() => {
        const selectors = ['[id*="cookie" i] button', '[class*="cookie" i] button', '[id*="consent" i] button', '[aria-label*="accept" i]'];
        for (const sel of selectors) {
          const el = document.querySelector(sel) as HTMLElement | null;
          if (el && /accept|allow|agree|ok|got it/i.test(el.textContent || "")) { el.click(); break; }
        }
      });
      await page.waitForTimeout(500);
    } catch { /* non-fatal */ }

    const buffers: Buffer[] = [];
    const labels: string[] = [];

    // Frame 1: at load (t=0)
    buffers.push(await page.screenshot({ fullPage: false, type: "png" }));
    labels.push("load-t0");

    // Frame 2: after delay (initial animations complete)
    await page.waitForTimeout(delayMs);
    buffers.push(await page.screenshot({ fullPage: false, type: "png" }));
    labels.push(`load-t${delayMs}ms`);

    // Frames 3-6: scroll to 25%, 50%, 75%, 100%
    const scrollHeight = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
    const positions = [0.25, 0.5, 0.75, 1.0];

    for (const pct of positions) {
      const scrollY = Math.round(scrollHeight * pct);
      await page.evaluate((y: number) => window.scrollTo({ top: y, behavior: "instant" }), scrollY);
      // Wait for scroll-triggered animations to fire
      await page.waitForTimeout(700);
      buffers.push(await page.screenshot({ fullPage: false, type: "png" }));
      labels.push(`scroll-${Math.round(pct * 100)}%`);
    }

    const pageHeight = scrollHeight + 900;
    await ctx.close();

    return { buffers, labels, width, height: pageHeight };
  }

  async close() { if (this.browser) { await this.browser.close(); this.browser = null; } }
}

let _svc: ScreenshotService | null = null;
export function getScreenshotService(storage?: StorageAdapter) {
  if (!_svc) _svc = new ScreenshotService(storage);
  return _svc;
}
