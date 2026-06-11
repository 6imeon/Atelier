/**
 * Home-grown DESIGN.md — format, parse, lint, export.
 *
 * Implements the subset of google-labs-code/design.md (Apache-2.0, alpha) that
 * Atelier needs as a quality gate: YAML-front-matter parse, token-ref resolve,
 * seven lint rules, canonical serializer, Tailwind theme export.
 *
 * Consumers: [redesign.ts](../models/redesign.ts) post-extract for DS-level
 * findings; UICrit for contrast-ratio findings.
 */

// ─── Types ────────────────────────────────────────────────────────────────

export interface DesignTokens {
  name?: string;
  version?: string;
  colors: Record<string, string>;
  typography?: Record<string, Record<string, string | number>>;
  spacing?: Record<string, string>;
  rounded?: Record<string, string>;
  components?: Record<string, Record<string, string>>;
  /** Phase 5 — 3-dial parameterisation, persisted alongside tokens. */
  dials?: DialValues;
}

export type LintRule =
  | "broken-ref"
  | "contrast-ratio"
  | "orphaned-tokens"
  | "missing-primary"
  | "missing-typography"
  | "missing-sections"
  | "section-order";

export type LintSeverity = "error" | "warning" | "info";

export interface LintFinding {
  rule: LintRule;
  severity: LintSeverity;
  message: string;
  token?: string;
  component?: string;
  ratio?: number;
}

export interface LintReport {
  findings: LintFinding[];
  summary: { errors: number; warnings: number; info: number };
  designSystem: DesignTokens;
}

// Inputs that adapters may produce. Kept permissive: colors can be nulls (the
// brand extractor hands us nulls when a slot couldn't be resolved).
export interface ExtractedDesignInput {
  colors?: {
    primary?: string | null;
    secondary?: string | null;
    accent?: string | null;
    background?: string | null;
    text?: string | null;
    neutral?: string | null;
  };
  typography?: {
    fontFamilies?: {
      heading?: string | null;
      body?: string | null;
    };
  };
}

// Atelier's CanvasDesignSystem shape (owned by the web-ui store). Kept loose
// because the SDK doesn't depend on web-ui types.
export interface CanvasDesignSystemInput {
  palette?: {
    primary?: string;
    secondary?: string;
    tertiary?: string;
    neutral?: string;
    background?: string;
    text?: string;
  };
  fonts?: {
    headline?: string;
    body?: string;
    label?: string;
  };
  cornerRadius?: string;
  /** Phase 5 — 3-dial parameterisation (integer 1-10 each). */
  dials?: DialValues;
}

/**
 * Phase 5 dials. Orthogonal knobs tuning output against three axes
 * independently from the persona/visual direction. Integer 1-10 each;
 * `DEFAULT_DIALS` matches the taste-skill research baseline.
 */
export interface DialValues {
  /** Layout asymmetry. 1-3 = centred/symmetric; 8-10 = broken-grid. */
  variance: number;
  /** Motion complexity. 1-3 = hover-only; 8-10 = scroll choreography. */
  motion: number;
  /** Content density. 1-3 = gallery whitespace; 8-10 = data-dense cockpit. */
  density: number;
}

export const DEFAULT_DIALS: DialValues = { variance: 8, motion: 6, density: 4 };

/**
 * Clamp a dial value to the valid 1-10 integer range. Returns the supplied
 * default when the input is undefined/NaN so the prompt never sees garbage.
 */
function clampDial(v: unknown, fallback: number): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(1, Math.min(10, Math.round(n)));
}

export function normaliseDials(partial: Partial<DialValues> | undefined): DialValues {
  return {
    variance: clampDial(partial?.variance, DEFAULT_DIALS.variance),
    motion: clampDial(partial?.motion, DEFAULT_DIALS.motion),
    density: clampDial(partial?.density, DEFAULT_DIALS.density),
  };
}

/**
 * Render the three dials as concrete guidance bands for a section-generation
 * prompt. The bands are lifted from the taste-skill research in
 * [upgrades.md](../../../../upgrades.md#11-the-3-dial-parameterisation-model).
 * Each dial produces a single, specific instruction rather than abstract
 * numbers — the model is bad at interpreting "7/10" without context.
 */
