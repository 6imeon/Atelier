/**
 * Section Parser & Assembler
 * Parses crawled HTML into sections and assembles generated sections into a complete page.
 */
import type { AnalyticsAdapter, SectionTemplate } from "../storage/interface.js";
import { NOOP_RUN, type PipelineRun } from "./logger.js";
import { validateGsapScriptBatch, computeAnimationQualityScore } from "./gsap-validator.js";
import { fixOrphanedHiddenStates } from "./orphaned-hidden-states.js";

export interface ParsedSection {
  index: number;
  tag: string;
  label: string;
  rawHtml: string;
  textContent: string;
  role: "nav" | "hero" | "content" | "footer";
  // Optional metadata captured from the original (untruncated) element HTML.
  // Used by the tiny-section merge to preserve image-heavy sections (logo
  // walls, case-study grids) whose media tags fall outside the rawHtml cap.
  fullHtmlMediaCount?: number;
  fullHtmlHadHeading?: boolean;
}

/**
 * Extract the inner content of a container element, stripping the outer tag.
 */
function unwrapContainer(html: string): string {
  // Remove the outermost opening and closing tags
  const openEnd = html.indexOf(">") + 1;
  const closeStart = html.lastIndexOf("</");
  if (openEnd > 0 && closeStart > openEnd) {
    return html.slice(openEnd, closeStart).trim();
  }
  return html;
}

/**
 * Recursively unwrap container elements to find actual content sections.
 * Digs through <main>, <div>, <article> wrappers up to maxDepth levels.
 */
function recursiveUnwrap(outerHtml: string, depth: number, maxDepth: number): Array<{ tag: string; html: string }> {
  const innerHtml = unwrapContainer(outerHtml);
  const children = findTopLevelElements(innerHtml);

  if (depth >= maxDepth) {
    return children;
  }

  // If we already have enough semantic sections (not just divs), stop unwrapping
  const semanticCount = children.filter(c => c.tag !== "div" && c.tag !== "article").length;
  if (children.length >= 4 && semanticCount >= 3) {
    return children;
  }

  // Check if children are mostly wrapper divs that need further unwrapping
  const expanded: Array<{ tag: string; html: string }> = [];
  for (const child of children) {
    const isChildWrapper = (child.tag === "main" || child.tag === "div" || child.tag === "article") &&
      child.html.length > innerHtml.length * 0.15; // lowered from 0.3 to catch more wrappers
    if (isChildWrapper) {
      const deeper = recursiveUnwrap(child.html, depth + 1, maxDepth);
      if (deeper.length >= 2) {
        expanded.push(...deeper);
      } else {
        expanded.push(child);
      }
    } else {
      expanded.push(child);
    }
  }
  return expanded;
}

/**
 * Find all top-level elements in an HTML string using depth-counting.
 * Only considers structural tags (nav, header, section, main, article, footer, div, aside).
 */
function findTopLevelElements(html: string): Array<{ tag: string; html: string }> {
  const sectionTags = ["nav", "header", "section", "main", "article", "footer", "div", "aside"];
  const tagPattern = sectionTags.join("|");
  const allTags = new RegExp(`<(/?)(${tagPattern})\\b[^>]*/?>`, "gi");

  const elements: Array<{ tag: string; html: string }> = [];
  let tagMatch: RegExpExecArray | null;
  let currentDepth = 0;
  let elementStart = -1;
  let elementTag = "";

  while ((tagMatch = allTags.exec(html)) !== null) {
    const isClosing = tagMatch[1] === "/";
    const isSelfClosing = tagMatch[0].endsWith("/>");

    if (isSelfClosing) continue;

    if (!isClosing) {
      if (currentDepth === 0) {
        elementStart = tagMatch.index;
        elementTag = tagMatch[2].toLowerCase();
      }
      currentDepth++;
    } else {
      currentDepth--;
      if (currentDepth === 0 && elementStart >= 0) {
        const elementHtml = html.slice(elementStart, tagMatch.index + tagMatch[0].length);
        if (elementHtml.length > 50) {
          elements.push({ tag: elementTag, html: elementHtml });
        }
        elementStart = -1;
      }
      if (currentDepth < 0) currentDepth = 0;
    }
  }

  return elements;
}

/**
 * Parse HTML into top-level sections for individual generation.
 * Unwraps container elements (main, div wrappers) to find actual content sections.
 */
