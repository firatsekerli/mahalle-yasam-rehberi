import { describe, expect, it } from "vitest";
import { pointInRing, pointInArea, type Area } from "./polygon";

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

describe("pointInArea", () => {
  // 2×2 outer square with a 1×1 hole in the middle, as [lng, lat] rings.
  const area: Area = {
    outer: [[[0, 0], [2, 0], [2, 2], [0, 2], [0, 0]]],
    inner: [[[0.5, 0.5], [1.5, 0.5], [1.5, 1.5], [0.5, 1.5], [0.5, 0.5]]],
  };

  it("is inside the outer ring but outside the hole", () => {
    expect(pointInArea({ lng: 0.2, lat: 0.2 }, area)).toBe(true);
  });

  it("is false inside a hole", () => {
    expect(pointInArea({ lng: 1, lat: 1 }, area)).toBe(false);
  });

  it("is false outside the outer ring", () => {
    expect(pointInArea({ lng: 3, lat: 3 }, area)).toBe(false);
  });

  it("supports multipolygons (a point in a second detached part)", () => {
    const multi: Area = {
      outer: [
        [[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]],
        [[5, 5], [6, 5], [6, 6], [5, 6], [5, 5]],
      ],
      inner: [],
    };
    expect(pointInArea({ lng: 5.5, lat: 5.5 }, multi)).toBe(true);
    expect(pointInArea({ lng: 3, lat: 3 }, multi)).toBe(false);
  });
});
