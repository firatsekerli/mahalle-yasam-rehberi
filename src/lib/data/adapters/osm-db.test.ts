import { describe, expect, it } from "vitest";
import { rowToBaselinePlace, type OsmPlaceRow } from "./osm-db";

describe("rowToBaselinePlace", () => {
  it("maps an osm_places row to a BaselinePlace", () => {
    const row: OsmPlaceRow = {
      source_id: "node/123",
      name: "Migros Kızılay",
      category_slug: "supermarket",
      lng: 32.8541,
      lat: 39.9208,
      source_timestamp: "2026-07-12T00:00:00.000Z",
    };
    expect(rowToBaselinePlace(row)).toEqual({
      source: "osm",
      sourceId: "node/123",
      name: "Migros Kızılay",
      categorySlug: "supermarket",
      location: { lat: 39.9208, lng: 32.8541 },
      sourceTimestamp: "2026-07-12T00:00:00.000Z",
    });
  });

  it("treats a missing timestamp as epoch, not 'now' (freshness honesty)", () => {
    const row: OsmPlaceRow = {
      source_id: "node/9",
      name: "Eczane",
      category_slug: "pharmacy",
      lng: 32.85,
      lat: 39.92,
      source_timestamp: null,
    };
    expect(rowToBaselinePlace(row).sourceTimestamp).toBe(new Date(0).toISOString());
  });
});