export function parseSections(html: string, logger?: PipelineRun, opts?: { maxSections?: number }): ParsedSection[] {
  const MAX_SECTIONS = opts?.maxSections ?? 10;
  const log = logger || NOOP_RUN;
  // Extract body content
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  const bodyContent = bodyMatch ? bodyMatch[1] : html;

  // Find top-level elements
  let topElements = findTopLevelElements(bodyContent);
  log.debug(`Top-level: ${topElements.length} elements: ${topElements.map(e => `${e.tag}(${e.html.length})`).join(", ")}`);

  // Strip hidden top-level elements before the unwrap decision.
  // Sites like Tesla wrap huge preloaded/template content in hidden divs
  // (class="tds--is_hidden", class="hidden", style="display:none") that
  // inflate the element count and skew the >25%-of-body wrapper heuristic.
  // Removing them first lets needsUnwrap see only visible children.
  const beforeHiddenStrip = topElements.length;
  let hiddenBytesStripped = 0;
  topElements = topElements.filter(el => {
    const openTag = el.html.match(/^<[^>]*>/)?.[0] || "";
    const isHidden = /\bhidden\b|is_hidden\b|display\s*:\s*none/i.test(openTag);
    if (isHidden) hiddenBytesStripped += el.html.length;
    return !isHidden;
  });
  if (topElements.length < beforeHiddenStrip) {
    log.debug(`Stripped ${beforeHiddenStrip - topElements.length} hidden top-level elements (${hiddenBytesStripped} chars)`);
  }

  // Unwrap container elements that wrap all the real sections
  // (e.g., <main>, <div id="app">, <div class="wrapper">)
  // Always unwrap <main> tags (they're always wrappers).
  // For other elements, unwrap if few top-level elements or element is disproportionately large.
  // Subtract hidden element sizes from body length so hidden preloaded content
  // (e.g. Tesla's 843K hidden SVG div) doesn't inflate the wrapper threshold.
  const effectiveBodySize = bodyContent.length - hiddenBytesStripped;
  const needsUnwrap = topElements.length < 6 || topElements.some(e => e.tag === "main");
  if (needsUnwrap) {
    const expanded: Array<{ tag: string; html: string }> = [];
    for (const el of topElements) {
      // <main> is always a wrapper; large <div>/<article>/<header> may be wrappers too
      const isWrapper = el.tag === "main" ||
        ((el.tag === "div" || el.tag === "article" || el.tag === "header") &&
        el.html.length > effectiveBodySize * 0.25);

      if (isWrapper) {
        // Recursively unwrap up to 6 levels deep (complex sites nest deeply)
        const unwrapped = recursiveUnwrap(el.html, 0, 6);
        if (unwrapped.length >= 2) {
          expanded.push(...unwrapped);
        } else {
          expanded.push(el);
        }
      } else {
        expanded.push(el);
      }
    }
    topElements = expanded;
    log.debug(`After unwrap: ${topElements.length} elements: ${topElements.map(e => `${e.tag}(${e.html.length})`).join(", ")}`);
  }

  // Classify each element into sections
  const rawSections: ParsedSection[] = [];
  let heroFound = false;
  let navCount = 0;

  for (let i = 0; i < topElements.length; i++) {
    const el = topElements[i];
    const text = stripHtmlTags(el.html);

    // Skip very small elements or script/style-only blocks (but always keep nav/header/footer)
    if (text.length < 20 && !el.html.includes("<img") && !el.html.includes("<svg") &&
        el.tag !== "nav" && el.tag !== "header" && el.tag !== "footer") continue;

    // Skip structural/UI sections that aren't real page content
    const lowerText = text.toLowerCase();
    const lowerHtml = el.html.toLowerCase();
    const isStructural =
      // Topics filter (Adidas)
      lowerText.includes("topics filter") ||
      lowerHtml.includes("data-component=\"topics-filter\"") ||
      (lowerHtml.includes("class=\"topics-filter") && text.length < 200) ||
      // Language/region switchers
      /^switch to \w{2,3}$/i.test(lowerText.trim()) ||
      (lowerText.trim().length < 40 && /language.switch|region.select|locale/i.test(lowerHtml)) ||
      // Cookie consent / analytics / GDPR — raised cap from 500 to 2000
      // because detailed cookie banners with toggle descriptions (Nike)
      // easily exceed 500 chars while still being site chrome, not content.
      /cookie|gdpr|consent|analytics.cookies|cookie.?policy|cookie.?settings|accept.?all|privacy.?prefer/i.test(lowerText) &&
        text.length < 2000 ||
      // Search bars as standalone sections (not real content)
      /^search\b/i.test(lowerText.trim()) && text.length < 300 &&
        (lowerHtml.includes("<input") || lowerHtml.includes("search")) ||
      // Newsletter popups / modals
      (lowerHtml.includes("modal") || lowerHtml.includes("popup") || lowerHtml.includes("overlay")) &&
        text.length < 200;

    if (isStructural) {
      log.debug(`Skipping structural: "${text.slice(0, 60).trim()}"`);
      continue;
    }

    // Determine role
    let role: ParsedSection["role"] = "content";
    let label = "";

    if ((el.tag === "nav" || (el.tag === "header" && el.html.includes("<nav"))) && navCount === 0) {
      role = "nav";
      label = "Navigation";
      navCount++;
    } else if (el.tag === "footer" || (i >= topElements.length - 2 && el.html.includes("©"))) {
      role = "footer";
      // Differentiate sibling footer blocks (nav vs. legal) so both survive
      // the cap/selection passes. Labels diverge by content signal.
      const existingFooters = rawSections.filter(s => s.role === "footer").length;
      if (existingFooters === 0) {
        label = "Footer";
      } else if (/©|copyright|all rights reserved|privacy|terms|cookie/i.test(el.html)) {
        label = "Footer Legal";
      } else {
        label = `Footer ${existingFooters + 1}`;
      }
    } else if (!heroFound && (
      el.html.includes("<h1") ||
      el.html.match(/hero|banner|jumbotron|splash/i) ||
      (rawSections.length <= 1 && el.tag === "section")
    )) {
      role = "hero";
      label = "Hero";
      heroFound = true;
    } else {
      // Extract label from headings (h1-h4), class names, or aria-labels
      label = extractSectionLabel(el.html, rawSections.length + 1);
    }

    // Skip duplicate navs (some sites have mobile + desktop nav)
    if (role === "nav" && rawSections.some(s => s.role === "nav")) continue;

    // Capture media-count + heading flags from the FULL element html before
    // truncation — the rawHtml cap at 8000ch can hide the imgs in an image-
    // heavy section (logo grid with <picture> blocks near the end).
    const fullHtmlMediaCount =
      (el.html.match(/<img\b/gi) || []).length +
      (el.html.match(/<svg\b/gi) || []).length;
    const fullHtmlHadHeading = /<h[1-3]\b/i.test(el.html);

    rawSections.push({
      index: rawSections.length,
      tag: el.tag,
      label,
      rawHtml: el.html.slice(0, 8000),
      textContent: text.slice(0, 3000),
      role,
      fullHtmlMediaCount,
      fullHtmlHadHeading,
    });
  }

  // Coalesce card-grid siblings FIRST. Agency/portfolio sites surface many
  // empty-text sibling wrappers (18 logo <picture> blocks on people-made's
  // client grid, 4 case-study cards, etc.). Running coalesce before the
  // tiny-merge prevents those siblings from being folded into unrelated
  // neighbours before we get a chance to group them.
  let sections = coalesceCardGrids(rawSections);

  // Merge remaining tiny content sections (< 100 chars text, no heading,
  // not visually rich) into their nearest neighbor.
  sections = mergeTinySections(sections);

  // Drop near-duplicate content sections. The walker sometimes returns a
  // parent wrapper AND its child element when they're both at scan depth —
  // both report the same textContent. Keep the one with more HTML (more
  // surrounding context for the generator).
  sections = dedupeByTextFingerprint(sections);

  // Footer salvage: top-level walker only sees elements at body depth 0,
  // but sites like Adidas wrap their `<footer>` inside a layout div so it
  // never becomes a top-level candidate. If no footer was picked up by the
  // main walk, regex-scoop the last `<footer>` in the document and append it.
  if (!sections.some(s => s.role === "footer")) {
    const footerMatch = html.match(/<footer\b[^>]*>[\s\S]*?<\/footer>(?![\s\S]*<\/footer>)/i);
    if (footerMatch) {
      const footerText = stripHtmlTags(footerMatch[0]);
      if (footerText.length >= 20) {
        sections.push({
          index: sections.length,
          tag: "footer",
          label: "Footer",
          rawHtml: footerMatch[0].slice(0, 8000),
          textContent: footerText.slice(0, 3000),
          role: "footer",
        });
      }
    }
  }

  // If still too few sections, try the fallback approach
  if (sections.length < 3) {
    log.debug(`Only ${sections.length} elements after merging, trying <section> split`);
    return parseSectionsFallback(html);
  }

  // Cap sections to MAX_SECTIONS to keep generation time reasonable.
  // Default is 10; cinematic mode raises it to 15 to preserve the full
  // scroll journey on content-rich sites (annual reports, brand stories).
  if (sections.length > MAX_SECTIONS) {
    log.info(`Capping from ${sections.length} to ${MAX_SECTIONS} sections`);
    // Keep nav, hero, footer, and the largest content sections
    const nav = sections.find((s: ParsedSection) => s.role === "nav");
    const hero = sections.find((s: ParsedSection) => s.role === "hero");
    const footer = sections.find((s: ParsedSection) => s.role === "footer");
    const contentBudget = MAX_SECTIONS - [nav, hero, footer].filter(Boolean).length;
    const content = sections
      .filter((s: ParsedSection) => s.role === "content")
      .sort((a: ParsedSection, b: ParsedSection) => b.textContent.length - a.textContent.length)
      .slice(0, contentBudget);
    const capped = [nav, hero, ...content, footer].filter(Boolean) as ParsedSection[];
    capped.forEach((s: ParsedSection, i: number) => s.index = i);
    log.debug(`Capped to ${capped.length} sections: ${capped.map((s: ParsedSection) => `${s.role}:"${s.label}"`).join(", ")}`);
    return capped;
  }

  log.info(`${sections.length} sections parsed: ${sections.map((s: ParsedSection) => `${s.role}:"${s.label}"`).join(", ")}`);
  return sections;
}

