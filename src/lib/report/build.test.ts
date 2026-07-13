import { describe, expect, it } from "vitest";
import { buildNeighborhoodReport, type NeighborhoodMeta } from "./build";
import { getProfile } from "@/lib/scoring/profiles";
import { getSamplePlaces } from "@/lib/data/seed/ankara";
import type { TuikDemographicRecord } from "@/lib/data/adapters/demographics";

const kizilay: NeighborhoodMeta = {
  slug: "kizilay",
  name: "Kızılay",
  district: "Çankaya",
  city: "Ankara",
  centroid: { lat: 39.9208, lng: 32.8541 },
  boundaryConfidence: "experimental",
  isApproximate: true,
};

function build(profileSlug: string, demographics: TuikDemographicRecord | null = null) {
  return buildNeighborhoodReport({
    neighborhood: kizilay,
    places: getSamplePlaces("kizilay"),
    demographics,
    profile: getProfile(profileSlug),
    currentYear: 2026,
    sample: true,
  });
}

describe("buildNeighborhoodReport", () => {
  it("assembles a complete report with an in-range overall score", () => {
    const r = build("general");
    expect(r.neighborhood.name).toBe("Kızılay");
    expect(r.score.overall).toBeGreaterThan(0);
    expect(r.score.overall).toBeLessThanOrEqual(100);
    expect(r.placeCount).toBe(getSamplePlaces("kizilay").length);
  });

  it("flags sample data and carries the honesty notice", () => {
    const r = build("general");
    expect(r.dataNotice.sample).toBe(true);
    expect(r.dataNotice.message).toMatch(/örnek prototip verisi/i);
  });

  it("caps confidence to experimental for sample data, however complete it looks", () => {
    const r = build("general");
    expect(r.score.confidence.label).toBe("experimental");
    expect(r.score.confidence.score).toBeLessThanOrEqual(20);
  });

  it("reweights the overall when the lifestyle profile changes (facts unchanged)", () => {
    const general = build("general");
    const student = build("student");
    // Same underlying places → identical reachable count, different weighting.
    expect(student.score.overall).not.toBe(general.score.overall);
    expect(student.placeCount).toBe(general.placeCount);
  });

  it("surfaces closest options per group, nearest first", () => {
    const r = build("general");
    expect(r.highlights.length).toBeGreaterThan(0);
    for (const g of r.highlights) {
      const distances = g.options.map((o) => o.distanceMeters);
      expect(distances).toEqual([...distances].sort((a, b) => a - b));
      expect(g.options.length).toBeLessThanOrEqual(3);
    }
  });

  it("returns null demographics when none imported, and facts when present", () => {
    expect(build("general").demographics).toBeNull();

    const record: TuikDemographicRecord = {
      adminLevel: "district",
      adminCode: "06-CANKAYA",
      areaName: "Çankaya",
      referenceYear: 2024,
      sourceDataset: "TUIK ADNKS 2024 (fixture)",
      totalPopulation: 100000,
    };
    const withDemo = build("general", record);
    expect(withDemo.demographics?.totalPopulation).toBe(100000);
    expect(withDemo.demographics?.freshness.label).toBe("recent");
  });
});
