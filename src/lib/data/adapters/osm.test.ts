import { describe, expect, it, vi } from "vitest";
import { OsmBaselineSource, overpassQuery, parseOverpassResponse } from "./osm";

const KIZILAY = { lat: 39.9208, lng: 32.8541 };

describe("overpassQuery", () => {
  it("embeds the rounded radius and coordinates and requests centers", () => {
    const q = overpassQuery(KIZILAY, 800.6);
    expect(q).toContain("around:801,39.9208,32.8541");
    expect(q).toContain("[out:json]");
    expect(q).toContain("out center tags;");
    expect(q).toContain("[highway=bus_stop]");
  });
});

describe("parseOverpassResponse", () => {
  const ts = "2026-07-12T00:00:00.000Z";

  it("normalizes nodes and resolves way/relation centers, dropping the rest", () => {
    const places = parseOverpassResponse(
      {
        elements: [
          { type: "node", id: 1, lat: 39.92, lon: 32.85, tags: { shop: "supermarket", name: "Migros" } },
          {
            type: "way",
            id: 2,
            center: { lat: 39.921, lon: 32.853 },
            tags: { leisure: "park", name: "Güven Park" },
          },
          { type: "node", id: 3, lat: 39.9, lon: 32.8, tags: { amenity: "fountain" } }, // untracked
          { type: "node", id: 4, lat: 39.9, lon: 32.8 }, // no tags
          { type: "node", id: 5, tags: { amenity: "pharmacy" } }, // no location
        ],
      },
      ts,
    );

    expect(places).toHaveLength(2);
    const market = places.find((p) => p.sourceId === "node/1");
    expect(market).toMatchObject({
      source: "osm",
      categorySlug: "supermarket",
      name: "Migros",
      location: { lat: 39.92, lng: 32.85 },
      sourceTimestamp: ts,
    });
    expect(places.find((p) => p.sourceId === "way/2")?.categorySlug).toBe("park");
  });

  it("labels unnamed evidence by its category and composes an address", () => {
    const [stop] = parseOverpassResponse(
      {
        elements: [
          {
            type: "node",
            id: 9,
            lat: 39.92,
            lon: 32.85,
            tags: { highway: "bus_stop", "addr:street": "Atatürk Blv", "addr:city": "Ankara" },
          },
        ],
      },
      ts,
    );
    expect(stop.categorySlug).toBe("bus_stop");
    expect(stop.name).toBe("bus_stop"); // fell back to the category slug
    expect(stop.address).toBe("Atatürk Blv, Ankara");
  });
});

describe("OsmBaselineSource.fetchNearby", () => {
  it("POSTs the query and returns parsed places", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          elements: [{ type: "node", id: 1, lat: 39.92, lon: 32.85, tags: { amenity: "pharmacy", name: "Eczane" } }],
        }),
        { status: 200 },
      ),
    );
    const source = new OsmBaselineSource({
      fetchImpl: fetchImpl as unknown as typeof fetch,
      now: () => new Date("2026-07-12T00:00:00.000Z"),
    });
    const places = await source.fetchNearby(KIZILAY, 800);

    expect(fetchImpl).toHaveBeenCalledOnce();
    const call = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(call[1].method).toBe("POST");
    expect(String(call[1].body)).toContain("data=");
    expect(places).toHaveLength(1);
    expect(places[0]).toMatchObject({ categorySlug: "pharmacy", name: "Eczane" });
  });

  it("throws a clear API error on a non-ok response", async () => {
    const fetchImpl = vi.fn(async () => new Response("rate limited", { status: 429, statusText: "Too Many Requests" }));
    const source = new OsmBaselineSource({ fetchImpl: fetchImpl as unknown as typeof fetch });
    await expect(source.fetchNearby(KIZILAY, 800)).rejects.toThrow(/Overpass API error 429/);
  });
});