export function formatDialsForPrompt(input: Partial<DialValues> | undefined): string {
  const d = normaliseDials(input);
  const variance =
    d.variance <= 3
      ? "LOW (1-3) — perfect symmetry, centred layouts, predictable 12-col grid, even spacing"
      : d.variance <= 7
      ? "MEDIUM (4-7) — offset anchors, non-centred focal points, occasional 2-col or 3-col alternation"
      : "HIGH (8-10) — asymmetric CSS grid, broken grids, massive whitespace, `2fr 1fr 1fr` ratios, split-screen heroes";

  const motion =
    d.motion <= 3
      ? "LOW (1-3) — static layout, only :hover/:focus transitions, no scroll animation"
      : d.motion <= 7
      ? "MEDIUM (4-7) — subtle scroll fade-ins, staggered reveals, spring easing on interactive elements"
      : "HIGH (8-10) — scroll-pinned choreography, magnetic cursors, GSAP ScrollTrigger sequences, parallax, horizontal hijack, kinetic marquee";

  const density =
    d.density <= 3
      ? "LOW (1-3) — art-gallery whitespace, huge gaps, single focal element per viewport, display-only typography"
      : d.density <= 7
      ? "MEDIUM (4-7) — balanced content cards, moderate padding, multi-column layouts where copy warrants"
      : "HIGH (8-10) — cockpit / data-dense, mono numerics (tabular-nums), `border-t`/`divide-y` rows over cards, tight leading";

  return `DIAL GUIDANCE (tune output against these three axes, orthogonal to persona):
- DESIGN_VARIANCE = ${d.variance}/10 → ${variance}
- MOTION_INTENSITY = ${d.motion}/10 → ${motion}
- VISUAL_DENSITY = ${d.density}/10 → ${density}`;
}

// ─── Adapters ─────────────────────────────────────────────────────────────

/**
 * Convert Atelier's extractedDesign (what [redesign.ts](../models/redesign.ts)
 * produces post-extract) into canonical DesignTokens. Drops null slots.
 */
export function fromExtractedDesign(input: ExtractedDesignInput, name?: string): DesignTokens {
  const colors: Record<string, string> = {};
  const c = input.colors ?? {};
  if (c.primary) colors.primary = c.primary;
  if (c.secondary) colors.secondary = c.secondary;
  if (c.accent) colors.accent = c.accent;
  if (c.background) colors.background = c.background;
  if (c.text) colors.text = c.text;
  if (c.neutral) colors.neutral = c.neutral;

  const typography: Record<string, Record<string, string>> = {};
  const tf = input.typography?.fontFamilies;
  if (tf?.heading) typography.h1 = { fontFamily: tf.heading };
  if (tf?.body) typography["body-md"] = { fontFamily: tf.body };

  return {
    name,
    version: "alpha",
    colors,
    typography: Object.keys(typography).length > 0 ? typography : undefined,
  };
}

/**
 * Convert the web-ui's `CanvasDesignSystem` shape (palette + fonts +
 * cornerRadius) into canonical DesignTokens. Used by Phase 3 to render a
 * Tailwind theme config for section-generation prompts, and by the
 * `/design-system.md` endpoints for round-tripping.
 */
export function fromCanvasDesignSystem(
  input: CanvasDesignSystemInput,
  name?: string,
): DesignTokens {
  const colors: Record<string, string> = {};
  const p = input.palette ?? {};
  if (p.primary) colors.primary = p.primary;
  if (p.secondary) colors.secondary = p.secondary;
  if (p.tertiary) colors.tertiary = p.tertiary;
  if (p.neutral) colors.neutral = p.neutral;
  if (p.background) colors.background = p.background;
  if (p.text) colors.text = p.text;

  const typography: Record<string, Record<string, string>> = {};
  const f = input.fonts ?? {};
  if (f.headline) typography.h1 = { fontFamily: f.headline };
  if (f.body) typography["body-md"] = { fontFamily: f.body };
  if (f.label) typography["label-caps"] = { fontFamily: f.label };

  const rounded: Record<string, string> = {};
  if (input.cornerRadius) rounded.md = input.cornerRadius;

  return {
    name,
    version: "alpha",
    colors,
    typography: Object.keys(typography).length > 0 ? typography : undefined,
    rounded: Object.keys(rounded).length > 0 ? rounded : undefined,
    dials: input.dials ? normaliseDials(input.dials) : undefined,
  };
}

