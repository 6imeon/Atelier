/**
 * Typographic Scale System
 *
 * Maps Aaker brand personality dimensions to typographic ratios and generates
 * concrete pixel values for injection into AI generation prompts.
 *
 * Based on classical musical interval ratios:
 *   Sincerity     -> 1.200  Minor Third    (friendly, readable)
 *   Excitement    -> 1.333  Perfect Fourth  (dynamic, impactful)
 *   Competence    -> 1.250  Major Third     (balanced, professional)
 *   Sophistication-> 1.414  Augmented Fourth(elegant, spacious)
 *   Ruggedness    -> 1.125  Major Second    (dense, utilitarian)
 */
import type { AakerVector } from "./personas.js";

// ─── Types ─────────────────────────────────────────────────────────

export interface TypeScale {
  /** The blended ratio derived from the Aaker vector */
  ratio: number;
  /** Base font size in px */
  basePx: number;
  /** Named size steps mapped to rounded px values */
  sizes: {
    xs: number;
    sm: number;
    base: number;
    lg: number;
    xl: number;
    "2xl": number;
    "3xl": number;
    "4xl": number;
  };
  /** Recommended unitless line-height per size step */
  lineHeights: {
    xs: number;
    sm: number;
    base: number;
    lg: number;
    xl: number;
    "2xl": number;
    "3xl": number;
    "4xl": number;
  };
  /** Recommended max line length in ch units */
  measureCh: number;
}

// ─── Constants ─────────────────────────────────────────────────────

/** Musical-interval ratios mapped to each Aaker dimension */
const DIMENSION_RATIOS: [number, number, number, number, number] = [
  1.200, // Sincerity   — Minor Third
  1.333, // Excitement  — Perfect Fourth
  1.250, // Competence  — Major Third
  1.414, // Sophistication — Augmented Fourth
  1.125, // Ruggedness  — Major Second
];

/** Default base size when none is provided */
const DEFAULT_BASE_PX = 16;

/**
 * Line-height curve: large text gets tighter leading, small text gets looser.
 * Values are unitless multipliers keyed by step index (0 = xs, 7 = 4xl).
 * These are base values; sophisticated/sincere brands shift the curve.
 */
const BASE_LINE_HEIGHTS = [1.65, 1.6, 1.55, 1.45, 1.35, 1.25, 1.2, 1.15];

/**
 * Measure sweet spot is ~66ch. Personality pushes it:
 *   Rugged/dense   -> shorter lines (~58ch)
 *   Sophisticated   -> wider lines (~72ch)
 *   Excitement      -> moderate (~64ch)
 *   Sincerity       -> slightly wider (~68ch, readability)
 *   Competence      -> right at 66ch
 */
const MEASURE_OFFSETS: [number, number, number, number, number] = [
  2,   // Sincerity: +2ch  (readability)
  -2,  // Excitement: -2ch (punchy)
  0,   // Competence: neutral
  6,   // Sophistication: +6ch (airy)
  -8,  // Ruggedness: -8ch (dense)
];

// ─── Core ──────────────────────────────────────────────────────────

/**
 * Compute a full typographic scale from an Aaker brand personality vector.
 *
 * @param aakerVector 5D vector [Sincerity, Excitement, Competence, Sophistication, Ruggedness]
 *                    Each component in [0, 1].
 * @param baseSizePx  Optional base font size in pixels (default 16).
 * @returns A TypeScale object with concrete px values and line-heights.
 */
export function computeTypographicScale(
  aakerVector: AakerVector,
  baseSizePx: number = DEFAULT_BASE_PX,
): TypeScale {
  // 1. Weighted blend of ratios
  let weightedSum = 0;
  let totalWeight = 0;
  for (let i = 0; i < 5; i++) {
    const w = aakerVector[i];
    weightedSum += DIMENSION_RATIOS[i] * w;
    totalWeight += w;
  }
  const ratio = totalWeight > 0 ? weightedSum / totalWeight : 1.250;

  // 2. Generate size steps: base is step 0, steps go -2..+5
  //    xs = base / ratio^2, sm = base / ratio, base, lg = base * ratio, ...
  const stepIndices = [-2, -1, 0, 1, 2, 3, 4, 5];
  const pxValues = stepIndices.map(step =>
    Math.round(baseSizePx * Math.pow(ratio, step)),
  );

  // 3. Line heights — shift curve based on personality
  //    More sophisticated -> slightly more generous leading
  //    More rugged -> tighter
  const lhShift =
    (aakerVector[3] - 0.5) * 0.06 + // sophistication pushes looser
    (aakerVector[0] - 0.5) * 0.04 - // sincerity pushes slightly looser
    (aakerVector[4] - 0.5) * 0.06;  // ruggedness pushes tighter

  const lineHeightValues = BASE_LINE_HEIGHTS.map(lh =>
    Math.round((lh + lhShift) * 100) / 100,
  );

  // 4. Measure (max line length in ch)
  let measureOffset = 0;
  for (let i = 0; i < 5; i++) {
    measureOffset += MEASURE_OFFSETS[i] * aakerVector[i];
  }
  const measureCh = Math.round(66 + measureOffset / totalWeight);

  // 5. Assemble
  const sizeKeys = ["xs", "sm", "base", "lg", "xl", "2xl", "3xl", "4xl"] as const;

  const sizes = {} as TypeScale["sizes"];
  const lineHeights = {} as TypeScale["lineHeights"];
  for (let i = 0; i < sizeKeys.length; i++) {
    sizes[sizeKeys[i]] = pxValues[i];
    lineHeights[sizeKeys[i]] = lineHeightValues[i];
  }

  return { ratio: Math.round(ratio * 1000) / 1000, basePx: baseSizePx, sizes, lineHeights, measureCh };
}

// ─── Prompt Formatting ─────────────────────────────────────────────

/**
 * Format a TypeScale into a plain-text block suitable for injection
 * into an AI system prompt. The AI reads these values and applies
 * them when generating HTML.
 */
export function formatScaleForPrompt(scale: TypeScale): string {
  const s = scale.sizes;
  const lh = scale.lineHeights;
  return `TYPOGRAPHIC SCALE (use these exact sizes for consistent rhythm):
- Scale ratio: ${scale.ratio} | Base: ${scale.basePx}px
- Sizes:  xs=${s.xs}px  sm=${s.sm}px  base=${s.base}px  lg=${s.lg}px  xl=${s.xl}px  2xl=${s["2xl"]}px  3xl=${s["3xl"]}px  4xl=${s["4xl"]}px
- Line-heights:  xs=${lh.xs}  sm=${lh.sm}  base=${lh.base}  lg=${lh.lg}  xl=${lh.xl}  2xl=${lh["2xl"]}  3xl=${lh["3xl"]}  4xl=${lh["4xl"]}
- Max line length: ${scale.measureCh}ch (set max-width on paragraphs)
- Use 4xl for hero headings, 3xl for section headings, 2xl for sub-headings, xl for card titles, lg for lead text, base for body, sm for captions, xs for labels/overlines.`;
}
