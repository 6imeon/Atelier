"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const http_1 = require("http");
const fs_1 = require("fs");
const path_1 = require("path");
const sdk_1 = require("@canvas-ai/sdk");
// Load .env from project root
const envPath = (0, path_1.resolve)(__dirname, "../../../.env");
if ((0, fs_1.existsSync)(envPath)) {
    for (const line of (0, fs_1.readFileSync)(envPath, "utf-8").split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#"))
            continue;
        const eq = trimmed.indexOf("=");
        if (eq < 0)
            continue;
        const key = trimmed.slice(0, eq).trim();
        const val = trimmed.slice(eq + 1).trim();
        if (!process.env[key])
            process.env[key] = val;
    }
}
const PORT = parseInt(process.env.PORT ?? "8080", 10);
const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS ?? "http://localhost:5173,http://localhost:8080").split(",");
const sdk = new sdk_1.CanvasAI();
const componentLibrary = new sdk_1.ComponentLibrary();
// Load seeded components if available
const componentsPath = (0, path_1.resolve)(__dirname, "../../../scripts/components.json");
if ((0, fs_1.existsSync)(componentsPath)) {
    try {
        const seeded = JSON.parse((0, fs_1.readFileSync)(componentsPath, "utf-8"));
        componentLibrary.load(seeded);
        console.log(`[api] Loaded ${seeded.length} components from seed file`);
    }
    catch (err) {
        console.warn(`[api] Failed to load seeded components:`, err);
    }
}
const VALID_DEVICE_TYPES = ["MOBILE", "DESKTOP", "TABLET", "AGNOSTIC"];
const VALID_CREATIVE_RANGES = ["REFINE", "EXPLORE", "REIMAGINE"];
function validateRequired(obj, fields) {
    for (const f of fields) {
        if (obj[f] === undefined || obj[f] === null || obj[f] === "")
            throw new Error(`Missing required field: ${f}`);
    }
}
// Simple per-IP rate limiter
const rateBuckets = new Map();
function rateLimit(req, limit = 30) {
    const ip = req.headers["x-forwarded-for"]?.split(",")[0] ?? req.socket.remoteAddress ?? "unknown";
    const now = Date.now();
    const bucket = (rateBuckets.get(ip) ?? []).filter(t => now - t < 60_000);
    if (bucket.length >= limit)
        throw new Error("Rate limit exceeded. Try again later.");
    bucket.push(now);
    rateBuckets.set(ip, bucket);
}
const routes = [];
function route(method, path, handler) {
    const paramNames = [];
    const re = path.replace(/:(\w+)/g, (_, n) => { paramNames.push(n); return "([^/]+)"; });
    routes.push({ method, pattern: new RegExp(`^${re}$`), paramNames, handler });
}
function match(method, path) {
    for (const r of routes) {
        if (r.method !== method)
            continue;
        const m = path.match(r.pattern);
        if (!m)
            continue;
        const params = {};
        r.paramNames.forEach((n, i) => params[n] = m[i + 1]);
        return { handler: r.handler, params };
    }
    return null;
}
async function body(req) {
    return new Promise((resolve, reject) => {
        let d = "";
        req.on("data", c => d += c);
        req.on("end", () => { try {
            resolve(d ? JSON.parse(d) : {});
        }
        catch {
            reject(new Error("Bad JSON"));
        } });
    });
}
function json(res, data, status = 200, origin) {
    const headers = { "Content-Type": "application/json" };
    if (origin && ALLOWED_ORIGINS.includes(origin))
        headers["Access-Control-Allow-Origin"] = origin;
    res.writeHead(status, headers);
    res.end(JSON.stringify(data));
}
// --- Routes ---
route("GET", "/api/health", async (_r, res) => json(res, { status: "ok" }));
route("POST", "/api/projects", async (req, res) => {
    const b = await body(req);
    const title = typeof b.title === "string" ? b.title.slice(0, 255) : "Untitled";
    const p = sdk.createProject(title);
    json(res, { id: p.id, title }, 201);
});
route("POST", "/api/projects/:pid/screens/generate", async (req, res, params) => {
    rateLimit(req);
    const b = await body(req);
    validateRequired(b, ["prompt"]);
    const deviceType = VALID_DEVICE_TYPES.includes(b.deviceType) ? b.deviceType : "DESKTOP";
    const project = sdk.project(params.pid);
    // Attach component library for hybrid generation
    if (componentLibrary.all().length > 0)
        project.setComponentLibrary(componentLibrary);
    // Stream progress events via SSE
    const origin = req.headers.origin ?? "";
    const headers = {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
    };
    if (ALLOWED_ORIGINS.includes(origin))
        headers["Access-Control-Allow-Origin"] = origin;
    res.writeHead(200, headers);
    const sendEvent = (type, data) => {
        res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`);
    };
    const onProgress = (stage, detail) => {
        sendEvent("progress", { stage, detail });
    };
    try {
        if (b.sourceUrl && typeof b.sourceUrl === "string" && /^https?:\/\//.test(b.sourceUrl)) {
            console.log(`[api] Redesign mode — fetching ${b.sourceUrl}`);
            const s = await project.redesignFromURL(b.sourceUrl, b.prompt, deviceType, onProgress);
            const data = s.toJSON();
            sendEvent("complete", { screenId: s.id, html: await s.getHtml(), designTokens: data.designTokens });
        }
        else {
            const s = await project.generate(b.prompt, deviceType, onProgress);
            sendEvent("complete", { screenId: s.id, html: await s.getHtml() });
        }
    }
    catch (err) {
        sendEvent("error", { error: err.message });
    }
    res.end();
});
// Plan a redesign — analyzes site, proposes pages, creates design system name
route("POST", "/api/projects/:pid/redesign/plan", async (req, res, params) => {
    rateLimit(req);
    const b = await body(req);
    validateRequired(b, ["url"]);
    const project = sdk.project(params.pid);
    const origin = req.headers.origin ?? "";
    const headers = {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
    };
    if (ALLOWED_ORIGINS.includes(origin))
        headers["Access-Control-Allow-Origin"] = origin;
    res.writeHead(200, headers);
    const sendEvent = (type, data) => {
        res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`);
    };
    try {
        const plan = await project.planRedesign(b.url, b.prompt || "", (stage, detail) => {
            sendEvent("progress", { stage, detail });
        });
        sendEvent("complete", { plan });
    }
    catch (err) {
        sendEvent("error", { error: err.message });
    }
    res.end();
});
// Generate multiple pages from a plan (called after plan is confirmed)
route("POST", "/api/projects/:pid/redesign/generate", async (req, res, params) => {
    rateLimit(req);
    const b = await body(req);
    validateRequired(b, ["url", "pages", "brandName", "designTokens", "fetchedContent"]);
    const deviceType = VALID_DEVICE_TYPES.includes(b.deviceType) ? b.deviceType : "DESKTOP";
    const project = sdk.project(params.pid);
    if (componentLibrary.all().length > 0)
        project.setComponentLibrary(componentLibrary);
    const origin = req.headers.origin ?? "";
    const headers = {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
    };
    if (ALLOWED_ORIGINS.includes(origin))
        headers["Access-Control-Allow-Origin"] = origin;
    res.writeHead(200, headers);
    const sendEvent = (type, data) => {
        res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`);
    };
    const pages = b.pages;
    sendEvent("progress", { stage: `Generating ${pages.length} pages...`, detail: `Applying design system to the screens (0/${pages.length})` });
    try {
        for (let i = 0; i < pages.length; i++) {
            const page = pages[i];
            sendEvent("progress", { stage: `Generating ${page.title}...`, detail: `Applying design system to the screens (${i}/${pages.length})` });
            const screen = await project.generatePage(b.url, page.title, page.description, b.brandName, b.fetchedContent, b.designTokens, deviceType);
            sendEvent("screen", {
                index: i,
                total: pages.length,
                screenId: screen.id,
                title: page.title,
                html: await screen.getHtml(),
                designTokens: b.designTokens,
            });
        }
        sendEvent("complete", { totalScreens: pages.length });
    }
    catch (err) {
        sendEvent("error", { error: err.message });
    }
    res.end();
});
route("POST", "/api/projects/:pid/screens/from-image", async (req, res, params) => {
    rateLimit(req);
    const b = await body(req);
    validateRequired(b, ["imageBase64"]);
    const deviceType = VALID_DEVICE_TYPES.includes(b.deviceType) ? b.deviceType : "DESKTOP";
    const s = await sdk.project(params.pid).generateFromImage(b.imageBase64, b.prompt ?? "", deviceType);
    json(res, { screenId: s.id, html: await s.getHtml() }, 201);
});
route("POST", "/api/projects/:pid/screens/:sid/edit", async (req, res, params) => {
    rateLimit(req);
    const b = await body(req);
    validateRequired(b, ["prompt"]);
    const scr = await sdk.project(params.pid).getScreen(params.sid);
    if (!scr) {
        json(res, { error: "Not found" }, 404);
        return;
    }
    const ed = await scr.edit(b.prompt);
    json(res, { screenId: ed.id, html: await ed.getHtml() }, 201);
});
route("POST", "/api/projects/:pid/screens/:sid/variants", async (req, res, params) => {
    rateLimit(req);
    const b = await body(req);
    validateRequired(b, ["prompt"]);
    const scr = await sdk.project(params.pid).getScreen(params.sid);
    if (!scr) {
        json(res, { error: "Not found" }, 404);
        return;
    }
    const count = Math.min(Math.max(b.variantCount ?? 3, 1), 5);
    const creativeRange = VALID_CREATIVE_RANGES.includes(b.creativeRange) ? b.creativeRange : "EXPLORE";
    const vars = await scr.variants(b.prompt, { variantCount: count, creativeRange });
    json(res, await Promise.all(vars.map(async (v) => ({ screenId: v.id, html: await v.getHtml() }))), 201);
});
route("GET", "/api/projects/:pid/screens/:sid/export/react", async (_r, res, params) => {
    const scr = await sdk.project(params.pid).getScreen(params.sid);
    if (!scr) {
        json(res, { error: "Not found" }, 404);
        return;
    }
    json(res, { code: await scr.exportReact() });
});
route("GET", "/api/projects/:pid/screens/:sid", async (_r, res, params) => {
    const scr = await sdk.project(params.pid).getScreen(params.sid);
    if (!scr) {
        json(res, { error: "Not found" }, 404);
        return;
    }
    json(res, { screenId: scr.id, html: await scr.getHtml(), prompt: scr.prompt, deviceType: scr.deviceType });
});
route("GET", "/api/projects/:pid/screens", async (req, res, params) => {
    const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
    const page = Math.max(0, parseInt(url.searchParams.get("page") ?? "0", 10));
    const limit = Math.min(Math.max(1, parseInt(url.searchParams.get("limit") ?? "20", 10)), 100);
    const allScreens = await sdk.project(params.pid).screens();
    const start = page * limit;
    const paginated = allScreens.slice(start, start + limit);
    json(res, {
        screens: paginated.map(s => ({ id: s.id, prompt: s.prompt, deviceType: s.deviceType })),
        total: allScreens.length, page, limit,
        hasMore: start + limit < allScreens.length,
    });
});
route("GET", "/api/assets/:key", async (_r, res, params) => {
    const key = params.key;
    // Attempt to serve from the SDK's storage adapter if available
    const safe = key.replace(/[^a-zA-Z0-9_.-]/g, "_");
    const { existsSync, readFileSync } = await import("fs");
    const { join } = await import("path");
    const assetPath = join(process.env.CANVAS_STORAGE_PATH ?? "./data", "assets", safe);
    if (!existsSync(assetPath)) {
        json(res, { error: "Asset not found" }, 404);
        return;
    }
    const data = readFileSync(assetPath);
    const ext = safe.split(".").pop()?.toLowerCase();
    const mime = ext === "png" ? "image/png" : ext === "jpg" || ext === "jpeg" ? "image/jpeg" : "application/octet-stream";
    res.writeHead(200, { "Content-Type": mime, "Cache-Control": "public, max-age=3600" });
    res.end(data);
});
route("POST", "/api/projects/:pid/design-system/extract", async (req, res, params) => {
    rateLimit(req);
    const b = await body(req);
    validateRequired(b, ["url"]);
    if (typeof b.url !== "string" || !/^https?:\/\//.test(b.url)) {
        json(res, { error: "Invalid URL" }, 400);
        return;
    }
    const ds = await sdk.project(params.pid).extractDesignFromURL(b.url);
    json(res, ds);
});
// --- Component Library Routes ---
route("GET", "/api/components", async (req, res) => {
    const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
    const category = url.searchParams.get("category");
    const query = url.searchParams.get("q");
    let components;
    if (query) {
        components = componentLibrary.search(query);
    }
    else if (category) {
        components = componentLibrary.getByCategory(category);
    }
    else {
        components = componentLibrary.all();
    }
    json(res, { components, total: components.length });
});
route("GET", "/api/components/stats", async (_r, res) => {
    json(res, componentLibrary.stats());
});
route("GET", "/api/components/:id", async (_r, res, params) => {
    const all = componentLibrary.all();
    const comp = all.find(c => c.id === params.id);
    if (!comp) {
        json(res, { error: "Component not found" }, 404);
        return;
    }
    json(res, comp);
});
route("POST", "/api/components", async (req, res) => {
    rateLimit(req);
    const b = await body(req);
    validateRequired(b, ["category", "name", "html"]);
    const comp = {
        id: b.id || `${b.category}-${Date.now()}`,
        category: b.category,
        name: b.name,
        description: b.description || "",
        html: b.html,
        tokens: b.tokens || { colors: ["primary"], fonts: ["body"], radius: true },
        slots: b.slots || [],
        variants: b.variants || [],
        tags: b.tags || [],
        source: b.source || "curated",
        adaptability: b.adaptability || "flexible",
        quality: b.quality || 3,
        usageCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };
    componentLibrary.add(comp);
    json(res, comp, 201);
});
route("POST", "/api/components/:id/customize", async (req, res, params) => {
    rateLimit(req);
    const b = await body(req);
    validateRequired(b, ["instruction"]);
    const all = componentLibrary.all();
    const comp = all.find(c => c.id === params.id);
    if (!comp) {
        json(res, { error: "Component not found" }, 404);
        return;
    }
    const html = await componentLibrary.customizeComponent(comp, b.instruction);
    json(res, { html });
});
route("POST", "/api/components/generate", async (req, res) => {
    rateLimit(req);
    const b = await body(req);
    validateRequired(b, ["description", "category"]);
    const comp = await componentLibrary.generateComponent(b.description, b.category);
    componentLibrary.add(comp);
    json(res, comp, 201);
});
// --- Server ---
const server = (0, http_1.createServer)(async (req, res) => {
    const origin = req.headers.origin ?? "";
    if (req.method === "OPTIONS") {
        const headers = { "Access-Control-Allow-Methods": "GET,POST,OPTIONS", "Access-Control-Allow-Headers": "Content-Type" };
        if (ALLOWED_ORIGINS.includes(origin))
            headers["Access-Control-Allow-Origin"] = origin;
        res.writeHead(204, headers);
        res.end();
        return;
    }
    const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
    const m = match(req.method ?? "GET", url.pathname);
    if (!m) {
        json(res, { error: "Not found" }, 404, origin);
        return;
    }
    try {
        await m.handler(req, res, m.params);
    }
    catch (err) {
        const status = err.message.includes("Rate limit") ? 429 : err.message.includes("Missing required") ? 400 : 500;
        json(res, { error: err.message }, status, origin);
    }
});
const shutdown = async () => {
    console.log("[api] shutting down...");
    server.close();
    process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
server.listen(PORT, () => console.log(`[api] http://localhost:${PORT}`));
//# sourceMappingURL=index.js.map