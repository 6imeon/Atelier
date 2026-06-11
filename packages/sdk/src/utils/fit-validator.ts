// Post-generation layout fit validator.
//
// Renders the assembled HTML in headless Chromium at desktop (1440×900) and
// mobile (390×844), forces all GSAP timelines to their end state and kills
// ScrollTriggers so pinned sections reveal fully, then walks the DOM
// measuring three specific overflow patterns Kimi's cinematic output keeps
// producing:
//
//   1. Text overflow — element has `scrollWidth > clientWidth`, usually a
//      large-display number or headline that doesn't fit its card. Fix by
//      shrinking the `text-[Nrem]` class and adding `whitespace-nowrap`.
//
//   2. h-screen container clip — element has `h-screen` (or clientHeight
//      exactly equal to viewport height) and `scrollHeight > clientHeight`.
//      The fixed-viewport container cuts off content below the fold. Fix by
//      swapping `h-screen` → `min-h-screen py-16`.
//
//   3. Absolute-child clip — a `position: absolute` child has scrollHeight
//      greater than its positioned parent's clientHeight. The parent needs
//      an explicit `min-h-[Npx]` sized to the child. Fix by injecting
//      `min-h-[{measured}px]` into the parent's class list.
//
// Auto-fixes are scoped to the exact element the validator flagged via an
// injected `data-fit-id` attribute. We inject IDs, render+measure, apply
// surgical class-swap edits keyed by ID, then strip the IDs before
// returning the HTML. Remaining unfixable issues are returned as warnings.

import type { PipelineRun } from "./logger.js";
import { NOOP_RUN } from "./logger.js";

export type FitIssueType = "text-overflow" | "h-screen-clip" | "absolute-child-clip" | "h-full-in-min-h";

export interface FitIssue {
  id: string;
  type: FitIssueType;
  viewport: "desktop" | "mobile";
  tag: string;
  classes: string;
  measurements: {
    scrollW?: number;
    clientW?: number;
    scrollH?: number;
    clientH?: number;
  };
  fixed: boolean;
  text?: string;
}

export interface FitReport {
  html: string;
  issues: FitIssue[];
  appliedFixes: number;
  remainingIssues: number;
}

interface RawIssue {
  id: string;
  type: FitIssueType;
  tag: string;
  classes: string;
  scrollW?: number;
  clientW?: number;
  scrollH?: number;
  clientH?: number;
  text?: string;
  targetId?: string; // for absolute-child-clip, the parent to fix
  neededH?: number;  // for absolute-child-clip, parent min-height to inject
}

/** Tag every opening element that carries a class attribute with a unique
 * data-fit-id so we can address it post-render. Elements without classes
 * can't be fixed via class-swap anyway so we skip them. */
