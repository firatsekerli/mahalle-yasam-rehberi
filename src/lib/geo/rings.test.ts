import { describe, expect, it } from "vitest";
import { assembleRings } from "./rings";

describe("assembleRings", () => {
  it("stitches two ways into one closed ring", () => {
    const rings = assembleRings([
      [[0, 0], [1, 0], [1, 1]],
      [[1, 1], [0, 1], [0, 0]],
    ]);
    expect(rings).toHaveLength(1);
    const r = rings[0];
    expect(r[0]).toEqual(r[r.length - 1]); // closed
    expect(r).toContainEqual([1, 1]);
    expect(r).toContainEqual([0, 1]);
  });

  it("reverses a way when only its far end connects", () => {
    const rings = assembleRings([
      [[0, 0], [1, 0], [1, 1]],
      // Reversed orientation: shares endpoint [1,1] at its end, [0,0] at start.
      [[0, 0], [0, 1], [1, 1]],
    ]);
    expect(rings).toHaveLength(1);
    expect(rings[0][0]).toEqual(rings[0][rings[0].length - 1]);
  });

  it("keeps an already-closed single way", () => {
    const closed = [[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]];
    expect(assembleRings([closed])).toEqual([closed]);
  });

  it("drops chains that never close", () => {
    expect(assembleRings([[[0, 0], [1, 0], [2, 0]]])).toEqual([]);
  });

  it("assembles two independent rings", () => {
    const rings = assembleRings([
      [[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]],
      [[5, 5], [6, 5], [6, 6], [5, 6], [5, 5]],
    ]);
    expect(rings).toHaveLength(2);
  });
});
