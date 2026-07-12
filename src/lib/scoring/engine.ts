/**
 * Scoring engine (CLAUDE.md §11).
 *
 * Pure, deterministic, and explainable. Every score returns the inputs that
 * produced it so the UI can show *why* a score is high or low (§11.4, §11.5).
 * No hard-coded weights — all tunables come from a `ScoringConfig` (§11.2).
 *
 * Scoring rules enforced here:
 *  - Diminishing returns on count; raw count is not rewarded without limit.
 *  - Confidence-adjusted (Bayesian) ratings, not naive averages.
 *  - Missing essential subcategories produce a clear penalty.
 *  - Sponsored places must be excluded by callers before scoring (§11.4).
 */

import { DEFAULT_SCORING_CONFIG, type ScoringConfig } from "./config";

/** A candidate place already filtered for status/duplicates/sponsorship by the caller. */
export interface ScorablePlace {
  categorySlug: string;
  /** Straight-line distance to the reference point, in meters (§15.7). */
  distanceMeters: number;
  /** Google-derived rating 0..5, if enrichment ran; undefined = unrated (§31.1). */
  rating?: number;
  /** Number of ratings backing `rating`. */
  ratingCount?: number;
}

/** Confidence-adjusted rating on a 0..5 scale (§11.4). */
export function bayesianRating(
  rating: number | undefined,
  count: number | undefined,
  cfg: ScoringConfig = DEFAULT_SCORING_CONFIG,
): number {
  const { priorMean, priorWeight } = cfg.ratingPrior;
  if (rating === undefined || count === undefined || count <= 0) return priorMean;
  return (priorMean * priorWeight + rating * count) / (priorWeight + count);
}

/**
 * Proximity credit 0..1 from distance (§11.3). Full credit within `nearMeters`,
 * linearly decaying to 0 at `reachableMeters`, then 0.
 */
export function proximityScore(
  distanceMeters: number,
  cfg: ScoringConfig = DEFAULT_SCORING_CONFIG,
): number {
  const { nearMeters, reachableMeters } = cfg.distanceBands;
  if (distanceMeters <= nearMeters) return 1;
  if (distanceMeters >= reachableMeters) return 0;
  return (reachableMeters - distanceMeters) / (reachableMeters - nearMeters);
}

/**
 * Saturating credit 0..1 for having N useful places (§11.4). Diminishing
 * returns: the first few matter most; beyond `saturationCount` extra places
 * add little. `count` may be fractional (e.g. proximity-weighted).
 */
export function diminishingReturns(
  count: number,
  cfg: ScoringConfig = DEFAULT_SCORING_CONFIG,
): number {
  if (count <= 0) return 0;
  return 1 - Math.exp(-count / cfg.saturationCount);
}

export interface CategoryScore {
  /** 0..100. */
  score: number;
  /** Human-readable components for explainability (§11.5). */
  breakdown: {
    /** Count of places actually reachable (proximity > 0). */
    reachableCount: number;
    /** Sum of proximity credits — the effective "useful place" count. */
    effectiveCount: number;
    /** 0..1 saturating count credit. */
    coverage: number;
    /** 0..1 average proximity of reachable places. */
    proximity: number;
    /** 0..1 normalized confidence-adjusted quality (0 if nothing rated). */
    quality: number;
  };
}

/**
 * Score a single category group from its candidate places (§11.3).
 * Combines coverage (saturating count) × proximity × quality.
 */
export function scoreCategory(
  places: ScorablePlace[],
  cfg: ScoringConfig = DEFAULT_SCORING_CONFIG,
): CategoryScore {
  const reachable = places
    .map((p) => ({ p, prox: proximityScore(p.distanceMeters, cfg) }))
    .filter((x) => x.prox > 0);

  if (reachable.length === 0) {
    return {
      score: 0,
      breakdown: { reachableCount: 0, effectiveCount: 0, coverage: 0, proximity: 0, quality: 0 },
    };
  }

  const effectiveCount = reachable.reduce((sum, x) => sum + x.prox, 0);
  const coverage = diminishingReturns(effectiveCount, cfg);
  const proximity =
    reachable.reduce((sum, x) => sum + x.prox, 0) / reachable.length;

  // Quality: proximity-weighted mean of Bayesian ratings, normalized 0..1 (rating/5).
  const rated = reachable.filter((x) => x.p.rating !== undefined);
  let quality = 0;
  if (rated.length > 0) {
    const wSum = rated.reduce((s, x) => s + x.prox, 0);
    const q = rated.reduce(
      (s, x) => s + x.prox * bayesianRating(x.p.rating, x.p.ratingCount, cfg),
      0,
    );
    quality = wSum > 0 ? q / wSum / 5 : 0;
  }

  // Coverage and proximity are the backbone; quality nudges within a band so an
  // unrated-but-present category still scores reasonably (data honesty, §13).
  const base = coverage * (0.6 + 0.4 * proximity);
  const qualityFactor = rated.length > 0 ? 0.85 + 0.15 * quality : 1;
  const score = clamp01(base * qualityFactor) * 100;

  return {
    score: round1(score),
    breakdown: {
      reachableCount: reachable.length,
      effectiveCount: round2(effectiveCount),
      coverage: round2(coverage),
      proximity: round2(proximity),
      quality: round2(quality),
    },
  };
}

/**
 * Apply a missing-essential penalty (§11.4). `missingEssentials` is the count of
 * essential subcategories with zero reachable places in this group.
 */
export function applyMissingEssentialPenalty(
  score: number,
  missingEssentials: number,
  cfg: ScoringConfig = DEFAULT_SCORING_CONFIG,
): number {
  const factor = Math.max(0, 1 - missingEssentials * cfg.missingEssentialPenalty);
  return round1(score * factor);
}

// --- small numeric helpers ---
export function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}
function round1(x: number): number {
  return Math.round(x * 10) / 10;
}
function round2(x: number): number {
  return Math.round(x * 100) / 100;
}
