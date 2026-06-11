import { route, authenticate, rateLimit, body, json, validateRequired, validateExternalUrl, analytics, sdk, storage, getRequestUser } from "../shared";
import { saveSectionTemplates, fromCanvasDesignSystem, serializeDesignMd, parseDesignMdSpec, toCanvasDesignSystem } from "@canvas-ai/sdk";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import type { IncomingMessage } from "http";

export function registerAnalyticsRoutes() {
  route("GET", "/api/analytics/stats", async (_r, res) => {
    if (!analytics) { json(res, { error: "Analytics not configured" }, 503); return; }
    const stats = await analytics.getStats();
    const freeTierLimitMB = 512;
    json(res, { ...stats, freeTierLimitMB, usagePercent: Math.round(stats.estimatedSizeMB / freeTierLimitMB * 100 * 100) / 100 });
  });

  route("POST", "/api/feedback", async (req, res) => {
    await authenticate(req);
    const b = await body(req);
    validateRequired(b, ["projectId", "screenId", "action"]);
    const validActions = ["kept", "deleted", "edited", "exported", "variant_created"];
    if (!validActions.includes(b.action)) { json(res, { error: "Invalid action" }, 400); return; }
    if (analytics) {
      // Parse section ratings if provided
      const sectionRatings = Array.isArray(b.sectionRatings) ? b.sectionRatings : undefined;
      await analytics.logFeedback({
        generationId: b.generationId,
        projectId: b.projectId,
        screenId: b.screenId,
        action: b.action,
        editDelta: b.editDelta,
        explicitRating: b.rating ?? null,
        sectionRatings,
        timeToAction: b.timeToAction,
      });
      analytics.adjustTemplateScores(b.action).catch(() => {});

      // Apply section-level votes to templates
      if (sectionRatings && sectionRatings.length > 0) {
        for (const sr of sectionRatings) {
          if (sr.sectionType && (sr.vote === "up" || sr.vote === "down")) {
            analytics.rateSectionTemplate(sr.sectionType, sr.vote).catch(() => {});
          }
        }
      }

      const positiveActions = ["exported", "edited", "variant_created"];
      if (positiveActions.includes(b.action) && typeof b.html === "string" && b.html.length > 200) {
        const sectionRegex = /<(section|nav|header|footer)\b[^>]*>[\s\S]*?<\/\1>/gi;
        const sections: string[] = [];
        let match;
        while ((match = sectionRegex.exec(b.html)) !== null) {
          const cleaned = match[0]
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");
          if (cleaned.length > 100) sections.push(cleaned);
        }
        if (sections.length > 0) {
          saveSectionTemplates(sections, analytics);
          console.log(`[api] Quality gate: saved ${sections.length} templates from ${b.action} feedback`);
        }
      }
    }
    json(res, { ok: true });
  });

  // ─── Explicit Rating Endpoints ───

  route("POST", "/api/projects/:pid/screens/:sid/rate", async (req, res) => {
    await authenticate(req);
    const b = await body(req);
    if (typeof b.rating !== "number" || b.rating < 1 || b.rating > 5) {
      json(res, { error: "Rating must be 1-5" }, 400); return;
    }
    if (analytics) {
      await analytics.logFeedback({
        projectId: b.projectId ?? "",
        screenId: b.screenId ?? "",
        action: "kept",
        explicitRating: b.rating,
      });
      // Boost recent templates based on star rating
      const action = b.rating >= 4 ? "exported" : b.rating <= 2 ? "deleted" : "kept";
      analytics.adjustTemplateScores(action).catch(() => {});
    }
    json(res, { ok: true });
  });

  route("POST", "/api/projects/:pid/screens/:sid/rate-section", async (req, res) => {
    await authenticate(req);
    const b = await body(req);
    if (!b.sectionType || (b.vote !== "up" && b.vote !== "down")) {
      json(res, { error: "sectionType and vote (up/down) required" }, 400); return;
    }
    if (analytics) {
      analytics.rateSectionTemplate(b.sectionType, b.vote).catch(() => {});
    }
    json(res, { ok: true });
  });

  // ─── ELO Pairwise Comparison ───

  route("GET", "/api/elo/pair/:sectionType", async (req, res, params) => {
    await authenticate(req);
    if (!analytics) { json(res, { error: "Analytics not configured" }, 503); return; }
    const pair = await analytics.getEloPair(params.sectionType);
    if (!pair) { json(res, { error: "Not enough templates for comparison" }, 404); return; }
    json(res, pair);
  });

  route("POST", "/api/elo/compare", async (req, res) => {
    await authenticate(req);
    const b = await body(req);
    validateRequired(b, ["winnerId", "loserId", "outcome", "sectionType"]);
    if (b.outcome !== "win" && b.outcome !== "draw") { json(res, { error: "outcome must be 'win' or 'draw'" }, 400); return; }
    if (!analytics) { json(res, { error: "Analytics not configured" }, 503); return; }
    await analytics.submitEloComparison(b.winnerId, b.loserId, b.outcome, b.sectionType);
    json(res, { ok: true });
  });

  route("GET", "/api/elo/leaderboard/:sectionType", async (req, res, params) => {
    await authenticate(req);
    if (!analytics) { json(res, { error: "Analytics not configured" }, 503); return; }
    const leaderboard = await analytics.getEloLeaderboard(params.sectionType);
    json(res, leaderboard);
  });

  route("GET", "/api/elo/section-types", async (req, res) => {
    await authenticate(req);
    if (!analytics) { json(res, { error: "Analytics not configured" }, 503); return; }
    const types = await analytics.getSectionTypes();
    json(res, types);
  });

  // ─── Quality Analytics ───

  route("GET", "/api/analytics/quality", async (req, res) => {
    await authenticate(req);
    if (!analytics) { json(res, { error: "Analytics not configured" }, 503); return; }
    const summary = await analytics.getQualitySummary();
    json(res, summary);
  });

  route("GET", "/api/analytics/trends", async (req, res) => {
    await authenticate(req);
    if (!analytics) { json(res, { error: "Analytics not configured" }, 503); return; }
    const url = new URL(req.url || "", `http://${req.headers.host}`);
    const days = parseInt(url.searchParams.get("days") || "30", 10);
    const trends = await analytics.getRatingTrends(Math.min(days, 90));
    json(res, trends);
  });

  route("POST", "/api/analytics/elo-decay", async (req, res) => {
    await authenticate(req);
    if (!analytics) { json(res, { error: "Analytics not configured" }, 503); return; }
    const decayed = await analytics.applyEloDecay();
    json(res, { decayed });
  });

  route("POST", "/api/projects/:pid/design-system/extract", async (req, res, params) => {
    await authenticate(req);
    const b = await body(req);
    validateRequired(b, ["url"]);
    if (typeof b.url !== "string" || !/^https?:\/\//.test(b.url)) { json(res, { error: "Invalid URL" }, 400); return; }
    validateExternalUrl(b.url);
    rateLimit(req);
    const ds = await sdk.project(params.pid).extractDesignFromURL(b.url);
    json(res, ds);
  });

  // GET per-project canvas design system (palette, fonts, cornerRadius, logos).
  // Returns { designSystem: null } when the project has never saved one.
  route("GET", "/api/projects/:pid/design-system", async (req, res, params) => {
    await authenticate(req);
    if (!storage) { json(res, { error: "Storage not configured" }, 503); return; }
    const p = await storage.getProject(params.pid);
    if (!p) { json(res, { error: "Project not found" }, 404); return; }
    const user = getRequestUser(req);
    if (p.ownerId && user && user.userId !== "apikey-user" && p.ownerId !== user.userId) {
      json(res, { error: "Forbidden" }, 403); return;
    }
    const designSystem = await storage.getCanvasDesignSystem(params.pid);
    json(res, { designSystem: designSystem ?? null });
  });

  // PUT per-project canvas design system. Body is the full CanvasDesignSystem
  // object (owned by web-ui); persisted as an opaque JSON blob. Phase 3:
  // dual-write — we also generate a DESIGN.md string from the palette/fonts
  // and stash it on the same row under `.markdown` so GET /design-system.md
  // and prompt context can pull the formatted version cheaply.
  route("PUT", "/api/projects/:pid/design-system", async (req, res, params) => {
    await authenticate(req);
    if (!storage) { json(res, { error: "Storage not configured" }, 503); return; }
    const p = await storage.getProject(params.pid);
    if (!p) { json(res, { error: "Project not found" }, 404); return; }
    const user = getRequestUser(req);
    if (p.ownerId && user && user.userId !== "apikey-user" && p.ownerId !== user.userId) {
      json(res, { error: "Forbidden" }, 403); return;
    }
    const b = await body(req);
    if (!b || typeof b !== "object" || Array.isArray(b)) {
      json(res, { error: "Body must be a design system object" }, 400); return;
    }
    // Reject unreasonably large payloads — a CanvasDesignSystem serialises to
    // well under 50 KB even with a full logo array. 256 KB cap is generous.
    const serialised = JSON.stringify(b);
    if (serialised.length > 262_144) {
      json(res, { error: "Design system payload too large" }, 413); return;
    }
    const markdown = canvasDsToMarkdown(b, p.title || "Project");
    const toStore = markdown ? { ...b, markdown } : b;
    await storage.setCanvasDesignSystem(params.pid, toStore);
    json(res, { designSystem: toStore });
  });

  // GET raw DESIGN.md for the project. Returns text/markdown. Regenerates from
  // the stored CanvasDesignSystem if `.markdown` isn't cached yet (pre-Phase-3
  // rows, or rows written through paths that don't dual-write).
  route("GET", "/api/projects/:pid/design-system.md", async (req, res, params) => {
    await authenticate(req);
    if (!storage) { json(res, { error: "Storage not configured" }, 503); return; }
    const p = await storage.getProject(params.pid);
    if (!p) { json(res, { error: "Project not found" }, 404); return; }
    const user = getRequestUser(req);
    if (p.ownerId && user && user.userId !== "apikey-user" && p.ownerId !== user.userId) {
      json(res, { error: "Forbidden" }, 403); return;
    }
    const stored = await storage.getCanvasDesignSystem(params.pid) as Record<string, unknown> | null;
    let md: string | null = null;
    if (stored && typeof stored === "object") {
      if (typeof (stored as any).markdown === "string") {
        md = (stored as any).markdown;
      } else {
        md = canvasDsToMarkdown(stored, p.title || "Project");
      }
    }
    if (!md) { json(res, { error: "Design system not found" }, 404); return; }
    res.writeHead(200, { "Content-Type": "text/markdown; charset=utf-8" });
    res.end(md);
  });

  // PUT raw DESIGN.md for the project. Body is text/markdown; we parse it to
  // DesignTokens via the Phase 2 helper, adapt back to CanvasDesignSystem
  // shape for the frontend, and persist both the canonical JSON and the
  // original markdown string on the row.
  route("PUT", "/api/projects/:pid/design-system.md", async (req, res, params) => {
    await authenticate(req);
    if (!storage) { json(res, { error: "Storage not configured" }, 503); return; }
    const p = await storage.getProject(params.pid);
    if (!p) { json(res, { error: "Project not found" }, 404); return; }
    const user = getRequestUser(req);
    if (p.ownerId && user && user.userId !== "apikey-user" && p.ownerId !== user.userId) {
      json(res, { error: "Forbidden" }, 403); return;
    }
    const md = await readRawBody(req);
    if (!md || md.length === 0) { json(res, { error: "Body must be DESIGN.md markdown" }, 400); return; }
    if (md.length > 262_144) { json(res, { error: "Markdown payload too large" }, 413); return; }
    try {
      const { ds } = parseDesignMdSpec(md);
      const canvasShape = toCanvasDesignSystem(ds);
      const toStore = { ...canvasShape, markdown: md };
      await storage.setCanvasDesignSystem(params.pid, toStore);
      res.writeHead(200, { "Content-Type": "text/markdown; charset=utf-8" });
      res.end(md);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      json(res, { error: `Invalid DESIGN.md: ${msg}` }, 400);
    }
  });

  route("GET", "/api/assets/:key", async (_r, res, params) => {
    const key = params.key;
    const safe = key.replace(/[^a-zA-Z0-9_.-]/g, "_");
    const assetsDir = resolve(process.env.ATELIER_STORAGE_PATH ?? "./data", "assets");
    const assetPath = resolve(assetsDir, safe);
    if (!assetPath.startsWith(assetsDir)) { json(res, { error: "Invalid asset path" }, 403); return; }
    if (!existsSync(assetPath)) { json(res, { error: "Asset not found" }, 404); return; }
    const data = readFileSync(assetPath);
    const ext = safe.split(".").pop()?.toLowerCase();
    const mime = ext === "png" ? "image/png" : ext === "jpg" || ext === "jpeg" ? "image/jpeg" : "application/octet-stream";
    res.writeHead(200, { "Content-Type": mime, "Cache-Control": "public, max-age=3600" });
    res.end(data);
  });
}

// ─── Phase 3 helpers ─────────────────────────────────────────────────────

// Generate a DESIGN.md string from the web-ui's CanvasDesignSystem shape.
// Returns null if the payload has no palette/fonts worth serialising.
function canvasDsToMarkdown(ds: unknown, name: string): string | null {
  if (!ds || typeof ds !== "object") return null;
  try {
    const tokens = fromCanvasDesignSystem(ds as any, name);
    if (Object.keys(tokens.colors).length === 0 && !tokens.typography) return null;
    return serializeDesignMd(tokens, name);
  } catch {
    return null;
  }
}

// Read a raw request body as utf-8 text. Mirrors the size cap used by the
// JSON body() parser in shared.ts.
async function readRawBody(req: IncomingMessage): Promise<string> {
  const MAX = 10 * 1024 * 1024;
  return new Promise((resolveBody, reject) => {
    let size = 0;
    let d = "";
    req.on("data", (c: string | Buffer) => {
      size += typeof c === "string" ? Buffer.byteLength(c) : c.length;
      if (size > MAX) { req.destroy(); reject(new Error("Payload too large")); return; }
      d += c;
    });
    req.on("end", () => resolveBody(d));
    req.on("error", reject);
  });
}
