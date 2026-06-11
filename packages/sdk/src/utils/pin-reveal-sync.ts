// Pin-reveal synchronization safety net.
//
// Problem Kimi keeps producing on cinematic redesigns:
//
//   ScrollTrigger.create({ trigger: ".hero-cine", pin: true,
//                          start: "top top", end: "+=100%" });
//   gsap.timeline({ scrollTrigger: { trigger: ".hero-cine",
//                                    start: "top 80%", once: true }})
//     .from(".hero-cine__title", {...})
//     ...
//
// Two separate ScrollTriggers on the same element → pin and reveal drift
// apart. The pin runs for its own `end`, the reveal fires at `top 80%`
// with `once: true` and completes in ~1.5s. Net effect: reveal finishes
// before the pin even starts, leaving the user trapped scrolling through
// a frozen end-state. And because Kimi often sets the pin `end` to
// `bottom top` or similar, the pin barely holds at all — user blows past
// the chapter instantly.
//
// Fix: merge pin + reveal into a SINGLE ScrollTrigger per pinned section.
// Canonical GSAP pattern:
//
//   gsap.timeline({
//     scrollTrigger: {
//       trigger: ".hero-cine",
//       start: "top top",
//       end: "+=100%",
//       pin: true,
//       scrub: 1,
//     }
//   }).from(".title", {...}).from(".subtitle", {...});
//
// One controller: scrub distributes the whole timeline evenly across the
// pin distance, so the pin only releases once every element in the
// reveal has played. That's the chapter-by-chapter cadence the Adidas
// 2024 report uses.
//
// Transform:
//   1. Collect { selector → id? } for every ScrollTrigger.create({pin:true})
//   2. For each gsap.timeline({scrollTrigger:{trigger:X}}) where X is pinned:
//      rewrite scrollTrigger to include pin:true + start/end/scrub
//   3. Delete the original ScrollTrigger.create(...) statements for those
//      selectors — the timeline now owns the pin.
//   4. If a pinned selector has no matching timeline, leave its creator
//      in place but still normalize start/end/scrub (fallback safety).

export interface PinRevealSyncResult {
  html: string;
  pinnedSelectors: string[];
  rewrittenTimelines: number;
  deletedPinCreators: number;
}

interface PinnedEntry {
  selector: string;
  id?: string;
  createRanges: Array<{ start: number; end: number }>;
}

const PIN_START = '"top top"';
const PIN_END = '"+=100%"';

function collectPinnedEntries(script: string): Map<string, PinnedEntry> {
  const out = new Map<string, PinnedEntry>();
  // Match `ScrollTrigger.create({...})` — note the full statement range so
  // we can delete it later (including trailing semicolon if present).
  const re = /ScrollTrigger\.create\s*\(\s*\{([^{}]{0,800})\}\s*\)\s*;?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(script)) !== null) {
    const body = m[1];
    if (!/\bpin\s*:\s*true\b/.test(body)) continue;
    const trig = body.match(/\btrigger\s*:\s*["']([^"']+)["']/);
    if (!trig) continue;
    const sel = trig[1];
    const idMatch = body.match(/\bid\s*:\s*["']([^"']+)["']/);
    const existing = out.get(sel);
    const range = { start: m.index, end: m.index + m[0].length };
    if (existing) {
      existing.createRanges.push(range);
    } else {
      out.set(sel, { selector: sel, id: idMatch?.[1], createRanges: [range] });
    }
  }
  return out;
}

function buildMergedScrollTrigger(selector: string, id?: string): string {
  const parts: string[] = [`trigger: ${JSON.stringify(selector)}`];
  if (id) parts.push(`id: ${JSON.stringify(id)}`);
  parts.push(`start: ${PIN_START}`);
  parts.push(`end: ${PIN_END}`);
  parts.push("pin: true");
  parts.push("scrub: 1");
  return parts.join(", ");
}

/** Process a single <script> body: merge pin + reveal, delete redundant
 * ScrollTrigger.create pin statements. Returns new body + counters. */
