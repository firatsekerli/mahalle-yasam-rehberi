import { describe, expect, it } from "vitest";
import {
  TuikDemographicsSource,
  staticDemographicLookup,
  type TuikDemographicRecord,
} from "./demographics";

// Illustrative fixtures — NOT real TÜİK figures (real data is worker-imported).
const records: TuikDemographicRecord[] = [
  {
    adminLevel: "district",
    adminCode: "06-CANKAYA",
    areaName: "Çankaya",
    referenceYear: 2024,
    sourceDataset: "TUIK ADNKS 2024 (fixture)",
    totalPopulation: 100000,
  },
  {
    adminLevel: "neighborhood",
    adminCode: "06-CANKAYA-KIZILAY",
    areaName: "Kızılay",
    referenceYear: 2024,
    sourceDataset: "TUIK ADNKS 2024 (fixture)",
    totalPopulation: 8000,
  },
];

describe("TuikDemographicsSource", () => {
  const source = new TuikDemographicsSource(staticDemographicLookup(records));

  it("returns an imported record by admin level + code", async () => {
    const r = await source.getByAdminCode("district", "06-CANKAYA");
    expect(r?.areaName).toBe("Çankaya");
    expect(r?.totalPopulation).toBe(100000);
  });

  it("keys on both level and code so codes don't collide across levels", async () => {
    expect(await source.getByAdminCode("neighborhood", "06-CANKAYA-KIZILAY")).not.toBeNull();
    // Same code queried at the wrong level must not match.
    expect(await source.getByAdminCode("province", "06-CANKAYA")).toBeNull();
  });

  it("returns null for a unit that has not been imported (no fabrication)", async () => {
    expect(await source.getByAdminCode("district", "06-NONEXISTENT")).toBeNull();
  });
});
