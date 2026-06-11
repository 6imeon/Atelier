/**
 * Rating System — Composite Score + ELO Engine
 *
 * Blends automated (UICrit), explicit human (stars/thumbs), and implicit
 * signals into a single 0-10 composite score per asset.
 *
 * Also provides ELO pairwise comparison functions for section template ranking.
 *
 * See docs/ratingsystem.md for full design rationale.
 */

import type { EloRating, SectionTemplate } from "../storage/interface.js";

export interface CompositeScore {
  automated: number;     // UICrit score (0-10), always available
  humanExplicit: number; // Wilson lower bound of star ratings (0-1)
  humanImplicit: number; // Weighted action score (0-1)
  composite: number;     // Final blended score (0-10)
  confidence: number;    // How reliable is this score? (0-1)
  ratingCount: number;   // Total explicit + implicit signals
}

/**
 * Wilson lower bound for a proportion.
 * Conservative estimate: returns the lower end of the confidence interval.
 * Prevents over-ranking items with few positive ratings.
 *
 * z = 1.96 for 95% confidence (standard)
 */
function wilsonLowerBound(positive: number, total: number, z = 1.96): number {
  if (total === 0) return 0;
  const p = positive / total;
  const denominator = 1 + z * z / total;
  const centre = p + z * z / (2 * total);
  const spread = z * Math.sqrt((p * (1 - p) + z * z / (4 * total)) / total);
  return (centre - spread) / denominator;
}

/**
 * Implicit action weight map.
 * Positive actions boost score, negative actions reduce it.
 */
const IMPLICIT_WEIGHTS: Record<string, number> = {
  exported: 1.0,
  kept: 0.5,
  edited: 0.3,
  variant_created: 0.0,
  regenerated: -0.3,
  deleted: -0.5,
};

/**
 * Compute a blended composite score from automated, explicit, and implicit signals.
 *
 * The blend shifts from automated → human as confidence grows:
 *   - 0 ratings:  100% auto
 *   - 20 ratings:  40% auto + 40% explicit + 20% implicit
 */
export function computeCompositeScore(
  autoScore: number,
  explicitRatings: number[],
  implicitActions: Array<{ action: string; weight?: number }>,
): CompositeScore {
  const automated = Math.max(0, Math.min(10, autoScore));

  // Explicit human ratings — Wilson lower bound
  const totalExplicit = explicitRatings.length;
  const positiveExplicit = explicitRatings.filter(r => r >= 4).length;
  const humanExplicit = totalExplicit > 0
    ? wilsonLowerBound(positiveExplicit, totalExplicit)
    : 0.5; // neutral prior

  // Implicit signal aggregation
  const totalImplicit = implicitActions.length;
  const implicitSum = implicitActions.reduce((sum, a) => {
    const w = a.weight ?? IMPLICIT_WEIGHTS[a.action] ?? 0;
    return sum + w;
  }, 0);
  const humanImplicit = totalImplicit > 0
    ? Math.max(0, Math.min(1, (implicitSum / totalImplicit + 0.5)))
    : 0.5; // neutral prior

  // Confidence ramps with data (saturates at 20 signals)
  const ratingCount = totalExplicit + totalImplicit;
  const confidence = Math.min(1.0, ratingCount / 20);

  // Blend: shift from auto → human as confidence grows
  const wAuto = 1.0 - confidence * 0.6;     // 1.0 → 0.4
  const wExplicit = confidence * 0.4;         // 0.0 → 0.4
  const wImplicit = confidence * 0.2;         // 0.0 → 0.2

  const composite = (
    wAuto * (automated / 10) +
    wExplicit * humanExplicit +
    wImplicit * humanImplicit
  ) * 10; // Scale back to 0-10

  return {
    automated,
    humanExplicit,
    humanImplicit,
    composite: Math.round(composite * 10) / 10,
    confidence: Math.round(confidence * 100) / 100,
    ratingCount,
  };
}

/**
 * Simple composite score from just positive/negative counts + auto score.
 * Used for quick recalculation when a single vote comes in.
 */
