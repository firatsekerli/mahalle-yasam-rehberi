import { describe, expect, it } from "vitest";
import { scoreNeighborhood } from "./neighborhood";
import { DEFAULT_SCORING_CONFIG } from "./config";
import type { ScorablePlace } from "./engine";

const W = DEFAULT_SCORING_CONFIG.weights;

/** A neighborhood with good coverage of most essentials, close by. */
const wellCovered: ScorablePlace[] = [
  { categorySlug: "supermarket", distanceMeters: 150 },
  { categorySlug: "grocery", distanceMeters: 200 },
  { categorySlug: "bakery", distanceMeters: 250 },
  { categorySlug: "pharmacy", distanceMeters: 180 },
  { categorySlug: "clinic", distanceMeters: 500 },
  { categorySlug: "restaurant", distanceMeters: 220 },
  { categorySlug: "cafe", distanceMeters: 240 },
  { categorySlug: "metro_station", distanceMeters: 350 },
  { categorySlug: "bus_stop", distanceMeters: 120 },
  { categorySlug: "primary_school", distanceMeters: 400 },
  { categorySlug: "kindergarten", distanceMeters: 380 },
  { categorySlug: "park", distanceMeters: 300 },
  { categorySlug: "veterinarian", distanceMeters: 600 },
  { categorySlug: "atm", distanceMeters: 90 },
];

describe("scoreNeighborhood", () => {
  it("produces an overall score in range and records the scoring version", () => {
    const r = scoreNeighborhood(wellCovered, W);
    expect(r.overall).toBeGreaterThan(0);
    expect(r.overall).toBeLessThanOrEqual(100);
    expect(r.scoringVersion).toBe(DEFAULT_SCORING_CONFIG.version);
  });

  it("marks derived dimensions unavailable in the MVP baseline", () => {
    const r = scoreNeighborhood(wellCovered, W);
    const lateHour = r.dimensions.find((d) => d.weightKey === "late_hour_convenience");
    const quality = r.dimensions.find((d) => d.weightKey === "business_quality");
    expect(lateHour?.available).toBe(false);
    expect(lateHour?.score).toBeNull();
    // No ratings supplied → quality cannot be scored honestly.
    expect(quality?.available).toBe(false);
    expect(quality?.score).toBeNull();
  });

  it("redistributes weight so unavailable dimensions never drag the overall down", () => {
    // No ratings and no hours → business_quality and late_hour are unavailable.
    const r = scoreNeighborhood(wellCovered, W);
    const avail = r.dimensions.filter((d) => d.available && d.score !== null);

    // Overall is the weighted mean over AVAILABLE dimensions (weights renormalized).
    const num = avail.reduce((s, d) => s + d.weight * (d.score as number), 0);
    const availWeight = avail.reduce((s, d) => s + d.weight, 0);
    expect(availWeight).toBeLessThan(1); // some weight belongs to unavailable dims
    expect(r.overall).toBeCloseTo(num / availWeight, 1);

    // Had we NOT redistributed (unavailable dims counted as 0 over full weight),
    // the overall would be strictly lower — redistribution never hurts.
    const naive = num / 1.0;
    expect(r.overall).toBeGreaterThan(naive);
  });

  it("becomes quality-aware once ratings are present", () => {
    const rated = wellCovered.map((p) => ({ ...p, rating: 4.6, ratingCount: 300 }));
    const r = scoreNeighborhood(rated, W);
    const quality = r.dimensions.find((d) => d.weightKey === "business_quality");
    expect(quality?.available).toBe(true);
    expect(quality?.score).toBeGreaterThan(80);
  });

  it("penalizes missing essential subcategories and reports them", () => {
    // Drop the pharmacy and clinic → health essentials missing.
    const noHealth = wellCovered.filter(
      (p) => p.categorySlug !== "pharmacy" && p.categorySlug !== "clinic",
    );
    const full = scoreNeighborhood(wellCovered, W);
    const missing = scoreNeighborhood(noHealth, W);

    const healthFull = full.dimensions.find((d) => d.weightKey === "health_wellbeing")!;
    const healthMissing = missing.dimensions.find((d) => d.weightKey === "health_wellbeing")!;
    expect(healthMissing.score!).toBeLessThan(healthFull.score!);
    expect(missing.missingServices).toContain("Pharmacy");
    expect(missing.missingServices).toContain("Clinic");
  });

  it("scores a barren neighborhood low with experimental/limited confidence", () => {
    const sparse: ScorablePlace[] = [{ categorySlug: "cafe", distanceMeters: 1000 }];
    const r = scoreNeighborhood(sparse, W);
    expect(r.overall).toBeLessThan(20);
    expect(["experimental", "limited"]).toContain(r.confidence.label);
    expect(r.weaknesses.length).toBeGreaterThan(0);
  });

  it("reports higher confidence for a well-mapped area", () => {
    const r = scoreNeighborhood(wellCovered, W);
    expect(r.confidence.score).toBeGreaterThan(40);
    expect(r.confidence.inputs.reachablePlaceCount).toBe(wellCovered.length);
  });

  it("scores personal_household for context but keeps it out of the overall", () => {
    const withServices = [
      ...wellCovered,
      { categorySlug: "bank", distanceMeters: 200 } as ScorablePlace,
    ];
    const r = scoreNeighborhood(withServices, W);
    expect(r.contextDimensions[0].name).toContain("Personal");
    // personal_household is not among the weighted dimensions.
    expect(r.dimensions.every((d) => d.name !== r.contextDimensions[0].name)).toBe(true);
  });

  it("writes a plain-language summary grounded in the numbers", () => {
    const r = scoreNeighborhood(wellCovered, W);
    expect(r.summary).toContain(`${r.overall}/100`);
    expect(r.summary).toMatch(/data confidence is (high|good|limited|experimental)/i);
  });

  it("ignores places with slugs outside the taxonomy", () => {
    const withJunk = [...wellCovered, { categorySlug: "spaceport", distanceMeters: 100 } as ScorablePlace];
    const clean = scoreNeighborhood(wellCovered, W);
    const dirty = scoreNeighborhood(withJunk, W);
    expect(dirty.overall).toBe(clean.overall);
  });
});
