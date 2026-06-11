// SPA-aware section parser.
//
// This is an alternate pipeline that only runs when the legacy parser (in
// section-parser.ts) fails OR the SPA detector flags a page as likely SPA /
// hydration-shell / SSR-non-semantic. It does NOT modify the legacy parser.
//
// Strategy (from docs/SPA.md §5):
//   1. Strip noise — scripts, styles, comments, unlikely-candidate chrome.
//   2. Discover candidate blocks — broad tag + class/id keyword match.
//   3. Score by text density, class hints, heading adjacency.
//   4. Containment resolution — prefer inner, more specific blocks.
//   5. Tiny-merge adjacent weak blocks.
//   6. Role assignment — nav / hero / content / footer.
//   7. Cap to maxSections, preserving DOM order.
//
// Throws SPAEmptyShellError for hydration shells with no extractable content
// so the caller can route to a rendered re-fetch or the AI planner.

import type { ParsedSection } from "./section-parser.js";
import { parseSections } from "./section-parser.js";
import { detectSPA } from "./spa-detector.js";
import { NOOP_RUN, type PipelineRun } from "./logger.js";

export class SPAEmptyShellError extends Error {
  readonly reason: string;
  constructor(reason: string) {
    super(`SPA empty shell: ${reason}`);
    this.name = "SPAEmptyShellError";
    this.reason = reason;
  }
}

// ─── Helpers (self-contained; legacy parser unchanged) ───────────────────

function stripHtmlTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractBody(html: string): string {
  const m = html.match(/<body\b[^>]*>([\s\S]*)<\/body>/i);
  return m ? m[1] : html;
}

/** Readability's unlikely-candidate regex — matches boilerplate chrome.
 * Note: "footer" is intentionally NOT in this list. Readability drops
 * footers because it's extracting article bodies, but we're extracting
 * page sections and the footer is a legitimate chapter in a redesign. */
const UNLIKELY_RE = /-ad-|banner|breadcrumbs|combx|comment|cover-wrap|disqus|gdpr|legends|menu|related|remark|replies|rss|shoutbox|sidebar|skyscraper|social|sponsor|supplemental|ad-break|pagination|pager|popup|cookie|consent|toast|notification/i;

/** Positive keyword list for candidate class/id matching. */
const POSITIVE_RE = /section|chapter|block|module|panel|hero|feature|cta|highlight|intro|slice|storyblok|page-section|page_section|pagesection|home-|hnf-/i;

/** Framework CSS-module hashed pattern (Linear, many Next apps). */
const CSS_MODULE_RE = /[A-Z][a-zA-Z]*_(root|container|section|wrapper|home[a-zA-Z]*)__[a-zA-Z0-9_-]{4,}/;

/** Hero-ish class/id hint. */
const HERO_RE = /hero|jumbotron|splash|intro|masthead/i;

/** Footer-ish class/id hint. */
const FOOTER_RE = /footer|prefooter/i;

interface Candidate {
  tag: string;
  outerHtml: string;
  start: number; // byte offset in the body string
  end: number;
  classAttr: string;
  idAttr: string;
  textLen: number;
  linkDensity: number;
  headingHits: number;
  score: number;
  depth: number;
}

/**
 * Walk the body looking for any opening tag matching a whitelist of
 * candidate-section shapes. For each one, use depth-counting to find its
 * matching close tag, record the outer HTML and offsets, then advance past
 * the *open* tag (NOT past the close tag) so nested candidates are also
 * discovered. Containment is resolved in a later pass.
 */