export function quickCompositeScore(
  autoScore: number,
  positiveRatings: number,
  negativeRatings: number,
): number {
  const total = positiveRatings + negativeRatings;
  if (total === 0) return autoScore;

  const wilson = wilsonLowerBound(positiveRatings, total);
  const confidence = Math.min(1.0, total / 20);
  const wAuto = 1.0 - confidence * 0.6;
  const wHuman = confidence * 0.6;

  return Math.round((wAuto * (autoScore / 10) + wHuman * wilson) * 100) / 10;
}

// ─── ELO Pairwise Comparison System ───

const K_BASE = 32; // K-factor: how much a single match moves ratings

/** Default ELO rating for new templates/components */
export const DEFAULT_ELO: EloRating = { rating: 1500, matches: 0, wins: 0, sigma: 350 };

/**
 * Update ELO ratings after a pairwise comparison where one template wins.
 * Returns new ratings for both (does not mutate inputs).
 */
export function updateElo(
  winner: EloRating,
  loser: EloRating,
): { winner: EloRating; loser: EloRating } {
  const expectedWin = 1 / (1 + Math.pow(10, (loser.rating - winner.rating) / 400));
  const expectedLose = 1 - expectedWin;

  // Adaptive K: new templates (few matches) move faster
  const kWinner = winner.matches < 10 ? K_BASE * 2 : K_BASE;
  const kLoser = loser.matches < 10 ? K_BASE * 2 : K_BASE;

  return {
    winner: {
      rating: winner.rating + kWinner * (1 - expectedWin),
      matches: winner.matches + 1,
      wins: winner.wins + 1,
      sigma: Math.max(50, winner.sigma * 0.95),
    },
    loser: {
      rating: loser.rating + kLoser * (0 - expectedLose),
      matches: loser.matches + 1,
      wins: loser.wins,
      sigma: Math.max(50, loser.sigma * 0.95),
    },
  };
}

/**
 * Update ELO ratings for a draw ("can't decide / both fine").
 * Both templates get a slight adjustment toward each other.
 */
export function updateEloDraw(
  a: EloRating,
  b: EloRating,
): { a: EloRating; b: EloRating } {
  const expected = 1 / (1 + Math.pow(10, (b.rating - a.rating) / 400));
  return {
    a: {
      rating: a.rating + (K_BASE / 2) * (0.5 - expected),
      matches: a.matches + 1,
      wins: a.wins,
      sigma: Math.max(50, a.sigma * 0.95),
    },
    b: {
      rating: b.rating + (K_BASE / 2) * (0.5 - (1 - expected)),
      matches: b.matches + 1,
      wins: b.wins,
      sigma: Math.max(50, b.sigma * 0.95),
    },
  };
}

/**
 * Active learning: select the most informative pair for comparison.
 *
 * Strategy: pick the template with highest uncertainty (fewest matches)
 * and pair it against the template closest in ELO (most informative).
 * Randomize left/right to avoid position bias.
 */
export function selectPairForComparison(
  templates: SectionTemplate[],
  sectionType: string,
): [SectionTemplate, SectionTemplate] {
  const pool = templates.filter(t => t.type === sectionType);
  if (pool.length < 2) throw new Error(`Need at least 2 ${sectionType} templates for comparison`);

  // Pick template with fewest matches (most uncertain)
  pool.sort((a, b) => a.elo.matches - b.elo.matches);
  const uncertain = pool[0];

  // Find template closest in ELO (most informative opponent)
  const others = pool.filter(t => t !== uncertain);
  others.sort((a, b) =>
    Math.abs(a.elo.rating - uncertain.elo.rating) -
    Math.abs(b.elo.rating - uncertain.elo.rating)
  );
  const opponent = others[0];

  // Randomize left/right to avoid position bias
  return Math.random() < 0.5
    ? [uncertain, opponent]
    : [opponent, uncertain];
}

/**
 * Get ELO leaderboard for a section type, sorted by rating descending.
 */
