import { describe, expect, it } from "vitest";
import { pointInRing } from "./polygon";

// A small square ring around Kızılay, as [lng, lat] pairs (GeoJSON order).
const square: number[][] = [
  [32.85, 39.92],
  [32.86, 39.92],
  [32.86, 39.93],
  [32.85, 39.93],
  [32.85, 39.92],
];

describe("pointInRing", () => {
  it("returns true for a point inside", () => {
    expect(pointInRing({ lng: 32.855, lat: 39.925 }, square)).toBe(true);
  });

  it("returns false for a point outside", () => {
    expect(pointInRing({ lng: 32.9, lat: 39.925 }, square)).toBe(false);
    expect(pointInRing({ lng: 32.855, lat: 39.95 }, square)).toBe(false);
  });
});