function discoverCandidates(body: string): Candidate[] {
  const out: Candidate[] = [];
  const openRe = /<(section|article|main|footer|div)\b([^>]*)>/gi;
  let m: RegExpExecArray | null;
  while ((m = openRe.exec(body)) !== null) {
    const tag = m[1].toLowerCase();
    const attrs = m[2] || "";
    const classAttr = (attrs.match(/\bclass\s*=\s*["']([^"']*)["']/i)?.[1] || "").trim();
    const idAttr = (attrs.match(/\bid\s*=\s*["']([^"']*)["']/i)?.[1] || "").trim();
    const roleAttr = (attrs.match(/\brole\s*=\s*["']([^"']*)["']/i)?.[1] || "").trim();
    const ariaLabelledBy = /\baria-labelledby\s*=/.test(attrs);

    let eligible = false;
    if (tag === "section" || tag === "article" || tag === "main" || tag === "footer") {
      eligible = true;
    } else if (tag === "div") {
      if (["region", "main", "article", "group"].includes(roleAttr)) eligible = true;
      else if (ariaLabelledBy) eligible = true;
      else if (POSITIVE_RE.test(classAttr) || POSITIVE_RE.test(idAttr)) eligible = true;
      else if (CSS_MODULE_RE.test(classAttr)) eligible = true;
    }
    if (!eligible) continue;

    // Find matching close tag with depth counting.
    const startIdx = m.index;
    const openLen = m[0].length;
    let depth = 1;
    let pos = startIdx + openLen;
    const innerOpen = new RegExp(`<${tag}\\b[^>]*>`, "gi");
    const innerClose = new RegExp(`</${tag}\\s*>`, "gi");
    let end = -1;
    while (depth > 0 && pos < body.length) {
      innerOpen.lastIndex = pos;
      innerClose.lastIndex = pos;
      const nextOpen = innerOpen.exec(body);
      const nextClose = innerClose.exec(body);
      if (!nextClose) break;
      if (nextOpen && nextOpen.index < nextClose.index) {
        depth++;
        pos = nextOpen.index + nextOpen[0].length;
      } else {
        depth--;
        pos = nextClose.index + nextClose[0].length;
        if (depth === 0) { end = pos; break; }
      }
    }
    if (end < 0) continue;

    const outer = body.slice(startIdx, end);
    const text = stripHtmlTags(outer);
    const textLen = text.length;

    // Link density
    const linkTextMatches = outer.match(/<a\b[^>]*>([\s\S]*?)<\/a>/gi) || [];
    let linkText = 0;
    for (const a of linkTextMatches) linkText += stripHtmlTags(a).length;
    const linkDensity = textLen > 0 ? linkText / textLen : 0;

    // Heading hits (any h1..h4 inside)
    const headingHits = (outer.match(/<h[1-4]\b/gi) || []).length;

    out.push({
      tag,
      outerHtml: outer,
      start: startIdx,
      end,
      classAttr,
      idAttr,
      textLen,
      linkDensity,
      headingHits,
      score: 0,
      depth: 0,
    });
  }
  return out;
}

function scoreCandidate(c: Candidate): number {
  let score = 0;
  const isFooter = c.tag === "footer" || FOOTER_RE.test(`${c.classAttr} ${c.idAttr}`);
  // Class hints
  const classId = `${c.classAttr} ${c.idAttr}`;
  if (POSITIVE_RE.test(classId)) score += 2;
  if (UNLIKELY_RE.test(classId)) score -= 2;
  if (CSS_MODULE_RE.test(c.classAttr)) score += 1;
  // Size
  score += Math.min(5, c.textLen / 200);
  // Heading adjacency
  score += c.headingHits;
  // Link density penalty — nav strips, related-links blocks. Footers are
  // exempt: they legitimately contain link grids (legal, sitemap, social)
  // and would otherwise be filtered out before classification.
  if (c.linkDensity > 0.5 && !isFooter) score -= 3;
  // Footer floor: we always want the footer as a chapter, even if it's
  // short and link-heavy. +4 guarantees it clears the acceptance threshold.
  if (isFooter) score += 4;
  return score;
}