/**
 * Adapt a parsed DesignTokens object back to the web-ui's CanvasDesignSystem
 * shape. Used by PUT /design-system.md so a user-uploaded markdown file
 * hydrates the frontend store.
 */
export function toCanvasDesignSystem(ds: DesignTokens): CanvasDesignSystemInput {
  const palette: NonNullable<CanvasDesignSystemInput["palette"]> = {};
  if (ds.colors.primary) palette.primary = ds.colors.primary;
  if (ds.colors.secondary) palette.secondary = ds.colors.secondary;
  if (ds.colors.tertiary) palette.tertiary = ds.colors.tertiary;
  if (ds.colors.neutral) palette.neutral = ds.colors.neutral;
  if (ds.colors.background) palette.background = ds.colors.background;
  if (ds.colors.text) palette.text = ds.colors.text;

  const fonts: NonNullable<CanvasDesignSystemInput["fonts"]> = {
    headline: "",
    body: "",
    label: "",
  };
  const headline = ds.typography?.h1?.fontFamily;
  const body = ds.typography?.["body-md"]?.fontFamily ?? ds.typography?.body?.fontFamily;
  const label = ds.typography?.["label-caps"]?.fontFamily ?? ds.typography?.mono?.fontFamily;
  if (typeof headline === "string") fonts.headline = headline;
  if (typeof body === "string") fonts.body = body;
  if (typeof label === "string") fonts.label = label;

  const cornerRadius = ds.rounded?.md;

  return {
    palette: Object.keys(palette).length > 0 ? palette : undefined,
    fonts,
    cornerRadius: typeof cornerRadius === "string" ? cornerRadius : undefined,
    dials: ds.dials ? normaliseDials(ds.dials) : undefined,
  };
}

// ─── YAML subset parser ───────────────────────────────────────────────────
// Strict subset — 2-space indents, key:value lines, nested maps, quoted
// strings, token refs like `{colors.primary}`. No lists, no flow style, no
// anchors. Any unrecognised syntax is ignored (forward-compatible).

function parseYaml(text: string): Record<string, unknown> {
  const lines = text.split("\n");
  const root: Record<string, unknown> = {};
  const stack: Array<{ indent: number; obj: Record<string, unknown> }> = [
    { indent: -1, obj: root },
  ];

  for (const raw of lines) {
    if (!raw.trim() || raw.trim().startsWith("#")) continue;
    const indent = raw.length - raw.trimStart().length;
    const line = raw.trimStart();
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;

    const key = line.slice(0, colonIdx).trim();
    const rest = line.slice(colonIdx + 1).trim();

    // Pop stack until we find the parent at a shallower indent.
    while (stack.length > 1 && stack[stack.length - 1].indent >= indent) {
      stack.pop();
    }
    const parent = stack[stack.length - 1].obj;

    if (rest === "") {
      // Nested map opens here.
      const child: Record<string, unknown> = {};
      parent[key] = child;
      stack.push({ indent, obj: child });
    } else {
      parent[key] = unquote(rest);
    }
  }
  return root;
}

function unquote(v: string): string {
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    return v.slice(1, -1);
  }
  return v;
}

// ─── Front-matter extraction ──────────────────────────────────────────────

function splitFrontMatter(md: string): { frontMatter: string; body: string } {
  if (!md.startsWith("---")) return { frontMatter: "", body: md };
  const end = md.indexOf("\n---", 3);
  if (end === -1) return { frontMatter: "", body: md };
  const frontMatter = md.slice(3, end).replace(/^\n/, "");
  const body = md.slice(end + 4).replace(/^\n/, "");
  return { frontMatter, body };
}

