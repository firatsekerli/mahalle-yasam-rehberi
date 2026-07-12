import { describe, expect, it } from "vitest";
import { normalizeOsmTags, type OsmTags } from "./osm-mapping";
import { getCategory } from "./categories";

describe("normalizeOsmTags", () => {
  it("maps common shop and amenity tags to platform slugs", () => {
    expect(normalizeOsmTags({ shop: "supermarket" })).toBe("supermarket");
    expect(normalizeOsmTags({ shop: "bakery" })).toBe("bakery");
    expect(normalizeOsmTags({ amenity: "pharmacy" })).toBe("pharmacy");
    expect(normalizeOsmTags({ amenity: "restaurant" })).toBe("restaurant");
    expect(normalizeOsmTags({ amenity: "veterinary" })).toBe("veterinarian");
    expect(normalizeOsmTags({ amenity: "atm" })).toBe("atm");
  });

  it("returns null for untracked tags", () => {
    expect(normalizeOsmTags({ amenity: "fountain" })).toBeNull();
    expect(normalizeOsmTags({ tourism: "hotel" })).toBeNull();
    expect(normalizeOsmTags({})).toBeNull();
  });

  it("distinguishes metro stations from ordinary train stations", () => {
    expect(normalizeOsmTags({ railway: "station", station: "subway" })).toBe("metro_station");
    expect(normalizeOsmTags({ railway: "station", subway: "yes" })).toBe("metro_station");
    expect(normalizeOsmTags({ railway: "subway_entrance" })).toBe("metro_station");
    expect(normalizeOsmTags({ railway: "station" })).toBe("train_station");
  });

  it("prefers coffee shops over generic cafés when tagged", () => {
    expect(normalizeOsmTags({ amenity: "cafe", cuisine: "coffee_shop" })).toBe("coffee_shop");
    expect(normalizeOsmTags({ amenity: "cafe" })).toBe("cafe");
  });

  it("uses isced:level for schools and defaults untyped schools to primary", () => {
    expect(normalizeOsmTags({ amenity: "school", "isced:level": "1" })).toBe("primary_school");
    expect(normalizeOsmTags({ amenity: "school", "isced:level": "2" })).toBe("secondary_school");
    expect(normalizeOsmTags({ amenity: "school", "isced:level": "3" })).toBe("high_school");
    expect(normalizeOsmTags({ amenity: "school" })).toBe("primary_school");
  });

  it("only ever returns slugs that exist in the taxonomy", () => {
    const samples: OsmTags[] = [
      { shop: "greengrocer" },
      { amenity: "kindergarten" },
      { leisure: "park" },
      { healthcare: "physiotherapist" },
      { highway: "bus_stop" },
      { sport: "yoga" },
    ];
    for (const tags of samples) {
      const slug = normalizeOsmTags(tags);
      expect(slug).not.toBeNull();
      expect(getCategory(slug as string)).toBeDefined();
    }
  });
});
