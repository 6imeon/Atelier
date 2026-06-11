/**
 * Track 4 verification — run the new gsap-validator over:
 *   1. All 25 existing cinematic components (should all pass)
 *   2. A few hand-crafted broken scripts (should all fail with clear errors)
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

import {
  validateGsapScript,
  validateGsapScriptBatch,
  computeAnimationQualityScore,
} from "../packages/sdk/src/utils/gsap-validator.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CINE_PATH = resolve(__dirname, "components-cinematic.json");

function extractFirstScript(html: string): string | null {
  const m = html.match(/<script[^>]*>([\s\S]*?)<\/script>/);
  return m ? m[1] : null;
}

console.log("1. Validating 25 cinematic components");
console.log("=====================================");
const components = JSON.parse(readFileSync(CINE_PATH, "utf-8")) as Array<{ id: string; html: string }>;
const allScripts: string[] = [];
for (const c of components) {
  const script = extractFirstScript(c.html);
  if (!script) { console.log(`✗ ${c.id} — no <script> found`); continue; }
  const r = validateGsapScript(script);
  const mark = r.valid ? "✓" : "✗";
  const warn = r.warnings.length > 0 ? ` (${r.warnings.length} warnings)` : "";
  console.log(`${mark} ${c.id.padEnd(40)} gsap=${r.stats.gsapCalls} st=${r.stats.scrollTriggers} ids=[${r.stats.triggerIds.join(",")}]${warn}`);
  if (!r.valid) r.errors.forEach(e => console.log(`    ERROR: ${e}`));
  allScripts.push(script);
}

const batch = validateGsapScriptBatch(allScripts);
const score = computeAnimationQualityScore(batch);
console.log(`\nBatch stats: ${batch.totalScrollTriggers} triggers, ${batch.totalGsapCalls} gsap calls`);
console.log(`Duplicate IDs: ${batch.duplicateIds.length > 0 ? batch.duplicateIds.join(", ") : "(none)"}`);
console.log(`Animation quality score: ${score.toFixed(3)}`);

console.log("\n2. Broken script detection");
console.log("===========================");
const broken: Array<{ name: string; script: string; expectFail: boolean }> = [
  { name: "syntax error — unclosed brace", script: "gsap.to('.foo', { x: 100", expectFail: true },
  { name: "syntax error — invalid token", script: "gsap.to('.foo' @@@ 100)", expectFail: true },
  { name: "valid — pinned timeline", script: `gsap.timeline({ scrollTrigger: { id: "hero-main", trigger: ".hero", pin: true, scrub: 1, end: "+=150%" } }).from(".word", { yPercent: 110 })`, expectFail: false },
  { name: "valid — simple to()", script: `gsap.to(".box", { x: 100, duration: 1 })`, expectFail: false },
  { name: "warning — reverse toggleActions", script: `gsap.from(".el", { opacity: 0, scrollTrigger: { trigger: ".el", toggleActions: "play none none reverse" } })`, expectFail: false },
];
for (const t of broken) {
  const r = validateGsapScript(t.script);
  const actualFail = !r.valid;
  const match = actualFail === t.expectFail ? "✓" : "✗";
  console.log(`${match} ${t.name} — ${r.valid ? "VALID" : "INVALID"} (expected ${t.expectFail ? "INVALID" : "VALID"})`);
  if (r.errors.length > 0) console.log(`    errors: ${r.errors.join("; ")}`);
  if (r.warnings.length > 0) console.log(`    warnings: ${r.warnings.join("; ")}`);
}
