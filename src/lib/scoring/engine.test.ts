import { describe, expect, it } from "vitest";
import {
  applyMissingEssentialPenalty,
  bayesianRating,
  diminishingReturns,
  placeProximity,
  proximityScore,
  scoreCategory,
  walkProximityScore,
  type ScorablePlace,
} from "./engine";
import { DEFAULT_SCORING_CONFIG, validateScoringConfig } from "./config";

describe("scoring config", () => {
  it("default weights sum to 1.0", () => {
    expect(() => validateScoringConfig(DEFAULT_SCORING_CONFIG)).not.toThrow();
  });
});

describe("bayesianRating", () => {
  it("returns the prior mean for an unrated place", () => {
    expect(bayesianRating(undefined, undefined)).toBe(DEFAULT_SCORING_CONFIG.ratingPrior.priorMean);
    expect(bayesianRating(5, 0)).toBe(DEFAULT_SCORING_CONFIG.ratingPrior.priorMean);
  });

  it("a 5.0 from 2 reviews does not outrank a 4.7 from hundreds (§11.4)", () => {
    const few = bayesianRating(5.0, 2);
    const many = bayesianRating(4.7, 400);
    expect(many).toBeGreaterThan(few);
  });

  it("converges toward the true rating as count grows", () => {
    const near = bayesianRating(4.2, 5000);
    expect(near).toBeGreaterThan(4.15);
    expect(near).toBeLessThanOrEqual(4.2);
  });
});

describe("proximityScore", () => {
  it("gives full credit within the near band and none beyond reachable", () => {
    expect(proximityScore(100)).toBe(1);
    expect(proximityScore(DEFAULT_SCORING_CONFIG.distanceBands.nearMeters)).toBe(1);
    expect(proximityScore(DEFAULT_SCORING_CONFIG.distanceBands.reachableMeters)).toBe(0);
    expect(proximityScore(9999)).toBe(0);
  });

  it("decays monotonically between the bands", () => {
    expect(proximityScore(600)).toBeGreaterThan(proximityScore(900));
  });
});

describe("walkProximityScore", () => {
  it("gives full credit within the near band and none beyond reachable", () => {
    expect(walkProximityScore(5)).toBe(1);
    expect(walkProximityScore(10)).toBe(1);
    expect(walkProximityScore(15)).toBe(0);
    expect(walkProximityScore(30)).toBe(0);
  });
  it("decays linearly between the bands", () => {
    expect(walkProximityScore(12)).toBeCloseTo(0.6, 5); // (15-12)/(15-10)
  });
});

describe("placeProximity", () => {
  it("prefers routed walk minutes when present, else falls back to distance", () => {
    // Far in meters, but 8 walking minutes → full credit via walk band.
    expect(placeProximity({ categorySlug: "x", distanceMeters: 5000, walkMinutes: 8 })).toBe(1);
    // No walk minutes → distance path (within near band).
    expect(placeProximity({ categorySlug: "x", distanceMeters: 100 })).toBe(1);
    // Walk minutes beyond reach → zero, regardless of distance.
    expect(placeProximity({ categorySlug: "x", distanceMeters: 50, walkMinutes: 20 })).toBe(0);
  });
});

describe("diminishingReturns", () => {
  it("rewards the first places most and saturates (§11.4)", () => {
    const one = diminishingReturns(1);
    const two = diminishingReturns(2);
    const ten = diminishingReturns(10);
    expect(one).toBeGreaterThan(0);
    expect(two - one).toBeGreaterThan(diminishingReturns(11) - ten);
    // Ten supermarkets are not ~twice as good as five.
    expect(diminishingReturns(10)).toBeLessThan(2 * diminishingReturns(5));
  });
});

describe("scoreCategory", () => {
  it("scores 0 when nothing is reachable", () => {
    const far: ScorablePlace[] = [{ categorySlug: "supermarket", distanceMeters: 5000 }];
    expect(scoreCategory(far).score).toBe(0);
  });

  it("scores higher for closer, more numerous options", () => {
    const sparse: ScorablePlace[] = [{ categorySlug: "supermarket", distanceMeters: 1000 }];
    const rich: ScorablePlace[] = [
      { categorySlug: "supermarket", distanceMeters: 150 },
      { categorySlug: "grocery", distanceMeters: 250 },
      { categorySlug: "bakery", distanceMeters: 300 },
    ];
    expect(scoreCategory(rich).score).toBeGreaterThan(scoreCategory(sparse).score);
  });

  it("exposes an explainable breakdown", () => {
    const places: ScorablePlace[] = [
      { categorySlug: "supermarket", distanceMeters: 150, rating: 4.5, ratingCount: 200 },
    ];
    const result = scoreCategory(places);
    expect(result.breakdown.reachableCount).toBe(1);
    expect(result.breakdown.coverage).toBeGreaterThan(0);
    expect(result.breakdown.quality).toBeGreaterThan(0);
  });
});

describe("applyMissingEssentialPenalty", () => {
  it("reduces the score per missing essential and never goes negative", () => {
    expect(applyMissingEssentialPenalty(80, 0)).toBe(80);
    expect(applyMissingEssentialPenalty(80, 1)).toBeLessThan(80);
    expect(applyMissingEssentialPenalty(80, 100)).toBe(0);
  });
});
