/**
 * Batch skeleton enhancer — pair each skeleton with N randomly-selected personas
 * and pipe results into MongoDB `generated_components` for manual review at #/review.
 *
 * Why random: 51 personas are available; hand-picking 3 always gives a homogeneous
 * stress-test. Random sampling per skeleton ensures visual variety across the
 * review pool (brutalist + coastal + cyberpunk beats corporate × 3).
 *
 * Usage:
 *   npx tsx scripts/batch-enhance-skeletons.ts                         # default 5 skeletons × 3 personas
 *   npx tsx scripts/batch-enhance-skeletons.ts --skeletons a,b,c       # specific skeletons
 *   npx tsx scripts/batch-enhance-skeletons.ts --per 3                 # personas per skeleton
 *   npx tsx scripts/batch-enhance-skeletons.ts --seed 42               # reproducible random
 *   npx tsx scripts/batch-enhance-skeletons.ts --dry                   # print matrix only, skip Kimi calls
 *
 * Requires OPENROUTER_API_KEY + MONGO_URI in .env.
 */

import { readFileSync, readdirSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { MongoClient } from "mongodb";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ─── Load .env (same pattern as generate-cinematic-components.ts) ─────────────
const envPath = resolve(__dirname, "../.env");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const k = trimmed.slice(0, eq).trim();
    if (!process.env[k]) process.env[k] = trimmed.slice(eq + 1).trim();
  }
}

if (!process.env.OPENROUTER_API_KEY) { console.error("Missing OPENROUTER_API_KEY"); process.exit(1); }
if (!process.env.MONGO_URI) { console.error("Missing MONGO_URI"); process.exit(1); }

// ─── CLI args ─────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const argVal = (k: string) => {
  const i = args.indexOf(`--${k}`);
  return i >= 0 ? args[i + 1] : null;
};
const hasFlag = (k: string) => args.includes(`--${k}`);

const PER = parseInt(argVal("per") || "3", 10);
const SEED = argVal("seed");
const DRY = hasFlag("dry");

const DEFAULT_SKELETONS = [
  "split-panel-hero",
  "scrub-counter-locked",
  "bento-grid-hover",
  "faq-motion-accordion",
  "magnetic-cta",
];
const SKELETONS = (argVal("skeletons")?.split(",").map(s => s.trim()).filter(Boolean)) || DEFAULT_SKELETONS;

