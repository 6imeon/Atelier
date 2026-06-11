/**
 * Structured pipeline logger for generation runs.
 *
 * Each generation creates a PipelineRun instance that tracks elapsed time
 * and prints structured, readable logs with phase boundaries and timing.
 *
 * Output format:
 *   [00:00] ── FETCH ─────────────────────
 *   [00:05]   Success: 215,728 chars HTML
 *   [00:07] ── GENERATE (batch 1/3) ──────
 *   [00:07]   ├─ [1] Navigation (nav) → kimi-k2.5, 33K prompt
 *   [00:12]   ├─ [2] OK Hero: 6,327 chars (5s)
 *   [01:45] ── DONE (1m 45s) ─────────────
 */

const isDebug = () =>
  typeof process !== "undefined" &&
  process.env?.CANVAS_LOG_LEVEL === "debug";

function elapsed(startMs: number): string {
  const s = Math.floor((Date.now() - startMs) / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

function formatDuration(startMs: number): string {
  const totalSec = Math.floor((Date.now() - startMs) / 1000);
  if (totalSec < 60) return `${totalSec}s`;
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

const BANNER_WIDTH = 40;

export class PipelineRun {
  private startMs: number;

  constructor() {
    this.startMs = Date.now();
  }

  /** Print a phase banner: [00:05] ── PLAN ────────────── */
  phase(name: string, detail?: string): void {
    const tag = detail ? `${name} (${detail})` : name;
    const pad = Math.max(0, BANNER_WIDTH - tag.length - 5);
    console.log(`[${elapsed(this.startMs)}] ── ${tag} ${"─".repeat(pad)}`);
  }

  /** Info-level log with timestamp */
  info(msg: string): void {
    console.log(`[${elapsed(this.startMs)}]   ${msg}`);
  }

  /** Warning-level log with timestamp */
  warn(msg: string): void {
    console.warn(`[${elapsed(this.startMs)}]   ??? ${msg}`);
  }

  /** Error-level log with timestamp */
  error(msg: string): void {
    console.error(`[${elapsed(this.startMs)}]   !!! ${msg}`);
  }

  /** Debug log — only prints when CANVAS_LOG_LEVEL=debug */
  debug(msg: string): void {
    if (isDebug()) {
      console.log(`[${elapsed(this.startMs)}]   . ${msg}`);
    }
  }

  /** Log start of a parallel task: ├─ [1] Navigation (nav) → kimi-k2.5 */
  task(index: number, label: string): void {
    console.log(`[${elapsed(this.startMs)}]   ├─ [${index}] ${label}`);
  }

  /** Log successful completion of a parallel task */
  taskDone(index: number, label: string, detail: string): void {
    console.log(`[${elapsed(this.startMs)}]   ├─ [${index}] OK ${label}: ${detail}`);
  }

  /** Log warning for a parallel task */
  taskWarn(index: number, label: string, detail: string): void {
    console.warn(`[${elapsed(this.startMs)}]   ├─ [${index}] ??? ${label}: ${detail}`);
  }

  /** Log failure of a parallel task */
  taskError(index: number, label: string, detail: string): void {
    console.error(`[${elapsed(this.startMs)}]   ├─ [${index}] !!! ${label}: ${detail}`);
  }

  /** Print final done banner with total elapsed */
  done(): void {
    const dur = formatDuration(this.startMs);
    const pad = Math.max(0, BANNER_WIDTH - dur.length - 9);
    console.log(`[${elapsed(this.startMs)}] ── DONE (${dur}) ${"─".repeat(pad)}`);
  }
}

/** No-op logger — all methods are silent. Use when no logger is provided. */
export const NOOP_RUN: PipelineRun = new Proxy({} as PipelineRun, {
  get(_target, prop) {
    if (typeof prop === "string") {
      return () => {};
    }
    return undefined;
  },
});

/** Create a new PipelineRun instance */
export function createPipelineRun(): PipelineRun {
  return new PipelineRun();
}