/**
 * Fallback parser: find all <section> elements using depth-counting (handles nesting),
 * then fall back to h2 boundaries if that doesn't find enough.
 */
function parseSectionsFallback(html: string): ParsedSection[] {
  const sections: ParsedSection[] = [];

  // Find nav/header first
  const navMatch = html.match(/<(?:nav|header)\b[^>]*>[\s\S]*?<\/(?:nav|header)>/i);
  if (navMatch) {
    sections.push({
      index: 0, tag: "nav", label: "Navigation",
      rawHtml: navMatch[0].slice(0, 8000), textContent: stripHtmlTags(navMatch[0]).slice(0, 3000), role: "nav",
    });
  }

  // Find all <section> elements using depth-counting (handles nested sections correctly)
  const sectionElements = findAllByTag(html, "section");
  let heroFound = false;

  for (const secHtml of sectionElements) {
    const text = stripHtmlTags(secHtml);
    if (text.length < 20) continue;

    let role: ParsedSection["role"] = "content";
    let label = "";

    if (!heroFound && (secHtml.includes("<h1") || sections.length <= 1)) {
      role = "hero";
      label = "Hero";
      heroFound = true;
    } else {
      const headingMatch = secHtml.match(/<h[2-3][^>]*>([\s\S]*?)<\/h[2-3]>/i);
      label = headingMatch ? stripHtmlTags(headingMatch[1]).trim().slice(0, 60) : `Section ${sections.length + 1}`;
    }

    sections.push({
      index: sections.length, tag: "section", label,
      rawHtml: secHtml.slice(0, 8000), textContent: text.slice(0, 3000), role,
    });
  }

  // If still not enough, split by h2 headings
  if (sections.length < 3) {
    console.log(`[section-parser] <section> split found ${sections.length}, trying h2 split`);
    return parseSectionsByHeadings(html);
  }

  // Footer
  const footerMatch = html.match(/<footer\b[^>]*>[\s\S]*?<\/footer>/i);
  if (footerMatch) {
    sections.push({
      index: sections.length, tag: "footer", label: "Footer",
      rawHtml: footerMatch[0].slice(0, 8000), textContent: stripHtmlTags(footerMatch[0]).slice(0, 3000), role: "footer",
    });
  }

  console.log(`[section-parser] Fallback: parsed ${sections.length} sections: ${sections.map(s => `${s.role}:"${s.label}"`).join(", ")}`);
  return sections;
}

/**
 * Find all elements of a specific tag using depth-counting.
 * Returns only the outermost instances (not nested ones).
 */
function findAllByTag(html: string, tag: string): string[] {
  const results: string[] = [];
  const openRe = new RegExp(`<${tag}\\b[^>]*>`, "gi");
  const closeRe = new RegExp(`</${tag}\\s*>`, "gi");

  let match: RegExpExecArray | null;
  while ((match = openRe.exec(html)) !== null) {
    const startIdx = match.index;
    let depth = 1;
    let pos = startIdx + match[0].length;

    // Clone regexes for inner search
    const innerOpen = new RegExp(`<${tag}\\b[^>]*>`, "gi");
    const innerClose = new RegExp(`</${tag}\\s*>`, "gi");

    while (depth > 0 && pos < html.length) {
      innerOpen.lastIndex = pos;
      innerClose.lastIndex = pos;
      const nextOpen = innerOpen.exec(html);
      const nextClose = innerClose.exec(html);

      if (!nextClose) break;

      if (nextOpen && nextOpen.index < nextClose.index) {
        depth++;
        pos = nextOpen.index + nextOpen[0].length;
      } else {
        depth--;
        pos = nextClose.index + nextClose[0].length;
        if (depth === 0) {
          results.push(html.slice(startIdx, pos));
          // Skip past this element for the outer regex
          openRe.lastIndex = pos;
        }
      }
    }
  }
  return results;
}

/**
 * Last-resort parser: split content by h2 headings
 */
