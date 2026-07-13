/**
 * Neighborhood-level score aggregation (CLAUDE.md §11.1, §13, §19.3, §29 step 8).
 *
 * Turns a bag of scored places into a full report: an overall Neighborhood Life
 * Score, per-dimension category scores, missing-essential analysis, a Data
 * Confidence Score, and plain-language strengths/weaknesses. Pure, deterministic
 * and explainable — the same inputs always produce the same report, and every
 * number carries the breakdown that produced it (§11.4, §11.5, §28).
 *
 * Weighting rules (reconciling taxonomy ScoreGroups with config WeightKeys):
 *  - Seven place-based groups map 1:1 to a weight and are always "available"
 *    (even a 0 score is a real signal that coverage is poor).
 *  - `business_quality` is a derived cross-category dimension with no group; it
 *    is only available once rating enrichment has run for some places (§11.3).
 *  - `late_hour_convenience` is derived from operating hours, which the OSM
 *    baseline lacks, so it is unavailable in the MVP rather than scored 0 (§13).
 *  - `personal_household` is a taxonomy group with no weight; scored for display
 *    only, excluded from the weighted overall (matches the config comment).
 *
 * Unavailable dimensions are excluded and their weight is redistributed across
 * the available ones, so the overall score never silently penalizes for data we
 * don't have — the missing coverage is reported via the Confidence Score instead.
 */

import {
  applyMissingEssentialPenalty,
  bayesianRating,
  proximityScore,
  scoreCategory,
  type CategoryScore,
  type ScorablePlace,
} from "./engine";
import { DEFAULT_SCORING_CONFIG, type ScoringConfig, type WeightKey } from "./config";
import {
  essentialCategoriesInGroup,
  getCategory,
  scoreGroupNameTr,
  categoryNameTr,
  type ScoreGroup,
} from "@/lib/taxonomy/categories";
import { WEIGHT_LABEL_TR, CONFIDENCE_LABEL_TR, scoreBandTr } from "@/lib/i18n/tr";

/** WeightKey → the ScoreGroup that feeds it, or null for derived dimensions. */
const WEIGHT_GROUP: Record<WeightKey, ScoreGroup | null> = {
  daily_essentials: "daily_essentials",
  health_wellbeing: "health_wellbeing",
  transport_mobility: "transport_mobility",
  family_education: "family_education",
  food_social: "food_social",
  fitness_recreation: "fitness_recreation",
  pet_services: "pet_services",
  late_hour_convenience: "late_hour_convenience",
  business_quality: null,
};

export interface DimensionScore {
  weightKey: WeightKey;
  /** Display label. */
  name: string;
  /** 0..100 after any missing-essential penalty; null when unavailable. */
  score: number | null;
  /** Configured weight before redistribution. */
  weight: number;
  /** False for dimensions we cannot honestly score yet (§13). */
  available: boolean;
  /** Human names of essential subcategories with no reachable place. */
  missingEssentials: string[];
  /** Present for place-based dimensions; explains the score (§11.5). */
  breakdown?: CategoryScore["breakdown"];
}

export type ConfidenceLabel = "high" | "good" | "limited" | "experimental";

export interface ConfidenceScore {
  score: number; // 0..100
  label: ConfidenceLabel;
  inputs: {
    essentialCoverage: number; // 0..1
    dimensionAvailability: number; // 0..1
    volumeAdequacy: number; // 0..1
    reachablePlaceCount: number;
  };
}

export interface NeighborhoodScore {
  overall: number; // 0..100
  scoringVersion: string;
  dimensions: DimensionScore[];
  confidence: ConfidenceScore;
  /** Extra, non-weighted dimensions shown for context (e.g. personal_household). */
  contextDimensions: DimensionScore[];
  strengths: string[];
  weaknesses: string[];
  missingServices: string[];
  summary: string;
}

/** Places counted as reachable for a category (proximity > 0). */
function reachableInGroup(places: ScorablePlace[], cfg: ScoringConfig) {
  return places.filter((p) => proximityScore(p.distanceMeters, cfg) > 0);
}

function missingEssentialNames(
  group: ScoreGroup,
  placesInGroup: ScorablePlace[],
  cfg: ScoringConfig,
): string[] {
  const reachableSlugs = new Set(
    reachableInGroup(placesInGroup, cfg).map((p) => p.categorySlug),
  );
  return essentialCategoriesInGroup(group)
    .filter((c) => !reachableSlugs.has(c.slug))
    .map((c) => categoryNameTr(c.slug));
}

/** Score one place-based ScoreGroup, applying the missing-essential penalty. */
function scoreGroup(
  group: ScoreGroup,
  placesInGroup: ScorablePlace[],
  cfg: ScoringConfig,
): { score: number; missingEssentials: string[]; breakdown: CategoryScore["breakdown"] } {
  const base = scoreCategory(placesInGroup, cfg);
  const missing = missingEssentialNames(group, placesInGroup, cfg);
  const penalized = applyMissingEssentialPenalty(base.score, missing.length, cfg);
  return { score: penalized, missingEssentials: missing, breakdown: base.breakdown };
}

