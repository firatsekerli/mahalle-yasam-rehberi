import { describe, expect, it, vi } from "vitest";
import {
  OpenRouteServiceIsochroneSource,
  parseOrsIsochrones,
  walkMinutesFor,
  estimateWalkMinutes,
  type WalkIsochrone,
} from "./isochrone";

// Two nested squares around Kızılay: inner ~10 min, outer ~15 min.
const inner: number[][] = [
  [32.852, 39.919], [32.856, 39.919], [32.856, 39.923], [32.852, 39.923], [32.852, 39.919],
];
const outer: number[][] = [
  [32.848, 39.916], [32.860, 39.916], [32.860, 39.926], [32.848, 39.926], [32.848, 39.916],
];
const orsJson = {
  features: [
    { properties: { value: 900 }, geometry: { coordinates: [outer] } },
    { properties: { value: 600 }, geometry: { coordinates: [inner] } },
  ],
};

describe("parseOrsIsochrones", () => {
  it("maps features to minute bands, sorted ascending", () => {
    const isos = parseOrsIsochrones(orsJson);
    expect(isos.map((i) => i.minutes)).toEqual([10, 15]);
    expect(isos[0].ring).toEqual(inner);
  });

  it("skips malformed features", () => {
    expect(parseOrsIsochrones({ features: [{ properties: {}, geometry: {} }] })).toEqual([]);
    expect(parseOrsIsochrones({})).toEqual([]);
  });
});

describe("walkMinutesFor", () => {
  const isos = parseOrsIsochrones(orsJson);
  it("returns the tightest band containing the point", () => {
    expect(walkMinutesFor({ lng: 32.854, lat: 39.921 }, isos)).toBe(10); // inside inner
    expect(walkMinutesFor({ lng: 32.858, lat: 39.917 }, isos)).toBe(15); // outside inner, inside outer
  });
  it("returns null when outside all bands", () => {
    expect(walkMinutesFor({ lng: 32.9, lat: 39.95 }, isos)).toBeNull();
  });
});

describe("estimateWalkMinutes", () => {
  it("derives minutes from straight-line distance (~80 m/min), min 1", () => {
    expect(estimateWalkMinutes(800)).toBe(10);
    expect(estimateWalkMinutes(1200)).toBe(15);
    expect(estimateWalkMinutes(10)).toBe(1);
  });
});

describe("OpenRouteServiceIsochroneSource", () => {
  it("POSTs foot-walking ranges and parses the result", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify(orsJson), { status: 200 }));
    const src = new OpenRouteServiceIsochroneSource({
      apiKey: "k",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const isos = await src.getWalkingIsochrones({ lat: 39.92, lng: 32.854 });
    expect(isos.map((i) => i.minutes)).toEqual([10, 15]);
    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toBe("k");
    expect(String(init.body)).toContain('"range":[600,900]');
  });

  it("throws a clear error on a non-ok response", async () => {
    const fetchImpl = vi.fn(async () => new Response("no", { status: 403, statusText: "Forbidden" }));
    const src = new OpenRouteServiceIsochroneSource({
      apiKey: "k",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    await expect(src.getWalkingIsochrones({ lat: 39.92, lng: 32.85 })).rejects.toThrow(/403/);
  });
});

// Guard: bands stay ascending so walkMinutesFor returns the tightest first.
it("WALK_BANDS ordering assumption", () => {
  const isos: WalkIsochrone[] = parseOrsIsochrones(orsJson);
  expect(isos[0].minutes).toBeLessThan(isos[1].minutes);
});
