// Content-fade guard for pinned cinematic sections.
//
// Kimi keeps inserting tweens like:
//
//   tl.to(".hero-cine__content", { opacity: 0, yPercent: -15, duration: 0.8 }, 0.7)
//
// inside pinned + scrubbed timelines. The rationale it writes sounds fine
// ("content fades out past 70% scroll progress") but the effect is a blank
// dark viewport for the last ~30% of scroll through the pinned section —
// the user dwells on nothing before the pin releases. Classic anti-pattern
// on pinned storytelling sections.
//
// Fix: walk <script> bodies; if a script contains any `pin: true` marker
// (placed either by Kimi directly or by pin-reveal-sync afterwards), strip
// every `.to(SEL, { ... opacity: 0 ... })` whose selector points at a
// content/headline/card element. Leave decorative fade-outs (scroll hint,
// grain overlay, glow, background) alone.
//
// Runs AFTER pin-reveal-sync so the pin markers are already canonicalized.

export interface ContentFadeGuardResult {
  html: string;
  strippedTweens: number;
}

/** Selectors whose fade-to-zero is the bug we're stripping. These all
 * denote the primary textual/interactive content of a section. */
const CONTENT_DENY_RE =
  /__(content|headline|title|heading|cta|card|body|inner|text|year|num|number|subtitle|eyebrow|intro|copy|quote|name|role|label|question|answer|score|stat|metric|counter)(?:\b|_|-)/;

/** Decorative selectors whose fade-to-zero is fine — these are hints,
 * overlays, and background layers that should go invisible once the
 * content has been revealed. */
const DECORATIVE_ALLOW_RE =
  /__(scroll|hint|indicator|arrow|mouse|overlay|grain|glow|gradient|noise|bg|backdrop|vignette|scanline|line)(?:\b|_|-)/;

/** Top-level .to( opts object can contain nested braces (rare — mostly for
 * ease functions like `ease: "power2.out"`). Match up to 500 chars with a
 * simple depth counter so we don't trip on them. */
function findToCall(body: string, startIdx: number): { end: number; inner: string } | null {
  // Expect body[startIdx..] to begin with ".to(" or "to(" — caller handles prefix.
  let pos = startIdx;
  if (body.slice(pos, pos + 4) !== ".to(") return null;
  pos += 4;
  let depth = 1;
  const innerStart = pos;
  while (pos < body.length && depth > 0) {
    const ch = body[pos];
    if (ch === "(") depth++;
    else if (ch === ")") {
      depth--;
      if (depth === 0) return { end: pos + 1, inner: body.slice(innerStart, pos) };
    } else if (ch === '"' || ch === "'" || ch === "`") {
      // Skip string
      const quote = ch;
      pos++;
      while (pos < body.length && body[pos] !== quote) {
        if (body[pos] === "\\") pos++;
        pos++;
      }
    }
    pos++;
  }
  return null;
}

/** Parse the `.to()` inner (selector, vars, [position]) and decide if it
 * should be stripped. Returns null if it's not a fade-to-zero content
 * tween we care about. */
function classifyToCall(inner: string): "strip" | "keep" {
  // Pull out the first argument — the target selector (string literal).
  const selMatch = inner.match(/^\s*(["'`])([^"'`]+)\1/);
  if (!selMatch) return "keep"; // dynamic target (variable ref) — too risky to touch
  const sel = selMatch[2];

  // Strip must satisfy: opacity set to a low value AND content-ish selector
  // AND NOT decorative. Matches `opacity: 0`, `opacity: 0.0` through
  // `opacity: 0.4`. Kimi keeps moving the goalposts — originally it fully
  // faded content to 0, then started writing `opacity: 0.3` to bypass the
  // early version of this guard. Anything ≤ 0.4 leaves the content too dim
  // to be useful at pin end.
  if (!/\bopacity\s*:\s*0(?:\.[0-4]\d*)?\s*[,}]/.test(inner)) return "keep";
  if (DECORATIVE_ALLOW_RE.test(sel)) return "keep";
  if (!CONTENT_DENY_RE.test(sel)) return "keep";
  return "strip";
}

function stripContentFades(scriptBody: string): { body: string; stripped: number } {
  if (!/\bpin\s*:\s*true\b/.test(scriptBody)) {
    return { body: scriptBody, stripped: 0 };
  }
  let out = "";
  let stripped = 0;
  let i = 0;
  while (i < scriptBody.length) {
    // Find next `.to(` occurrence. We only strip calls whose prefix is `.`
    // (chained on a timeline or variable) — standalone `gsap.to(...)` calls
    // inside click handlers etc. are left alone because they are not part
    // of the scrub-driven reveal.
    const next = scriptBody.indexOf(".to(", i);
    if (next < 0) {
      out += scriptBody.slice(i);
      break;
    }
    // Make sure the char before `.to(` is NOT "p" (from `gsap.to(`) or
    // `gsap.fromTo(` etc. The prefix must be an identifier character or
    // `)` (chain continuation).
    const prev = scriptBody[next - 1];
    if (prev === "p" || prev === "m" || prev === "o") {
      // Likely `gsap.to(` / `fromTo(` / some other method — skip and advance.
      out += scriptBody.slice(i, next + 4);
      i = next + 4;
      continue;
    }
    const call = findToCall(scriptBody, next);
    if (!call) {
      out += scriptBody.slice(i, next + 4);
      i = next + 4;
      continue;
    }
    const decision = classifyToCall(call.inner);
    if (decision === "keep") {
      out += scriptBody.slice(i, call.end);
      i = call.end;
      continue;
    }
    // Strip the entire `.to(...)` call. Preserve whitespace before it;
    // chain on either side stays valid because `a.b().c()` → `a.b()` is
    // still well-formed.
    out += scriptBody.slice(i, next);
    stripped++;
    i = call.end;
  }
  return { body: out, stripped };
}

/** Walk every inline <script> in the HTML, strip content-fade tweens from
 * scripts that contain a `pin: true` marker. */
export function stripPinnedContentFades(html: string): ContentFadeGuardResult {
  let strippedTotal = 0;
  const out = html.replace(
    /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi,
    (full, body: string) => {
      const result = stripContentFades(body);
      strippedTotal += result.stripped;
      if (result.body === body) return full;
      return full.replace(body, result.body);
    },
  );
  return { html: out, strippedTweens: strippedTotal };
}