function processScript(body: string): {
  body: string;
  rewrittenTimelines: number;
  deletedPinCreators: number;
  pinnedSelectors: string[];
} {
  const pinned = collectPinnedEntries(body);
  if (pinned.size === 0) {
    return { body, rewrittenTimelines: 0, deletedPinCreators: 0, pinnedSelectors: [] };
  }

  let rewrittenTimelines = 0;
  const mergedSelectors = new Set<string>();

  // Step 1: rewrite matching gsap.timeline scrollTrigger blocks.
  let newBody = body.replace(
    /gsap\.timeline\s*\(\s*\{\s*scrollTrigger\s*:\s*\{([^{}]{0,500})\}\s*([^}]*)\}\s*\)/g,
    (match, stBody: string, trailingTimelineOpts: string) => {
      const trig = stBody.match(/\btrigger\s*:\s*["']([^"']+)["']/);
      if (!trig) return match;
      const entry = pinned.get(trig[1]);
      if (!entry) return match;
      rewrittenTimelines++;
      mergedSelectors.add(entry.selector);
      const trailing = trailingTimelineOpts.trim();
      const tail = trailing && !trailing.startsWith(",") ? `, ${trailing}` : trailing;
      return `gsap.timeline({ scrollTrigger: { ${buildMergedScrollTrigger(entry.selector, entry.id)} }${tail} })`;
    },
  );

  // Step 2: delete ScrollTrigger.create pin statements whose selector was
  // merged into a timeline. Must re-scan because offsets shifted after step 1.
  // Simpler: regex-delete any ScrollTrigger.create({...pin:true...trigger:X...})
  // where X is in mergedSelectors.
  let deletedPinCreators = 0;
  if (mergedSelectors.size > 0) {
    newBody = newBody.replace(
      /ScrollTrigger\.create\s*\(\s*\{([^{}]{0,800})\}\s*\)\s*;?/g,
      (match, stBody: string) => {
        if (!/\bpin\s*:\s*true\b/.test(stBody)) return match;
        const trig = stBody.match(/\btrigger\s*:\s*["']([^"']+)["']/);
        if (!trig || !mergedSelectors.has(trig[1])) return match;
        deletedPinCreators++;
        return "";
      },
    );
  }

  // Step 3: fallback — for pinned selectors with NO matching timeline,
  // normalize the creator's timing so the pin at least holds for a
  // meaningful distance. Don't touch ones we already deleted.
  newBody = newBody.replace(
    /ScrollTrigger\.create\s*\(\s*\{([^{}]{0,800})\}\s*\)/g,
    (match, stBody: string) => {
      if (!/\bpin\s*:\s*true\b/.test(stBody)) return match;
      const trig = stBody.match(/\btrigger\s*:\s*["']([^"']+)["']/);
      if (!trig) return match;
      const sel = trig[1];
      if (!pinned.has(sel) || mergedSelectors.has(sel)) return match;
      const entry = pinned.get(sel)!;
      return `ScrollTrigger.create({ ${buildMergedScrollTrigger(entry.selector, entry.id)} })`;
    },
  );

  return {
    body: newBody,
    rewrittenTimelines,
    deletedPinCreators,
    pinnedSelectors: [...pinned.keys()],
  };
}

/** Walk the scripts, merging pin + reveal timelines per canonical GSAP
 * pattern. One ScrollTrigger per section controls both pin and scrub. */
export function syncPinRevealAnimations(html: string): PinRevealSyncResult {
  const pinnedSelectorsGlobal = new Set<string>();
  let rewrittenTimelines = 0;
  let deletedPinCreators = 0;

  const fixedHtml = html.replace(
    /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi,
    (full, body: string) => {
      const result = processScript(body);
      if (result.pinnedSelectors.length === 0) return full;
      for (const s of result.pinnedSelectors) pinnedSelectorsGlobal.add(s);
      rewrittenTimelines += result.rewrittenTimelines;
      deletedPinCreators += result.deletedPinCreators;
      if (result.body === body) return full;
      return full.replace(body, result.body);
    },
  );

  return {
    html: fixedHtml,
    pinnedSelectors: [...pinnedSelectorsGlobal],
    rewrittenTimelines,
    deletedPinCreators,
  };
}