function injectFitIds(html: string): string {
  let counter = 0;
  const TAGS = /<(div|section|nav|main|article|footer|header|span|h[1-6]|p|button|a|ul|ol|li|img|svg)\b([^>]*)>/g;
  return html.replace(TAGS, (match, tag: string, attrs: string) => {
    if (!/\bclass\s*=\s*["']/.test(attrs)) return match;
    if (/\bdata-fit-id\s*=/.test(attrs)) return match;
    const id = `f${counter++}`;
    return `<${tag}${attrs} data-fit-id="${id}">`;
  });
}

function stripFitIds(html: string): string {
  return html.replace(/\s*data-fit-id="f\d+"/g, "");
}

/** Shrink every `text-[Nrem]` / `text-[Npx]` class inside a class string
 * to roughly 60% of its current value, clamped to sensible minimums.
 * Returns { newClasses, changed }. */
function shrinkTextSizes(classes: string): { out: string; changed: boolean } {
  let changed = false;
  const out = classes.replace(/text-\[(\d+(?:\.\d+)?)(rem|px)\]/g, (_, n: string, unit: string) => {
    const val = parseFloat(n);
    if (unit === "rem" && val >= 3) {
      const shrunk = Math.max(1.75, +(val * 0.6).toFixed(2));
      changed = true;
      return `text-[${shrunk}rem]`;
    }
    if (unit === "px" && val >= 48) {
      const shrunk = Math.max(28, Math.round(val * 0.6));
      changed = true;
      return `text-[${shrunk}px]`;
    }
    return `text-[${val}${unit}]`;
  });
  // Also downgrade static tailwind sizes one notch when they're clearly display-sized.
  const STATIC_DOWN: Record<string, string> = {
    "text-9xl": "text-6xl",
    "text-8xl": "text-5xl",
    "text-7xl": "text-5xl",
    "text-6xl": "text-4xl",
    "text-5xl": "text-4xl",
  };
  let out2 = out;
  for (const [from, to] of Object.entries(STATIC_DOWN)) {
    if (new RegExp(`\\b${from}\\b`).test(out2)) {
      out2 = out2.replace(new RegExp(`\\b${from}\\b`, "g"), to);
      changed = true;
    }
  }
  return { out: out2, changed };
}

/** Add `whitespace-nowrap` to a class string if absent. Only safe for
 * short display-style text (KPI numbers, one-word labels) — never use on
 * container or paragraph text or you'll force horizontal scroll. */
function addNowrap(classes: string): { out: string; changed: boolean } {
  if (/\bwhitespace-(nowrap|normal|pre)/.test(classes)) return { out: classes, changed: false };
  return { out: `${classes} whitespace-nowrap`, changed: true };
}

function swapHScreen(classes: string): { out: string; changed: boolean } {
  if (!/\bh-screen\b/.test(classes)) return { out: classes, changed: false };
  // Just relax the hard clip — don't also inject py-*, which adds 128px
  // of extra vertical space and makes the section background extend far
  // below its content.
  return { out: classes.replace(/\bh-screen\b/g, "min-h-screen"), changed: true };
}

function injectMinHeight(classes: string, pixels: number): { out: string; changed: boolean } {
  // Round up to the nearest 20px for cleaner values.
  const rounded = Math.ceil(pixels / 20) * 20;
  // If the element already has a min-h-[...] in its classes, bump it if our
  // requirement is larger; otherwise leave it alone.
  const existing = classes.match(/\bmin-h-\[(\d+)px\]/);
  if (existing) {
    const cur = parseInt(existing[1], 10);
    if (rounded <= cur) return { out: classes, changed: false };
    return { out: classes.replace(/\bmin-h-\[\d+px\]/, `min-h-[${rounded}px]`), changed: true };
  }
  return { out: `${classes} min-h-[${rounded}px]`, changed: true };
}

/** Apply a single class-swap fix to the HTML, targeting the element with
 * the given data-fit-id. Returns the updated HTML and whether the fix
 * actually landed (the element may be nested inside another fix target). */
function applyClassFix(
  html: string,
  fitId: string,
  transform: (classes: string) => { out: string; changed: boolean },
): { html: string; changed: boolean } {
  const tagRe = new RegExp(`<(\\w+)([^>]*?data-fit-id="${fitId}"[^>]*?)>`, "g");
  let changed = false;
  const next = html.replace(tagRe, (match, tag: string, attrs: string) => {
    const classMatch = attrs.match(/\bclass\s*=\s*"([^"]*)"/);
    if (!classMatch) return match;
    const result = transform(classMatch[1]);
    if (!result.changed) return match;
    changed = true;
    const newAttrs = attrs.replace(/\bclass\s*=\s*"[^"]*"/, `class="${result.out}"`);
    return `<${tag}${newAttrs}>`;
  });
  return { html: next, changed };
}

/** DOM walker executed inside the page. Returns raw issues — structured
 * plain data so it survives Playwright serialization. */
const COLLECT_ISSUES_FN = `(() => {
  const issues = [];
  const INTENTIONAL = /\\b(overflow-scroll|overflow-auto|overflow-x-scroll|overflow-x-auto|snap-x|snap-mandatory)\\b/;
  // Classes on the parent that signal it already knows its own size — skip
  // for absolute-child-clip. We care about collapsed wrappers, not navs.
  const PARENT_SIZED = /\\b(h-|max-h-|min-h-|fixed|sticky|absolute)\\b/;
  const pinnedIds = new Set(window.__fitPinnedIds || []);
  const all = document.querySelectorAll("[data-fit-id]");

  // Check 1: text overflow — element scrollWidth exceeds clientWidth.
  all.forEach(el => {
    const cls = el.className || "";
    if (INTENTIONAL.test(cls)) return;
    if (el.clientWidth <= 20) return;  // ignore accessibility hidden skip-links etc.
    if (el.scrollWidth <= el.clientWidth + 2) return;
    // Only flag elements that directly contain visible text (avoid false
    // positives from grid rows whose inner cells legitimately overflow).
    const hasText = Array.from(el.childNodes).some(n =>
      n.nodeType === 3 && n.textContent && n.textContent.trim().length > 0
    );
    if (!hasText && el.children.length > 1) return;
    issues.push({
      id: el.dataset.fitId,
      type: "text-overflow",
      tag: el.tagName.toLowerCase(),
      classes: cls,
      scrollW: el.scrollWidth,
      clientW: el.clientWidth,
      text: (el.textContent || "").trim().slice(0, 60),
    });
  });

  // Check 2: h-screen / fixed-viewport containers with content clipped.
  // Skip pinned sections — their content is meant to exceed viewport
  // while the pin holds, and changing h-screen → min-h-screen would
  // destroy the pin setup.
  all.forEach(el => {
    const cls = el.className || "";
    if (!/\\bh-screen\\b/.test(cls)) return;
    if (pinnedIds.has(el.dataset.fitId)) return;
    if (el.scrollHeight <= el.clientHeight + 2) return;
    issues.push({
      id: el.dataset.fitId,
      type: "h-screen-clip",
      tag: el.tagName.toLowerCase(),
      classes: cls,
      scrollH: el.scrollHeight,
      clientH: el.clientHeight,
    });
  });

  // Helper: walk ancestors looking for nav/header/footer tags. Dropdowns
  // nested inside a <nav> are navigation chrome, not primary content,
  // and their measurements shouldn't inflate parent wrappers.
  const isInNavigationAncestor = (el) => {
    let cur = el.parentElement;
    while (cur && cur !== document.body) {
      const tag = cur.tagName.toLowerCase();
      if (tag === "nav" || tag === "header" || tag === "footer") return true;
      cur = cur.parentElement;
    }
    return false;
  };

  // Helper: is this element hidden by default (opacity 0, display none,
  // or visibility hidden)? These are dropdown menus, modals, tooltips —
  // not live content. Their scroll measurements should never drive parent
  // sizing.
  const isHiddenByDefault = (el) => {
    const cs = getComputedStyle(el);
    if (cs.display === "none") return true;
    if (cs.visibility === "hidden") return true;
    if (parseFloat(cs.opacity) === 0) return true;
    // Also check common Tailwind hidden utility class.
    if (/\b(hidden|invisible|opacity-0)\b/.test(el.className || "")) return true;
    return false;
  };

  // Check 3: absolute children exceeding their positioned parent's height.
  // Only fires for the specific "collapsed wrapper around a stack of
  // absolute cards" shape — the quiz-cine__cards case.
  all.forEach(el => {
    const cs = getComputedStyle(el);
    if (cs.position !== "absolute") return;
    if (isHiddenByDefault(el)) return;
    const parent = el.offsetParent;
    if (!parent || parent === document.body) return;
    if (!parent.dataset || !parent.dataset.fitId) return;
    const parentTag = parent.tagName.toLowerCase();
    if (parentTag === "nav" || parentTag === "header" || parentTag === "footer") return;
    if (parentTag === "section") return;   // sections have their own sizing via h/min-h
    if (isInNavigationAncestor(parent)) return;  // dropdowns inside <nav>
    const parentCls = parent.className || "";
    if (PARENT_SIZED.test(parentCls)) return;
    if (pinnedIds.has(parent.dataset.fitId)) return;
    const parentH = parent.clientHeight;
    if (parentH < 0) return;
    if (el.scrollHeight <= parentH + 2) return;
    // Only flag when the absolute child has real interactive/semantic
    // content — not parallax bg layers, grain overlays, gradient washes.
    const hasRealContent = el.querySelectorAll("button, input, textarea, select, a, h1, h2, h3, h4, h5, h6, p").length > 0;
    if (!hasRealContent) return;
    issues.push({
      id: el.dataset.fitId,
      targetId: parent.dataset.fitId,
      type: "absolute-child-clip",
      tag: parentTag,
      classes: parentCls,
      scrollH: el.scrollHeight,
      clientH: parentH,
      neededH: el.scrollHeight,
    });
  });

  // Check 4: \`h-full\` child inside a parent whose only height is \`min-h-[Npx]\`.
  // CSS \`height: 100%\` requires the parent to have explicit \`height\`, not
  // \`min-height\` — otherwise it resolves to 0 and the child collapses. This
  // is the quiz \`#quiz-cards h-full\` bug.
  //
  // Only flag when ALL of:
  //   1. Parent has a fixed-pixel \`min-h-[Npx]\` (not \`min-h-screen\` — those
  //      are viewport-sized and the fix we'd apply doesn't make sense).
  //   2. Parent has no other height declaration (h-*, max-h-*, fixed, etc.).
  //   3. The h-full child ACTUALLY collapsed to 0 (measured via clientHeight).
  //      This avoids flagging cases where flex layout gives the child height
  //      anyway, or h-full resolves correctly via some other ancestor chain.
  const H_FRACTION_RE = /\\bh-full\\b/;
  const MIN_H_PX_RE = /\\bmin-h-\\[(\\d+)(?:px|rem)?\\]\\b/;
  const OTHER_H_RE = /\\b(?:h-(?:screen|full|\\d+|\\[[^\\]]+\\])|max-h-|position-)\\b/;
  all.forEach(el => {
    const cls = el.className || "";
    if (!H_FRACTION_RE.test(cls)) return;
    if (el.clientHeight > 20) return;   // the h-full child isn't collapsed
    // Walk up to find the nearest ancestor with min-h-[Npx].
    let cur = el.parentElement;
    while (cur && cur !== document.body) {
      const pc = cur.className || "";
      const mpx = pc.match(MIN_H_PX_RE);
      if (mpx) {
        // The specific bug: parent has min-h-[Npx] and NO h-*.
        if (!OTHER_H_RE.test(pc.replace(/\\bmin-h-\\[[^\\]]+\\]\\b/, ""))) {
          if (cur.dataset && cur.dataset.fitId) {
            issues.push({
              id: cur.dataset.fitId,
              targetId: cur.dataset.fitId,
              type: "h-full-in-min-h",
              tag: cur.tagName.toLowerCase(),
              classes: pc,
              clientH: el.clientHeight,
              neededH: parseInt(mpx[1], 10),
            });
          }
        }
        break;
      }
      cur = cur.parentElement;
    }
  });

  return issues;
})()`;

/** Deduplicate raw issues from multiple viewports. Key by (id, type) so a
 * text that overflows on both desktop and mobile is only fixed once; the
 * desktop fix shrinks enough that mobile should also pass. */
function dedupeIssues(raw: Array<RawIssue & { viewport: "desktop" | "mobile" }>): Array<RawIssue & { viewport: "desktop" | "mobile" }> {
  const seen = new Set<string>();
  const out: Array<RawIssue & { viewport: "desktop" | "mobile" }> = [];
  for (const r of raw) {
    const key = `${r.type}:${r.targetId || r.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out;
}

/** Validate and auto-fix layout fit issues in the assembled HTML. */
export async function validateAndFixFit(html: string, logger?: PipelineRun): Promise<FitReport> {
  const log = logger || NOOP_RUN;
  let playwright: typeof import("playwright");
  try {
    // Dynamic import so projects that don't need fit validation don't pay
    // the Playwright startup cost on module load.
    playwright = await import("playwright");
  } catch (err) {
    log.warn(`Fit validator: playwright not available (${err instanceof Error ? err.message : err}) — skipping`);
    return { html, issues: [], appliedFixes: 0, remainingIssues: 0 };
  }

  const tagged = injectFitIds(html);
  const viewports: Array<{ name: "desktop" | "mobile"; width: number; height: number }> = [
    { name: "desktop", width: 1440, height: 900 },
    { name: "mobile", width: 390, height: 844 },
  ];

  let browser: import("playwright").Browser | null = null;
  const rawAll: Array<RawIssue & { viewport: "desktop" | "mobile" }> = [];
  try {
    browser = await playwright.chromium.launch({ headless: true });
    for (const vp of viewports) {
      const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 1 });
      const page = await ctx.newPage();
      try {
        await page.setContent(tagged, { waitUntil: "domcontentloaded" });
        await page.waitForTimeout(600);
        // Force GSAP timelines to end state and kill ScrollTriggers so pinned
        // sections expose their final revealed layout for measurement.
        await page.evaluate(() => {
          const w = window as any;
          // Phase 1: capture which fit-id elements are pin targets BEFORE
          // killing ScrollTriggers. A pinned section's content is allowed
          // to exceed viewport height because the pin keeps it locked —
          // we must not flag it as h-screen-clip.
          const pinnedIds = new Set<string>();
          if (w.ScrollTrigger?.getAll) {
            for (const st of w.ScrollTrigger.getAll()) {
              if (!st.pin) continue;
              const trig = st.trigger as HTMLElement | null;
              if (trig?.dataset?.fitId) pinnedIds.add(trig.dataset.fitId);
              // Also tag any ancestor sections so the wrapping <section>
              // with h-screen is protected too.
              let cur: HTMLElement | null = trig;
              while (cur && cur !== document.body) {
                if (cur.dataset?.fitId) pinnedIds.add(cur.dataset.fitId);
                cur = cur.parentElement;
              }
            }
          }
          (w as any).__fitPinnedIds = Array.from(pinnedIds);

          if (w.gsap?.globalTimeline) {
            for (const t of w.gsap.globalTimeline.getChildren()) {
              try { t.progress(1); } catch {}
            }
          }
          if (w.ScrollTrigger?.getAll) {
            for (const st of w.ScrollTrigger.getAll()) {
              try { st.kill(true); } catch {}
            }
          }
          document.querySelectorAll(".opacity-0").forEach((el) => {
            (el as HTMLElement).style.opacity = "1";
          });
          // Counter animations replace textContent at runtime (e.g. "0" → "€23.7B"),
          // but with ScrollTriggers killed they never fire. Resolve data-counter /
          // data-target final values manually so text-overflow measurement uses
          // the real end-state string, not the initial "0".
          document.querySelectorAll<HTMLElement>("[data-counter],[data-target]").forEach((el) => {
            const raw = el.dataset.counter ?? el.dataset.target ?? "";
            if (!raw) return;
            const n = parseFloat(raw);
            if (isNaN(n)) return;
            const prefix = el.dataset.prefix ?? "";
            const suffix = el.dataset.suffix ?? "";
            const formatted = Number.isInteger(n) && n >= 1000
              ? n.toLocaleString()
              : n.toString();
            el.textContent = `${prefix}${formatted}${suffix}`;
          });
        });
        await page.waitForTimeout(200);
        const raw = (await page.evaluate(COLLECT_ISSUES_FN)) as RawIssue[];
        for (const r of raw) rawAll.push({ ...r, viewport: vp.name });
      } finally {
        await ctx.close().catch(() => {});
      }
    }
  } catch (err) {
    log.warn(`Fit validator: render failed (${err instanceof Error ? err.message : err})`);
    return { html, issues: [], appliedFixes: 0, remainingIssues: 0 };
  } finally {
    if (browser) await browser.close().catch(() => {});
  }

  const deduped = dedupeIssues(rawAll);
  let current = tagged;
  let applied = 0;
  const resolved: FitIssue[] = [];

  // Extract a BEM-style block token (e.g. "dash-cine__num" from a long
  // Tailwind class string). When a text-overflow fix lands on one sibling,
  // we also shrink every element sharing this token so the row looks
  // uniform — otherwise e.g. 3 of 4 KPI numbers shrink and the 4th stays
  // huge because it happened to fit at the measured viewport.
  const pickBemToken = (classes: string): string | null => {
    const tokens = classes.split(/\s+/);
    for (const t of tokens) {
      if (/^[a-z][a-z0-9-]*__[a-z0-9-]+$/i.test(t)) return t;
    }
    return null;
  };

  const shrunkTokens = new Set<string>();
  for (const issue of deduped) {
    let result: { html: string; changed: boolean } = { html: current, changed: false };
    if (issue.type === "text-overflow") {
      const token = pickBemToken(issue.classes);
      if (token && shrunkTokens.has(token)) {
        // Already handled via sibling propagation from an earlier issue —
        // skip to avoid shrinking twice (which would produce nonsense like
        // `text-[2.4rem] lg:text-[1.8rem]` where lg is smaller than base).
        resolved.push({
          id: issue.id, type: issue.type, viewport: issue.viewport, tag: issue.tag,
          classes: issue.classes,
          measurements: { scrollW: issue.scrollW, clientW: issue.clientW, scrollH: issue.scrollH, clientH: issue.clientH },
          fixed: true, text: issue.text,
        });
        applied++;
        continue;
      }
      // Only add whitespace-nowrap for short display text (KPI numbers,
      // one-word labels). Paragraphs and multi-word labels should wrap.
      const txt = (issue.text || "").trim();
      const isShortDisplay = txt.length > 0 && txt.length <= 20 && txt.split(/\s+/).length <= 2;
      const transform = isShortDisplay
        ? (cls: string) => {
            const a = shrinkTextSizes(cls);
            const b = addNowrap(a.out);
            return { out: b.out, changed: a.changed || b.changed };
          }
        : shrinkTextSizes;
      if (token) {
        // Shrink every element carrying the same BEM token in one pass.
        // Idempotent via shrunkTokens.
        shrunkTokens.add(token);
        const siblingRe = new RegExp(
          `<(\\w+)([^>]*?\\bclass="[^"]*\\b${token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b[^"]*"[^>]*)>`,
          "g",
        );
        let anyChanged = false;
        const next = current.replace(siblingRe, (m, tag: string, attrs: string) => {
          const classMatch = attrs.match(/\bclass\s*=\s*"([^"]*)"/);
          if (!classMatch) return m;
          const r = transform(classMatch[1]);
          if (!r.changed) return m;
          anyChanged = true;
          return `<${tag}${attrs.replace(/\bclass\s*=\s*"[^"]*"/, `class="${r.out}"`)}>`;
        });
        result = { html: next, changed: anyChanged };
      } else {
        result = applyClassFix(current, issue.id, transform);
      }
    } else if (issue.type === "h-screen-clip") {
      result = applyClassFix(current, issue.id, swapHScreen);
    } else if (issue.type === "absolute-child-clip" && issue.targetId && issue.neededH) {
      const needed = issue.neededH + 32; // safety margin
      result = applyClassFix(current, issue.targetId, (cls) => injectMinHeight(cls, needed));
    } else if (issue.type === "h-full-in-min-h" && issue.targetId) {
      // Upgrade parent's `min-h-[N]` to `h-[N] min-h-[N]` so that `h-full`
      // children have an explicit parent height to resolve against.
      const needed = issue.neededH && issue.neededH > 0 ? issue.neededH : 480;
      result = applyClassFix(current, issue.targetId, (cls) => {
        const existingMinH = cls.match(/\bmin-h-\[(\d+)(?:px|rem|vh)?\]\b/);
        const size = existingMinH ? parseInt(existingMinH[1], 10) : needed;
        // If class already has any h-* (not min-h, not max-h), nothing to do.
        if (/(?:^|\s)h-(?:screen|\[[^\]]+\]|\d+|full|\d+\/\d+)\b/.test(cls)) {
          return { out: cls, changed: false };
        }
        return { out: `${cls} h-[${size}px]`, changed: true };
      });
    }
    current = result.html;
    if (result.changed) applied++;
    resolved.push({
      id: issue.id,
      type: issue.type,
      viewport: issue.viewport,
      tag: issue.tag,
      classes: issue.classes,
      measurements: {
        scrollW: issue.scrollW,
        clientW: issue.clientW,
        scrollH: issue.scrollH,
        clientH: issue.clientH,
      },
      fixed: result.changed,
      text: issue.text,
    });
  }

  const finalHtml = stripFitIds(current);
  const remaining = resolved.filter((i) => !i.fixed).length;
  return { html: finalHtml, issues: resolved, appliedFixes: applied, remainingIssues: remaining };
}
