import { describe, expect, it } from "vitest";
import { haversineMeters, offsetMeters } from "./distance";

describe("haversineMeters", () => {
  it("is zero for identical points", () => {
    expect(haversineMeters({ lat: 39.92, lng: 32.85 }, { lat: 39.92, lng: 32.85 })).toBe(0);
  });

  it("is symmetric", () => {
    const a = { lat: 39.92, lng: 32.85 };
    const b = { lat: 39.93, lng: 32.86 };
    expect(haversineMeters(a, b)).toBeCloseTo(haversineMeters(b, a), 6);
  });

  it("matches a known short distance (~1 km)", () => {
    // ~0.009° latitude ≈ 1 km near the equator/mid-latitudes.
    const d = haversineMeters({ lat: 39.92, lng: 32.85 }, { lat: 39.929, lng: 32.85 });
    expect(d).toBeGreaterThan(950);
    expect(d).toBeLessThan(1050);
  });
});

describe("offsetMeters", () => {
  it("produces a point at approximately the requested distance", () => {
    const origin = { lat: 39.92, lng: 32.85 };
    const p = offsetMeters(origin, 300, 400); // 300m N, 400m E → 500m hypotenuse
    expect(haversineMeters(origin, p)).toBeGreaterThan(480);
    expect(haversineMeters(origin, p)).toBeLessThan(520);
  });
});
