import { describe, expect, it } from "vitest";
import {
  districtsQuery,
  neighborhoodsInAreaQuery,
  parseAdminUnits,
} from "./admin-osm";

describe("districtsQuery", () => {
  it("scopes ilçe (level 6) to a named province (level 4)", () => {
    const q = districtsQuery("Ankara");
    expect(q).toContain('["admin_level"="4"]["name"="Ankara"]');
    expect(q).toContain('relation(area.il)["boundary"="administrative"]["admin_level"="6"]');
    expect(q).toContain("out tags center;");
  });

  it("escapes quotes in the province name", () => {
    expect(districtsQuery('A"B')).toContain('["name"="A\\"B"]');
  });
});

describe("neighborhoodsInAreaQuery", () => {
  it("derives the Overpass area id from the ilçe relation id", () => {
    const q = neighborhoodsInAreaQuery(1234);
    expect(q).toContain("area(3600001234)->.ilce;");
    expect(q).toContain('node(area.ilce)["place"~"^(neighbourhood|quarter|suburb)$"]');
    expect(q).toContain('relation(area.ilce)["boundary"="administrative"]["admin_level"~"^(9|10)$"]');
  });
});

describe("parseAdminUnits", () => {
  it("parses relations (center) and place nodes (lat/lon)", () => {
    const units = parseAdminUnits({
      elements: [
        { type: "relation", id: 10, center: { lat: 39.9, lon: 32.8 }, tags: { name: "Kavaklıdere" } },
        { type: "node", id: 20, lat: 39.91, lon: 32.85, tags: { name: "Kızılay", place: "neighbourhood" } },
      ],
    });
    expect(units).toEqual([
      { osmId: "relation/10", osmNumericId: 10, osmType: "relation", name: "Kavaklıdere", lat: 39.9, lng: 32.8 },
      { osmId: "node/20", osmNumericId: 20, osmType: "node", name: "Kızılay", lat: 39.91, lng: 32.85 },
    ]);
  });

  it("prefers name:tr and drops nameless / location-less elements", () => {
    const units = parseAdminUnits({
      elements: [
        { type: "relation", id: 1, center: { lat: 1, lon: 2 }, tags: { name: "X", "name:tr": "Türkçe" } },
        { type: "node", id: 2, tags: { name: "No location" } }, // no lat/lon/center → dropped
        { type: "node", id: 3, lat: 1, lon: 2, tags: { place: "suburb" } }, // no name → dropped
      ],
    });
    expect(units).toHaveLength(1);
    expect(units[0].name).toBe("Türkçe");
  });

  it("de-duplicates by name (Turkish-insensitive), keeping the first", () => {
    const units = parseAdminUnits({
      elements: [
        { type: "relation", id: 1, center: { lat: 1, lon: 1 }, tags: { name: "Bahçelievler" } },
        { type: "node", id: 2, lat: 2, lon: 2, tags: { name: "BAHÇELİEVLER", place: "quarter" } },
      ],
    });
    expect(units).toHaveLength(1);
    expect(units[0].osmId).toBe("relation/1");
  });
});
