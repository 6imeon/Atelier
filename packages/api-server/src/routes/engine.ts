/**
 * Component Engine Admin API Routes
 *
 * Provides REST endpoints for managing crawl targets, browsing extracted
 * sections, viewing animation patterns, and monitoring engine stats.
 */
import { route, authenticate, json, body, analytics } from "../shared";
import { mergeApprovedTemplateById } from "./components";
import {
  generateAutoSpec,
  generatePremiumComponent,
  enhanceFromSkeleton,
  scoreQualityStatic,
  normalizeHtml,
  qualityGate,
  buildComponentEntry,
  getRouter,
} from "@canvas-ai/sdk";
import type { BrandLock } from "@canvas-ai/sdk";

// In-memory job tracker for generation runs
interface GenerationJob {
  id: string;
  status: "running" | "completed" | "failed";
  requested: number;
  accepted: number;
  normalized: number;
  rejected: number;
  errors: number;
  log: string[];
  startedAt: Date;
  finishedAt?: Date;
}

const activeJobs = new Map<string, GenerationJob>();

export function registerEngineRoutes() {
  // All engine routes require auth
  const db = () => {
    if (!analytics) throw new Error("Analytics not configured");
    return (analytics as any).db as import("mongodb").Db;
  };

  // ─── Crawl Targets ───

  route("GET", "/api/engine/targets", async (req, res) => {
    await authenticate(req);
    const url = new URL(req.url || "", "http://localhost");
    const status = url.searchParams.get("status") || undefined;
    const tier = url.searchParams.get("tier") || undefined;
    const industry = url.searchParams.get("industry") || undefined;

    const query: Record<string, unknown> = {};
    if (status) query.status = status;
    if (tier) query.tier = tier;
    if (industry) query.industry = industry;

    const docs = await db().collection("crawl_targets").find(query).sort({ status: 1, domain: 1 }).toArray();
    json(res, { targets: docs.map(d => ({ domain: d.domain, url: d.url, industry: d.industry, tier: d.tier, status: d.status, lastCrawled: d.lastCrawled, sectionsExtracted: d.sectionsExtracted || 0, crawlCount: d.crawlCount || 0 })), total: docs.length });
  });

  // ─── Raw Sections ───

  route("GET", "/api/engine/sections", async (req, res) => {
    await authenticate(req);
    const url = new URL(req.url || "", "http://localhost");
    const domain = url.searchParams.get("domain") || undefined;
    const category = url.searchParams.get("category") || undefined;
    const tier = url.searchParams.get("tier") || undefined;
    const status = url.searchParams.get("status") || undefined;
    const limit = parseInt(url.searchParams.get("limit") || "50");

    const query: Record<string, unknown> = {};
    if (domain) query.sourceDomain = domain;
    if (category) query["classification.category"] = category;
    if (tier) query["classification.tier"] = tier;
    if (status) query.status = status;

    const docs = await db().collection("raw_sections").find(query).sort({ extractedAt: -1 }).limit(limit).toArray();
    json(res, {
      sections: docs.map(d => ({
        _id: d._id.toString(),
        sourceDomain: d.sourceDomain,
        category: d.classification?.category,
        tier: d.classification?.tier,
        confidence: d.classification?.confidence,
        status: d.status,
        animations: (d.animations || []).length,
        hasBrief: !!d.animationBrief,
        htmlLength: d.htmlLength,
        extractedAt: d.extractedAt,
      })),
      total: docs.length,
    });
  });

  route("GET", "/api/engine/sections/:id", async (req, res, params) => {
    await authenticate(req);
    const { ObjectId } = await import("mongodb");
    const doc = await db().collection("raw_sections").findOne({ _id: new ObjectId(params.id) });
    if (!doc) { json(res, { error: "Not found" }, 404); return; }
    json(res, {
      ...doc,
      _id: doc._id.toString(),
      html: doc.html?.slice(0, 5000), // truncate for API response
    });
  });

  // ─── Animation Patterns ───

  route("GET", "/api/engine/patterns", async (req, res) => {
    await authenticate(req);
    const url = new URL(req.url || "", "http://localhost");
    const type = url.searchParams.get("type") || undefined;
    const limit = parseInt(url.searchParams.get("limit") || "50");

    const query: Record<string, unknown> = {};
    if (type) query["pattern.type"] = type;

    const docs = await db().collection("animation_patterns").find(query).sort({ frequency: -1 }).limit(limit).toArray();
    json(res, { patterns: docs, total: docs.length });
  });

  route("GET", "/api/engine/catalogue", async (_req, res) => {
    // Public endpoint — no auth needed for catalogue overview
    const result = await db().collection("animation_patterns").aggregate([
      { $group: {
        _id: { type: "$pattern.type", trigger: "$pattern.trigger" },
        frequency: { $sum: "$frequency" },
        domains: { $addToSet: "$domain" },
      }},
      { $project: {
        type: "$_id.type", trigger: "$_id.trigger",
        frequency: 1, domains: { $size: "$domains" },
      }},
      { $sort: { frequency: -1 } },
    ]).toArray();
    json(res, { catalogue: result });
  });

  // ─── Generated Components ───

  route("GET", "/api/engine/generated", async (req, res) => {
    await authenticate(req);
    const url = new URL(req.url || "", "http://localhost");
    const merged = url.searchParams.get("merged");
    const limit = parseInt(url.searchParams.get("limit") || "50");

    const query: Record<string, unknown> = {};
    if (merged === "true") query.merged = true;
    if (merged === "false") query.merged = { $ne: true };

    const docs = await db().collection("generated_components").find(query).sort({ generatedAt: -1 }).limit(limit).toArray();
    json(res, {
      components: docs.map(d => ({
        id: d.id,
        category: d.category,
        name: d.name,
        tier: d.qualityReport?.tier,
        score: d.qualityReport?.overall,
        merged: d.merged || false,
        approved: d.approved || false,
        rejected: d.rejected || false,
        skipReason: d.skipReason,
        source: d.source,
        generatedAt: d.generatedAt,
      })),
      total: docs.length,
    });
  });

  // ─── Single Generated Component (full HTML) ───

  route("GET", "/api/engine/generated/:id", async (req, res, params) => {
    await authenticate(req);
    const doc = await db().collection("generated_components").findOne({ id: params.id });
    if (!doc) { json(res, { error: "Not found" }, 404); return; }
    json(res, {
      id: doc.id,
      category: doc.category,
      name: doc.name,
      html: doc.html,
      tokens: doc.tokens,
      qualityReport: doc.qualityReport,
      source: doc.source,
      merged: doc.merged || false,
      rejected: doc.rejected || false,
      generatedAt: doc.generatedAt,
    });
  });

  // ─── Approve / Reject Generated Components ───

  route("POST", "/api/engine/generated/:id/approve", async (req, res, params) => {
    await authenticate(req);
    const doc = await db().collection("generated_components").findOne({ id: params.id });
    if (!doc) { json(res, { error: "Not found" }, 404); return; }

    // Mark as approved + merged
    await db().collection("generated_components").updateOne(
      { id: params.id },
      { $set: { approved: true, rejected: false, merged: true, reviewedAt: new Date() } },
    );

    // Add to section_templates (the component library) for ELO ranking + reuse.
    // Preserve the rich name/description/source from the engine doc so the
    // library UI shows meaningful labels instead of falling back to
    // "${category} (${industry})" → "hero (multi)".
    const personaTag = typeof doc.source === "string"
      ? doc.source.split(":")[1]
      : doc.source?.persona;
    const industryTag = typeof doc.source === "string"
      ? doc.source.split(":")[2]
      : doc.source?.industry;
    await db().collection("section_templates").updateOne(
      { sourceGenerationId: params.id },
      { $set: {
        type: doc.category || "content",
        industry: industryTag || "multi",
        style: personaTag || undefined,
        name: doc.name || undefined,
        description: doc.description || undefined,
        source: doc.source || undefined,
        sourceUrl: doc.sourceUrl || doc.source?.url || undefined,
        sourceDomain: doc.sourceDomain || doc.source?.domain || undefined,
        brandName: doc.brandName || doc.source?.brandName || undefined,
        tags: doc.tags || undefined,
        html: doc.html,
        htmlLength: doc.html?.length || 0,
        features: doc.qualityReport?.features || { hasAnimation: true, hasCta: false, hasImage: false, columnCount: 0 },
        qualityScore: doc.qualityReport?.overall || 5,
        positiveRatings: 1,
        negativeRatings: 0,
        compositeScore: doc.qualityReport?.overall || 5,
        elo: { rating: 1500, matches: 0, wins: 0, sigma: 350 },
        timesReused: 0,
        sourceGenerationId: params.id,
        updatedAt: new Date(),
        createdAt: new Date(),
      }},
      { upsert: true },
    );

    await mergeApprovedTemplateById(params.id).catch(() => {});

    json(res, { ok: true, merged: true });
  });

  route("POST", "/api/engine/generated/:id/reject", async (req, res, params) => {
    await authenticate(req);
    const result = await db().collection("generated_components").updateOne(
      { id: params.id },
      { $set: { rejected: true, approved: false, reviewedAt: new Date() } },
    );
    if (result.matchedCount === 0) { json(res, { error: "Not found" }, 404); return; }
    json(res, { ok: true });
  });

  // ─── Preview: full standalone HTML page (opened in new tab) ───

  route("GET", "/api/engine/preview/:id", async (req, res, params) => {
    // Support ?token= for new-tab opens where Authorization header isn't available
    const url = new URL(req.url || "", "http://localhost");
    const queryToken = url.searchParams.get("token");
    if (queryToken && !req.headers.authorization) {
      req.headers.authorization = `Bearer ${queryToken}`;
    }
    await authenticate(req);
    const doc = await db().collection("generated_components").findOne({ id: params.id });
    if (!doc) { json(res, { error: "Not found" }, 404); return; }
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${doc.name || doc.id}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js"></script>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.css">
  <script src="https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.js"></script>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Playfair+Display:ital,wght@0,700;1,700&display=swap" rel="stylesheet">
  <style>body{font-family:'Inter',sans-serif;margin:0;}</style>
</head>
<body class="bg-white">
<div style="height:30vh;background:#f3f4f6;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:8px">
  <p style="color:#9ca3af;font-size:14px">Scroll down to see component</p>
  <p style="color:#d1d5db;font-size:12px">${doc.category} | ${doc.qualityReport?.tier || "?"} | score: ${doc.qualityReport?.overall || "?"}/10</p>
</div>

${doc.html}

<div style="height:50vh;background:#f9fafb"></div>

<script>
window.addEventListener('load', function() {
  if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {
    gsap.registerPlugin(ScrollTrigger);
    setTimeout(function() { ScrollTrigger.refresh(); }, 200);
  }
});
</script>
</body>
</html>`;
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(html);
  });

  // ─── Engine Stats ───

  route("GET", "/api/engine/stats", async (_req, res) => {
    // Public endpoint
    const crawlTargets = await db().collection("crawl_targets").countDocuments();
    const rawSections = await db().collection("raw_sections").countDocuments();
    const animationPatterns = await db().collection("animation_patterns").countDocuments();
    const generatedComponents = await db().collection("generated_components").countDocuments();

    const tierAgg = await db().collection("raw_sections").aggregate([
      { $group: { _id: "$classification.tier", count: { $sum: 1 } } },
    ]).toArray();
    const byTier: Record<string, number> = {};
    for (const r of tierAgg) byTier[r._id as string] = r.count;

    const statusAgg = await db().collection("raw_sections").aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]).toArray();
    const byStatus: Record<string, number> = {};
    for (const r of statusAgg) byStatus[r._id as string] = r.count;

    json(res, { crawlTargets, rawSections, animationPatterns, generatedComponents, byTier, byStatus });
  });

  // ─── Generate: trigger component generation ───

  // ─── List available skeletons ───

  route("GET", "/api/engine/skeletons", async (req, res) => {
    await authenticate(req);
    try {
      const { readdirSync, readFileSync, existsSync } = await import("fs");
      const { resolve, join } = await import("path");
      // Find skeletons dir relative to project root
      const possiblePaths = [
        resolve(process.cwd(), "scripts/skeletons"),
        resolve(process.cwd(), "../scripts/skeletons"),
        resolve(process.cwd(), "../../scripts/skeletons"),
      ];
      let skeletonsDir = "";
      for (const p of possiblePaths) {
        if (existsSync(p)) { skeletonsDir = p; break; }
      }
      if (!skeletonsDir) {
        json(res, { skeletons: [] });
        return;
      }
      const files = readdirSync(skeletonsDir).filter((f: string) => f.endsWith(".html")).sort();
      const skeletons = files.map((file: string) => {
        const html = readFileSync(join(skeletonsDir, file), "utf-8");
        const descMatch = html.match(/<!--\s*(.*?)\s*-->/);
        const desc = descMatch ? descMatch[1].slice(0, 100) : "";
        const hasGsap = /gsap|ScrollTrigger/i.test(html);
        const hasSwiper = /swiper/i.test(html);
        const libs = [hasGsap && "GSAP", hasSwiper && "Swiper"].filter(Boolean);
        if (!hasGsap && !hasSwiper) libs.push("CSS-only");
        return {
          name: file.replace(".html", ""),
          file,
          description: desc,
          libraries: libs,
          sizeChars: html.length,
        };
      });
      json(res, { skeletons });
    } catch {
      json(res, { skeletons: [] });
    }
  });

  // ─── Generation ───
  // Supports 3 methods:
  //   method: "pipeline" (default) — generate from briefed raw_sections
  //   method: "skeleton" — enhance a skeleton from the library with CSS-only styling
  //   method: "brand-lock" — pipeline generation locked to specific brand colors

  route("POST", "/api/engine/generate", async (req, res) => {
    await authenticate(req);
    const b = await body(req);
    const method = b.method || "pipeline";
    const count = Math.min(Math.max(parseInt(b.count) || 5, 1), 50);

    // Check if a job is already running
    for (const job of activeJobs.values()) {
      if (job.status === "running") {
        json(res, { error: "A generation job is already running", jobId: job.id }, 409);
        return;
      }
    }

    const jobId = `gen-${Date.now()}`;

    if (method === "skeleton") {
      // Skeleton enhance mode
      const skeletonName = b.skeleton;
      if (!skeletonName) {
        json(res, { error: "skeleton name is required for skeleton method" }, 400);
        return;
      }

      const job: GenerationJob = {
        id: jobId,
        status: "running",
        requested: 1,
        accepted: 0, normalized: 0, rejected: 0, errors: 0,
        log: [],
        startedAt: new Date(),
      };
      activeJobs.set(jobId, job);

      const database = db();
      const router = getRouter();
      (async () => {
        try {
          const { readFileSync, existsSync } = await import("fs");
          const { resolve, join } = await import("path");
          const possiblePaths = [
            resolve(process.cwd(), "scripts/skeletons"),
            resolve(process.cwd(), "../scripts/skeletons"),
            resolve(process.cwd(), "../../scripts/skeletons"),
          ];
          let skeletonsDir = "";
          for (const p of possiblePaths) {
            if (existsSync(p)) { skeletonsDir = p; break; }
          }
          const fileName = skeletonName.endsWith(".html") ? skeletonName : `${skeletonName}.html`;
          const filePath = join(skeletonsDir, fileName);
          if (!existsSync(filePath)) {
            job.log.push(`ERROR: Skeleton not found: ${fileName}`);
            job.status = "failed";
            job.finishedAt = new Date();
            return;
          }

          let skeletonHtml = readFileSync(filePath, "utf-8");
          // Strip wrapper if present
          const bodyMatch = skeletonHtml.match(/<body[^>]*>([\s\S]*)<\/body>/i);
          if (bodyMatch) skeletonHtml = bodyMatch[1].trim();
          skeletonHtml = skeletonHtml.replace(/<div[^>]*>.*?Scroll down.*?<\/div>/gi, "").replace(/<div[^>]*>.*?End.*?<\/div>/gi, "").trim();

          job.log.push(`Enhancing skeleton: ${fileName} (${skeletonHtml.length} chars)`);

          const { html, tokensUsed } = await enhanceFromSkeleton(router, skeletonHtml, {
            description: b.description || undefined,
            colorPalette: b.colors || undefined,
            imageStyle: b.images || undefined,
            cssOnly: true,
          });

          if (!html || html.length < 100) {
            job.log.push("  SKIP: empty response");
            job.errors++;
            job.status = "failed";
            job.finishedAt = new Date();
            return;
          }

          const report = scoreQualityStatic(html);
          job.log.push(`  Score: ${report.overall}/10 [${report.tier}] (${tokensUsed || "?"} tokens)`);

          const id = `enhanced-${(b.domain || "skeleton")}-${Date.now().toString(36)}`;
          await database.collection("generated_components").updateOne(
            { id },
            { $set: {
              id,
              name: `Enhanced: ${b.description || skeletonName}`,
              category: "hero",
              html,
              tokens: tokensUsed || 0,
              source: { domain: b.domain || "skeleton", persona: "none", method: "css-only-enhance", skeletonFile: fileName },
              qualityReport: report,
              generatedAt: new Date(),
            }},
            { upsert: true },
          );

          job.accepted++;
          job.log.push(`  Saved: ${id} (${html.length} chars)`);
          job.status = "completed";
        } catch (err) {
          job.log.push(`ERROR: ${err instanceof Error ? err.message : err}`);
          job.status = "failed";
        }
        job.finishedAt = new Date();
      })();

      json(res, { jobId, requested: 1, method: "skeleton" });
      return;
    }

    // Pipeline and brand-lock methods
    // Check available briefed sections
    const query: Record<string, unknown> = {
      status: "briefed",
      animationBrief: { $exists: true },
    };
    if (b.domain) query.sourceDomain = b.domain;

    const available = await db().collection("raw_sections").countDocuments(query);

    if (available === 0) {
      json(res, { error: "No briefed sections available. Run briefs first." }, 400);
      return;
    }

    const actualCount = Math.min(count, available);
    const job: GenerationJob = {
      id: jobId,
      status: "running",
      requested: actualCount,
      accepted: 0, normalized: 0, rejected: 0, errors: 0,
      log: [],
      startedAt: new Date(),
    };
    activeJobs.set(jobId, job);

    // Build brand lock if provided
    const brandLock: BrandLock | undefined = (method === "brand-lock" && b.brandName && b.brandColors)
      ? { name: b.brandName, colors: b.brandColors, fonts: b.brandFonts, style: b.brandStyle }
      : undefined;

    if (brandLock) {
      job.log.push(`Brand-locked: ${brandLock.name} (${brandLock.colors})`);
    }

    // Run generation inline using SDK (async, non-blocking)
    const database = db();
    const router = getRouter();
    (async () => {
      try {
        const docs = await database.collection("raw_sections").find(query).limit(actualCount).toArray();

        for (const doc of docs) {
          try {
            const spec = generateAutoSpec(
              { ...doc, _id: doc._id.toString() } as any,
              brandLock ? undefined : (b.persona || undefined),
              brandLock,
            );
            job.log.push(`[${doc.sourceDomain}] ${spec.category} (${spec.brief.animationStyle}, ${spec.persona})`);

            const { html: rawHtml, tokensUsed } = await generatePremiumComponent(router, spec);
            if (!rawHtml || rawHtml.length < 100) {
              job.log.push(`  SKIP: empty response`);
              job.errors++;
              continue;
            }

            const report = scoreQualityStatic(rawHtml);
            const decision = qualityGate({ ...report, jsErrors: [] });

            let finalHtml = rawHtml;
            if (decision === "normalize") {
              finalHtml = normalizeHtml(rawHtml);
              const newReport = scoreQualityStatic(finalHtml);
              const newDecision = qualityGate({ ...newReport, jsErrors: [] });
              if (newDecision === "reject") {
                job.log.push(`  REJECT: ${report.overall}/10 -> normalized -> ${newReport.overall}/10`);
                job.rejected++;
                await database.collection("raw_sections").updateOne({ _id: doc._id }, { $set: { status: "rejected", updatedAt: new Date() } });
                continue;
              }
              job.log.push(`  NORMALIZE: ${report.overall}/10 -> ${newReport.overall}/10 [${newReport.tier}]`);
              job.normalized++;
            } else if (decision === "reject") {
              job.log.push(`  REJECT: ${report.overall}/10`);
              job.rejected++;
              await database.collection("raw_sections").updateOne({ _id: doc._id }, { $set: { status: "rejected", updatedAt: new Date() } });
              continue;
            } else {
              job.log.push(`  ACCEPT: ${report.overall}/10 [${report.tier}] (${tokensUsed || "?"} tokens)`);
              job.accepted++;
            }

            const entry = buildComponentEntry(finalHtml, spec, { ...report, jsErrors: [] });
            await database.collection("generated_components").updateOne(
              { id: entry.id },
              { $set: { ...entry, generatedAt: new Date() } },
              { upsert: true },
            );
            await database.collection("raw_sections").updateOne({ _id: doc._id }, {
              $set: { status: "accepted", generatedComponentId: entry.id, updatedAt: new Date() },
            });
          } catch (err) {
            job.log.push(`  ERROR: ${err instanceof Error ? err.message : err}`);
            job.errors++;
          }
        }
        job.status = "completed";
      } catch (err) {
        job.log.push(`FATAL: ${err instanceof Error ? err.message : err}`);
        job.status = "failed";
      }
      job.finishedAt = new Date();
    })();

    json(res, { jobId, requested: actualCount, available, method });
  });

  // ─── Generation job status ───

  route("GET", "/api/engine/generate/:jobId", async (req, res, params) => {
    await authenticate(req);
    const job = activeJobs.get(params.jobId);
    if (!job) { json(res, { error: "Job not found" }, 404); return; }
    json(res, {
      id: job.id,
      status: job.status,
      requested: job.requested,
      accepted: job.accepted,
      normalized: job.normalized,
      rejected: job.rejected,
      errors: job.errors,
      log: job.log.slice(-30),
      startedAt: job.startedAt,
      finishedAt: job.finishedAt,
    });
  });

  // ─── Playground: Component Extractor ───

  // Shared browser pool — reuse a single Chromium instance
  let sharedBrowser: import("playwright").Browser | null = null;
  let browserLaunchPromise: Promise<import("playwright").Browser> | null = null;

  async function getBrowser(): Promise<import("playwright").Browser> {
    if (sharedBrowser?.isConnected()) return sharedBrowser;
    if (browserLaunchPromise) return browserLaunchPromise;
    browserLaunchPromise = (async () => {
      const pw = await import("playwright");
      sharedBrowser = await pw.chromium.launch({
        headless: true,
        args: ["--disable-blink-features=AutomationControlled", "--no-sandbox"],
      });
      sharedBrowser.on("disconnected", () => { sharedBrowser = null; browserLaunchPromise = null; });
      browserLaunchPromise = null;
      return sharedBrowser;
    })();
    return browserLaunchPromise;
  }

  // Section-finding JS shared between capture and extract (injected into page.evaluate)
  const FIND_SECTIONS_JS = `
    function findSections() {
      // Strategy 1: Find semantic sections (section, article, aside) but NOT wrapper elements (main, div)
      var sections = document.querySelectorAll("section, article, aside, [role='region']");
      var elements = [];

      if (sections.length >= 3) {
        sections.forEach(function(el) { elements.push(el); });
      }

      // Strategy 2: Also grab header, nav, footer as standalone
      document.querySelectorAll("header, nav, footer, [role='banner'], [role='contentinfo']").forEach(function(el) {
        // Don't add if it's inside an already-found section
        var dominated = false;
        for (var i = 0; i < elements.length; i++) {
          if (elements[i].contains(el) || el.contains(elements[i])) { dominated = true; break; }
        }
        if (!dominated) elements.push(el);
      });

      // Strategy 3: If we still have < 3 sections, look at direct children of main or body
      if (elements.length < 3) {
        var container = document.querySelector("main") || document.body;
        var children = container.children;
        for (var i = 0; i < children.length; i++) {
          var el = children[i];
          if (el instanceof HTMLElement) {
            var rect = el.getBoundingClientRect();
            var tag = el.tagName;
            if (rect.height > 80 && !["SCRIPT", "STYLE", "LINK", "META", "NOSCRIPT"].includes(tag)) {
              // Avoid adding wrappers that contain already-found elements
              var dominated = false;
              for (var j = 0; j < elements.length; j++) {
                if (el.contains(elements[j])) { dominated = true; break; }
              }
              if (!dominated) elements.push(el);
            }
          }
        }
      }

      // Deduplicate: remove elements that are ancestors of other elements in the list
      var filtered = [];
      for (var i = 0; i < elements.length; i++) {
        var dominated = false;
        for (var j = 0; j < elements.length; j++) {
          if (i !== j && elements[j].contains(elements[i]) && elements[j] !== elements[i]) {
            // elements[i] is a child of elements[j] — keep the child (more specific)
          }
          if (i !== j && elements[i].contains(elements[j]) && elements[i] !== elements[j]) {
            // elements[i] is a parent of elements[j] — skip the parent
            dominated = true; break;
          }
        }
        if (!dominated) filtered.push(elements[i]);
      }

      // Sort by vertical position
      filtered.sort(function(a, b) {
        return a.getBoundingClientRect().top - b.getBoundingClientRect().top;
      });

      return filtered.filter(function(el) {
        var rect = el.getBoundingClientRect();
        return rect.height >= 30;
      });
    }
  `;

  // In-memory capture cache (5 min TTL)
  interface CaptureCache {
    url: string;
    screenshot: string;
    pageHeight: number;
    viewportWidth: number;
    sections: Array<{
      index: number;
      tag: string;
      bbox: { x: number; y: number; width: number; height: number };
      classes: string[];
      textPreview: string;
      hasAnimation: boolean;
    }>;
    createdAt: number;
  }
  const captureCache = new Map<string, CaptureCache>();
  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of captureCache) {
      if (now - v.createdAt > 5 * 60 * 1000) captureCache.delete(k);
    }
  }, 60_000);

  route("POST", "/api/engine/capture", async (req, res) => {
    await authenticate(req);
    const b = await body(req);
    const url = b.url;
    if (!url || typeof url !== "string") {
      json(res, { error: "url is required" }, 400);
      return;
    }

    let browser: import("playwright").Browser;
    try {
      browser = await getBrowser();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("Cannot find") || msg.includes("MODULE_NOT_FOUND")) {
        json(res, { error: "Playwright not installed. Run: npm install playwright && npx playwright install chromium" }, 501);
      } else {
        json(res, { error: `Browser launch failed: ${msg}` }, 500);
      }
      return;
    }

    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
      locale: "en-US",
      geolocation: { longitude: -122.4, latitude: 37.8 },
      permissions: ["geolocation"],
    });
    try {
      const page = await context.newPage();
      // Try networkidle → domcontentloaded → crawl4ai fallback
      let usedCrawl4ai = false;
      try {
        try {
          await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
        } catch {
          await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
          await page.waitForTimeout(5000);
        }
      } catch {
        // Both failed — use crawl4ai to fetch rendered HTML (same approach as redesign pipeline)
        try {
          const dismissJS = `
            (function() {
              try {
                // Cookie/consent dismissal
                var sels = ['[id*="cookie"] button','[class*="cookie"] button','[id*="consent"] button','#onetrust-accept-btn-handler','.cc-accept','[aria-label*="accept" i]'];
                for (var i = 0; i < sels.length; i++) { try { var btns = document.querySelectorAll(sels[i]); for (var j = 0; j < btns.length; j++) { var t = (btns[j].textContent||'').toLowerCase(); if (t.match(/accept|agree|allow|ok|close|dismiss/)) btns[j].click(); } } catch(e) {} }
                // Geo/locale modals
                var geos = ['[class*="locale"] a','[class*="location"] a','[class*="modal"] [class*="close"]','[role="dialog"] button[aria-label*="close" i]'];
                for (var i = 0; i < geos.length; i++) { try { document.querySelectorAll(geos[i]).forEach(function(el) { var t = (el.textContent||'').toLowerCase(); if (t.match(/united states|continue|stay|english|close/)) el.click(); }); } catch(e) {} }
                // Hide overlays
                var hides = ['[id*="cookie-banner"]','[id*="consent"]','#onetrust-banner-sdk','.cc-window'];
                for (var i = 0; i < hides.length; i++) { try { document.querySelectorAll(hides[i]).forEach(function(el) { el.style.display = 'none'; }); } catch(e) {} }
                document.body.style.overflow = '';
                // Scroll to load lazy content
                window.scrollTo(0, document.body.scrollHeight);
              } catch(e) {}
            })();
          `;
          const crawlRes = await fetch("http://crawl4ai:11235/crawl", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              urls: [url],
              crawler_config: {
                js_code: [dismissJS],
                wait_until: "domcontentloaded",
                delay_before_return_html: 5,
                page_timeout: 45000,
                screenshot: true,
              },
            }),
          });
          const crawlData = await crawlRes.json() as any;
          const crawlResult = crawlData.results?.[0] ?? crawlData;
          const crawlHtml = crawlResult.html ?? crawlResult.raw_html ?? "";
          const crawlScreenshot = crawlResult.screenshot ?? "";
          if (typeof crawlHtml === "string" && crawlHtml.length > 500) {
            usedCrawl4ai = true;
            // Store for later — don't load into Playwright (crashes on large HTML)
            (page as any).__crawl4aiHtml = crawlHtml;
            (page as any).__crawl4aiScreenshot = crawlScreenshot || undefined;
          } else {
            throw new Error("crawl4ai returned empty HTML");
          }
        } catch (crawlErr) {
          throw new Error(`Page failed to load. Crawl4ai fallback: ${crawlErr instanceof Error ? crawlErr.message : crawlErr}`);
        }
      }
      // ── Crawl4ai path: skip browser interaction, parse HTML server-side ──
      if (usedCrawl4ai) {
        const crawlHtml = (page as any).__crawl4aiHtml as string;
        const crawlScreenshot = (page as any).__crawl4aiScreenshot as string | undefined;

        // Parse sections from raw HTML using regex (no DOM needed)
        const sectionRegex = /<(section|article|aside|header|nav|footer|main)(\s[^>]*)?>[\s\S]*?<\/\1>/gi;
        const topLevelRegex = /<body[^>]*>([\s\S]*)<\/body>/i;
        const bodyMatch = topLevelRegex.exec(crawlHtml);
        const bodyHtml = bodyMatch?.[1] || crawlHtml;

        const sections: CaptureCache["sections"] = [];
        let match;
        let idx = 0;
        const seen = new Set<string>();

        // Find semantic tags
        while ((match = sectionRegex.exec(crawlHtml)) !== null) {
          const tag = match[1].toLowerCase();
          if (tag === "main") continue; // skip wrapper
          const fullMatch = match[0];
          const text = fullMatch.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 120);
          if (text.length < 10) continue;
          const classMatch = fullMatch.match(/class="([^"]*)"/);
          const classes = classMatch ? classMatch[1].split(/\s+/).slice(0, 10) : [];
          const key = `${tag}-${classes[0] || idx}`;
          if (seen.has(key)) continue;
          seen.add(key);

          const hasAnimation = /gsap|ScrollTrigger|swiper|anime|lottie|@keyframes|data-aos/i.test(fullMatch);

          // Estimate Y position from order (900px per section as rough estimate)
          sections.push({
            index: idx,
            tag,
            bbox: { x: 0, y: idx * 900, width: 1440, height: 900 },
            classes,
            textPreview: text,
            hasAnimation,
          });
          idx++;
        }

        // If no semantic sections found, fall back to top-level divs
        if (sections.length < 3) {
          const divRegex = /<div\s+class="([^"]*)"[^>]*>/gi;
          while ((match = divRegex.exec(bodyHtml)) !== null && idx < 20) {
            const cls = match[1].split(/\s+/);
            if (cls[0] && !seen.has(cls[0])) {
              seen.add(cls[0]);
              sections.push({
                index: idx,
                tag: "div",
                bbox: { x: 0, y: idx * 600, width: 1440, height: 600 },
                classes: cls.slice(0, 10),
                textPreview: cls[0],
                hasAnimation: false,
              });
              idx++;
            }
          }
        }

        const screenshot = crawlScreenshot || "";
        const pageHeight = sections.length * 900;

        if (!screenshot && sections.length === 0) {
          json(res, {
            error: "This site blocked headless browser access. Try a different URL.",
            suggestion: "Corporate sites, annual reports, and SaaS sites work best.",
          }, 422);
          return;
        }

        const captureId = `cap-${Date.now().toString(36)}`;
        captureCache.set(captureId, { url, screenshot, pageHeight, viewportWidth: 1440, sections, createdAt: Date.now() });
        json(res, { captureId, screenshot, pageHeight, viewportWidth: 1440, url, sections });
        return;
      }

      // ── Direct Playwright path ──
      await page.waitForTimeout(4000);

      // Dismiss cookie banners / consent dialogs
      await page.evaluate(() => {
        // Try clicking common accept/close buttons
        const selectors = [
          "[id*='cookie'] button", "[class*='cookie'] button",
          "[id*='consent'] button", "[class*='consent'] button",
          "[id*='gdpr'] button", "[class*='gdpr'] button",
          "[data-testid*='cookie'] button", "[data-testid*='consent'] button",
          "button[id*='accept']", "button[class*='accept']",
          "button[id*='agree']", "button[class*='agree']",
          ".cc-btn", ".cc-accept", ".cc-dismiss",
          "#onetrust-accept-btn-handler",
          ".onetrust-close-btn-handler",
          "[aria-label*='cookie' i] button",
          "[aria-label*='consent' i] button",
          "[aria-label*='accept' i]",
        ];
        for (const sel of selectors) {
          try {
            const btns = document.querySelectorAll(sel);
            btns.forEach(btn => {
              const text = (btn.textContent || "").toLowerCase();
              if (text.includes("accept") || text.includes("agree") || text.includes("ok") || text.includes("got it") || text.includes("close") || text.includes("dismiss")) {
                (btn as HTMLElement).click();
              }
            });
          } catch {}
        }
        // Dismiss geo/locale redirect dialogs
        const geoSelectors = [
          "[class*='locale-modal'] a", "[class*='location'] a", "[id*='locale'] a",
          "[class*='geo-modal'] button", "[class*='region'] button",
          "a[href*='united-states']", "a[href*='/us/']", "a[href*='/en-us']",
          "[data-region='us'] a", "[data-locale='en_US'] a",
        ];
        for (const sel of geoSelectors) {
          try {
            document.querySelectorAll(sel).forEach(el => {
              const text = (el.textContent || "").toLowerCase();
              if (text.includes("united states") || text.includes("continue") || text.includes("stay") || text.includes("english")) {
                (el as HTMLElement).click();
              }
            });
          } catch {}
        }
        // Also try closing any modal overlay via close/X buttons
        const closeSelectors = [
          "[class*='modal'] [class*='close']", "[class*='modal'] button[aria-label*='close' i]",
          "[class*='dialog'] [class*='close']", "[role='dialog'] button[aria-label*='close' i]",
          ".modal-close", ".dialog-close",
        ];
        for (const sel of closeSelectors) {
          try { document.querySelectorAll(sel).forEach(el => (el as HTMLElement).click()); } catch {}
        }

        // Hide remaining cookie/consent overlays
        const overlaySelectors = [
          "[id*='cookie-banner']", "[id*='cookiebanner']", "[id*='cookie-consent']",
          "[id*='consent-banner']", "[class*='cookie-banner']", "[class*='cookieBanner']",
          "[class*='consent-banner']", "[class*='gdpr']",
          "#onetrust-banner-sdk", "#onetrust-consent-sdk",
          ".cc-window", ".cc-banner",
          "[id*='CybotCookiebot']",
        ];
        for (const sel of overlaySelectors) {
          try {
            document.querySelectorAll(sel).forEach(el => {
              (el as HTMLElement).style.display = "none";
            });
          } catch {}
        }
      });
      await page.waitForTimeout(500);

      // Force-load all lazy images: remove loading="lazy" and data-src → src
      await page.evaluate(() => {
        document.querySelectorAll("img[loading='lazy']").forEach(img => {
          img.removeAttribute("loading");
        });
        // Handle data-src lazy loading pattern
        document.querySelectorAll("img[data-src]").forEach(img => {
          if (!img.getAttribute("src") || img.getAttribute("src") === "") {
            img.setAttribute("src", img.getAttribute("data-src")!);
          }
        });
        document.querySelectorAll("source[data-srcset]").forEach(source => {
          if (!source.getAttribute("srcset")) {
            source.setAttribute("srcset", source.getAttribute("data-srcset")!);
          }
        });
        // Force video poster images to load
        document.querySelectorAll("video[data-poster]").forEach(vid => {
          if (!vid.getAttribute("poster")) {
            vid.setAttribute("poster", vid.getAttribute("data-poster")!);
          }
        });
      });

      // Phase 1: Fast scroll to trigger all lazy/intersection content
      // Scrolls the full page in ~10-15s regardless of height
      let totalHeight = await page.evaluate(() => document.body.scrollHeight);
      const prevHeight = totalHeight;
      const MAX_SCROLL_TIME = 30000;
      const scrollStart = Date.now();

      // First pass: scroll down the full page
      for (let y = 0; y < totalHeight && (Date.now() - scrollStart) < MAX_SCROLL_TIME; y += 400) {
        await page.evaluate((s) => window.scrollTo(0, s), y);
        await page.waitForTimeout(100);
        // Check if page grew (dynamic content loading)
        if (y % 2000 === 0) {
          const h = await page.evaluate(() => document.body.scrollHeight);
          if (h > totalHeight) totalHeight = h;
        }
      }
      // Scroll to absolute bottom
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(2000);

      // Check if page grew during scroll — if so, do a second pass for the new content
      const heightAfterFirst = await page.evaluate(() => document.body.scrollHeight);
      if (heightAfterFirst > prevHeight + 1000) {
        for (let y = prevHeight; y < heightAfterFirst && (Date.now() - scrollStart) < MAX_SCROLL_TIME; y += 400) {
          await page.evaluate((s) => window.scrollTo(0, s), y);
          await page.waitForTimeout(100);
        }
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await page.waitForTimeout(1500);
      }

      // Phase 2: Force all content visible, then take fullPage screenshot
      // Kill GSAP so it doesn't re-hide elements, force inline visibility
      await page.evaluate(() => {
        const w = window as any;
        if (w.ScrollTrigger) try { w.ScrollTrigger.getAll().forEach((t: any) => t.kill()); } catch {}
        if (w.gsap) { try { w.gsap.globalTimeline.clear(); } catch {} try { w.gsap.killTweensOf("*"); } catch {} }
        document.getAnimations?.().forEach((a: Animation) => { try { a.cancel(); } catch {} });

        // Force every element visible
        document.querySelectorAll("*").forEach(el => {
          const h = el as HTMLElement;
          h.style.setProperty("opacity", "1", "important");
          h.style.setProperty("visibility", "visible", "important");
        });

        // Replace videos with poster images where available
        document.querySelectorAll("video").forEach(video => {
          const poster = video.poster || "";
          if (poster) {
            const img = document.createElement("img");
            img.src = poster;
            img.style.cssText = "width:100%;height:100%;object-fit:cover;position:absolute;inset:0;";
            img.className = video.className;
            video.style.display = "none";
            video.parentElement?.appendChild(img);
          }
        });
      });

      // Wait for images (poster replacements + lazy-loaded)
      const imgWaitStart = Date.now();
      while ((Date.now() - imgWaitStart) < 8000) {
        const pending = await page.evaluate(() => {
          let n = 0; document.querySelectorAll("img[src]").forEach(img => { if (!(img as HTMLImageElement).complete) n++; }); return n;
        });
        if (pending === 0) break;
        await page.waitForTimeout(500);
      }

      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(1000);

      // Use crawl4ai screenshot if available (captured from real rendered page),
      // otherwise take fullPage screenshot from Playwright
      const crawl4aiScreenshot = (page as any).__crawl4aiScreenshot as string | undefined;
      let screenshot: string;
      if (crawl4aiScreenshot) {
        screenshot = crawl4aiScreenshot;
      } else {
        const screenshotBuffer = await page.screenshot({ fullPage: true, timeout: 30000 });
        screenshot = screenshotBuffer.toString("base64");
      }

      // Clean up overrides so extract sees real page
      await page.evaluate(() => {
        document.querySelectorAll("*").forEach(el => {
          (el as HTMLElement).style.removeProperty("opacity");
          (el as HTMLElement).style.removeProperty("visibility");
        });
      });

      const sections = await page.evaluate(`
        (function() {
          ${FIND_SECTIONS_JS}
          var elements = findSections();
          return elements.map(function(el, i) {
            var rect = el.getBoundingClientRect();
            var scrollY = window.scrollY;
            var text = (el.textContent || "").replace(/\\s+/g, " ").trim().slice(0, 120);
            var classes = Array.from(el.classList).slice(0, 10);
            var inner = el.innerHTML || "";
            var hasAnimation = /gsap|ScrollTrigger|swiper|anime|lottie|@keyframes|data-aos|data-parallax/i.test(inner)
              || /transition|animation|will-change/i.test(el.getAttribute("style") || "");
            return {
              index: i,
              tag: el.tagName.toLowerCase(),
              bbox: { x: rect.x, y: rect.y + scrollY, width: rect.width, height: rect.height },
              classes: classes,
              textPreview: text,
              hasAnimation: hasAnimation,
            };
          });
        })()
      `);

      const pageHeight = await page.evaluate(() => document.body.scrollHeight);
      const textLen = await page.evaluate(() => (document.body.textContent || "").trim().length);

      // Check if the page actually rendered content
      const sectionList = sections as CaptureCache["sections"];
      if (sectionList.length === 0 && textLen < 200) {
        json(res, {
          error: "This site blocked headless browser access or rendered no content. Try a different URL.",
          suggestion: "Sites like adobe.com use aggressive bot protection. Corporate sites, annual reports, and most SaaS sites work well.",
        }, 422);
        return;
      }

      const captureId = `cap-${Date.now().toString(36)}`;
      const cached: CaptureCache = {
        url, screenshot, pageHeight, viewportWidth: 1440,
        sections: sectionList,
        createdAt: Date.now(),
      };
      captureCache.set(captureId, cached);

      json(res, { captureId, screenshot, pageHeight, viewportWidth: 1440, url, sections: sectionList });
    } catch (err) {
      json(res, { error: err instanceof Error ? err.message : "Capture failed" }, 500);
    } finally {
      await context.close();
    }
  });

  route("POST", "/api/engine/extract", async (req, res) => {
    await authenticate(req);
    const b = await body(req);
    const { captureId, sectionIndex } = b;
    // Support multi-section: sectionIndex can be a number or array of numbers
    const indices: number[] = Array.isArray(sectionIndex) ? sectionIndex : [sectionIndex];

    if (!captureId || indices.length === 0 || indices.some(i => i === undefined)) {
      json(res, { error: "captureId and sectionIndex are required" }, 400);
      return;
    }

    const cached = captureCache.get(captureId);
    if (!cached) {
      json(res, { error: "Capture expired or not found. Re-capture the page." }, 404);
      return;
    }

    let browser: import("playwright").Browser;
    try {
      browser = await getBrowser();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      json(res, { error: `Browser launch failed: ${msg}` }, 500);
      return;
    }

    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    try {
      const page = await context.newPage();
      await page.goto(cached.url, { waitUntil: "networkidle", timeout: 30000 });
      await page.waitForTimeout(2000);

      const scopeId = `ext-${Date.now().toString(36)}`;

      const result = await page.evaluate(`
        (function() {
          ${FIND_SECTIONS_JS}
          var elements = findSections();
          var indices = ${JSON.stringify(indices)};
          var scopeId = ${JSON.stringify(scopeId)};

          // Collect HTML from all selected sections
          var htmlParts = [];
          var scriptParts = [];
          var allSubtreeEls = [];

          for (var ii = 0; ii < indices.length; ii++) {
            var el = elements[indices[ii]];
            if (!el) continue;

            // Extract script tags separately before getting outerHTML
            var scripts = el.querySelectorAll("script");
            scripts.forEach(function(s) {
              var content = s.textContent || "";
              if (content.trim()) scriptParts.push(content);
            });

            // Add scope class to root element
            el.classList.add(scopeId);
            htmlParts.push(el.outerHTML);
            el.classList.remove(scopeId);

            allSubtreeEls.push(el);
            el.querySelectorAll("*").forEach(function(sub) { allSubtreeEls.push(sub); });
          }

          // Extract scoped CSS rules
          var cssRules = [];
          var fontFaces = [];
          var keyframes = [];
          try {
            for (var si = 0; si < document.styleSheets.length; si++) {
              var sheet = document.styleSheets[si];
              try {
                for (var ri = 0; ri < sheet.cssRules.length; ri++) {
                  var rule = sheet.cssRules[ri];
                  if (rule instanceof CSSStyleRule) {
                    for (var ei = 0; ei < allSubtreeEls.length; ei++) {
                      try {
                        if (allSubtreeEls[ei].matches(rule.selectorText)) {
                          // Scope the selector: prepend .scopeId
                          var scoped = "." + scopeId + " " + rule.cssText;
                          cssRules.push(scoped);
                          break;
                        }
                      } catch(e) { /* invalid selector */ }
                    }
                  } else if (rule instanceof CSSFontFaceRule) {
                    fontFaces.push(rule.cssText);
                  } else if (rule instanceof CSSKeyframesRule) {
                    keyframes.push(rule.cssText);
                  } else if (rule instanceof CSSMediaRule) {
                    var hasMatch = false;
                    var innerRules = [];
                    for (var mri = 0; mri < rule.cssRules.length; mri++) {
                      var inner = rule.cssRules[mri];
                      if (inner instanceof CSSStyleRule) {
                        for (var mei = 0; mei < allSubtreeEls.length; mei++) {
                          try {
                            if (allSubtreeEls[mei].matches(inner.selectorText)) {
                              hasMatch = true;
                              innerRules.push("." + scopeId + " " + inner.cssText);
                              break;
                            }
                          } catch(e) { /* */ }
                        }
                      }
                    }
                    if (hasMatch) {
                      cssRules.push("@media " + rule.conditionText + " {\\n" + innerRules.join("\\n") + "\\n}");
                    }
                  }
                }
              } catch(e) { /* cross-origin sheet */ }
            }
          } catch(e) { /* */ }

          // Detect assets
          var assets = [];
          for (var ai = 0; ai < indices.length; ai++) {
            var ael = elements[indices[ai]];
            if (!ael) continue;
            ael.querySelectorAll("img[src], source[src], video[src], [style*='background']").forEach(function(img) {
              var src = img.getAttribute("src");
              if (src) {
                try { assets.push(new URL(src, document.baseURI).href); } catch(e) { assets.push(src); }
              }
              // background-image from inline style
              var style = img.getAttribute("style") || "";
              var bgMatch = style.match(/url\\(['"]?([^'"\\)]+)['"]?\\)/);
              if (bgMatch) {
                try { assets.push(new URL(bgMatch[1], document.baseURI).href); } catch(e) { assets.push(bgMatch[1]); }
              }
            });
          }

          // Detect libs — check page-level scripts too
          var libs = [];
          var allScriptText = scriptParts.join(" ").toLowerCase();
          var pageScripts = document.querySelectorAll("script[src]");
          var scriptSrcs = "";
          pageScripts.forEach(function(s) { scriptSrcs += " " + (s.getAttribute("src") || ""); });
          var combined = allScriptText + " " + scriptSrcs.toLowerCase();
          if (/gsap/.test(combined)) libs.push("GSAP");
          if (/scrolltrigger|scroll-trigger/i.test(combined)) libs.push("ScrollTrigger");
          if (/swiper/i.test(combined)) libs.push("Swiper");
          if (keyframes.length > 0) libs.push("CSS Animations");
          if (/lottie/i.test(combined)) libs.push("Lottie");
          if (/anime\\.js|animejs/i.test(combined)) libs.push("Anime.js");
          if (/three\\.js|threejs/i.test(combined)) libs.push("Three.js");

          // Build final CSS
          var uniqueRules = [];
          var seen = {};
          var allCss = fontFaces.concat(keyframes).concat(cssRules);
          for (var ci = 0; ci < allCss.length; ci++) {
            if (!seen[allCss[ci]]) { seen[allCss[ci]] = true; uniqueRules.push(allCss[ci]); }
          }

          return {
            html: htmlParts.join("\\n\\n"),
            css: uniqueRules.join("\\n\\n"),
            scripts: scriptParts,
            scopeClass: scopeId,
            assets: assets.filter(function(v, i, a) { return a.indexOf(v) === i; }),
            libs: libs,
          };
        })()
      `);

      json(res, result);
    } catch (err) {
      json(res, { error: err instanceof Error ? err.message : "Extract failed" }, 500);
    } finally {
      await context.close();
    }
  });

  route("POST", "/api/engine/save-skeleton", async (req, res) => {
    await authenticate(req);
    const b = await body(req);
    const { name, html, css, description } = b;

    if (!name || !html) {
      json(res, { error: "name and html are required" }, 400);
      return;
    }

    try {
      const { writeFileSync, existsSync } = await import("fs");
      const { resolve } = await import("path");

      const possiblePaths = [
        resolve(process.cwd(), "scripts/skeletons"),
        resolve(process.cwd(), "../scripts/skeletons"),
        resolve(process.cwd(), "../../scripts/skeletons"),
      ];
      let skeletonsDir = "";
      for (const p of possiblePaths) {
        if (existsSync(p)) { skeletonsDir = p; break; }
      }
      if (!skeletonsDir) {
        json(res, { error: "Skeletons directory not found" }, 500);
        return;
      }

      const safeName = name.replace(/[^a-z0-9-]/gi, "-").toLowerCase();
      const fileName = safeName.endsWith(".html") ? safeName : `${safeName}.html`;
      const filePath = resolve(skeletonsDir, fileName);

      const content = `<!-- ${description || safeName} -->\n${css ? `<style>\n${css}\n</style>\n` : ""}${html}\n`;
      writeFileSync(filePath, content, "utf-8");

      json(res, { saved: true, file: fileName });
    } catch (err) {
      json(res, { error: err instanceof Error ? err.message : "Save failed" }, 500);
    }
  });
}
