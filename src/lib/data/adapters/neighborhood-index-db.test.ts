import { describe, expect, it } from "vitest";
import { rowToIndexedNeighborhood, type NeighborhoodIndexRow } from "./neighborhood-index-db";

describe("rowToIndexedNeighborhood", () => {
  it("maps a row to a picker item (province → city)", () => {
    const row: NeighborhoodIndexRow = {
      slug: "ankara-cankaya-kavaklidere",
      name: "Kavaklıdere",
      district: "Çankaya",
      province: "Ankara",
      lat: 39.9,
      lng: 32.86,
    };
    expect(rowToIndexedNeighborhood(row)).toEqual({
      slug: "ankara-cankaya-kavaklidere",
      name: "Kavaklıdere",
      district: "Çankaya",
      city: "Ankara",
      lat: 39.9,
      lng: 32.86,
    });
  });
});
