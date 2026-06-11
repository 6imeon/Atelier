/**
 * Seed the component library by scraping HyperUI (hyperui.dev).
 *
 * Usage:
 *   npx tsx scripts/seed-components.ts
 *
 * Requires crawl4ai running on localhost:11235 (docker compose up)
 * Outputs components.json in the scripts/ directory.
 */

import { writeFileSync } from "fs";
import { resolve } from "path";

const CRAWL4AI_URL = process.env.CRAWL4AI_URL || "http://localhost:11235";
const BASE = "https://www.hyperui.dev";
const OUTPUT_PATH = resolve(__dirname, "components.json");

// HyperUI category pages
const CATEGORIES: Array<{ path: string; category: string }> = [
  { path: "/components/marketing/announcements", category: "banner" },
  { path: "/components/marketing/banners", category: "hero" },
  { path: "/components/marketing/cards", category: "cards" },
  { path: "/components/marketing/blog-cards", category: "cards" },
  { path: "/components/marketing/ctas", category: "cta" },
  { path: "/components/marketing/faqs", category: "faq" },
  { path: "/components/marketing/footers", category: "footer" },
  { path: "/components/marketing/contact-forms", category: "forms" },
  { path: "/components/marketing/headers", category: "navbar" },
  { path: "/components/marketing/sections", category: "features" },
  { path: "/components/marketing/feature-grids", category: "features" },
  { path: "/components/marketing/pricing", category: "pricing" },
  { path: "/components/marketing/team-sections", category: "team" },
];

async function crawlPage(url: string): Promise<string> {
  try {
    const res = await fetch(`${CRAWL4AI_URL}/crawl`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ urls: [url], word_count_threshold: 5 }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const result = data.results?.[0] ?? data;
    return result.html ?? result.raw_html ?? "";
  } catch (err) {
    console.warn(`  Failed to crawl: ${err}`);
    return "";
  }
}

async function fetchDirect(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/120.0.0.0" },
      signal: AbortSignal.timeout(15_000),
    });
    return await res.text();
  } catch {
    return "";
  }
}

function extractBody(html: string): string {
  // Extract just the <body> content, stripping <head>, <script>, <link> etc.
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  const body = bodyMatch ? bodyMatch[1] : html;
  // Remove script tags
  return body.replace(/<script[\s\S]*?<\/script>/gi, "").trim();
}

function inferAdaptability(html: string): "rigid" | "flexible" | "fluid" {
  const lines = html.split("\n").length;
  const hasGrid = html.includes("grid-cols") || html.includes("grid ");
  const hasFlex = html.includes("flex ");
  if (lines > 50 || (hasGrid && hasFlex)) return "fluid";
  if (lines > 20 || hasGrid || hasFlex) return "flexible";
  return "rigid";
}

function inferTokens(html: string) {
  const colors: string[] = [];
  if (/bg-(?:blue|indigo|purple|violet|pink|rose|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky)/.test(html)) colors.push("primary");
  if (/bg-(?:gray|slate|zinc|neutral|stone)/.test(html)) colors.push("surface");
  if (/text-(?:gray|slate)/.test(html)) colors.push("text");
  if (colors.length === 0) colors.push("primary", "surface", "text");

  const fonts: string[] = [];
  if (/text-(?:2xl|3xl|4xl|5xl|6xl)|font-bold/.test(html)) fonts.push("headline");
  if (/text-(?:sm|base|lg)/.test(html)) fonts.push("body");
  if (fonts.length === 0) fonts.push("headline", "body");

  return { colors, fonts, radius: /rounded/.test(html) };
}

async function main() {
  console.log("Component Library Seed Script");
  console.log("=============================\n");

  // Check crawl4ai
  try {
    const health = await fetch(`${CRAWL4AI_URL}/health`, { signal: AbortSignal.timeout(5000) });
    if (!health.ok) throw new Error("not healthy");
    console.log(`crawl4ai running at ${CRAWL4AI_URL}\n`);
  } catch {
    console.error(`ERROR: crawl4ai not available at ${CRAWL4AI_URL}`);
    console.error("Run: docker compose up -d");
    process.exit(1);
  }

  const allComponents: any[] = [];
  const categoryCounters: Record<string, number> = {};

  for (const { path, category } of CATEGORIES) {
    const url = `${BASE}${path}`;
    console.log(`\n[${category}] ${url}`);

    // Step 1: Crawl the category page to find iframe example URLs
    const pageHtml = await crawlPage(url);
    if (!pageHtml) { console.log("  Skipped (no content)"); continue; }

    // Extract iframe src paths like /examples/marketing/ctas/1.html
    const iframeSrcs: string[] = [];
    const iframeRegex = /(?:src|href)=["']?(\/examples\/[^"'\s]+\.html)/gi;
    let match;
    while ((match = iframeRegex.exec(pageHtml)) !== null) {
      const src = match[1];
      // Skip dark variants (we can add those as variants later)
      if (src.includes("-dark")) continue;
      if (!iframeSrcs.includes(src)) iframeSrcs.push(src);
    }

    console.log(`  Found ${iframeSrcs.length} component examples`);

    // Step 2: Fetch each example page directly (they're static HTML, no JS needed)
    for (let i = 0; i < iframeSrcs.length; i++) {
      const exampleUrl = `${BASE}${iframeSrcs[i]}`;
      const html = await fetchDirect(exampleUrl);
      if (!html || html.length < 100) {
        console.log(`  Skipped ${iframeSrcs[i]} (empty)`);
        continue;
      }

      const bodyHtml = extractBody(html);
      if (bodyHtml.length < 50) continue;

      categoryCounters[category] = (categoryCounters[category] || 0) + 1;
      const num = categoryCounters[category];
      const id = `${category}-${String(num).padStart(2, "0")}`;
      const name = `${category.charAt(0).toUpperCase() + category.slice(1)} ${num}`;

      // Check for dark variant
      const darkSrc = iframeSrcs[i].replace(".html", "") + "-dark" + ".html";
      // We don't fetch dark variants here — just note they exist
      const darkPath = `${BASE}${darkSrc.replace(/\/\//g, "/")}`;

      allComponents.push({
        id,
        category,
        name,
        description: `${name} — Tailwind component from HyperUI`,
        html: bodyHtml,
        thumbnail: undefined,
        tokens: inferTokens(bodyHtml),
        slots: [],
        variants: [],
        tags: ["tailwind", "responsive", category, "hyperui"],
        source: `scraped:hyperui.dev${iframeSrcs[i]}`,
        adaptability: inferAdaptability(bodyHtml),
        quality: 4,
        usageCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      console.log(`  + ${id}: ${bodyHtml.length} chars`);
    }
  }

  console.log(`\n=============================`);
  console.log(`Total components: ${allComponents.length}`);

  writeFileSync(OUTPUT_PATH, JSON.stringify(allComponents, null, 2));
  console.log(`Written to: ${OUTPUT_PATH}`);

  const byCat: Record<string, number> = {};
  for (const c of allComponents) byCat[c.category] = (byCat[c.category] || 0) + 1;
  console.log("\nBy category:");
  for (const [cat, count] of Object.entries(byCat).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${cat}: ${count}`);
  }
}

main().catch(err => { console.error("Fatal:", err); process.exit(1); });