function parseSectionsByHeadings(html: string): ParsedSection[] {
  const sections: ParsedSection[] = [];

  // Nav
  const navMatch = html.match(/<(?:nav|header)\b[^>]*>[\s\S]*?<\/(?:nav|header)>/i);
  if (navMatch) {
    sections.push({
      index: 0, tag: "nav", label: "Navigation",
      rawHtml: navMatch[0].slice(0, 8000), textContent: stripHtmlTags(navMatch[0]).slice(0, 3000), role: "nav",
    });
  }

  // Split body by h2 boundaries
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  const body = bodyMatch ? bodyMatch[1] : html;

  const h2Re = /<h2\b[^>]*>([\s\S]*?)<\/h2>/gi;
  let match: RegExpExecArray | null;
  const headingPositions: Array<{ label: string; index: number }> = [];

  while ((match = h2Re.exec(body)) !== null) {
    headingPositions.push({
      label: stripHtmlTags(match[1]).trim().slice(0, 60),
      index: match.index,
    });
  }

  // Create sections between heading positions
  let heroFound = false;
  for (let i = 0; i < headingPositions.length; i++) {
    const start = headingPositions[i].index;
    const end = i + 1 < headingPositions.length ? headingPositions[i + 1].index : body.length;
    const chunk = body.slice(start, end);
    const text = stripHtmlTags(chunk);

    if (text.length < 30) continue;

    let role: ParsedSection["role"] = "content";
    if (!heroFound && (chunk.includes("<h1") || sections.length <= 1)) {
      role = "hero";
      heroFound = true;
    }

    sections.push({
      index: sections.length,
      tag: "section",
      label: headingPositions[i].label || `Section ${sections.length + 1}`,
      rawHtml: chunk.slice(0, 8000),
      textContent: text.slice(0, 3000),
      role,
    });
  }

  // Footer
  const footerMatch = html.match(/<footer\b[^>]*>[\s\S]*?<\/footer>/i);
  if (footerMatch) {
    sections.push({
      index: sections.length, tag: "footer", label: "Footer",
      rawHtml: footerMatch[0].slice(0, 8000), textContent: stripHtmlTags(footerMatch[0]).slice(0, 3000), role: "footer",
    });
  }

  console.log(`[section-parser] Heading split: parsed ${sections.length} sections: ${sections.map(s => `${s.role}:"${s.label}"`).join(", ")}`);
  return sections;
}

/**
 * Extract a meaningful label for a section from headings, class names, or aria attributes.
 */
function extractSectionLabel(html: string, fallbackIndex: number): string {
  // Try h1-h4 headings
  const headingMatch = html.match(/<h[1-4][^>]*>([\s\S]*?)<\/h[1-4]>/i);
  if (headingMatch) {
    const text = stripHtmlTags(headingMatch[1]).trim();
    if (text.length > 2 && text.length < 80) return text;
  }

  // Try aria-label on the section tag itself
  const ariaMatch = html.match(/aria-label="([^"]+)"/i);
  if (ariaMatch && ariaMatch[1].length > 2) return ariaMatch[1].slice(0, 60);

  // Try class name hints (e.g., "home-hero", "ceo-interview", "financial-highlights")
  const classMatch = html.match(/class="([^"]+)"/i);
  if (classMatch) {
    const cls = classMatch[1];
    // Extract meaningful class segments
    const meaningful = cls.split(/\s+/)
      .find(c => c.match(/hero|about|feature|service|testimonial|team|contact|cta|highlight|slider|chapter|interview|ceo|financial|governance|employee|quiz|dashboard|value/i));
    if (meaningful) {
      return meaningful
        .replace(/^home-/, "")
        .replace(/[-_]/g, " ")
        .replace(/\b\w/g, c => c.toUpperCase())
        .trim();
    }
  }

  // Try first strong/bold text
  const strongMatch = html.match(/<(?:strong|b)[^>]*>([\s\S]*?)<\/(?:strong|b)>/i);
  if (strongMatch) {
    const text = stripHtmlTags(strongMatch[1]).trim();
    if (text.length > 2 && text.length < 60) return text;
  }

  return `Section ${fallbackIndex}`;
}

/**
 * Merge tiny sections (< 100 chars of text) into their nearest larger neighbor.
 *
 * Sections are exempt from the merge when they carry distinct visual value
 * that text length doesn't capture:
 *   - 3+ `<img>` or `<svg>` tags (logo grids, case-study card grids)
 *   - A CSS grid/flex layout class (logo walls, card galleries)
 *   - A heading (h1-h3) — an explicit page chapter, even if terse
 *   - A single-line CTA banner (button + short headline)
 */
function mergeTinySections(sections: ParsedSection[]): ParsedSection[] {
  const MIN_TEXT_LENGTH = 100;
  const result: ParsedSection[] = [];

  const isVisuallyRich = (s: ParsedSection): boolean => {
    // Prefer the media count from the full (untruncated) element HTML; fall
    // back to scanning the capped rawHtml when the metadata isn't set.
    const mediaCount = s.fullHtmlMediaCount ?? (
      (s.rawHtml.match(/<img\b/gi) || []).length +
      (s.rawHtml.match(/<svg\b/gi) || []).length
    );
    // ≥3 media tags only counts if the section has some actual content text,
    // otherwise we're preserving empty tag-chip wrappers.
    if (mediaCount >= 3 && s.textContent.length >= 30) return true;
    // Specific grid-layout signals — plain `flex\s` / `grid\s` are too common
    // as utility classes to be a meaningful signal on their own.
    if (/\b(grid-cols-|logo[-_]?grid|card[-_]?grid|client[-_]?logos)\b/i.test(s.rawHtml)) return true;
    return false;
  };
  const hasHeading = (s: ParsedSection): boolean =>
    s.fullHtmlHadHeading ?? /<h[1-3]\b/i.test(s.rawHtml);
  const isCtaBanner = (s: ParsedSection): boolean => {
    if (s.textContent.length > 240) return false;
    const hasButton = /<button\b|<a\b[^>]*class=["'][^"']*\b(btn|button|cta)\b/i.test(s.rawHtml);
    const hasCtaCopy = /\b(get started|sign up|try (it|now)|subscribe|learn more|contact us|view (more|all)|read more|download|request|book a|join)\b/i.test(s.textContent);
    return hasButton && (hasCtaCopy || hasHeading(s));
  };

  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];

    // Always keep nav, hero, footer regardless of size.
    // For content sections, keep when: enough text, visually rich, has a
    // heading, or looks like a CTA banner.
    if (
      section.role !== "content" ||
      section.textContent.length >= MIN_TEXT_LENGTH ||
      isVisuallyRich(section) ||
      hasHeading(section) ||
      isCtaBanner(section)
    ) {
      result.push(section);
      continue;
    }

    // Tiny content section — merge into the nearest larger neighbor
    // Prefer merging into the next section (content flows forward)
    const nextIdx = sections.findIndex((s, j) => j > i && s.role === "content" && s.textContent.length >= MIN_TEXT_LENGTH);
    const prevIdx = result.length - 1;

    if (nextIdx >= 0) {
      // Merge into next section
      const next = sections[nextIdx];
      next.rawHtml = section.rawHtml + "\n" + next.rawHtml;
      next.textContent = (section.textContent + " " + next.textContent).slice(0, 3000);
      if (section.label !== `Section ${section.index + 1}` && next.label.startsWith("Section ")) {
        next.label = section.label; // Use the tiny section's label if it had a real name
      }
    } else if (prevIdx >= 0 && result[prevIdx].role === "content") {
      // Merge into previous section
      result[prevIdx].rawHtml = result[prevIdx].rawHtml + "\n" + section.rawHtml;
      result[prevIdx].textContent = (result[prevIdx].textContent + " " + section.textContent).slice(0, 3000);
    } else {
      // No neighbor to merge with — keep it
      result.push(section);
    }
  }

  // Re-index
  result.forEach((s, i) => s.index = i);
  return result;
}

