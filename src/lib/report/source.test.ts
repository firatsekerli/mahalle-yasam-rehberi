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

const place = (id: string, name: string): BaselinePlace => ({
  source: "osm",
  sourceId: id,
  name,
  categorySlug: "pharmacy",
  location: { lat: 39.9209, lng: 32.8542 },
  sourceTimestamp: "2026-07-12T00:00:00.000Z",
});

const dbPlace = place("db/1", "Eczane (DB)");
const livePlace = place("node/1", "Eczane (live)");
const samplePlace = place("sample/kizilay-0", "pharmacy");
const getSample = () => [samplePlace];

describe("resolveNeighborhoodPlaces", () => {
  it("prefers the first real source (DB) when it returns data", async () => {
    const db = vi.fn(async () => [dbPlace]);
    const live = vi.fn(async () => [livePlace]);
    const r = await resolveNeighborhoodPlaces(neighborhood, {
      realSources: [db, live],
      getSample,
      forceSample: false,
    });
    expect(r.sample).toBe(false);
    expect(r.places).toEqual([dbPlace]);
    expect(live).not.toHaveBeenCalled();
  });

  it("falls through to the next real source when the first is empty", async () => {
    const db = vi.fn(async () => []);
    const live = vi.fn(async () => [livePlace]);
    const r = await resolveNeighborhoodPlaces(neighborhood, {
      realSources: [db, live],
      getSample,
      forceSample: false,
    });
    expect(r.sample).toBe(false);
    expect(r.places).toEqual([livePlace]);
  });

  it("skips a throwing source and tries the next", async () => {
    const db = vi.fn(async () => {
      throw new Error("Supabase down");
    });
    const live = vi.fn(async () => [livePlace]);
    const r = await resolveNeighborhoodPlaces(neighborhood, {
      realSources: [db, live],
      getSample,
      forceSample: false,
    });
    expect(r.sample).toBe(false);
    expect(r.places).toEqual([livePlace]);
  });

  it("falls back to sample when every real source fails or is empty", async () => {
    const r = await resolveNeighborhoodPlaces(neighborhood, {
      realSources: [async () => [], async () => { throw new Error("x"); }],
      getSample,
      forceSample: false,
    });
    expect(r.sample).toBe(true);
    expect(r.places).toEqual([samplePlace]);
  });

  it("ignores falsy source entries (e.g. DB not configured)", async () => {
    const live = vi.fn(async () => [livePlace]);
    const r = await resolveNeighborhoodPlaces(neighborhood, {
      realSources: [null, false, undefined, live],
      getSample,
      forceSample: false,
    });
    expect(r.sample).toBe(false);
    expect(r.places).toEqual([livePlace]);
  });

  it("skips all real sources when forceSample is set", async () => {
    const live = vi.fn(async () => [livePlace]);
    const r = await resolveNeighborhoodPlaces(neighborhood, {
      realSources: [live],
      getSample,
      forceSample: true,
    });
    expect(r.sample).toBe(true);
    expect(live).not.toHaveBeenCalled();
  });
});
