"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScreenshotService = void 0;
exports.getScreenshotService = getScreenshotService;
const PRESETS = {
    MOBILE: { w: 390, h: 844 }, TABLET: { w: 820, h: 1180 },
    DESKTOP: { w: 1440, h: 900 }, AGNOSTIC: { w: 1280, h: 800 },
};
class ScreenshotService {
    browser = null;
    storage;
    constructor(storage) { this.storage = storage ?? null; }
    async ensureBrowser() {
        if (this.browser)
            return this.browser;
        try {
            const { chromium } = await import("playwright");
            this.browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
            return this.browser;
        }
        catch {
            throw new Error("Run: npm install playwright && npx playwright install chromium");
        }
    }
    async capture(html, device = "DESKTOP", scale = 2) {
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
        if (this.storage)
            await this.storage.saveAsset(key, buffer);
        return { buffer, width: p.w, height: p.h, assetKey: key };
    }
    async thumbnail(html, device = "DESKTOP") {
        return this.capture(html, device, 1);
    }
    async close() { if (this.browser) {
        await this.browser.close();
        this.browser = null;
    } }
}
exports.ScreenshotService = ScreenshotService;
let _svc = null;
function getScreenshotService(storage) {
    if (!_svc)
        _svc = new ScreenshotService(storage);
    return _svc;
}
//# sourceMappingURL=service.js.map