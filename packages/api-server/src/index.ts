import { createServer } from "http";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { createAnalytics, createStorage, getRouter } from "@canvas-ai/sdk";
import type { UIComponentData, StorageBackend } from "@canvas-ai/sdk";
import { PORT, ALLOWED_ORIGINS, AuthError, route, match, json, componentLibrary, setStorage, setAnalytics, analytics, storage } from "./shared";
import { registerProjectRoutes } from "./routes/projects";
import { registerScreenRoutes } from "./routes/screens";
import { registerComponentRoutes, mergeApprovedIntoLibrary } from "./routes/components";
import { registerAnalyticsRoutes } from "./routes/analytics";
import { registerEngineRoutes } from "./routes/engine";

// Load .env from project root
const envPath = resolve(__dirname, "../../../.env");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
}

// --- Initialize storage (SQLite by default, memory fallback) ---
const STORAGE_BACKEND = (process.env.ATELIER_STORAGE ?? "sqlite") as StorageBackend;
const STORAGE_PATH = process.env.ATELIER_STORAGE_PATH ?? "./data/canvas.db";

(async () => {
  try {
    const s = await createStorage(STORAGE_BACKEND, { path: STORAGE_PATH });
    setStorage(s);
    console.log(`[api] Storage initialized: ${STORAGE_BACKEND}${STORAGE_BACKEND === "sqlite" ? ` (${STORAGE_PATH})` : ""}`);
  } catch (err) {
    console.warn("[api] Storage init failed, falling back to memory:", err instanceof Error ? err.message : err);
    const s = await createStorage("memory");
    setStorage(s);
  }
})();

// --- Initialize analytics (optional — works without MONGO_URI) ---
(async () => {
  const uri = process.env.MONGO_URI;
  if (uri) {
    try {
      const a = await createAnalytics(uri);
      if (a) {
        setAnalytics(a);
        getRouter().analytics = a;
        console.log("[api] Analytics layer connected");
        try {
          const n = await mergeApprovedIntoLibrary();
          if (n > 0) console.log(`[api] Merged ${n} approved templates into component library`);
        } catch (err) {
          console.warn("[api] Failed to merge approved templates:", err instanceof Error ? err.message : err);
        }
      }
    } catch (err) {
      console.warn("[api] Analytics layer failed to connect (non-blocking):", err instanceof Error ? err.message : err);
    }
  }
})();

// --- Load seeded components ---
const componentsPath = resolve(__dirname, "../../../scripts/components.json");
if (existsSync(componentsPath)) {
  try {
    const seeded = JSON.parse(readFileSync(componentsPath, "utf-8")) as UIComponentData[];
    componentLibrary.load(seeded);
    console.log(`[api] Loaded ${seeded.length} components from seed file`);
  } catch (err) {
    console.warn(`[api] Failed to load seeded components:`, err);
  }
}

// --- Load cinematic components (Track 3) ---
const cinematicPath = resolve(__dirname, "../../../scripts/components-cinematic.json");
if (existsSync(cinematicPath)) {
  try {
    const cinematic = JSON.parse(readFileSync(cinematicPath, "utf-8")) as UIComponentData[];
    componentLibrary.load(cinematic);
    console.log(`[api] Loaded ${cinematic.length} cinematic components`);
  } catch (err) {
    console.warn(`[api] Failed to load cinematic components:`, err);
  }
}

// --- Register all routes ---
route("GET", "/api/health", async (_r, res) => json(res, { status: "ok" }));
registerProjectRoutes();
registerScreenRoutes();
registerComponentRoutes();
registerAnalyticsRoutes();
registerEngineRoutes();

// --- Auto-cleanup: delete projects inactive for 30+ days ---
const CLEANUP_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours
setInterval(async () => {
  if (!storage) return;
  try {
    const deleted = await storage.deleteStaleProjects(30);
    if (deleted > 0) console.log(`[cleanup] Removed ${deleted} stale project(s)`);
  } catch (err) {
    console.warn("[cleanup] Error:", err instanceof Error ? err.message : err);
  }
}, CLEANUP_INTERVAL).unref();

// --- Server ---
const server = createServer(async (req, res) => {
  const origin = req.headers.origin ?? "";
  if (req.method === "OPTIONS") {
    const headers: Record<string, string> = { "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization" };
    if (ALLOWED_ORIGINS.includes(origin)) headers["Access-Control-Allow-Origin"] = origin;
    res.writeHead(204, headers);
    res.end(); return;
  }
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
  const m = match(req.method ?? "GET", url.pathname);
  if (!m) { json(res, { error: "Not found" }, 404, origin); return; }
  try { await m.handler(req, res, m.params); }
  catch (err: any) {
    const status = err instanceof AuthError ? 401
      : err.message.includes("Payload too large") ? 413
      : err.message.includes("Rate limit") ? 429
      : err.message.includes("Missing required") ? 400
      : err.message.includes("not allowed") ? 403
      : 500;
    json(res, { error: err.message }, status, origin);
  }
});

const shutdown = async () => {
  console.log("[api] shutting down...");
  if (storage) await storage.close().catch(() => {});
  if (analytics) await analytics.close().catch(() => {});
  server.close();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

server.listen(PORT, () => console.log(`[api] http://localhost:${PORT}`));