/**
 * Detect and coalesce groups of content sections that look like cards in one
 * grid (Featured Work / Our Clients / Case Studies on agency sites).
 *
 * Signals a card-grid group:
 *   - 3+ content sections share the same first-2-token class signature on
 *     their root element (e.g. "flex grow" or "case-study card"). Same-class
 *     siblings in an actual card-grid layout will always share this.
 *
 * Result: all group members (plus any heading-bearing content section
 * sandwiched between them, even with a different class — often a wrapped
 * variant of the same card) are merged into one section at the first
 * group member's position. Label becomes the card names joined ("Currys /
 * Meta / InterContinental / Wendy's") or "Featured Work" if no real names.
 */
function coalesceCardGrids(sections: ParsedSection[]): ParsedSection[] {
  if (sections.length < 4) return sections;
  const MAX_RUN_HTML = 16000;

  const rootClassSig = (s: ParsedSection): string => {
    const m = s.rawHtml.match(/<[a-z]+\s+[^>]*class=["']([^"']{0,160})["']/i);
    if (!m) return "";
    return m[1].split(/\s+/).slice(0, 2).join(" ");
  };

  const sigGroups = new Map<string, number[]>();
  sections.forEach((s, i) => {
    if (s.role !== "content") return;
    const sig = rootClassSig(s);
    if (!sig) return;
    if (!sigGroups.has(sig)) sigGroups.set(sig, []);
    sigGroups.get(sig)!.push(i);
  });

  // Every qualifying group (≥3 members) becomes its own merged grid section.
  // Agency sites routinely have multiple independent card grids on one page
  // (case studies + client logo wall + office tiles etc.) — the original
  // "pick the biggest" heuristic under-merged.
  const qualifyingGroups = [...sigGroups.values()].filter(idxs => idxs.length >= 3);
  if (qualifyingGroups.length === 0) return sections;

  // Track which original indices belong to which merged group. First claim
  // wins when groups would overlap via middle-expansion.
  const assignment = new Map<number, number>(); // index → group id
  qualifyingGroups.forEach((grp, gid) => {
    for (const i of grp) {
      if (!assignment.has(i)) assignment.set(i, gid);
    }
    const firstGrid = grp[0];
    const lastGrid = grp[grp.length - 1];
    // Pick up any content section sandwiched between first and last grid
    // members that carries a heading (h1-h3). These are typically the same
    // kind of card wrapped differently (e.g. the hero card in a 2x2 grid).
    for (let i = firstGrid + 1; i < lastGrid; i++) {
      if (assignment.has(i)) continue;
      const s = sections[i];
      if (s.role !== "content") continue;
      // Check full-html heading flag first — the rawHtml cap at 8000ch can
      // hide the heading on image-heavy case-study cards.
      const hasHeading = s.fullHtmlHadHeading ?? /<h[1-3]\b/i.test(s.rawHtml);
      if (!hasHeading) continue;
      // Don't swallow massive full-bleed stories. Media-heavy cards have
      // low text density so allow them generously; text-heavy sections
      // (likely separate narrative chapters) get a tighter ceiling.
      const density = s.rawHtml.length > 0 ? s.textContent.length / s.rawHtml.length : 0;
      const cap = density < 0.05 ? 40000 : 25000;
      if (s.rawHtml.length > cap) continue;
      assignment.set(i, gid);
    }
  });

  // Build one merged section per group.
  const mergedByGroup = new Map<number, ParsedSection>();
  const membersByGroup = new Map<number, number[]>();
  for (const [idx, gid] of assignment) {
    if (!membersByGroup.has(gid)) membersByGroup.set(gid, []);
    membersByGroup.get(gid)!.push(idx);
  }
  for (const [gid, indices] of membersByGroup) {
    indices.sort((a, b) => a - b);
    const members = indices.map(i => sections[i]);
    const cardNames = members
      .map(r => stripHtmlTags(r.label || "").trim())
      .filter(l => l && !/^Section \d+$/.test(l))
      .slice(0, 4);
    let label: string;
    if (cardNames.length >= 2) {
      label = cardNames.join(" / ").slice(0, 120);
    } else {
      const combined = members.map(r => r.rawHtml).join("\n");
      const h2 = combined.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i);
      label = h2 ? stripHtmlTags(h2[1]).trim().slice(0, 60) : "Featured Work";
    }
    mergedByGroup.set(gid, {
      index: indices[0],
      tag: members[0].tag,
      label,
      rawHtml: members.map(r => r.rawHtml).join("\n").slice(0, MAX_RUN_HTML),
      textContent: members.map(r => r.textContent).join(" ").slice(0, 3000),
      role: "content",
    });
  }

  // Emit: non-grouped sections pass through; each group's merged section is
  // emitted once, at the position of its first original member.
  const result: ParsedSection[] = [];
  const emitted = new Set<number>();
  for (let i = 0; i < sections.length; i++) {
    if (assignment.has(i)) {
      const gid = assignment.get(i)!;
      if (!emitted.has(gid)) {
        result.push(mergedByGroup.get(gid)!);
        emitted.add(gid);
      }
      continue;
    }
    result.push(sections[i]);
  }
  result.forEach((s, idx) => s.index = idx);
  return result;
}

