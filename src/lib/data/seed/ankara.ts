/**
 * Sample Ankara neighborhoods for the prototype report (CLAUDE.md §18.1, §29 step 4).
 *
 * IMPORTANT — this is SAMPLE prototype data, not live coverage:
 *  - Neighborhood centroids are approximate real locations.
 *  - Places are representative points labeled by category, NOT claims about
 *    specific named businesses, and NOT a complete list.
 *  - No ratings are attached (Google enrichment is lazy per-business, §31.1).
 *  - Demographics are intentionally absent here; real figures are imported by
 *    the worker from official TÜİK ADNKS data (§12.5) — never fabricated.
 *
 * Reports built from this source are flagged `sample: true` so the UI shows a
 * clear notice and low confidence. It is replaced by the live OSM baseline +
 * PostGIS read once the worker import lands (§29 step 5).
 */

import type { BaselinePlace } from "@/lib/data/adapters/types";
import type { PlaceBaselineSource, GeoPoint } from "@/lib/data/adapters/types";
import type { TuikDemographicRecord } from "@/lib/data/adapters/demographics";
import type { NeighborhoodMeta } from "@/lib/report/build";
import { offsetMeters, haversineMeters } from "@/lib/geo/distance";

const SAMPLE_TIMESTAMP = "2026-07-12T00:00:00.000Z";

export const SAMPLE_NEIGHBORHOODS: NeighborhoodMeta[] = [
  {
    slug: "kizilay",
    name: "Kızılay",
    district: "Çankaya",
    city: "Ankara",
    centroid: { lat: 39.9208, lng: 32.8541 },
    boundaryConfidence: "experimental",
    isApproximate: true,
  },
  {
    slug: "bahcelievler",
    name: "Bahçelievler",
    district: "Çankaya",
    city: "Ankara",
    centroid: { lat: 39.9256, lng: 32.8203 },
    boundaryConfidence: "experimental",
    isApproximate: true,
  },
  {
    slug: "ayranci",
    name: "Ayrancı",
    district: "Çankaya",
    city: "Ankara",
    centroid: { lat: 39.902, lng: 32.857 },
    boundaryConfidence: "experimental",
    isApproximate: true,
  },
];

/** [categorySlug, metersNorth, metersEast] relative to the centroid. */
type Spec = [string, number, number];

// Kızılay: dense central district — rich across most categories, has metro.
const KIZILAY_SPECS: Spec[] = [
  ["supermarket", 120, 80], ["supermarket", -200, 150], ["grocery", 90, -60],
  ["grocery", 260, 40], ["bakery", -80, 110], ["bakery", 300, -220],
  ["convenience", 50, 50], ["butcher", -150, -90], ["greengrocer", 180, 200],
  ["pharmacy", 70, -40], ["pharmacy", -220, 120], ["clinic", 350, 180],
  ["hospital", -600, 500], ["dentist", 140, -160],
  ["restaurant", 60, 90], ["restaurant", -110, -70], ["cafe", 40, 120],
  ["cafe", 200, -50], ["coffee_shop", -90, 60], ["fast_food", 130, 30],
  ["metro_station", -180, 90], ["bus_stop", 40, -30], ["bus_stop", -60, 140],
  ["taxi_stand", 90, 70],
  ["primary_school", 400, -300], ["kindergarten", -350, 220], ["library", 500, 260],
  ["gym", 150, -110], ["park", -250, -180], ["sports_center", 420, 300],
  ["veterinarian", 380, -260], ["pet_shop", -300, 160],
  ["bank", 80, -100], ["atm", 30, 40], ["hairdresser", -70, 90], ["cargo", 220, -140],
];