/** Resolve nested candidates: prefer inner, more specific blocks. */
function resolveContainment(cands: Candidate[]): Candidate[] {
  // Sort by start asc, end desc — parent before child so we can test
  // containment via simple byte-offset comparison.
  const byStart = [...cands].sort((a, b) => a.start - b.start || b.end - a.end);
  const dropped = new Set<number>();

  for (let i = 0; i < byStart.length; i++) {
    if (dropped.has(i)) continue;
    const a = byStart[i];
    // Find children of A
    const children: number[] = [];
    for (let j = i + 1; j < byStart.length; j++) {
      const b = byStart[j];
      if (b.start >= a.end) break;
      if (b.end <= a.end) children.push(j);
    }
    if (children.length === 0) continue;

    // Rule: if A contains a child B whose score >= A.score - 1, drop A.
    const strongestChildScore = Math.max(...children.map(j => byStart[j].score));
    if (strongestChildScore >= a.score - 1) {
      dropped.add(i);
      continue;
    }

    // Wrapper rule: if A has enough accepted children to cover most of its
    // own text, drop A. Two shapes:
    //   a) ≥ 2 children AND A's own extra text is tiny (< 200 chars)
    //   b) ≥ 3 children AND children cover ≥ 70% of A's text (IKEA's
    //      `<article>` wrapping six hashed-class `<section>`s whose class
    //      names don't match the positive keyword list)
    const accepted = children.filter(j => !dropped.has(j));
    if (accepted.length >= 2) {
      const childText = accepted.reduce((sum, j) => sum + byStart[j].textLen, 0);
      const extraText = a.textLen - childText;
      const coverage = a.textLen > 0 ? childText / a.textLen : 0;
      if (extraText < 200 || (accepted.length >= 3 && coverage >= 0.7)) {
        dropped.add(i);
      }
    }
  }

  return byStart.filter((_, i) => !dropped.has(i));
}

/**
 * Collapse duplicate blocks. A "duplicate" is defined semantically: two
 * blocks that describe the same logical section. We detect this in three
 * passes to handle the real-world shapes we've observed:
 *
 *   1. Same extracted heading text  → collapse (VW "Ride easier..." twins
 *      sit inside a tab carousel parent and a tab panel; both surface the
 *      same h3 but have different surrounding chrome, so body-prefix
 *      fingerprinting misses them).
 *   2. Same body-prefix fingerprint → collapse (responsive variants,
 *      layout wrappers that duplicate their child's content verbatim).
 *   3. Substring containment        → collapse (one block's normalized
 *      body text is wholly contained within another's — a tab wrapper
 *      around the winning slide's body).
 *
 * Within each duplicate group keep the highest-scoring candidate, ties
 * broken by larger textLen and earlier DOM position.
 *
 * Crucially this does NOT collapse Adidas's "Home Esg Letter" ×3 blocks:
 * those lack real headings (labels come from class-name fallback) and
 * their body text is genuinely different per pillar, so neither the
 * heading rule nor the body-prefix rule fires.
 */
function extractFirstHeading(outerHtml: string): string {
  const m = outerHtml.match(/<h[1-4]\b[^>]*>([\s\S]*?)<\/h[1-4]>/i);
  if (!m) return "";
  return stripHtmlTags(m[1]).toLowerCase().replace(/\s+/g, " ").trim();
}

function pickBest(bucket: Candidate[]): Candidate {
  return [...bucket].sort(
    (a, b) => (b.score - a.score) || (b.textLen - a.textLen) || (a.start - b.start),
  )[0];
}

function dedupeByTextFingerprint(cands: Candidate[]): Candidate[] {
  const FINGERPRINT_LEN = 100;

  // Pass 1: group by heading text (when present and non-trivial).
  const byHeading = new Map<string, Candidate[]>();
  const noHeading: Candidate[] = [];
  for (const c of cands) {
    const h = extractFirstHeading(c.outerHtml);
    if (h.length >= 8) {
      const bucket = byHeading.get(h);
      if (bucket) bucket.push(c);
      else byHeading.set(h, [c]);
    } else {
      noHeading.push(c);
    }
  }
  let afterHeading: Candidate[] = [];
  for (const bucket of byHeading.values()) {
    afterHeading.push(bucket.length === 1 ? bucket[0] : pickBest(bucket));
  }
  afterHeading = afterHeading.concat(noHeading);

  // Pass 2: group by body-prefix fingerprint.
  const byPrefix = new Map<string, Candidate[]>();
  for (const c of afterHeading) {
    const text = stripHtmlTags(c.outerHtml).toLowerCase().replace(/\s+/g, " ").trim();
    const fp = text.slice(0, FINGERPRINT_LEN);
    const bucket = byPrefix.get(fp);
    if (bucket) bucket.push(c);
    else byPrefix.set(fp, [c]);
  }
  const afterPrefix: Candidate[] = [];
  for (const bucket of byPrefix.values()) {
    afterPrefix.push(bucket.length === 1 ? bucket[0] : pickBest(bucket));
  }

  // Pass 3: substring containment. Drop the shorter block when its
  // normalized body is fully contained in a longer one. This ONLY runs
  // in the "shorter ⊂ longer" direction — we never drop the longer block,
  // because doing so collapses legitimate wrapper-of-many-sections shapes
  // like IKEA's single <main> containing all its inner sections. Parent-
  // child wrapper deletion is handled earlier by resolveContainment,
  // which uses DOM offsets rather than text matching.
  const texts = afterPrefix.map((c) =>
    stripHtmlTags(c.outerHtml).toLowerCase().replace(/\s+/g, " ").trim(),
  );
  const dropped = new Set<number>();
  for (let i = 0; i < afterPrefix.length; i++) {
    if (dropped.has(i)) continue;
    for (let j = 0; j < afterPrefix.length; j++) {
      if (i === j || dropped.has(i) || dropped.has(j)) continue;
      if (texts[i].length >= texts[j].length) continue; // only test shorter(i) ⊂ longer(j)
      if (texts[i].length < 60) continue; // avoid dropping tiny stubs on accidental matches
      if (texts[j].includes(texts[i])) dropped.add(i);
    }
  }
  const final = afterPrefix.filter((_, i) => !dropped.has(i));

  // Preserve DOM order after deduping.
  return final.sort((a, b) => a.start - b.start);
}

