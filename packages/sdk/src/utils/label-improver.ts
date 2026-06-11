// Label improver for ParsedSection arrays.
//
// The legacy parser sometimes produces weak labels: "Section 2", "Hero"
// (4 chars), "Quiz" (4 chars), "Close". These trip the poorQuality heuristic
// in section-generator.ts and send otherwise-valid parsed output to the AI
// planner, throwing away good structure and costing a slow LLM round-trip.
//
// Rather than touching the legacy parser, this module post-processes a
// ParsedSection[] and rewrites weak labels using signals available in the
// section's `rawHtml`:
//
//   1. First h1/h2/h3/h4 heading text
//   2. aria-label, aria-labelledby target, data-title attributes
//   3. Class-derived token name (`home-chapter-header-3` → "Home Chapter
//      Header 3"; common framework prefixes like `home-`, `hnf-`, `page-`
//      are stripped)
//   4. First sentence of textContent (10-60 chars)
//
// A label is considered weak when it matches the same conditions the
// downstream poorQuality check uses, plus "Navigation" / "Hero" / "Footer"
// bare-role labels that carry no page-specific info.

import type { ParsedSection } from "./section-parser.js";

const WEAK_LABEL_RE = /^(section\s+\d+|hero|navigation|footer|close|content|main|unknown)$/i;