export function eloLeaderboard(
  templates: SectionTemplate[],
  sectionType: string,
  limit = 10,
): Array<{ type: string; style?: string; rating: number; matches: number; wins: number }> {
  return templates
    .filter(t => t.type === sectionType && t.elo.matches > 0)
    .sort((a, b) => b.elo.rating - a.elo.rating)
    .slice(0, limit)
    .map(t => ({
      type: t.type,
      style: t.style,
      rating: Math.round(t.elo.rating),
      matches: t.elo.matches,
      wins: t.elo.wins,
    }));
}

// ─── Thompson Sampling ───

/**
 * Sample from a Beta(alpha, beta) distribution using the Joehnk method.
 * Pure JS, no external deps.
 */
function betaSample(alpha: number, beta: number): number {
  // Use gamma sampling: Beta(a,b) = Ga(a) / (Ga(a) + Ga(b))
  const ga = gammaSample(alpha);
  const gb = gammaSample(beta);
  return ga / (ga + gb);
}

/** Sample from Gamma(shape, 1) using Marsaglia & Tsang's method */
function gammaSample(shape: number): number {
  if (shape < 1) {
    // Boost: Gamma(a) = Gamma(a+1) * U^(1/a)
    return gammaSample(shape + 1) * Math.pow(Math.random(), 1 / shape);
  }
  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  for (;;) {
    let x: number, v: number;
    do {
      x = randn();
      v = 1 + c * x;
    } while (v <= 0);
    v = v * v * v;
    const u = Math.random();
    if (u < 1 - 0.0331 * (x * x) * (x * x)) return d * v;
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
}

/** Standard normal via Box-Muller */
function randn(): number {
  const u1 = Math.random();
  const u2 = Math.random();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

/**
 * Select `limit` templates from candidates using Thompson Sampling.
 *
 * Each template is sampled from Beta(positiveRatings+1, negativeRatings+1).
 * Templates with ELO data get a boost proportional to their normalized ELO.
 * Returns the top `limit` by sampled value.
 */
export function thompsonSelect(
  candidates: SectionTemplate[],
  limit: number,
): SectionTemplate[] {
  if (candidates.length <= limit) return candidates;

  const scored = candidates.map(t => {
    // Beta distribution from thumbs ratings
    const alpha = t.positiveRatings + 1; // +1 uniform prior
    const beta = t.negativeRatings + 1;
    let sample = betaSample(alpha, beta);

    // Blend in ELO signal if available (normalized to 0-1 range)
    if (t.elo.matches > 0) {
      const eloNorm = Math.max(0, Math.min(1, (t.elo.rating - 1200) / 600)); // 1200-1800 → 0-1
      const eloWeight = Math.min(0.4, t.elo.matches / 50); // ramp up to 40% with matches
      sample = sample * (1 - eloWeight) + eloNorm * eloWeight;
    }

    return { template: t, sample };
  });

  scored.sort((a, b) => b.sample - a.sample);
  return scored.slice(0, limit).map(s => s.template);
}

/**
 * Wilson lower bound for ranking with sparse binary ratings.
 * Exported for use in template/component sorting.
 */
export { wilsonLowerBound };

// ─── ELO Rating Decay ───

/**
 * Apply decay to stale ELO ratings.
 * Templates not compared in `staleDays` get their sigma increased,
 * making them eligible for re-evaluation via active learning.
 *
 * Returns the number of templates that were decayed.
 */
export function decayStaleElo(
  templates: Array<{ elo: EloRating; updatedAt?: string }>,
  staleDays = 60,
): number {
  const cutoff = Date.now() - staleDays * 24 * 60 * 60 * 1000;
  let decayed = 0;

  for (const t of templates) {
    if (!t.updatedAt) continue;
    const lastUpdated = new Date(t.updatedAt).getTime();
    if (lastUpdated < cutoff && t.elo.sigma < 300) {
      // Increase uncertainty — template needs re-evaluation
      t.elo.sigma = Math.min(350, t.elo.sigma * 1.5);
      decayed++;
    }
  }

  return decayed;
}