function classifyRole(c: Candidate, index: number, total: number, ancestorChain: string): ParsedSection["role"] {
  const classId = `${c.classAttr} ${c.idAttr}`;
  if (c.tag === "footer" || FOOTER_RE.test(classId)) return "footer";
  if (/\bnav\b/i.test(ancestorChain) || /<header\b[^>]*role\s*=\s*["']banner["']/i.test(ancestorChain)) return "nav";
  if (index === 0 && (c.headingHits > 0 || HERO_RE.test(classId))) return "hero";
  if (HERO_RE.test(classId) && index <= 1) return "hero";
  if (index === total - 1 && /\bfooter\b/i.test(ancestorChain)) return "footer";
  return "content";
}

function extractLabel(c: Candidate, fallbackIndex: number): string {
  // Prefer the first heading inside the candidate.
  const headingMatch = c.outerHtml.match(/<h[1-4]\b[^>]*>([\s\S]*?)<\/h[1-4]>/i);
  if (headingMatch) {
    const text = stripHtmlTags(headingMatch[1]).trim();
    if (text.length >= 2) return text.slice(0, 60);
  }
  // Try aria-label / data-title attrs
  const aria = c.outerHtml.match(/\baria-label\s*=\s*["']([^"']+)["']/i);
  if (aria) return aria[1].slice(0, 60);
  // Fall back to class keyword
  const classKey = c.classAttr.split(/\s+/).find(cls => POSITIVE_RE.test(cls));
  if (classKey) {
    const cleaned = classKey.replace(/[-_]/g, " ").replace(/\b\w/g, (s) => s.toUpperCase());
    return cleaned.slice(0, 60);
  }
  return `Section ${fallbackIndex}`;
}

function mergeTinyAdjacent(sections: ParsedSection[]): ParsedSection[] {
  if (sections.length <= 1) return sections;
  const isVisuallyDistinct = (s: ParsedSection): boolean => {
    const imgs = (s.rawHtml.match(/<img\b/gi) || []).length;
    const svgs = (s.rawHtml.match(/<svg\b/gi) || []).length;
    if (imgs + svgs >= 3) return true;
    if (/<h[1-3]\b/i.test(s.rawHtml)) return true;
    const hasButton = /<button\b|<a\b[^>]*class=["'][^"']*\b(btn|button|cta)\b/i.test(s.rawHtml);
    return hasButton && s.textContent.length < 240;
  };
  const out: ParsedSection[] = [];
  let i = 0;
  while (i < sections.length) {
    const cur = sections[i];
    const next = sections[i + 1];
    if (
      next &&
      cur.role === "content" && next.role === "content" &&
      (cur.textContent.length + next.textContent.length) < 250 &&
      !isVisuallyDistinct(cur) && !isVisuallyDistinct(next)
    ) {
      out.push({
        ...cur,
        label: cur.label,
        rawHtml: `${cur.rawHtml}\n${next.rawHtml}`.slice(0, 8000),
        textContent: `${cur.textContent} ${next.textContent}`.slice(0, 3000),
      });
      i += 2;
    } else {
      out.push(cur);
      i++;
    }
  }
  return out;
}

export function parseSectionsSPA(
  html: string,
  logger?: PipelineRun,
  opts?: { maxSections?: number },
): ParsedSection[] {
  const log = logger || NOOP_RUN;
  const MAX_SECTIONS = opts?.maxSections ?? 10;

  // Quick empty-shell guard: if body strip yields < 500 bytes, bail.
  const body = extractBody(html);
  const bodyText = stripHtmlTags(body);
  if (bodyText.length < 500) {
    throw new SPAEmptyShellError(`body text only ${bodyText.length} bytes — needs render`);
  }

  const candidates = discoverCandidates(body);
  log.debug(`SPA parser: discovered ${candidates.length} candidate blocks`);

  for (const c of candidates) c.score = scoreCandidate(c);

  // Minimum thresholds
  // Acceptance: keep anything with enough body text. The score floor is
  // intentionally low — hashed CSS-module classes (Linear, IKEA's `gd8xc1c`)
  // don't contribute any classScore, so a section with just heading + body
  // lands at ~1.5. We rely on resolveContainment + dedupe to remove true
  // noise rather than filtering too aggressively up front.
  const accepted = candidates.filter(c => {
    const isFooter = c.tag === "footer" || FOOTER_RE.test(`${c.classAttr} ${c.idAttr}`);
    // Image-heavy blocks (logo grids, case-study card grids) and CTA banners
    // carry distinct visual value that raw text length under-counts. Lower
    // the floor for those so people-made.com / agency-style sites don't
    // lose their logo walls + "View more" CTAs.
    const imgCount = (c.outerHtml.match(/<img\b/gi) || []).length;
    const svgCount = (c.outerHtml.match(/<svg\b/gi) || []).length;
    const isImageHeavy = imgCount + svgCount >= 3;
    const isCtaBanner =
      c.textLen < 240 &&
      /<button\b|<a\b[^>]*class=["'][^"']*\b(btn|button|cta)\b/i.test(c.outerHtml);
    const minText = isFooter ? 40 : (isImageHeavy || isCtaBanner) ? 40 : 120;
    return c.score >= 1 && c.textLen >= minText;
  });
  if (accepted.length === 0) {
    throw new SPAEmptyShellError(`no candidate blocks met threshold (discovered=${candidates.length})`);
  }

  const afterContainment = resolveContainment(accepted);
  const resolved = dedupeByTextFingerprint(afterContainment);
  log.debug(`SPA parser: ${accepted.length} accepted → ${afterContainment.length} after containment → ${resolved.length} after dedupe`);

  // Build ParsedSection array in DOM order.
  const sectionsInOrder = resolved.sort((a, b) => a.start - b.start);

  // Probe ancestor context for role classification. Cheap approximation:
  // look at the body substring before the candidate for <nav>, <header>,
  // <footer> opening tags that haven't been closed yet.
  const rawSections: ParsedSection[] = sectionsInOrder.map((c, i) => {
    const before = body.slice(0, c.start);
    const ancestorChain = before.slice(-2000); // last chunk is enough
    const role = classifyRole(c, i, sectionsInOrder.length, ancestorChain);
    return {
      index: i,
      tag: c.tag,
      label: extractLabel(c, i + 1),
      rawHtml: c.outerHtml.slice(0, 8000),
      textContent: stripHtmlTags(c.outerHtml).slice(0, 3000),
      role,
    };
  });

  const merged = mergeTinyAdjacent(rawSections);

  // Cap: keep nav + hero + footer + top content up to MAX_SECTIONS, preserving order.
  if (merged.length <= MAX_SECTIONS) {
    // Re-index
    return merged.map((s, i) => ({ ...s, index: i }));
  }
  const nav = merged.find(s => s.role === "nav");
  const hero = merged.find(s => s.role === "hero");
  const footer = merged.find(s => s.role === "footer");
  const reserved = new Set([nav, hero, footer].filter(Boolean) as ParsedSection[]);
  const content = merged.filter(s => s.role === "content" && !reserved.has(s));
  const contentBudget = MAX_SECTIONS - reserved.size;
  // Pick top-N by textContent length as a proxy for density; then restore DOM order.
  const pickedContent = [...content]
    .sort((a, b) => b.textContent.length - a.textContent.length)
    .slice(0, contentBudget);
  const final = merged
    .filter(s => reserved.has(s) || pickedContent.includes(s))
    .map((s, i) => ({ ...s, index: i }));

  log.debug(`SPA parser: capped ${merged.length} → ${final.length} sections (max=${MAX_SECTIONS})`);
  return final;
}

/**
 * Cascade entry point: runs the legacy parseSections first for static sites,
 * only falls through to parseSectionsSPA when the legacy path fails to
 * produce ≥ 4 sections OR the SPA detector flags the page with high
 * confidence (≥ 0.60). This keeps static-site behaviour byte-identical to
 * today and opts SPA-flavoured pages into the new pipeline.
 *
 * Throws SPAEmptyShellError when neither parser can extract meaningful
 * content — caller should route to the AI planner or a rendered re-fetch.
 */
export function parseSectionsWithFallback(
  html: string,
  logger?: PipelineRun,
  opts?: { maxSections?: number },
): ParsedSection[] {
  const log = logger || NOOP_RUN;
  const detection = detectSPA(html);
  log.debug(`SPA detect: confidence=${detection.confidence.toFixed(2)} [${detection.reason}] frameworks=${detection.frameworks.join(",") || "none"}`);

  // High-confidence SPA → try the SPA parser first, but if the document is a
  // hydration shell with no extractable body text we still fall back to
  // whatever the legacy parser managed. The caller's downstream AI planner
  // will take over if sections are too few/poor-quality; we never want the
  // pipeline to crash because of an empty shell.
  if (detection.confidence >= 0.60) {
    log.info(`SPA pipeline: direct (confidence=${detection.confidence.toFixed(2)})`);
    try {
      const spa = parseSectionsSPA(html, logger, opts);
      // Even on the SPA-first path, always race against the legacy parser
      // and keep whichever found more sections. SPA discovery + containment
      // can collapse real content into big wrappers on heavily-nested sites
      // (people-made.com: SPA=5, legacy=12 with all 4 case studies). Legacy
      // wins only when it finds noticeably more; otherwise SPA's stricter
      // filtering is preferred.
      const legacyRace = parseSections(html, logger, opts);
      // Prefer legacy whenever it finds strictly more sections. Legacy's
      // post-merge card-grid coalesce often lands a more faithful structure
      // than SPA's containment resolution on agency/portfolio marketing
      // sites (people-made.com etc.).
      if (legacyRace.length > spa.length) {
        log.info(`SPA pipeline: legacy race produced ${legacyRace.length} (vs SPA ${spa.length}) — using legacy`);
        return legacyRace;
      }
      return spa;
    } catch (e) {
      if (e instanceof SPAEmptyShellError) {
        log.warn(`SPA parser: ${e.message} — falling back to legacy parser`);
        return parseSections(html, logger, opts);
      }
      throw e;
    }
  }

  // Default path: legacy parser first — byte-for-byte unchanged for static
  // sites that already return rich structure. Threshold is tuned against
  // the SPA.md fixture set: Adidas=8, IKEA=9, Linear=12, strattoncraig=23
  // all clear ≥ 6 and take the legacy path. Sites like VW that return only
  // nav+hero+2 content blobs fall through to the SPA parser which finds
  // 12 real sections.
  const legacy = parseSections(html, logger, opts);
  if (legacy.length >= 6) return legacy;

  // Legacy under-delivered — try the SPA parser and keep whichever found
  // more sections. SPAEmptyShellError safely degrades to the legacy result.
  log.info(`SPA pipeline: fallback (legacy returned ${legacy.length}, detect=${detection.confidence.toFixed(2)})`);
  try {
    const spa = parseSectionsSPA(html, logger, opts);
    if (spa.length > legacy.length) {
      log.info(`SPA parser produced ${spa.length} sections (vs legacy ${legacy.length}) — using SPA result`);
      return spa;
    }
    return legacy;
  } catch (e) {
    if (e instanceof SPAEmptyShellError) {
      log.warn(`SPA parser: ${e.message} — returning legacy result (${legacy.length} sections)`);
      return legacy;
    }
    throw e;
  }
}
