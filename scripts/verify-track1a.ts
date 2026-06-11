/**
 * Track 1A verification — fetches two sites and reports detected
 * animation patterns + cinematic auto-detection decision.
 *
 * Usage: npx tsx scripts/verify-track1a.ts
 */

import { extractSections } from "../packages/sdk/src/utils/section-extractor.js";

const TARGETS = [
  { name: "strattoncraig (lightweight)", url: "https://strattoncraig.com" },
  { name: "adidas-group report (heavy)", url: "https://report.adidas-group.com/2024/en/" },
];

const CRAWL4AI_URL = process.env.CRAWL4AI_URL || "http://localhost:11235";

async function fetchHtml(url: string): Promise<string> {
  process.stdout.write(`  fetching via crawl4ai... `);
  const t0 = Date.now();
  try {
    const res = await fetch(`${CRAWL4AI_URL}/crawl`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ urls: [url] }),
    });
    if (res.ok) {
      const data = await res.json() as any;
      const result = Array.isArray(data.results) ? data.results[0] : data;
      const html = result?.html || result?.cleaned_html || "";
      if (html && html.length > 500) {
        console.log(`ok (${Date.now() - t0}ms, ${Math.round(html.length / 1000)}K chars)`);
        return html;
      }
    }
    console.log(`empty response, falling back to direct fetch`);
  } catch (err) {
    console.log(`failed (${err instanceof Error ? err.message : err}), falling back`);
  }
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

function analyzeSite(name: string, url: string, html: string) {
  console.log(`\n${"=".repeat(72)}`);
  console.log(`SITE: ${name}`);
  console.log(`URL:  ${url}`);
  console.log(`HTML: ${Math.round(html.length / 1000)}K chars`);
  console.log("=".repeat(72));

  const sections = extractSections(html, { sourceUrl: url, maxSections: 20 });
  const allPatterns = sections.flatMap(s => s.animations);

  const cinematicLibs = new Set(["gsap", "scrolltrigger", "lottie", "three-js", "framer-motion"]);
  const scrollTriggers = new Set(["scroll", "viewport-enter"]);
  const hasCinematicLib = allPatterns.some(p => cinematicLibs.has(p.type));
  const scrollPatternCount = allPatterns.filter(p => scrollTriggers.has(p.trigger)).length;
  const cinematicDetected = hasCinematicLib || scrollPatternCount >= 3;

  console.log(`\nSections extracted: ${sections.length}`);
  console.log(`Total animation patterns: ${allPatterns.length}`);
  console.log(`Scroll-triggered patterns: ${scrollPatternCount}`);
  console.log(`Cinematic libraries present: ${hasCinematicLib}`);
  console.log(`\nDECISION: cinematic mode = ${cinematicDetected ? "ON" : "OFF"}`);

  if (allPatterns.length > 0) {
    const byType = new Map<string, number>();
    for (const p of allPatterns) byType.set(p.type, (byType.get(p.type) || 0) + 1);
    const typeSummary = [...byType.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([t, n]) => `  ${t}: ${n}`)
      .join("\n");
    console.log(`\nPatterns by type:\n${typeSummary}`);

    console.log(`\nPer-section breakdown (first 12):`);
    sections.slice(0, 12).forEach(s => {
      const marker = s.animations.length > 0 ? "*" : " ";
      console.log(`  ${marker} [${String(s.index).padStart(2)}] ${s.classification.category.padEnd(12)} tier=${s.tier.padEnd(11)} anims=${s.animations.length}`);
      if (s.animations.length > 0) {
        s.animations.slice(0, 4).forEach(a => {
          console.log(`         - ${a.type}/${a.trigger}${a.properties.length ? ` [${a.properties.slice(0, 3).join(",")}]` : ""}`);
        });
      }
    });
  } else {
    console.log(`\n(No animation patterns detected)`);
  }
}

async function main() {
  for (const t of TARGETS) {
    try {
      const html = await fetchHtml(t.url);
      analyzeSite(t.name, t.url, html);
    } catch (err) {
      console.error(`\nFAILED ${t.name}: ${err instanceof Error ? err.message : err}`);
    }
  }
}

main();