// ─── Seeded random (mulberry32) for --seed reproducibility ────────────────────
function makeRng(seed?: string | null): () => number {
  if (!seed) return Math.random;
  let s = 0;
  for (let i = 0; i < seed.length; i++) s = (s * 31 + seed.charCodeAt(i)) >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = makeRng(SEED);

function pickN<T>(pool: T[], n: number): T[] {
  const copy = [...pool];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
}

// ─── Persona loader + slot extractor ──────────────────────────────────────────
interface PersonaSlot {
  id: string;
  name: string;
  description: string;  // Design Philosophy paragraph
  colorPalette: string; // Extracted **Color:** bullet + a hex or two
  imageStyle: string;   // Extracted **Images:** bullet
}

function loadPersonaSlots(): PersonaSlot[] {
  const dir = resolve(__dirname, "personas");
  if (!existsSync(dir)) { console.error(`Missing ${dir}`); process.exit(1); }
  const files = readdirSync(dir).filter(f => f.endsWith(".md"));
  return files.map(f => {
    const raw = readFileSync(resolve(dir, f), "utf-8");
    const id = f.replace(".md", "");
    const nameMatch = raw.match(/\*\*Name:\*\*\s*(.+)/);
    const philosophyMatch = raw.match(/## Design Philosophy\s+([\s\S]*?)(?=\n##|\n\*\*|$)/);
    const colorMatch = raw.match(/\*\*Color[s]?:\*\*\s*(.+?)(?=\n- \*\*|\n##|\n\n|$)/s);
    const imageMatch = raw.match(/\*\*Image[s]?:\*\*\s*(.+?)(?=\n- \*\*|\n##|\n\n|$)/s);
    const clean = (s: string | undefined) => (s || "").replace(/\s+/g, " ").trim().slice(0, 600);
    return {
      id,
      name: nameMatch?.[1]?.trim() || id,
      description: clean(philosophyMatch?.[1]),
      colorPalette: clean(colorMatch?.[1]),
      imageStyle: clean(imageMatch?.[1]),
    };
  });
}

// ─── Skeleton category map (what role in the page) ────────────────────────────
const CATEGORY_MAP: Record<string, string> = {
  "split-panel-hero": "hero",
  "hero-parallax-split": "hero",
  "pinned-key-message": "hero",
  "full-bleed-clip-wipe": "hero",
  "text-mask-video": "hero",
  "image-sequence-canvas": "hero",
  "counter-dashboard": "stats",
  "scrub-counter-locked": "stats",
  "animated-bar-chart": "stats",
  "bento-grid-hover": "features",
  "sticky-feature-list": "features",
  "spotlight-border-card": "features",
  "card-stack-to-grid": "features",
  "image-carousel": "gallery",
  "timeline-year-scrubber": "timeline",
  "horizontal-scroll-strip": "gallery",
  "scrollytelling-panels": "about",
  "text-marquee": "marquee",
  "sticky-sidebar-toc": "navigation",
  "panel-peel-reveal": "about",
  "comparison-slider": "showcase",
  "magnetic-cta": "cta",
  "pricing-sticky-column": "pricing",
  "faq-motion-accordion": "faq",
  "logo-wall-rotator": "logos",
  "quote-pull-serif": "testimonial",
};
const categoryFor = (name: string) => CATEGORY_MAP[name] || "content";

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  const skeletonsDir = resolve(__dirname, "skeletons");
  const personas = loadPersonaSlots();
  console.log(`\n── Batch Enhance Skeletons ──`);
  console.log(`  Skeletons: ${SKELETONS.length} (${SKELETONS.join(", ")})`);
  console.log(`  Personas pool: ${personas.length}`);
  console.log(`  Per skeleton: ${PER}`);
  console.log(`  Seed: ${SEED || "(none — pure random)"}`);
  console.log(`  Mode: ${DRY ? "DRY RUN — no Kimi calls" : "LIVE — will call Kimi K2.6"}`);

  // Verify each skeleton exists before we commit to anything
  const skeletonPaths: Record<string, string> = {};
  for (const name of SKELETONS) {
    const p = resolve(skeletonsDir, `${name}.html`);
    if (!existsSync(p)) { console.error(`  ERROR: skeleton not found — ${p}`); process.exit(1); }
    skeletonPaths[name] = p;
  }

  // Build the pairing matrix up front so we can print it before any work
  const matrix: Array<{ skeleton: string; persona: PersonaSlot }> = [];
  for (const skeleton of SKELETONS) {
    const picks = pickN(personas, PER);
    for (const persona of picks) matrix.push({ skeleton, persona });
  }

  console.log(`\n── Pairing matrix (${matrix.length} runs) ──`);
  for (const { skeleton, persona } of matrix) {
    console.log(`  ${skeleton.padEnd(28)} × ${persona.id}  (${persona.name})`);
  }

  if (DRY) {
    console.log(`\n[dry] exiting without Kimi calls.`);
    return;
  }

  // Lazy-import the SDK pieces only when we're actually going to call them
  const { getRouter } = await import("../packages/sdk/src/utils/router.js");
  const { enhanceFromSkeleton, scoreQualityStatic, qualityGate, normalizeHtml } = await import("../packages/sdk/src/utils/component-generator.js");

  const router = getRouter();
  const client = new MongoClient(process.env.MONGO_URI!);
  await client.connect();
  const db = client.db();

  let accepted = 0, normalized = 0, rejected = 0, errors = 0;
  const started = Date.now();

  for (let i = 0; i < matrix.length; i++) {
    const { skeleton, persona } = matrix[i];
    const tag = `[${i + 1}/${matrix.length}]`;
    console.log(`\n${tag} ${skeleton} × ${persona.id}`);

    try {
      let skeletonHtml = readFileSync(skeletonPaths[skeleton], "utf-8");
      const bodyMatch = skeletonHtml.match(/<body[^>]*>([\s\S]*)<\/body>/i);
      if (bodyMatch) skeletonHtml = bodyMatch[1].trim();

      const { html, tokensUsed } = await enhanceFromSkeleton(router, skeletonHtml, {
        category: categoryFor(skeleton),
        description: `Persona: ${persona.name} — ${persona.description}

QUALITY BAR — CINEMATIC:
Your target is report.adidas-group.com / pentagram.com / Apple product pages. Not "a nice website" — editorial, composed, premium. Every output should feel hand-crafted, not templated.

CINEMATIC PRINCIPLES:
- DRAMATIC TYPOGRAPHY: headlines at clamp(48px,8vw,140px) or larger. Aggressive weight contrast (900 vs 300). Tight tracking on display type (-0.02em to -0.04em). Deliberate leading (0.9-1.05 on headlines).
- HIERARCHY WITH TENSION: eyebrow → headline → body must feel like a three-act structure, not three evenly-sized lines. Huge scale jumps between tiers.
- OVERLAY GRADIENTS: image sections need scrim overlays (linear-gradient(to top, rgba(0,0,0,0.7), transparent 60%)) so text is readable AND dramatic. Never raw images with text on top.
- GENEROUS NEGATIVE SPACE: premium looks empty. Sections should breathe. py-24/32 not py-12. Headlines flanked by whitespace.
- COMPOSED COLOR: pick 1 dominant tone + 1 accent from the persona palette. Apply them with restraint — not every hex in a rainbow. One high-contrast moment per section.
- TEXTURE + DEPTH: subtle shadows, thin borders (1px rgba), gradient fills on buttons — not flat and plastic. But never skeuomorphic.

COPY RULES:
- Every [BRACKET_TOKEN] ([EYEBROW], [HEADLINE], [BODY], [TITLE_1], [LABEL_2], [YEAR_3], [QUESTION_1], [CTA], [PRICE_1], [FEATURE_2_3], [AUTHOR_NAME], etc.) MUST be replaced with editorial, specific copy — not generic placeholder phrasing. NO bracket tokens may remain.
- Write as if for a real brand at the persona's aesthetic peak. Pentagram-style headlines, New Yorker-caliber body copy, not "Lorem ipsum" adjacent.
- Headlines: 3-8 words, punchy, declarative, no marketing-speak ("Built to last" > "Quality you can count on").
- Eyebrows: 1-3 words, all-caps feel, label-grade ("CHAPTER 01", "THE ARCHIVE", "CASE NO. 3").
- Body: 1-2 sentences, each carrying weight. Nothing filler.

STRUCTURAL RULES (DO NOT BREAK):
- Preserve EVERY data-* attribute exactly (data-eyebrow, data-card, data-year, data-target, data-animate, data-cta, etc.)
- Preserve the unique root class prefix and all child class names
- Preserve the <script> animation code — GSAP timelines, ScrollTrigger configs, event listeners — verbatim
- Preserve <style> media queries for prefers-reduced-motion and responsive breakpoints
- Do not downgrade or simplify animation; add CSS transitions alongside if you want, never in place of GSAP`,
        colorPalette: persona.colorPalette || undefined,
        imageStyle: persona.imageStyle || undefined,
        cssOnly: false,
      });

      if (!html || html.length < 100) { console.log(`  ERROR empty response`); errors++; continue; }

      const report = scoreQualityStatic(html);
      const decision = qualityGate({ ...report, jsErrors: [] });
      let finalHtml = html;
      if (decision === "normalize") { finalHtml = normalizeHtml(html); normalized++; console.log(`  NORMALIZE ${report.overall}/10`); }
      else if (decision === "reject") { rejected++; console.log(`  REJECT ${report.overall}/10 — saved for manual review`); }
      else { accepted++; console.log(`  ACCEPT ${report.overall}/10 (${tokensUsed || "?"} tok)`); }

      const id = `enhanced-${skeleton}-${persona.id}-${Date.now().toString(36)}`;
      await db.collection("generated_components").updateOne(
        { id },
        { $set: {
          id,
          name: `${skeleton} · ${persona.name}`,
          category: categoryFor(skeleton),
          html: finalHtml,
          tokens: tokensUsed || 0,
          source: {
            domain: `skeleton-batch`,
            persona: persona.id,
            method: "css-only-enhance",
            skeletonFile: `scripts/skeletons/${skeleton}.html`,
            skeleton,
          },
          qualityReport: scoreQualityStatic(finalHtml),
          generatedAt: new Date(),
        }},
        { upsert: true },
      );
    } catch (err) {
      errors++;
      console.log(`  ERROR: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  await client.close();
  const elapsed = ((Date.now() - started) / 1000).toFixed(1);
  console.log(`\n── Done in ${elapsed}s ──`);
  console.log(`  accepted: ${accepted}`);
  console.log(`  normalized: ${normalized}`);
  console.log(`  rejected-but-saved: ${rejected}`);
  console.log(`  errors: ${errors}`);
  console.log(`\nReview at #/review — filter by \"skeleton-batch\" domain to see the new pending entries.`);
}

main().catch(err => { console.error(err); process.exit(1); });