/**
 * Derived cross-category business-quality dimension (§11.3, §11.2). Normalizes
 * the proximity-weighted Bayesian rating of all reachable rated places to 0..100.
 * Unavailable when no place has been rating-enriched — we never invent quality.
 */
function businessQualityDimension(
  places: ScorablePlace[],
  weight: number,
  cfg: ScoringConfig,
): DimensionScore {
  const reachableRated = places
    .map((p) => ({ p, prox: proximityScore(p.distanceMeters, cfg) }))
    .filter((x) => x.prox > 0 && x.p.rating !== undefined);

  if (reachableRated.length === 0) {
    return {
      weightKey: "business_quality",
      name: WEIGHT_LABEL_TR.business_quality,
      score: null,
      weight,
      available: false,
      missingEssentials: [],
    };
  }
  const wSum = reachableRated.reduce((s, x) => s + x.prox, 0);
  const weighted = reachableRated.reduce(
    (s, x) => s + x.prox * bayesianRating(x.p.rating, x.p.ratingCount, cfg),
    0,
  );
  const score = round1((weighted / wSum / 5) * 100);
  return {
    weightKey: "business_quality",
    name: "Business quality and reliability",
    score,
    weight,
    available: true,
    missingEssentials: [],
  };
}

/**
 * Compute a full neighborhood report from places already filtered for status,
 * duplicates and sponsorship by the caller (§11.4). Places with a category slug
 * outside the taxonomy are ignored.
 */
export function scoreNeighborhood(
  places: ScorablePlace[],
  weights: Record<WeightKey, number>,
  cfg: ScoringConfig = DEFAULT_SCORING_CONFIG,
): NeighborhoodScore {
  // Bucket places by their score group via the taxonomy.
  const byGroup = new Map<ScoreGroup, ScorablePlace[]>();
  for (const p of places) {
    const cat = getCategory(p.categorySlug);
    if (!cat) continue; // unknown/unmapped slug — ignore
    const bucket = byGroup.get(cat.scoreGroup) ?? [];
    bucket.push(p);
    byGroup.set(cat.scoreGroup, bucket);
  }
  const groupPlaces = (g: ScoreGroup) => byGroup.get(g) ?? [];

  // Build the weighted dimensions.
  const dimensions: DimensionScore[] = [];
  for (const weightKey of Object.keys(weights) as WeightKey[]) {
    const weight = weights[weightKey];
    const group = WEIGHT_GROUP[weightKey];

    if (weightKey === "business_quality") {
      dimensions.push(businessQualityDimension(places, weight, cfg));
      continue;
    }
    if (weightKey === "late_hour_convenience") {
      // Derived from operating hours — not in the OSM baseline (§13).
      dimensions.push({
        weightKey,
        name: WEIGHT_LABEL_TR.late_hour_convenience,
        score: null,
        weight,
        available: false,
        missingEssentials: [],
      });
      continue;
    }
    // Remaining keys are 1:1 with a place-based group.
    const g = group as ScoreGroup;
    const gp = groupPlaces(g);
    const { score, missingEssentials, breakdown } = scoreGroup(g, gp, cfg);
    dimensions.push({
      weightKey,
      name: WEIGHT_LABEL_TR[weightKey],
      score,
      weight,
      available: true,
      missingEssentials,
      breakdown,
    });
  }

  // Weighted overall over AVAILABLE dimensions only, weights renormalized so
  // unavailable dimensions neither help nor hurt (§13).
  const available = dimensions.filter((d) => d.available && d.score !== null);
  const availWeight = available.reduce((s, d) => s + d.weight, 0);
  const overall =
    availWeight > 0
      ? round1(available.reduce((s, d) => s + d.weight * (d.score as number), 0) / availWeight)
      : 0;

  // personal_household: scored for context, never weighted into the overall.
  const phPlaces = groupPlaces("personal_household");
  const ph = scoreGroup("personal_household", phPlaces, cfg);
  const contextDimensions: DimensionScore[] = [
    {
      weightKey: "business_quality", // nominal; not used for weighting here
      name: scoreGroupNameTr("personal_household"),
      score: ph.score,
      weight: 0,
      available: true,
      missingEssentials: ph.missingEssentials,
      breakdown: ph.breakdown,
    },
  ];

  const confidence = computeConfidence(dimensions, places, cfg);
  const { strengths, weaknesses, missingServices } = deriveNarrative(dimensions);
  const summary = buildSummary(overall, dimensions, confidence, missingServices);

  return {
    overall,
    scoringVersion: cfg.version,
    dimensions,
    confidence,
    contextDimensions,
    strengths,
    weaknesses,
    missingServices,
    summary,
  };
}