// Bahçelievler: residential — solid essentials/schools, thinner transport & nightlife.
const BAHCELIEVLER_SPECS: Spec[] = [
  ["supermarket", 150, 90], ["grocery", -120, 60], ["grocery", 300, -150],
  ["bakery", 80, -110], ["greengrocer", -200, 130], ["convenience", 60, 70],
  ["pharmacy", 110, -50], ["clinic", 450, 220], ["dentist", -180, 90],
  ["restaurant", 130, 60], ["cafe", -90, -70], ["cafe", 260, 140],
  ["bus_stop", 70, -40], ["bus_stop", -110, 120], ["taxi_stand", 200, 90],
  ["primary_school", 350, -260], ["secondary_school", -420, 300],
  ["kindergarten", 180, 210], ["playground", -160, -140],
  ["gym", 240, -180], ["park", -300, 200], ["walking_path", 380, 260],
  ["veterinarian", 500, -320],
  ["bank", 120, -90], ["atm", 50, 60], ["hairdresser", -80, 100],
];

// Ayrancı: leafy residential Çankaya — good cafés, parks and daily essentials.
const AYRANCI_SPECS: Spec[] = [
  ["supermarket", 130, 70], ["grocery", -110, 90], ["grocery", 280, -160],
  ["bakery", 90, -120], ["greengrocer", -180, 140], ["convenience", 55, 65],
  ["butcher", 210, 120],
  ["pharmacy", 100, -60], ["clinic", 420, 200], ["dentist", -170, 80],
  ["restaurant", 120, 70], ["restaurant", -80, 160], ["cafe", -70, -60],
  ["cafe", 240, 130], ["coffee_shop", 160, -90], ["breakfast", -140, 100],
  ["bus_stop", 60, -40], ["bus_stop", -100, 130], ["taxi_stand", 190, 80],
  ["primary_school", 330, -240], ["kindergarten", 170, 200],
  ["gym", 220, -170], ["park", -280, 190], ["walking_path", 360, 240],
  ["yoga_pilates", -210, -150],
  ["veterinarian", 470, -300], ["pet_shop", -260, 150],
  ["bank", 110, -80], ["atm", 45, 55], ["hairdresser", -75, 95], ["cargo", 200, -130],
];

function buildPlaces(centroid: GeoPoint, specs: Spec[], prefix: string): BaselinePlace[] {
  return specs.map(([categorySlug, north, east], i) => ({
    source: "osm",
    sourceId: `sample/${prefix}-${i}`,
    // Representative point labeled by category — not a specific named business.
    name: categorySlug,
    categorySlug,
    location: offsetMeters(centroid, north, east),
    sourceTimestamp: SAMPLE_TIMESTAMP,
  }));
}

const PLACES_BY_SLUG: Record<string, BaselinePlace[]> = {
  kizilay: buildPlaces(SAMPLE_NEIGHBORHOODS[0].centroid, KIZILAY_SPECS, "kizilay"),
  bahcelievler: buildPlaces(SAMPLE_NEIGHBORHOODS[1].centroid, BAHCELIEVLER_SPECS, "bahcelievler"),
  ayranci: buildPlaces(SAMPLE_NEIGHBORHOODS[2].centroid, AYRANCI_SPECS, "ayranci"),
};

/** Demographics are pending an official TÜİK import — never fabricated here. */
export const SAMPLE_DEMOGRAPHICS: Record<string, TuikDemographicRecord | null> = {
  kizilay: null,
  bahcelievler: null,
  ayranci: null,
};

export function getSampleNeighborhood(slug: string): NeighborhoodMeta | undefined {
  return SAMPLE_NEIGHBORHOODS.find((n) => n.slug === slug);
}

/**
 * A baseline source over the sample data. Implements the same contract as the
 * live OSM source, filtering by radius from the query center, so the report data
 * layer is identical whether reading sample or live data.
 */
export class SampleBaselineSource implements PlaceBaselineSource {
  readonly source = "osm" as const;

  async fetchNearby(center: GeoPoint, radiusMeters: number): Promise<BaselinePlace[]> {
    const all = Object.values(PLACES_BY_SLUG).flat();
    return all.filter((p) => haversineMeters(center, p.location) <= radiusMeters);
  }
}

export function getSamplePlaces(slug: string): BaselinePlace[] {
  return PLACES_BY_SLUG[slug] ?? [];
}