// ─── Token-ref resolution ─────────────────────────────────────────────────
// Refs look like `{colors.primary}` — single-level dotted path into the root
// object. Collects unresolved refs for the `broken-ref` rule.

const REF_RE = /^\{([a-zA-Z0-9_-]+)\.([a-zA-Z0-9_-]+)\}$/;

function resolveRef(
  root: Record<string, unknown>,
  value: string,
  broken: Array<{ ref: string; in: string }>,
  context: string,
): string {
  const m = value.match(REF_RE);
  if (!m) return value;
  const [, section, key] = m;
  const sec = root[section] as Record<string, unknown> | undefined;
  const resolved = sec?.[key];
  if (typeof resolved === "string") return resolved;
  broken.push({ ref: value, in: context });
  return value;
}

// ─── Parser ───────────────────────────────────────────────────────────────

export function parse(markdown: string): {
  ds: DesignTokens;
  raw: Record<string, unknown>;
  brokenRefs: Array<{ ref: string; in: string }>;
} {
  const { frontMatter } = splitFrontMatter(markdown);
  const raw = frontMatter.trim() ? parseYaml(frontMatter) : {};
  const brokenRefs: Array<{ ref: string; in: string }> = [];

  const name = typeof raw.name === "string" ? raw.name : undefined;
  const version = typeof raw.version === "string" ? raw.version : undefined;

  const colors: Record<string, string> = {};
  if (isRecord(raw.colors)) {
    for (const [k, v] of Object.entries(raw.colors)) {
      if (typeof v === "string") colors[k] = v;
    }
  }

  let typography: DesignTokens["typography"];
  if (isRecord(raw.typography)) {
    typography = {};
    for (const [k, v] of Object.entries(raw.typography)) {
      if (isRecord(v)) {
        const role: Record<string, string | number> = {};
        for (const [kk, vv] of Object.entries(v)) {
          if (typeof vv === "string" || typeof vv === "number") role[kk] = vv;
        }
        typography[k] = role;
      }
    }
  }

  let spacing: Record<string, string> | undefined;
  if (isRecord(raw.spacing)) {
    spacing = {};
    for (const [k, v] of Object.entries(raw.spacing)) {
      if (typeof v === "string") spacing[k] = v;
    }
  }

  let rounded: Record<string, string> | undefined;
  if (isRecord(raw.rounded)) {
    rounded = {};
    for (const [k, v] of Object.entries(raw.rounded)) {
      if (typeof v === "string") rounded[k] = v;
    }
  }

  let dials: DialValues | undefined;
  if (isRecord(raw.dials)) {
    const rawDials = raw.dials as Record<string, unknown>;
    dials = normaliseDials({
      variance: rawDials.variance as number,
      motion: rawDials.motion as number,
      density: rawDials.density as number,
    });
  }

  let components: Record<string, Record<string, string>> | undefined;
  if (isRecord(raw.components)) {
    components = {};
    for (const [comp, props] of Object.entries(raw.components)) {
      if (!isRecord(props)) continue;
      const resolved: Record<string, string> = {};
      for (const [prop, val] of Object.entries(props)) {
        if (typeof val !== "string") continue;
        resolved[prop] = resolveRef(raw, val, brokenRefs, comp);
      }
      components[comp] = resolved;
    }
  }

  return {
    ds: {
      name,
      version,
      colors,
      typography,
      spacing,
      rounded,
      components,
      dials,
    },
    raw,
    brokenRefs,
  };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

// ─── Contrast math (WCAG AA) ──────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] | null {
  const h = hex.replace("#", "").trim();
  if (h.length !== 3 && h.length !== 6) return null;
  const full = h.length === 3 ? h.split("").map(c => c + c).join("") : h;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

function relativeLuminance(rgb: [number, number, number]): number {
  const [r, g, b] = rgb.map(c => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(hex1: string, hex2: string): number | null {
  const a = hexToRgb(hex1);
  const b = hexToRgb(hex2);
  if (!a || !b) return null;
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

// ─── Lint rules ───────────────────────────────────────────────────────────

function ruleBrokenRef(
  brokenRefs: Array<{ ref: string; in: string }>,
  findings: LintFinding[],
): void {
  for (const b of brokenRefs) {
    findings.push({
      rule: "broken-ref",
      severity: "error",
      message: `Token ref ${b.ref} (used in "${b.in}") does not resolve`,
      token: b.ref,
      component: b.in,
    });
  }
}

function ruleMissingPrimary(ds: DesignTokens, findings: LintFinding[]): void {
  if (Object.keys(ds.colors).length > 0 && !ds.colors.primary) {
    findings.push({
      rule: "missing-primary",
      severity: "warning",
      message: "Colors defined but no `primary` token",
    });
  }
}

function ruleMissingTypography(ds: DesignTokens, findings: LintFinding[]): void {
  if (Object.keys(ds.colors).length > 0 && !ds.typography) {
    findings.push({
      rule: "missing-typography",
      severity: "warning",
      message: "Colors defined but no typography tokens",
    });
  }
}

function ruleOrphanedTokens(ds: DesignTokens, findings: LintFinding[]): void {
  if (!ds.components || Object.keys(ds.components).length === 0) return;
  const referenced = new Set<string>();
  for (const props of Object.values(ds.components)) {
    for (const val of Object.values(props)) {
      const m = val.match(REF_RE);
      if (m) referenced.add(`${m[1]}.${m[2]}`);
    }
  }
  for (const [key] of Object.entries(ds.colors)) {
    if (!referenced.has(`colors.${key}`)) {
      findings.push({
        rule: "orphaned-tokens",
        severity: "warning",
        message: `Color token \`${key}\` defined but not referenced by any component`,
        token: `colors.${key}`,
      });
    }
  }
}

function ruleContrastRatio(ds: DesignTokens, findings: LintFinding[]): void {
  // Pairwise check on known fg/bg conventions.
  // Each component gets scanned for background/text pairs, then we also check
  // palette-level common pairings (text-on-background, primary-on-neutral).
  if (ds.components) {
    for (const [comp, props] of Object.entries(ds.components)) {
      const bg = props.backgroundColor ?? props.background;
      const fg = props.textColor ?? props.color;
      if (!bg || !fg) continue;
      const ratio = contrastRatio(bg, fg);
      if (ratio === null) continue;
      if (ratio < 4.5) {
        findings.push({
          rule: "contrast-ratio",
          severity: "warning",
          message: `"${comp}" color pair (ratio ${ratio.toFixed(2)}) below WCAG AA 4.5:1`,
          component: comp,
          ratio,
        });
      }
    }
  }
  // Palette-level: primary on background, text on background.
  const pairs: Array<[string, string]> = [
    ["text", "background"],
    ["primary", "background"],
  ];
  for (const [fgKey, bgKey] of pairs) {
    const fg = ds.colors[fgKey];
    const bg = ds.colors[bgKey];
    if (!fg || !bg) continue;
    const ratio = contrastRatio(bg, fg);
    if (ratio === null) continue;
    if (ratio < 4.5) {
      findings.push({
        rule: "contrast-ratio",
        severity: "warning",
        message: `Palette ${fgKey}-on-${bgKey} (ratio ${ratio.toFixed(2)}) below WCAG AA 4.5:1`,
        token: `${fgKey}-on-${bgKey}`,
        ratio,
      });
    }
  }
}

const CANONICAL_SECTIONS = [
  "Overview",
  "Colors",
  "Typography",
  "Layout",
  "Elevation & Depth",
  "Shapes",
  "Components",
  "Do's and Don'ts",
];

function ruleMissingSections(markdown: string, findings: LintFinding[]): void {
  const { body } = splitFrontMatter(markdown);
  if (!body.trim()) return;
  const headings = extractH2Headings(body);
  for (const wanted of ["Colors", "Typography"]) {
    if (!headings.includes(wanted)) {
      findings.push({
        rule: "missing-sections",
        severity: "info",
        message: `Missing prose section "${wanted}"`,
      });
    }
  }
}

function ruleSectionOrder(markdown: string, findings: LintFinding[]): void {
  const { body } = splitFrontMatter(markdown);
  if (!body.trim()) return;
  const headings = extractH2Headings(body);
  let lastIdx = -1;
  for (const h of headings) {
    const idx = CANONICAL_SECTIONS.indexOf(h);
    if (idx === -1) continue;
    if (idx < lastIdx) {
      findings.push({
        rule: "section-order",
        severity: "warning",
        message: `Section "${h}" appears out of canonical order`,
      });
      return;
    }
    lastIdx = idx;
  }
}

function extractH2Headings(body: string): string[] {
  return body
    .split("\n")
    .filter(l => l.startsWith("## "))
    .map(l => l.slice(3).trim());
}

// ─── Public lint ──────────────────────────────────────────────────────────

export function lint(markdown: string): LintReport {
  const { ds, brokenRefs } = parse(markdown);
  const findings: LintFinding[] = [];

  ruleBrokenRef(brokenRefs, findings);
  ruleMissingPrimary(ds, findings);
  ruleMissingTypography(ds, findings);
  ruleOrphanedTokens(ds, findings);
  ruleContrastRatio(ds, findings);
  ruleMissingSections(markdown, findings);
  ruleSectionOrder(markdown, findings);

  const summary = {
    errors: findings.filter(f => f.severity === "error").length,
    warnings: findings.filter(f => f.severity === "warning").length,
    info: findings.filter(f => f.severity === "info").length,
  };

  return { findings, summary, designSystem: ds };
}

// ─── Serializer ───────────────────────────────────────────────────────────

export function serialize(ds: DesignTokens, name?: string): string {
  const displayName = name ?? ds.name ?? "Untitled";
  const fm: string[] = ["---"];
  fm.push(`version: ${ds.version ?? "alpha"}`);
  fm.push(`name: ${quoteIfNeeded(displayName)}`);

  if (Object.keys(ds.colors).length > 0) {
    fm.push("colors:");
    for (const k of sortTokenKeys(Object.keys(ds.colors), COLOR_KEY_ORDER)) {
      fm.push(`  ${k}: ${quoteValue(ds.colors[k])}`);
    }
  }

  if (ds.typography && Object.keys(ds.typography).length > 0) {
    fm.push("typography:");
    for (const k of Object.keys(ds.typography)) {
      fm.push(`  ${k}:`);
      const role = ds.typography[k];
      for (const prop of Object.keys(role)) {
        fm.push(`    ${prop}: ${quoteValue(String(role[prop]))}`);
      }
    }
  }

  if (ds.rounded && Object.keys(ds.rounded).length > 0) {
    fm.push("rounded:");
    for (const [k, v] of Object.entries(ds.rounded)) {
      fm.push(`  ${k}: ${quoteValue(v)}`);
    }
  }

  if (ds.spacing && Object.keys(ds.spacing).length > 0) {
    fm.push("spacing:");
    for (const [k, v] of Object.entries(ds.spacing)) {
      fm.push(`  ${k}: ${quoteValue(v)}`);
    }
  }

  if (ds.components && Object.keys(ds.components).length > 0) {
    fm.push("components:");
    for (const [comp, props] of Object.entries(ds.components)) {
      fm.push(`  ${comp}:`);
      for (const [prop, val] of Object.entries(props)) {
        fm.push(`    ${prop}: ${quoteValue(val)}`);
      }
    }
  }

  if (ds.dials) {
    const d = normaliseDials(ds.dials);
    fm.push("dials:");
    fm.push(`  variance: ${d.variance}`);
    fm.push(`  motion: ${d.motion}`);
    fm.push(`  density: ${d.density}`);
  }

  fm.push("---");

  // Canonical prose sections. Kept intentionally terse; generated content;
  // downstream consumers (Phase 7 user upload) can hand-edit these.
  const body: string[] = [
    "",
    `# ${displayName}`,
    "",
    "## Overview",
    `Auto-generated design system for ${displayName}.`,
    "",
    "## Colors",
    "Primary, secondary, accent, and neutral tokens define the project palette.",
    "",
    "## Typography",
    "Heading and body type roles. See front matter for exact values.",
    "",
    "## Layout",
    "Grid and spacing conventions follow the Atelier defaults.",
    "",
    "## Shapes",
    "Corner radii and border tokens.",
    "",
    "## Components",
    "Component-level colour and radius bindings. See front matter.",
    "",
    "## Do's and Don'ts",
    "Follow the Atelier prompt rules in [prompts.ts](../packages/sdk/src/utils/prompts.ts).",
    "",
  ];

  return [...fm, ...body].join("\n");
}

const COLOR_KEY_ORDER = ["primary", "secondary", "accent", "tertiary", "neutral", "background", "text"];

function sortTokenKeys(keys: string[], preferred: string[]): string[] {
  const set = new Set(keys);
  const ordered: string[] = [];
  for (const k of preferred) {
    if (set.has(k)) {
      ordered.push(k);
      set.delete(k);
    }
  }
  return [...ordered, ...Array.from(set).sort()];
}

function quoteIfNeeded(v: string): string {
  if (/[:#{}[\]]/.test(v)) return `"${v}"`;
  return v;
}

function quoteValue(v: string): string {
  // Token refs stay unquoted. Hex and strings get quoted for YAML safety.
  if (REF_RE.test(v)) return v;
  return `"${v}"`;
}

// ─── Tailwind export ──────────────────────────────────────────────────────

export function exportTailwind(ds: DesignTokens): string {
  const lines: string[] = [];
  lines.push("/** @type {import('tailwindcss').Config} */");
  lines.push("module.exports = {");
  lines.push("  theme: {");
  lines.push("    extend: {");

  if (Object.keys(ds.colors).length > 0) {
    lines.push("      colors: {");
    for (const [k, v] of Object.entries(ds.colors)) {
      lines.push(`        ${k}: ${JSON.stringify(v)},`);
    }
    lines.push("      },");
  }

  if (ds.typography) {
    const heading = ds.typography.h1?.fontFamily;
    const body = ds.typography["body-md"]?.fontFamily ?? ds.typography.body?.fontFamily;
    const mono = ds.typography.mono?.fontFamily ?? ds.typography["label-caps"]?.fontFamily;
    if (heading || body || mono) {
      lines.push("      fontFamily: {");
      if (heading) lines.push(`        heading: ${JSON.stringify([heading])},`);
      if (body) lines.push(`        body: ${JSON.stringify([body])},`);
      if (mono) lines.push(`        mono: ${JSON.stringify([mono])},`);
      lines.push("      },");
    }
  }

  if (ds.rounded && Object.keys(ds.rounded).length > 0) {
    lines.push("      borderRadius: {");
    for (const [k, v] of Object.entries(ds.rounded)) {
      lines.push(`        ${k}: ${JSON.stringify(v)},`);
    }
    lines.push("      },");
  }

  if (ds.spacing && Object.keys(ds.spacing).length > 0) {
    lines.push("      spacing: {");
    for (const [k, v] of Object.entries(ds.spacing)) {
      lines.push(`        ${k}: ${JSON.stringify(v)},`);
    }
    lines.push("      },");
  }

  lines.push("    },");
  lines.push("  },");
  lines.push("};");
  return lines.join("\n");
}

// ─── Env flag ─────────────────────────────────────────────────────────────

export function isLintEnabled(): boolean {
  if (typeof process === "undefined") return false;
  const v = process.env?.CANVAS_DESIGN_MD_LINT;
  // Default: enabled. Opt out with `0` or `false`.
  if (v === "0" || v === "false") return false;
  return true;
}

/**
 * Phase 3 prompt-format selector. `tailwind` → swap the ad-hoc JSON design
 * block in section prompts for a Tailwind `theme.extend` snippet (the LLM has
 * strong priors on Tailwind syntax). `json` or unset → keep the current block.
 * Flag-gated so we can A/B on canonical sites before flipping the default.
 */
export function promptDsFormat(): "tailwind" | "json" {
  if (typeof process === "undefined") return "json";
  const v = (process.env?.CANVAS_PROMPT_DS_FORMAT || "").toLowerCase();
  return v === "tailwind" ? "tailwind" : "json";
}