/**
 * Data Confidence Score (§13). Blends essential-category coverage, how many
 * weighted dimensions we can actually score, and whether the area has enough
 * mapped places to trust. This measures data *quality*, not neighborhood quality.
 */
function computeConfidence(
  dimensions: DimensionScore[],
  places: ScorablePlace[],
  cfg: ScoringConfig,
): ConfidenceScore {
  // Essential coverage across all weighted place-based groups.
  const weightedGroups = dimensions
    .map((d) => WEIGHT_GROUP[d.weightKey])
    .filter((g): g is ScoreGroup => g !== null);
  let essentialTotal = 0;
  let essentialCovered = 0;
  for (const g of weightedGroups) {
    const essentials = essentialCategoriesInGroup(g);
    essentialTotal += essentials.length;
    const reachableSlugs = new Set(
      reachableInGroup(groupOf(places, g), cfg).map((p) => p.categorySlug),
    );
    essentialCovered += essentials.filter((c) => reachableSlugs.has(c.slug)).length;
  }
  const essentialCoverage = essentialTotal > 0 ? essentialCovered / essentialTotal : 0;

  const weightedDims = dimensions.length;
  const availableDims = dimensions.filter((d) => d.available).length;
  const dimensionAvailability = weightedDims > 0 ? availableDims / weightedDims : 0;

  const reachablePlaceCount = places.filter(
    (p) => proximityScore(p.distanceMeters, cfg) > 0,
  ).length;
  // Saturating: ~30 reachable places reads as a well-mapped area.
  const volumeAdequacy = 1 - Math.exp(-reachablePlaceCount / 15);

  const score = Math.round(
    100 * (0.5 * essentialCoverage + 0.3 * dimensionAvailability + 0.2 * volumeAdequacy),
  );
  return {
    score,
    label: confidenceLabel(score),
    inputs: {
      essentialCoverage: round2(essentialCoverage),
      dimensionAvailability: round2(dimensionAvailability),
      volumeAdequacy: round2(volumeAdequacy),
      reachablePlaceCount,
    },
  };
}

function groupOf(places: ScorablePlace[], group: ScoreGroup): ScorablePlace[] {
  return places.filter((p) => getCategory(p.categorySlug)?.scoreGroup === group);
}

function confidenceLabel(score: number): ConfidenceLabel {
  if (score >= 80) return "high";
  if (score >= 60) return "good";
  if (score >= 35) return "limited";
  return "experimental";
}

/** Strengths, weaknesses and missing services for the report (§19.3). */
function deriveNarrative(dimensions: DimensionScore[]) {
  const scored = dimensions.filter(
    (d): d is DimensionScore & { score: number } => d.available && d.score !== null,
  );
  const strengths = scored
    .filter((d) => d.score >= 70)
    .sort((a, b) => b.score - a.score)
    .map((d) => d.name);
  const weaknesses = scored
    .filter((d) => d.score <= 40)
    .sort((a, b) => a.score - b.score)
    .map((d) => d.name);
  const missingServices = [
    ...new Set(dimensions.flatMap((d) => d.missingEssentials)),
  ];
  return { strengths, weaknesses, missingServices };
}

/** Deterministic plain-language summary (§15.8 — templates before any LLM). */
function buildSummary(
  overall: number,
  dimensions: DimensionScore[],
  confidence: ConfidenceScore,
  missingServices: string[],
): string {
  const band = scoreBandTr(overall);
  const scored = dimensions.filter(
    (d): d is DimensionScore & { score: number } => d.available && d.score !== null,
  );
  const best = [...scored].sort((a, b) => b.score - a.score)[0];
  const worst = [...scored].sort((a, b) => a.score - b.score)[0];

  const parts: string[] = [
    `Bu mahalle günlük yaşam açısından ${band} bir erişime sahip ve 100 üzerinden ${overall} puan aldı.`,
  ];
  if (best) parts.push(`En güçlü olduğu alan: ${best.name} (${best.score}/100).`);
  if (worst && best && worst.weightKey !== best.weightKey) {
    parts.push(`En zayıf günlük alanı: ${worst.name} (${worst.score}/100).`);
  }
  if (missingServices.length > 0) {
    parts.push(`Yakında eksik temel hizmetler: ${missingServices.join(", ")}.`);
  }
  parts.push(
    `Veri güvenilirliği: ${CONFIDENCE_LABEL_TR[confidence.label]}. Puan, hâlihazırda mevcut verilere dayanır ve her işletmeyi veya son değişiklikleri içermeyebilir.`,
  );
  return parts.join(" ");
}

// --- numeric helpers (kept local to avoid widening the engine's public API) ---
function round1(x: number): number {
  return Math.round(x * 10) / 10;
}
function round2(x: number): number {
  return Math.round(x * 100) / 100;
}
