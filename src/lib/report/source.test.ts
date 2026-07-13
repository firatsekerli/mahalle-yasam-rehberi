import { describe, expect, it, vi } from "vitest";
import { resolveNeighborhoodPlaces } from "./source";
import type { NeighborhoodMeta } from "./build";
import type { BaselinePlace } from "@/lib/data/adapters/types";

const neighborhood: NeighborhoodMeta = {
  slug: "kizilay",
  name: "Kızılay",
  district: "Çankaya",
  city: "Ankara",
  centroid: { lat: 39.9208, lng: 32.8541 },
  boundaryConfidence: "experimental",
  isApproximate: true,
};

const livePlace: BaselinePlace = {
  source: "osm",
  sourceId: "node/1",
  name: "Eczane",
  categorySlug: "pharmacy",
  location: { lat: 39.9209, lng: 32.8542 },
  sourceTimestamp: "2026-07-12T00:00:00.000Z",
};

const samplePlace: BaselinePlace = { ...livePlace, sourceId: "sample/kizilay-0", name: "pharmacy" };
const getSample = () => [samplePlace];

describe("resolveNeighborhoodPlaces", () => {
  it("uses live OSM data when available (sample=false)", async () => {
    const fetchLive = vi.fn(async () => [livePlace]);
    const r = await resolveNeighborhoodPlaces(neighborhood, { fetchLive, getSample, forceSample: false });
    expect(r.sample).toBe(false);
    expect(r.places).toEqual([livePlace]);
    expect(fetchLive).toHaveBeenCalledOnce();
  });

  it("falls back to sample when live throws (never a blank report)", async () => {
    const fetchLive = vi.fn(async () => {
      throw new Error("Overpass API error 429 Too Many Requests");
    });
    const r = await resolveNeighborhoodPlaces(neighborhood, { fetchLive, getSample, forceSample: false });
    expect(r.sample).toBe(true);
    expect(r.places).toEqual([samplePlace]);
  });

  it("falls back to sample when live returns empty", async () => {
    const fetchLive = vi.fn(async () => []);
    const r = await resolveNeighborhoodPlaces(neighborhood, { fetchLive, getSample, forceSample: false });
    expect(r.sample).toBe(true);
    expect(r.places).toEqual([samplePlace]);
  });

  it("skips live entirely when forceSample is set", async () => {
    const fetchLive = vi.fn(async () => [livePlace]);
    const r = await resolveNeighborhoodPlaces(neighborhood, { fetchLive, getSample, forceSample: true });
    expect(r.sample).toBe(true);
    expect(fetchLive).not.toHaveBeenCalled();
  });
});
