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
    expect(r.placeCount).toBeGreaterThan(0);
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

  it("builds a nearest-first business list and never shows a raw slug", () => {
    const r = build("general");
    expect(r.businesses.length).toBeGreaterThan(0);
    expect(r.placeCount).toBe(r.businesses.length); // sample < MAX_BUSINESSES
    const distances = r.businesses.map((b) => b.distanceMeters);
    expect(distances).toEqual([...distances].sort((a, b) => a - b));
    // Sample places carry their slug as the name → displayed as the Turkish
    // category label, and marked not-named.
    const market = r.businesses.find((b) => b.categorySlug === "supermarket")!;
    expect(market.named).toBe(false);
    expect(market.name).toBe("Süpermarket");
  });

  it("uses routed walk times when isochrones are provided", () => {
    const c = kizilay.centroid;
    const d = 0.02; // ~2 km box covering all sample places
    const ring = [
      [c.lng - d, c.lat - d],
      [c.lng + d, c.lat - d],
      [c.lng + d, c.lat + d],
      [c.lng - d, c.lat + d],
      [c.lng - d, c.lat - d],
    ];
    const r = buildNeighborhoodReport({
      neighborhood: kizilay,
      places: getSamplePlaces("kizilay"),
      demographics: null,
      profile: getProfile("general"),
      currentYear: 2026,
      sample: false,
      isochrones: [{ minutes: 10, ring }],
    });
    // Every place is inside the 10-min shape → routed (not estimated), 10 min.
    expect(r.businesses.every((b) => !b.walkEstimated)).toBe(true);
    expect(r.businesses.every((b) => b.walkMinutes === 10)).toBe(true);
  });

  it("falls back to walk estimates when a place is outside every isochrone", () => {
    const tinyRing = [
      [0, 0],
      [0.001, 0],
      [0.001, 0.001],
      [0, 0.001],
      [0, 0],
    ]; // far from Ankara → contains nothing
    const r = buildNeighborhoodReport({
      neighborhood: kizilay,
      places: getSamplePlaces("kizilay"),
      demographics: null,
      profile: getProfile("general"),
      currentYear: 2026,
      sample: false,
      isochrones: [{ minutes: 10, ring: tinyRing }],
    });
    expect(r.businesses.every((b) => b.walkEstimated)).toBe(true);
  });

  it("excludes transit infrastructure from the business list (still in scoring)", () => {
    const r = build("general");
    for (const b of r.businesses) {
      expect(["bus_stop", "taxi_stand", "parking", "bicycle_infra"]).not.toContain(b.categorySlug);
    }
    // Transport still scores — the bus stops fed the dimension, just not the list.
    const transport = r.score.dimensions.find((d) => d.weightKey === "transport_mobility");
    expect(transport?.score).toBeGreaterThan(0);
  });

  it("de-duplicates repeated named venues (keeps the nearest)", () => {
    const base = getSamplePlaces("kizilay");
    const dupes = [
      ...base,
      { ...base[0], sourceId: "x/1", name: "Teğmen Kalmaz İlkokulu", categorySlug: "primary_school" },
      { ...base[0], sourceId: "x/2", name: "Teğmen Kalmaz İlkokulu", categorySlug: "primary_school" },
    ];
    const r = buildNeighborhoodReport({
      neighborhood: kizilay,
      places: dupes,
      demographics: null,
      profile: getProfile("general"),
      currentYear: 2026,
      sample: false,
    });
    const schools = r.businesses.filter((b) => b.name === "Teğmen Kalmaz İlkokulu");
    expect(schools.length).toBe(1);
  });

  it("uses the real business name when present (live data)", () => {
    const withName = getSamplePlaces("kizilay").map((p, i) =>
      i === 0 ? { ...p, name: "Migros Kızılay" } : p,
    );
    const r = buildNeighborhoodReport({
      neighborhood: kizilay,
      places: withName,
      demographics: null,
      profile: getProfile("general"),
      currentYear: 2026,
      sample: false,
    });
    const named = r.businesses.find((b) => b.named);
    expect(named?.name).toBe("Migros Kızılay");
    expect(named?.categoryName).toBe("Süpermarket");
  });

  it("rolls up nearby facility counts by category and group", () => {
    const r = build("general");
    expect(r.nearbyCounts.length).toBeGreaterThan(0);
    for (const g of r.nearbyCounts) {
      // Group total equals the sum of its category counts.
      expect(g.total).toBe(g.categories.reduce((s, c) => s + c.count, 0));
      // Categories are ordered most-common first.
      const counts = g.categories.map((c) => c.count);
      expect(counts).toEqual([...counts].sort((a, b) => b - a));
      for (const c of g.categories) {
        expect(c.count).toBeGreaterThan(0);
        expect(c.nearestMeters).toBeGreaterThanOrEqual(0);
        expect(c.categoryName).not.toBe(c.categorySlug); // Turkish label, never a raw slug
      }
    }
    // Groups are ordered busiest first.
    const totals = r.nearbyCounts.map((g) => g.total);
    expect(totals).toEqual([...totals].sort((a, b) => b - a));
  });

  it("counts transit infrastructure in nearby counts (unlike the business list)", () => {
    const base = getSamplePlaces("kizilay");
    const countBusStops = (places: typeof base) =>
      buildNeighborhoodReport({
        neighborhood: kizilay,
        places,
        demographics: null,
        profile: getProfile("general"),
        currentYear: 2026,
        sample: false,
      }).nearbyCounts
        .find((g) => g.group === "transport_mobility")
        ?.categories.find((c) => c.categorySlug === "bus_stop")?.count ?? 0;

    const before = countBusStops(base);
    const after = countBusStops([
      ...base,
      { ...base[0], sourceId: "bus/extra-1", name: "bus_stop", categorySlug: "bus_stop" },
      { ...base[0], sourceId: "bus/extra-2", name: "bus_stop", categorySlug: "bus_stop" },
    ]);
    expect(after).toBe(before + 2); // transit is counted here...
    // ...but the venue list still excludes it.
    const r = buildNeighborhoodReport({
      neighborhood: kizilay,
      places: base,
      demographics: null,
      profile: getProfile("general"),
      currentYear: 2026,
      sample: false,
    });
    expect(r.businesses.some((b) => b.categorySlug === "bus_stop")).toBe(false);
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
