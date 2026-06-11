/**
 * Phase 4 — staged design-refine orchestrator.
 *
 * Runs up to five focused refine passes (font → palette → states → components
 * → typography) sequentially on a generated HTML page. Each pass is a small
 * LLM call that sees the previous pass's output and rewrites a single
 * dimension. Gated on `CANVAS_REFINE_PASSES` so the default pipeline stays
 * unchanged until we've benchmarked a canonical site and decided the cost is
 * worth it.
 *
 * Convention: `CANVAS_REFINE_PASSES` unset → no refine runs (opt-in). Setting
 * it to a comma list enables only those passes. Example:
 *   `CANVAS_REFINE_PASSES=font,palette,typography` → three passes, skips
 *   states and components. Use `=all` to enable every pass in canonical order.
 *
 * The opt-in default is deliberate: each pass is a full-page LLM call, so
 * five passes ~5× the existing single-shot generation time. We want the flag
 * explicit before flipping it on in production.
 */

import { getRouter, type ModelRouter } from "./router.js";
import { PROMPTS } from "./prompts.js";
import { NOOP_RUN, type PipelineRun } from "./logger.js";

export type RefinePass = "font" | "palette" | "states" | "components" | "typography";

export const REFINE_PASS_ORDER: RefinePass[] = [
  "font",
  "palette",
  "states",
  "components",
  "typography",
];

const PASS_PROMPTS: Record<RefinePass, string> = {
  font: PROMPTS.REFINE_FONT_SYSTEM,
  palette: PROMPTS.REFINE_PALETTE_SYSTEM,
  states: PROMPTS.REFINE_STATES_SYSTEM,
  components: PROMPTS.REFINE_COMPONENTS_SYSTEM,
  typography: PROMPTS.REFINE_TYPOGRAPHY_SYSTEM,
};

/**
 * Parse the `CANVAS_REFINE_PASSES` env value (or an arbitrary string) into a
 * de-duplicated list of passes in canonical order. Unknown names are dropped.
 * `all` is a sentinel that expands to the full canonical order.
 *
 * - undefined / "" → []
 * - "all" → all five passes
 * - "font, palette" → ["font", "palette"]
 * - "typography,font" → ["font", "typography"]  (always canonical order)
 * - "none" → []  (explicit opt-out keyword)
 */
export function parseRefinePasses(raw: string | undefined): RefinePass[] {
  if (!raw) return [];
  const trimmed = raw.trim().toLowerCase();
  if (trimmed === "" || trimmed === "none") return [];
  if (trimmed === "all") return [...REFINE_PASS_ORDER];
  const tokens = trimmed.split(",").map(t => t.trim()).filter(Boolean);
  const valid = new Set(REFINE_PASS_ORDER);
  const picked = new Set<RefinePass>();
  for (const tok of tokens) {
    if (valid.has(tok as RefinePass)) picked.add(tok as RefinePass);
  }
  return REFINE_PASS_ORDER.filter(p => picked.has(p));
}

/**
 * Read the configured refine passes from the env. Default (unset) = [].
 */
export function getRefinePasses(): RefinePass[] {
  if (typeof process === "undefined") return [];
  return parseRefinePasses(process.env?.CANVAS_REFINE_PASSES);
}

export interface StagedRefineOptions {
  /** Override env-configured passes (e.g. for tests or draft mode). */
  passes?: RefinePass[];
  /** Injected for unit tests; defaults to the shared router. */
  router?: ModelRouter;
}

export interface PassResult {
  pass: RefinePass;
  htmlLenBefore: number;
  htmlLenAfter: number;
  changed: boolean;
  durationMs: number;
}

export interface StagedRefineResult {
  html: string;
  passesRun: RefinePass[];
  perPass: PassResult[];
}

/**
 * Run the configured refine passes sequentially on `html`. Each pass sees the
 * previous pass's output. A pass that produces an empty or suspiciously-short
 * response is skipped (the prior HTML is kept).
 *
 * All logs go through `PipelineRun` so the `design_refine` stage line count is
 * visible in the per-project logger just like the other stages.
 */
export async function stagedRefineHtml(
  html: string,
  opts: StagedRefineOptions = {},
  logger?: PipelineRun,
): Promise<StagedRefineResult> {
  const log = logger ?? NOOP_RUN;
  const passes = opts.passes ?? getRefinePasses();
  const router = opts.router ?? getRouter();

  const result: StagedRefineResult = { html, passesRun: [], perPass: [] };
  if (passes.length === 0 || !html) {
    log.debug(`stagedRefine: no passes configured (CANVAS_REFINE_PASSES), skipping`);
    return result;
  }

  log.info(`stagedRefine: running ${passes.length} pass(es) → ${passes.join(" → ")}`);

  for (const pass of passes) {
    const started = Date.now();
    const before = result.html;
    try {
      const res = await router.routeJSON<{ html: string }>("design_refine", [
        { role: "system", content: PASS_PROMPTS[pass] },
        { role: "user", content: before },
      ], undefined, { timeoutMs: 5 * 60 * 1000 });
      const next = (res?.html ?? "").trim();
      const durationMs = Date.now() - started;
      if (!next || next.length < Math.min(800, Math.floor(before.length * 0.3))) {
        // A pass that drops >70% of the document or returns empty is almost
        // always a truncation / formatting error — keep the previous HTML.
        log.warn(`stagedRefine[${pass}]: response too short (${next.length}/${before.length} chars) — keeping prior HTML`);
        result.perPass.push({
          pass, htmlLenBefore: before.length, htmlLenAfter: before.length,
          changed: false, durationMs,
        });
        continue;
      }
      result.html = next;
      result.passesRun.push(pass);
      result.perPass.push({
        pass,
        htmlLenBefore: before.length,
        htmlLenAfter: next.length,
        changed: next !== before,
        durationMs,
      });
      log.info(`stagedRefine[${pass}]: ${before.length} → ${next.length} chars in ${durationMs}ms${next === before ? " (no-op)" : ""}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log.warn(`stagedRefine[${pass}] failed: ${msg} — keeping prior HTML`);
      result.perPass.push({
        pass, htmlLenBefore: before.length, htmlLenAfter: before.length,
        changed: false, durationMs: Date.now() - started,
      });
    }
  }

  return result;
}
