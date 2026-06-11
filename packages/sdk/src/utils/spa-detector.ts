// SPA detection heuristics — returns a confidence score that a fetched HTML
// document is a Single-Page Application / hydration shell / SSR-non-semantic
// page whose structure the legacy parser will likely mishandle.
//
// Signals (additive, capped):
//  1. Semantic-tag drought (<section> + <article> + <h2> ≤ 2)
//  2. Text-to-script byte ratio inside <body>
//  3. Framework fingerprints (Next/Nuxt/React/Vue/Svelte/Astro)
//  4. High div-to-semantic-tag ratio (hydration shell signature)
//  5. <noscript> "requires JavaScript" nag
//
// Thresholds are tuned against the five fixtures documented in docs/SPA.md
// (Adidas 2024/2025, VW, IKEA, Airbnb, Linear).

export interface SPADetection {
  isSPA: boolean;
  confidence: number; // 0..1
  reason: string;
  bodyTextBytes: number;
  bodyScriptBytes: number;
  frameworks: string[];
}

const FRAMEWORK_PATTERNS: Array<{ name: string; re: RegExp }> = [
  { name: "next", re: /__NEXT_DATA__|id="__next"|\/_next\//i },
  { name: "nuxt", re: /window\.__NUXT__|id="__nuxt"|\/_nuxt\//i },
  { name: "react", re: /data-reactroot|id="react-application"|id="root"[\s\S]{0,200}react-dom/i },
  { name: "vue", re: /data-v-[a-f0-9]{6,}/i },
  { name: "svelte", re: /__SVELTEKIT_DATA__|data-sveltekit-/i },
  { name: "astro", re: /<astro-island|astro-slot/i },
];

function extractBody(html: string): string {
  const m = html.match(/<body\b[^>]*>([\s\S]*)<\/body>/i);
  return m ? m[1] : html;
}

function countTagsInBody(body: string, tag: string): number {
  const re = new RegExp(`<${tag}\\b[^>]*>`, "gi");
  return (body.match(re) || []).length;
}

/** Compute visible-text vs <script> bytes within <body>. */
function computeTextScriptRatio(body: string): { text: number; script: number } {
  let scriptBytes = 0;
  const scripts = body.match(/<script\b[^>]*>[\s\S]*?<\/script>/gi) || [];
  for (const s of scripts) scriptBytes += s.length;
  const stripped = body
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return { text: stripped.length, script: scriptBytes };
}

export function detectSPA(html: string): SPADetection {
  const body = extractBody(html);

  const sectionCount = countTagsInBody(body, "section");
  const articleCount = countTagsInBody(body, "article");
  const h2Count = countTagsInBody(body, "h2");
  const divCount = countTagsInBody(body, "div");

  const { text: bodyTextBytes, script: bodyScriptBytes } = computeTextScriptRatio(body);
  const ratio = bodyScriptBytes > 0 ? bodyTextBytes / bodyScriptBytes : 1;

  let confidence = 0;
  const reasons: string[] = [];

  // 1. Semantic-tag drought
  if (sectionCount + articleCount + h2Count <= 2) {
    confidence += 0.30;
    reasons.push(`drought(${sectionCount}+${articleCount}+${h2Count})`);
  }

  // 2. Text-to-script ratio (only when scripts are actually present)
  if (bodyScriptBytes > 0) {
    if (ratio <= 0.05) {
      confidence += 0.25;
      reasons.push(`ratio=${ratio.toFixed(3)}`);
    } else if (ratio <= 0.15) {
      confidence += 0.10;
      reasons.push(`ratio=${ratio.toFixed(3)}`);
    }
  }

  // 3. Framework fingerprints
  const frameworks: string[] = [];
  for (const { name, re } of FRAMEWORK_PATTERNS) {
    if (re.test(html)) frameworks.push(name);
  }
  if (frameworks.length > 0) {
    confidence += Math.min(0.35, 0.20 + (frameworks.length - 1) * 0.05);
    reasons.push(`fw=${frameworks.join("+")}`);
  }

  // 4. High div-to-semantic ratio (hydration shell indicator)
  const semanticTotal = sectionCount + articleCount + 1;
  if (divCount / semanticTotal >= 100) {
    confidence += 0.15;
    reasons.push(`div/sem=${Math.round(divCount / semanticTotal)}`);
  }

  // 5. Noscript nag
  if (/<noscript[^>]*>[\s\S]*?(?:without javascript|enable javascript|requires javascript)/i.test(html)) {
    confidence += 0.10;
    reasons.push("noscript");
  }

  confidence = Math.min(1, confidence);

  return {
    isSPA: confidence >= 0.5,
    confidence,
    reason: reasons.join(" "),
    bodyTextBytes,
    bodyScriptBytes,
    frameworks,
  };
}