/**
 * Drop sections whose textContent fingerprint overlaps with another section.
 *
 * The top-level walker can surface both a wrapper element and one of its
 * children — both report the same or near-identical textContent. When two
 * sections share a long leading text run (60+ chars) we keep the one with
 * more HTML (richer context for generation) and drop the other.
 *
 * nav/hero/footer are never dropped.
 */
function dedupeByTextFingerprint(sections: ParsedSection[]): ParsedSection[] {
  if (sections.length < 2) return sections;
  const fingerprint = (s: ParsedSection): string =>
    s.textContent.toLowerCase().replace(/\s+/g, " ").trim().slice(0, 60);

  const toDrop = new Set<number>();
  for (let i = 0; i < sections.length; i++) {
    if (toDrop.has(i)) continue;
    if (sections[i].role !== "content") continue;
    const fp = fingerprint(sections[i]);
    if (fp.length < 20) continue;
    for (let j = i + 1; j < sections.length; j++) {
      if (toDrop.has(j)) continue;
      if (sections[j].role !== "content") continue;
      const fpJ = fingerprint(sections[j]);
      if (fpJ.length < 20) continue;
      // Identical leading text OR one is a prefix of the other.
      if (fp === fpJ || fp.startsWith(fpJ) || fpJ.startsWith(fp)) {
        const keepI = sections[i].rawHtml.length >= sections[j].rawHtml.length;
        toDrop.add(keepI ? j : i);
        if (!keepI) break;
      }
    }
  }

  if (toDrop.size === 0) return sections;
  const result = sections.filter((_, i) => !toDrop.has(i));
  result.forEach((s, idx) => s.index = idx);
  return result;
}

/**
 * Extract all inline <script> blocks from a section, returning the HTML without scripts
 * and the script contents separately. This prevents variable collisions and race conditions.
 */
function extractScripts(sectionHtml: string): { html: string; scripts: string[] } {
  const scripts: string[] = [];
  const html = sectionHtml.replace(/<script>([\s\S]*?)<\/script>/gi, (_match, content) => {
    const trimmed = content.trim();
    if (trimmed) scripts.push(trimmed);
    return "";
  });
  return { html, scripts };
}

/**
 * Validate and fix a generated section's HTML.
 * - Detects truncated output (premature </body></html>)
 * - Removes stray closing tags that don't belong in a section
 * - Makes hero content visible by default (remove translate-y-full)
 */
function validateSection(sectionHtml: string, index: number): string {
  const origLen = sectionHtml.length;
  let html = sectionHtml;

  // Remove premature document-closing tags (from truncated LLM output)
  html = html.replace(/<\/main>\s*<\/body>\s*<\/html>/gi, "");
  html = html.replace(/<\/body>\s*<\/html>/gi, "");

  // Fix truncated tags: if a tag attribute value is cut off, close it
  // e.g., text-[#cf001\n → text-[#cf0011]">
  html = html.replace(/(\w+-\[#[0-9a-f]{3,5})\s*\n/gi, (_m, partial) => {
    // Pad hex to 6 chars and close the attribute
    const hex = partial.match(/#([0-9a-f]+)/i)?.[1] || "000000";
    const padded = hex.length < 6 ? hex + hex.slice(-1).repeat(6 - hex.length) : hex;
    return `${partial.slice(0, partial.indexOf("#"))}#${padded}]">\n`;
  });

  // Remove translate-y-full from hero sections — content should be visible by default
  // GSAP can animate from y:100% if needed, but the CSS fallback should show content
  if (index <= 2) {
    const hadTranslate = /\btranslate-y-full\b/.test(html);
    html = html.replace(/\btranslate-y-full\b/g, "");
    if (hadTranslate) console.log(`[section-parser] Section ${index + 1}: removed translate-y-full`);
  }

  const delta = html.length - origLen;
  if (delta !== 0) console.log(`[section-parser] Section ${index + 1}: mutated ${delta > 0 ? "+" : ""}${delta} chars`);

  return html;
}

/**
 * Strip HTML tags to get plain text content
 */
function stripHtmlTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Assemble generated sections into a complete HTML document.
 */
/**
 * Detect section type from HTML content for template metadata.
 */
function detectSectionType(html: string): string {
  const lower = html.toLowerCase();
  if (/<nav\b/i.test(html) || /class="[^"]*navbar/i.test(html)) return "nav";
  if (/<footer\b/i.test(html)) return "footer";
  if (/h-screen|min-h-screen|hero/i.test(html) && /<h1/i.test(html)) return "hero";
  if (/pricing|plan|tier|\/month|\/year/i.test(lower)) return "pricing";
  if (/testimonial|review|quot|said|star/i.test(lower)) return "testimonials";
  if (/feature|benefit|advantage/i.test(lower)) return "features";
  if (/stat|metric|counter|\d+[%+kKmM]/i.test(lower)) return "stats";
  if (/team|member|employee|founder|ceo/i.test(lower)) return "team";
  if (/faq|accordion|question|answer/i.test(lower)) return "faq";
  if (/cta|call.to.action|get.started|sign.up|subscribe/i.test(lower)) return "cta";
  if (/contact|form|email|phone|address/i.test(lower)) return "contact";
  if (/gallery|portfolio|showcase|grid.*img/i.test(lower)) return "gallery";
  return "content";
}

/**
 * Save generated sections as templates to analytics (non-blocking).
 */
export function saveSectionTemplates(sections: string[], analytics: AnalyticsAdapter, industry?: string, logger?: PipelineRun): void {
  const log = logger || NOOP_RUN;
  for (const html of sections) {
    if (html.length < 100) continue; // skip trivially small sections
    const type = detectSectionType(html);
    const template: SectionTemplate = {
      type,
      industry,
      html: html.length > 8000 ? html.slice(0, 8000) : html, // cap storage size
      htmlLength: html.length,
      features: {
        hasAnimation: /gsap|scrolltrigger|animate/i.test(html),
        hasCta: /btn|button|cta|get.started|sign.up/i.test(html),
        hasImage: /<img\b/i.test(html),
        columnCount: (html.match(/grid-cols-(\d)/i)?.[1] ? parseInt(html.match(/grid-cols-(\d)/i)![1]) : undefined),
        tailwindClasses: (html.match(/class="([^"]+)"/)?.[1]?.split(/\s+/).filter(c => /^(bg-|text-|flex|grid|gap|py-|px-|rounded)/.test(c)).slice(0, 10)),
      },
      qualityScore: 3, // default, bumped by feedback later
      positiveRatings: 0,
      negativeRatings: 0,
      compositeScore: 3,
      elo: { rating: 1500, matches: 0, wins: 0, sigma: 350 },
      timesReused: 0,
    };
    analytics.saveSectionTemplate(template).catch(err =>
      log.warn(`Template save failed for ${type}: ${err instanceof Error ? err.message : err}`)
    );
  }
  log.debug(`Saved ${sections.filter(s => s.length >= 100).length} section templates to analytics`);
}

// Dedupe repeated phrases in scraped page titles (e.g.
// "adidas Annual Report 2024 - adidas Annual Report 2024 - adidas Annual Report 2024"),
// then ensure the brand name appears exactly once at the end.
function cleanPageTitle(title: string, brandName: string): string {
  const parts = title.split(/\s*-\s*|\s*\|\s*|\s*—\s*/).map(p => p.trim()).filter(Boolean);
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const p of parts) {
    const k = p.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    unique.push(p);
  }
  const base = unique.join(" - ") || brandName;
  return base.toLowerCase().includes(brandName.toLowerCase()) ? base : `${base} - ${brandName}`;
}

