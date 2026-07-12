/**
 * Scoring configuration (CLAUDE.md §11).
 *
 * Weights and tunables live HERE, in versioned config — never hard-coded into
 * scoring logic (§11.2, §28). Every score records the `version` string so
 * reports are reproducible and score changes are explainable over time (§28).
 *
 * `WeightKey` intentionally differs from the taxonomy's `ScoreGroup`:
 *  - "business_quality" is a derived cross-category quality dimension, not a
 *    place category.
 *  - "personal_household" is a taxonomy group but carries no default weight yet.
 */

export type WeightKey =
  | "daily_essentials"
  | "health_wellbeing"
  | "transport_mobility"
  | "family_education"
  | "food_social"
  | "fitness_recreation"
  | "business_quality"
  | "pet_services"
  | "late_hour_convenience";

export interface ScoringConfig {
  /** Bump on any change to weights or algorithm behavior. */
  version: string;
  /** Default category weights — MUST sum to 1.0 (§11.2). */
  weights: Record<WeightKey, number>;
  /** Straight-line distance bands in meters (MVP; not real walk time — §15.7). */
  distanceBands: {
    /** Full proximity credit within this radius. */
    nearMeters: number;
    /** Partial credit out to here; zero credit beyond. */
    reachableMeters: number;
  };
  /** Diminishing-returns knee: count at which extra places stop helping much (§11.4). */
  saturationCount: number;
  /** Bayesian rating prior (§11.4, §11 quality): confidence-adjusted ratings. */
  ratingPrior: {
    /** Assumed mean rating for a place with no/few reviews. */
    priorMean: number;
    /** Strength of the prior, in "virtual" reviews. */
    priorWeight: number;
  };
  /** Penalty (0..1 multiplier) applied per missing essential subcategory (§11.4). */
  missingEssentialPenalty: number;
}

export const DEFAULT_SCORING_CONFIG: ScoringConfig = {
  version: "score-2026.07.0",
  weights: {
    daily_essentials: 0.2,
    health_wellbeing: 0.15,
    transport_mobility: 0.15,
    family_education: 0.1,
    food_social: 0.1,
    fitness_recreation: 0.1,
    business_quality: 0.1,
    pet_services: 0.05,
    late_hour_convenience: 0.05,
  },
  distanceBands: {
    nearMeters: 400,
    reachableMeters: 1200,
  },
  saturationCount: 4,
  ratingPrior: {
    priorMean: 3.5,
    priorWeight: 20,
  },
  missingEssentialPenalty: 0.15,
};

/** Assert weights sum to ~1.0 — guards against a bad config edit. */
export function validateScoringConfig(cfg: ScoringConfig): void {
  const sum = Object.values(cfg.weights).reduce((a, b) => a + b, 0);
  if (Math.abs(sum - 1) > 1e-6) {
    throw new Error(
      `Scoring weights must sum to 1.0 (got ${sum.toFixed(4)}) in config ${cfg.version}`,
    );
  }
}
