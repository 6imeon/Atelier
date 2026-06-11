/**
 * GSAP script validator — parses extracted <script> blocks with acorn and
 * checks for syntax errors, duplicate ScrollTrigger IDs, missing configs,
 * and dangerous patterns. Used by section-parser.ts to strip broken scripts
 * from generated output before the HTML ships to the browser.
 */

import { Parser } from "acorn";
import * as walk from "acorn-walk";

export interface ScriptValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  stats: {
    gsapCalls: number;      // count of gsap.to/from/set/timeline calls
    scrollTriggers: number; // count of ScrollTrigger.create calls + scrollTrigger: {} options
    triggerIds: string[];   // collected id: "..." strings
    hasPin: boolean;
    hasScrub: boolean;
  };
}

const NOOP_STATS = {
  gsapCalls: 0, scrollTriggers: 0, triggerIds: [], hasPin: false, hasScrub: false,
};

/**
 * Validate a single GSAP script. Returns detailed diagnostic info.
 * If `valid` is false, the caller should strip the script from the output
 * and log a warning.
 */
export function validateGsapScript(script: string): ScriptValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const stats = {
    gsapCalls: 0,
    scrollTriggers: 0,
    triggerIds: [] as string[],
    hasPin: false,
    hasScrub: false,
  };

  // 1. Parse — syntax errors are hard failures
  let ast: any;
  try {
    ast = Parser.parse(script, { ecmaVersion: 2022, sourceType: "script", allowReturnOutsideFunction: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { valid: false, errors: [`syntax error: ${msg}`], warnings, stats };
  }

  // 2. Walk the AST and collect stats
  walk.simple(ast, {
    CallExpression(node: any) {
      // gsap.to/from/set/timeline/fromTo
      if (
        node.callee?.type === "MemberExpression" &&
        node.callee.object?.name === "gsap" &&
        ["to", "from", "set", "timeline", "fromTo"].includes(node.callee.property?.name)
      ) {
        stats.gsapCalls++;
      }

      // ScrollTrigger.create({...})
      if (
        node.callee?.type === "MemberExpression" &&
        node.callee.object?.name === "ScrollTrigger" &&
        node.callee.property?.name === "create"
      ) {
        stats.scrollTriggers++;
        if (node.arguments?.[0]?.type === "ObjectExpression") {
          inspectTriggerOptions(node.arguments[0], stats);
        }
      }

      // scrollTrigger: { ... } inside gsap.timeline/to/etc.
      for (const arg of node.arguments ?? []) {
        if (arg?.type === "ObjectExpression") {
          for (const prop of arg.properties ?? []) {
            if (
              prop.type === "Property" &&
              ((prop.key?.name === "scrollTrigger") || (prop.key?.value === "scrollTrigger")) &&
              prop.value?.type === "ObjectExpression"
            ) {
              stats.scrollTriggers++;
              inspectTriggerOptions(prop.value, stats);
            }
          }
        }
      }
    },
  });

  // 3. Soft warnings for suspicious patterns (don't fail the script)
  if (/toggleActions:\s*['"][^'"]*reverse/.test(script)) {
    warnings.push("toggleActions contains 'reverse' — prone to disappearing content on scroll-back");
  }
  if (/once:\s*true/.test(script) && /scrub:\s*(true|\d)/.test(script)) {
    warnings.push("both once: true and scrub set — scrub takes precedence, once is ignored");
  }

  return { valid: errors.length === 0, errors, warnings, stats };
}

/**
 * Cross-validate a batch of scripts — detects duplicate ScrollTrigger IDs
 * across sections. Returns per-script results + global issues.
 */
export function validateGsapScriptBatch(scripts: string[]): {
  results: ScriptValidationResult[];
  duplicateIds: string[];
  totalScrollTriggers: number;
  totalGsapCalls: number;
} {
  const results = scripts.map(validateGsapScript);
  const idCounts = new Map<string, number>();
  for (const r of results) {
    for (const id of r.stats.triggerIds) {
      idCounts.set(id, (idCounts.get(id) ?? 0) + 1);
    }
  }
  const duplicateIds = [...idCounts.entries()].filter(([, n]) => n > 1).map(([id]) => id);
  const totalScrollTriggers = results.reduce((a, r) => a + r.stats.scrollTriggers, 0);
  const totalGsapCalls = results.reduce((a, r) => a + r.stats.gsapCalls, 0);
  return { results, duplicateIds, totalScrollTriggers, totalGsapCalls };
}

/**
 * Compute an 0–1 animation quality score from a batch validation result.
 * Used by design-critique.ts to surface an `animationQuality` dimension.
 *
 *   - Syntax valid ratio: 50%
 *   - Non-duplicate IDs: 20%
 *   - Has at least one ScrollTrigger: 15%
 *   - Warning-free: 15%
 */
export function computeAnimationQualityScore(batch: ReturnType<typeof validateGsapScriptBatch>): number {
  if (batch.results.length === 0) return 0;
  const validRatio = batch.results.filter(r => r.valid).length / batch.results.length;
  const noDupes = batch.duplicateIds.length === 0 ? 1 : 0;
  const hasAnyTrigger = batch.totalScrollTriggers > 0 ? 1 : 0;
  const totalWarnings = batch.results.reduce((a, r) => a + r.warnings.length, 0);
  const warningFree = totalWarnings === 0 ? 1 : Math.max(0, 1 - totalWarnings / 10);
  return validRatio * 0.5 + noDupes * 0.2 + hasAnyTrigger * 0.15 + warningFree * 0.15;
}

function inspectTriggerOptions(obj: any, stats: { triggerIds: string[]; hasPin: boolean; hasScrub: boolean }) {
  for (const prop of obj.properties ?? []) {
    if (prop.type !== "Property") continue;
    const key = prop.key?.name ?? prop.key?.value;
    if (key === "id" && prop.value?.type === "Literal" && typeof prop.value.value === "string") {
      stats.triggerIds.push(prop.value.value);
    }
    if (key === "pin" && prop.value?.type === "Literal" && prop.value.value === true) {
      stats.hasPin = true;
    }
    if (key === "scrub" && prop.value?.type === "Literal" && (prop.value.value === true || typeof prop.value.value === "number")) {
      stats.hasScrub = true;
    }
  }
}
