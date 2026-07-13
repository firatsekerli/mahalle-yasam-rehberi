import { describe, expect, it } from "vitest";
import { buildDemographicFacts, summarizeDemographics } from "./facts";
import { TUIK_ATTRIBUTION, type TuikDemographicRecord } from "@/lib/data/adapters/demographics";

// NOTE: illustrative fixture, NOT real TÜİK figures. Real numbers are imported
// by the data worker from the official ADNKS dataset (see worker/README.md).
const districtRecord: TuikDemographicRecord = {
  adminLevel: "district",
  adminCode: "06-CANKAYA",
  areaName: "Çankaya",
  referenceYear: 2024,
  sourceDataset: "TUIK ADNKS 2024 (fixture)",
  totalPopulation: 100000,
  populationByAgeBand: { "0-14": 15000, "15-64": 70000, "65+": 15000 },
  populationBySex: { male: 48000, female: 52000 },
  averageHouseholdSize: 2.8,
};

// A mahalle-level record with no breakdowns — the common real-world case.
const mahalleRecord: TuikDemographicRecord = {
  adminLevel: "neighborhood",
  adminCode: "06-CANKAYA-KIZILAY",
  areaName: "Kızılay",
  referenceYear: 2024,
  sourceDataset: "TUIK ADNKS 2024 (fixture)",
  totalPopulation: 8000,
};

describe("buildDemographicFacts", () => {
  it("carries source, dataset, year and attribution through unchanged", () => {
    const f = buildDemographicFacts(districtRecord, 2026);
    expect(f.source).toBe("tuik");
    expect(f.attribution).toBe(TUIK_ATTRIBUTION);
    expect(f.sourceDataset).toBe("TUIK ADNKS 2024 (fixture)");
    expect(f.referenceYear).toBe(2024);
    expect(f.totalPopulation).toBe(100000);
  });

  it("computes age and sex shares from the published breakdown", () => {
    const f = buildDemographicFacts(districtRecord, 2026);
    const working = f.ageBands?.find((b) => b.band === "15-64");
    expect(working?.share).toBe(0.7);
    expect(f.sex?.femaleShare).toBe(0.52);
    expect(f.sex?.maleShare).toBe(0.48);
  });

  it("omits breakdowns entirely when the source did not publish them", () => {
    const f = buildDemographicFacts(mahalleRecord, 2026);
    expect(f.ageBands).toBeUndefined();
    expect(f.sex).toBeUndefined();
    expect(f.averageHouseholdSize).toBeUndefined();
    // Total population is still a fact we can show.
    expect(f.totalPopulation).toBe(8000);
  });

  it("labels freshness from the reference year", () => {
    expect(buildDemographicFacts(districtRecord, 2025).freshness.label).toBe("current");
    expect(buildDemographicFacts(districtRecord, 2027).freshness.label).toBe("recent");
    expect(buildDemographicFacts(districtRecord, 2030).freshness.label).toBe("dated");
    expect(buildDemographicFacts(districtRecord, 2035).freshness.label).toBe("stale");
  });

  it("never reports a negative data age for a future-dated import", () => {
    const f = buildDemographicFacts(districtRecord, 2023);
    expect(f.freshness.ageYears).toBe(0);
  });
});

describe("summarizeDemographics", () => {
  it("states only facts and always cites the source and year", () => {
    const s = summarizeDemographics(buildDemographicFacts(districtRecord, 2026));
    expect(s).toContain("2024");
    expect(s).toContain("TUIK ADNKS 2024 (fixture)");
    expect(s).toContain("100.000"); // tr-TR grouping
    expect(s).toContain("Ortalama hane büyüklüğü 2.8");
  });

  it("does not fabricate breakdowns that were not in the record", () => {
    const s = summarizeDemographics(buildDemographicFacts(mahalleRecord, 2026));
    expect(s).toContain("8.000");
    expect(s).not.toMatch(/hane büyüklüğü/);
  });

  it("flags staleness when the figure is old", () => {
    const s = summarizeDemographics(buildDemographicFacts(districtRecord, 2033));
    expect(s).toMatch(/yıl öncesine ait/);
  });
});
