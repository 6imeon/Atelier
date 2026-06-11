// Transition guard: strip Tailwind transition utilities that fight GSAP.
//
// Kimi habitually adds `transition-all duration-500` to elements that
// have a hover style (e.g. `hover:border-[#00b2ff]/30`). When those same
// elements are targets of a GSAP `.from()` / `.to()` tween in a scrub
// timeline, GSAP writes `opacity` and `transform` every animation frame
// (~16ms). The CSS `transition: all 500ms` tries to interpolate each
// write over 500ms, but the next frame GSAP writes again, restarting the
// transition. Net effect: the element's rendered state lags so far
// behind that it never visually advances — opacity stays at 0, the card
// never appears.
//
// This utility:
//   1. Scans every inline <script> for GSAP tween selectors — anything
//      passed as the first arg to `.from`, `.to`, `.fromTo`, `gsap.from`,
//      `gsap.to`, `gsap.fromTo`.
//   2. For every HTML element whose class list contains one of those
//      selectors AND also contains `transition-all` or an equivalent
//      broad transition class, swap the broad utility for a narrower
//      `transition-colors` so hover color effects still work.
//
// Runs after pin-reveal-sync and content-fade-guard, before fit-validator.

export interface TransitionGuardResult {
  html: string;
  strippedTransitions: number;
  touchedSelectors: string[];
}

/** Class substrings to rewrite. `transition-all` is the primary culprit
 * but `transition-opacity` and `transition-transform` also cause the
 * same fight because they target properties GSAP writes. Leave
 * `transition-colors` / `transition-shadow` etc. alone. */
const BROAD_TRANSITION_RE = /\btransition-(all|opacity|transform)(?:\s+duration-\d+)?\b/;
const BROAD_TRANSITION_REPLACE_RE = /\btransition-(?:all|opacity|transform)\b/g;

/** Pull selectors out of any `.from(...)`, `.to(...)`, `.fromTo(...)`,
 * `gsap.from(...)`, etc. call. Looks for the first string-literal argument. */
function collectGsapSelectors(script: string): Set<string> {
  const out = new Set<string>();
  // Match common tween entry points with a string literal first arg.
  // Covers: gsap.from / gsap.to / gsap.fromTo / timeline.from / timeline.to /
  // timeline.fromTo / tl.from / variableName.from — anything ending in .from(,
  // .to(, .fromTo(. Also catches chained `.from(".x", ...)`.
  const re = /(?:^|[^a-zA-Z_$])(?:from|to|fromTo|set)\s*\(\s*(["'`])([^"'`]+)\1/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(script)) !== null) {
    const sel = m[2].trim();
    if (!sel) continue;
    // Split comma-separated selector groups (`.a, .b`) and accept each.
    for (const part of sel.split(",")) {
      const p = part.trim();
      if (p) out.add(p);
    }
  }
  return out;
}

/** Given a selector like `.dash-cine__kpi-card` or `.foo .bar`, pull out
 * the class tokens we can test against an element's className. Returns
 * empty for selectors we can't safely match (id selectors, attr
 * selectors, pseudo-classes, descendant combinators with unclear scope). */
function classTokensFromSelector(sel: string): string[] {
  const trimmed = sel.trim();
  // Reject anything that's not a pure class or class chain.
  if (trimmed.startsWith("#")) return [];
  if (/[[:]/.test(trimmed)) return [];
  if (/\s/.test(trimmed)) return [];   // descendant combinators — context-dependent
  // `.a.b.c` → ["a", "b", "c"]
  const parts = trimmed.split(".").filter(Boolean);
  return parts;
}

/** Check whether an element's class attribute contains every token of the
 * selector. */
function classMatches(classAttr: string, tokens: string[]): boolean {
  if (tokens.length === 0) return false;
  const classes = classAttr.split(/\s+/);
  for (const t of tokens) {
    if (!classes.includes(t)) return false;
  }
  return true;
}

/** Rewrite broad transition utilities on a single class string to
 * `transition-colors`. Preserves the duration so hover timing stays. */
function softenTransition(classes: string): { out: string; changed: boolean } {
  if (!BROAD_TRANSITION_RE.test(classes)) return { out: classes, changed: false };
  const out = classes.replace(BROAD_TRANSITION_REPLACE_RE, "transition-colors");
  return { out, changed: out !== classes };
}

/** Walk the HTML, soften broad transitions on elements matching any GSAP
 * selector. Selector parsing is deliberately conservative — we only touch
 * elements we're confident are tween targets. */
export function stripConflictingTransitions(html: string): TransitionGuardResult {
  // Collect all GSAP tween selectors from inline scripts.
  const selectors = new Set<string>();
  const scriptRe = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = scriptRe.exec(html)) !== null) {
    for (const s of collectGsapSelectors(m[1])) selectors.add(s);
  }
  if (selectors.size === 0) {
    return { html, strippedTransitions: 0, touchedSelectors: [] };
  }

  // Reduce to token sets we can match cheaply.
  const tokenSets: Array<{ sel: string; tokens: string[] }> = [];
  for (const sel of selectors) {
    const tokens = classTokensFromSelector(sel);
    if (tokens.length > 0) tokenSets.push({ sel, tokens });
  }
  if (tokenSets.length === 0) {
    return { html, strippedTransitions: 0, touchedSelectors: [] };
  }

  let stripped = 0;
  const touched = new Set<string>();
  const openTagRe = /<(\w+)([^>]*?\bclass\s*=\s*")([^"]*)("[^>]*)>/g;
  const out = html.replace(openTagRe, (match, tag: string, pre: string, classAttr: string, post: string) => {
    if (!BROAD_TRANSITION_RE.test(classAttr)) return match;
    // Does this element match ANY GSAP selector?
    let matched: string | null = null;
    for (const { sel, tokens } of tokenSets) {
      if (classMatches(classAttr, tokens)) { matched = sel; break; }
    }
    if (!matched) return match;
    const r = softenTransition(classAttr);
    if (!r.changed) return match;
    stripped++;
    touched.add(matched);
    return `<${tag}${pre}${r.out}${post}>`;
  });

  return { html: out, strippedTransitions: stripped, touchedSelectors: [...touched] };
}