export function assembleSections(
  generatedSections: string[],
  opts: {
    title: string;
    brandName: string;
    googleFontsUrl?: string;
    primaryColor?: string;
    secondaryColor?: string;
    analytics?: AnalyticsAdapter | null;
    industry?: string;
    logger?: PipelineRun;
  },
): string {
  const log = opts.logger || NOOP_RUN;
  log.debug(`assembleSections: ${generatedSections.length} sections, sizes: ${generatedSections.map((s, i) => `${i + 1}:${s.length}ch`).join(", ")}`);

  // Log per-section details
  generatedSections.forEach((s, i) => {
    const hasScript = /<script>/i.test(s);
    const hasOpacity0 = /opacity-0/.test(s);
    const sectionTag = s.match(/<(section|nav|header|footer)\b/i)?.[1] || "unknown";
    log.debug(`Section ${i + 1}: <${sectionTag}> ${s.length}ch${hasScript ? " +script" : ""}${hasOpacity0 ? " opacity-0" : ""}`);
  });

  const fontsLink = opts.googleFontsUrl
    ? `<link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="${opts.googleFontsUrl}" rel="stylesheet">`
    : "";

  const primary = opts.primaryColor || "#6aabcf";
  const secondary = opts.secondaryColor || "#333333";

  // ─── Extract + validate scripts once upfront (Track 4) ─────────────────
  // Parse each extracted <script> via acorn, strip syntactically broken ones,
  // rewrite legacy patterns, and reuse the cleaned list for the page-level
  // init block. Also collects cross-section duplicate ScrollTrigger IDs.
  const sectionHtmlCleaned: string[] = [];
  const validatedScripts: string[] = [];
  const strippedCount = { broken: 0, total: 0 };

  for (let i = 0; i < generatedSections.length; i++) {
    const validated = validateSection(generatedSections[i], i);
    const extracted = extractScripts(validated);
    const { scripts } = extracted;
    let { html } = extracted;
    if (scripts.length > 0) log.debug(`Section ${i + 1}: extracted ${scripts.length} script(s)`);
    if (html.length < 50) log.warn(`Section ${i + 1}: cleaned HTML is only ${html.length} chars`);

    // Replace `justify-center` with `justify-start` in cinematic h-screen
    // containers. The cinematic prompt's `h-screen flex flex-col justify-center`
    // pattern centers content vertically — when content is taller than viewport,
    // the top elements (titles, eyebrows) get pushed above the visible area and
    // clipped by the section's overflow:hidden. `justify-start` keeps content
    // top-aligned so the title is always visible at the top of the pin.
    html = html.replace(/(h-screen\s+flex\s+flex-col\s+)justify-center/g, "$1justify-start py-12");

    sectionHtmlCleaned.push(html);

    for (const rawScript of scripts) {
      strippedCount.total++;
      // Apply legacy rewrites first (matches historical behavior)
      let rewritten = rawScript
        .replace(/toggleActions:\s*['"]play none none reverse['"]/g, 'once: true')
        .replace(/toggleActions:\s*['"]play none none none['"]/g, 'once: true')
        .replace(/gsap\.from\(([^,]+),\s*\{\s*scrollTrigger/g, 'gsap.from($1, { clearProps:"opacity,transform", scrollTrigger');

      // Decouple cinematic animations from scroll position. With pin+scrub,
      // content reveals are tied to where the user is in the pin range,
      // meaning users see partially-animated states mid-scroll (cards stuck
      // at opacity:0 etc.). Split each scrub timeline into TWO triggers:
      //   1. The animation plays ONCE on section entry (start: "top 80%")
      //   2. A separate pin-only ScrollTrigger holds the user at the section
      //      top for ~100vh of scroll, giving them time to see the reveal
      // By the time the pin engages, the animation has already completed.
      const pinSpawns: string[] = [];
      rewritten = rewritten.replace(
        /(gsap\.timeline\s*\(\s*\{[\s\S]*?scrollTrigger:\s*\{)([^}]*)(\}[\s\S]*?\}\s*\))/g,
        (match, prefix, opts, suffix) => {
          if (!/scrub:\s*(?:true|\d)/.test(opts) || !/pin:\s*true/.test(opts)) return match;
          const triggerMatch = opts.match(/trigger:\s*([^,}]+)/);
          const idMatch = opts.match(/id:\s*([^,}]+)/);
          if (!triggerMatch) return match;
          const trigger = triggerMatch[1].trim();
          const id = idMatch ? idMatch[1].trim() : `"cinematic-${pinSpawns.length}"`;

          // Spawn a separate pin-only ScrollTrigger, but only when the section's
          // natural content fits within ~1 viewport. Content-dense sections
          // (exec grids, financial tables) would clip inside a pin because the
          // user can't scroll within a pinned container — skip the pin for those
          // and let natural scroll reveal the content.
          pinSpawns.push(`(function(){var __el=document.querySelector(${trigger});if(__el&&__el.scrollHeight<=window.innerHeight*1.05){ScrollTrigger.create({trigger:${trigger},id:${id},pin:true,start:"top top",end:"+=100%"});}})();`);

          // Rewrite the timeline's scrollTrigger to fire once on entry, no pin, no scrub
          return `${prefix} trigger: ${trigger}, id: ${id}+"-anim", start: "top 80%", once: true ${suffix}`;
        },
      );
      if (pinSpawns.length > 0) {
        rewritten = rewritten + "\n" + pinSpawns.join("\n");
      }

      // Also strip positional offsets from any remaining scrub timelines
      // (e.g. parallax background animations) to prevent grid overlap
      if (/scrub:\s*(?:true|\d)/.test(rewritten)) {
        rewritten = rewritten.replace(
          /\.(from|fromTo)\s*\(([^,]+),\s*\{([^}]*)\}/g,
          (_match, method, target, props) => {
            const cleanedProps = props
              .replace(/\b(y|x|yPercent|xPercent|scale|scaleX|scaleY|rotation|rotationX|rotationY)\s*:\s*-?\d*\.?\d+\s*,?\s*/g, "")
              .replace(/,\s*}/, " }")
              .replace(/{\s*,/, "{ ");
            return `.${method}(${target}, {${cleanedProps}}`;
          },
        );
      }

      // Then validate via acorn AST — syntactically broken scripts get stripped
      const result = validateGsapScriptBatch([rewritten]).results[0];
      if (!result.valid) {
        strippedCount.broken++;
        log.warn(`Section ${i + 1}: stripping broken GSAP script — ${result.errors.join("; ")}`);
        continue;
      }
      if (result.warnings.length > 0) {
        log.debug(`Section ${i + 1}: script warnings — ${result.warnings.join("; ")}`);
      }
      validatedScripts.push(rewritten);
    }
  }

  // Cross-section validation: detect duplicate ScrollTrigger IDs
  const crossValidation = validateGsapScriptBatch(validatedScripts);
  if (crossValidation.duplicateIds.length > 0) {
    log.warn(`Duplicate ScrollTrigger IDs across sections: ${crossValidation.duplicateIds.join(", ")} — may cause animation collisions`);
  }

  const animationQualityScore = computeAnimationQualityScore(crossValidation);
  log.info(`Animation quality: ${animationQualityScore.toFixed(2)} (${crossValidation.totalScrollTriggers} triggers, ${crossValidation.totalGsapCalls} gsap calls, ${strippedCount.broken}/${strippedCount.total} scripts stripped)`);

  const assembled = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${cleanPageTitle(opts.title, opts.brandName)}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js"></script>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.css">
  <script src="https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.js"></script>
  ${fontsLink}
  <style>
    body { -webkit-font-smoothing: antialiased; }
    .brand-primary { color: ${primary}; }
    .bg-brand-primary { background-color: ${primary}; }
    .border-brand-primary { border-color: ${primary}; }
    .brand-secondary { color: ${secondary}; }
    .bg-brand-secondary { background-color: ${secondary}; }
  </style>
</head>
<body class="bg-white text-black antialiased">

${sectionHtmlCleaned.join("\n\n")}

<script>
window.addEventListener('load', function() {
  if (typeof gsap === 'undefined') return;
  if (typeof ScrollTrigger !== 'undefined') gsap.registerPlugin(ScrollTrigger);

  // Viewport-aware gsap.from: skip animation for elements already visible
  // Prevents the flash where elements go invisible then animate back
  var _origFrom = gsap.from.bind(gsap);
  gsap.from = function(target, vars) {
    if (vars && vars.scrollTrigger && !vars.scrollTrigger.scrub) {
      var els = gsap.utils.toArray(target);
      if (els.length > 0 && els.every(function(el) {
        var rect = el.getBoundingClientRect();
        return rect.top < window.innerHeight && rect.bottom > 0;
      })) {
        els.forEach(function(el) { el.style.opacity = ''; el.style.transform = ''; });
        return gsap.set(target, {});
      }
    }
    return _origFrom(target, vars);
  };

  // --- Per-section scripts (each in its own scope, AST-validated upstream) ---
${validatedScripts.map((script, i) =>
    "  // Section script " + i + "\n  (function(){ try {\n" + script + "\n  } catch(e) { console.warn('Section " + i + " script error:', e.message); } })();"
  ).join("\n\n")}

  // Initialize Swiper instances — but only ones not already initialized by
  // per-section scripts. Cinematic sections often create their own Swiper
  // with custom slidesPerView/effect, and double-initializing causes slide
  // overlap chaos. Swiper sets el.swiper on initialized containers.
  if (typeof Swiper !== 'undefined') {
    document.querySelectorAll('.swiper').forEach(function(el) {
      if (el.swiper) return; // already initialized by section script
      new Swiper(el, {
        slidesPerView: 1, spaceBetween: 24, loop: true,
        pagination: { el: el.querySelector('.swiper-pagination'), clickable: true },
        navigation: { nextEl: el.querySelector('.swiper-button-next'), prevEl: el.querySelector('.swiper-button-prev') },
        breakpoints: { 768: { slidesPerView: 2 }, 1024: { slidesPerView: 3 } }
      });
    });
  }

  // Recalculate trigger positions after everything is loaded
  setTimeout(function() { ScrollTrigger.refresh(); }, 100);
});
</script>
</body>
</html>`;

  // ─── Fix B: strip orphaned hidden-state CSS ──────────────────────────────
  // If any CSS class sets an initial hidden state (opacity:0, translateY,
  // scale(0), visibility:hidden, clip-path inset) but isn't referenced by any
  // surviving script, neutralize it so content is visible by default.
  const orphanFix = fixOrphanedHiddenStates(assembled);
  if (orphanFix.strippedRules > 0) {
    log.warn(`Orphaned hidden-state fallback: neutralized ${orphanFix.strippedRules} rule(s) for classes [${[...new Set(orphanFix.strippedClasses)].join(", ")}]`);
  }
  return orphanFix.html;
}