// Patterns that indicate a candidate label is junk from a JSON blob, a11y
// skip link, a pagination indicator, or pure boilerplate chrome. These are
// rejected even if they pass the weakness regex — we prefer to fall through
// to the next improvement strategy rather than hand Kimi a garbage label.
const JUNK_LABEL_PATTERNS: RegExp[] = [
  /[{[]["'][\w-]+["']\s*:/,              // JSON: {"foo": or [{"bar":
  /["']\s*:\s*["']?(?:\d+|rgb\(|#[0-9a-f])/i, // JSON value patterns: "key": 42 / "rgb(
  /rgb\s*\(\s*\d+/i,                     // raw rgb(…) tokens
  /\b\d+\s*[,;]\s*\d+\s*[,;]/,           // number-sequence blobs like "0, 0, 0, 445"
  /^[\d\s/,.\-|—:%]+$/,                  // labels that are nothing but digits+separators: "1 / 8", "2024 / 2023"
  /^(jump|skip)\b/i,                     // accessibility skip-link chrome
  /\{&quot;|\{&#34;/,                    // HTML-entity-escaped JSON artifacts
];

// Minimal HTML entity decoder — we only care about the handful that commonly
// leak into labels via class attributes or innerHTML preservation. Full
// entity decoding would require a dependency; this covers the real cases.
const ENTITY_MAP: Record<string, string> = {
  "&nbsp;": " ",
  "&#160;": " ",
  "&amp;": "&",
  "&#38;": "&",
  "&quot;": '"',
  "&#34;": '"',
  "&apos;": "'",
  "&#39;": "'",
  "&lt;": "<",
  "&#60;": "<",
  "&gt;": ">",
  "&#62;": ">",
  "&ndash;": "–",
  "&mdash;": "—",
  "&hellip;": "…",
};

function decodeEntities(s: string): string {
  return s.replace(/&(?:nbsp|#160|amp|#38|quot|#34|apos|#39|lt|#60|gt|#62|ndash|mdash|hellip);/gi, (m) => ENTITY_MAP[m.toLowerCase()] ?? m);
}

function isJunkLabel(s: string): boolean {
  const trimmed = s.trim();
  if (trimmed.length === 0) return true;
  // Labels that are mostly non-letter characters are almost certainly not
  // human-readable titles — classic for JSON blob slices.
  const letterCount = (trimmed.match(/[A-Za-z]/g) || []).length;
  if (letterCount < 3) return true;
  if (letterCount / trimmed.length < 0.4) return true;
  return JUNK_LABEL_PATTERNS.some((re) => re.test(trimmed));
}

function sanitize(label: string | null): string | null {
  if (!label) return null;
  const decoded = decodeEntities(label).replace(/\s+/g, " ").trim();
  if (!decoded) return null;
  if (isJunkLabel(decoded)) return null;
  return decoded.slice(0, 60);
}

function stripHtml(s: string): string {
  return s.replace(/<script[\s\S]*?<\/script>/gi, "")
          .replace(/<style[\s\S]*?<\/style>/gi, "")
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .trim();
}

function extractHeadingFromHtml(html: string): string | null {
  for (const level of ["h2", "h3", "h1", "h4"]) {
    const re = new RegExp(`<${level}\\b[^>]*>([\\s\\S]*?)<\\/${level}>`, "i");
    const m = html.match(re);
    if (!m) continue;
    const text = stripHtml(m[1]);
    if (text.length < 3 || text.length > 120) continue;
    const clean = sanitize(text);
    if (clean) return clean;
  }
  return null;
}

function extractAriaLabel(html: string): string | null {
  const direct = html.match(/\baria-label\s*=\s*["']([^"']+)["']/i);
  if (direct) {
    const clean = sanitize(direct[1]);
    if (clean) return clean;
  }
  const data = html.match(/\bdata-(?:title|heading|section-title)\s*=\s*["']([^"']+)["']/i);
  if (data) {
    const clean = sanitize(data[1]);
    if (clean) return clean;
  }
  return null;
}

/**
 * Extract the first meaningful class keyword from the outermost element
 * and turn it into a humanized label.  Strips framework prefixes and
 * common layout/state suffixes.
 */
function extractClassLabel(html: string): string | null {
  const tagMatch = html.match(/^<([a-z][a-z0-9]*)\b([^>]*)>/i);
  if (!tagMatch) return null;
  const attrs = tagMatch[2] || "";
  const classMatch = attrs.match(/\bclass\s*=\s*["']([^"']+)["']/i);
  if (!classMatch) return null;
  const classes = classMatch[1].split(/\s+/).filter(Boolean);

  const PREFIXES_TO_STRIP = /^(home-|hnf-|page-|page_|pagesection-|styled|sc-|css-|cmp-|c-|is-|has-|js-|u-|t-|o-|g-)/i;
  const JUNK_SUFFIXES = /-(wrapper|container|root|inner|outer|module|block|box|aos|grain|loaded|active|open|show|hide|visible|hidden)$/i;
  const HASH_RE = /^[a-z0-9]{6,}$|^[a-z]+-[a-z0-9]{6,}$/i;

  for (const cls of classes) {
    if (HASH_RE.test(cls)) continue; // skip hashed CSS-module names
    const cleaned = cls.replace(PREFIXES_TO_STRIP, "").replace(JUNK_SUFFIXES, "");
    if (cleaned.length < 3) continue;
    if (/^\d+$/.test(cleaned)) continue;
    // Humanize: split on hyphens/underscores, title-case each word.
    const humanized = cleaned
      .split(/[-_]+/)
      .filter(Boolean)
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(" ");
    const clean = sanitize(humanized);
    if (clean && clean.length >= 4) return clean;
  }
  return null;
}

function extractFirstSentence(textContent: string): string | null {
  const trimmed = decodeEntities(textContent).trim();
  if (trimmed.length < 10) return null;
  // Hard guard: textContent from crawl4ai post-render HTML can include
  // stringified JSON blobs (e.g. Playwright's page-analysis metadata).
  // If the text starts with a JSON-looking character or contains an
  // obvious key:value sequence, bail out.
  if (/^[\s]*[{[]/.test(trimmed)) return null;
  const firstBreak = trimmed.search(/[.!?—]\s|\n/);
  const candidate = (firstBreak > 0 ? trimmed.slice(0, firstBreak) : trimmed).trim();
  return sanitize(candidate);
}

function isWeakLabel(label: string): boolean {
  const trimmed = decodeEntities(label).trim();
  if (trimmed.length < 5) return true;
  if (WEAK_LABEL_RE.test(trimmed)) return true;
  if (isJunkLabel(trimmed)) return true;
  return false;
}

/**
 * Post-process a ParsedSection array, rewriting weak labels using richer
 * signals from each section's rawHtml and textContent. Returns a new array
 * — does not mutate the input. The improved label is also kept in sync
 * when the role suggests a specific prefix (hero/footer/nav).
 */
export function improveSectionLabels(sections: ParsedSection[]): ParsedSection[] {
  return sections.map((s) => {
    // Always normalise entities in the existing label — fixes "A n n u a l
    // &amp;nbsp; R e p o r t" → "A n n u a l   R e p o r t" even for labels
    // that would otherwise pass the weakness check.
    const decodedExisting = decodeEntities(s.label).replace(/\s+/g, " ").trim();
    if (!isWeakLabel(decodedExisting)) {
      return decodedExisting === s.label ? s : { ...s, label: decodedExisting };
    }

    const heading = extractHeadingFromHtml(s.rawHtml);
    if (heading) return { ...s, label: heading };

    const aria = extractAriaLabel(s.rawHtml);
    if (aria) return { ...s, label: aria };

    const classLabel = extractClassLabel(s.rawHtml);
    if (classLabel) return { ...s, label: classLabel };

    const firstSentence = extractFirstSentence(s.textContent);
    if (firstSentence) return { ...s, label: firstSentence };

    // Last resort: generic indexed label that won't trip the downstream
    // poorQuality regex. The role hint gives Kimi enough context.
    const roleHint = s.role === "content" ? "Content Block" : s.role.charAt(0).toUpperCase() + s.role.slice(1);
    return { ...s, label: `${roleHint} ${s.index + 1}` };
  });
}
