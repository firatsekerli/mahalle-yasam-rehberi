/**
 * Report data access (CLAUDE.md §29 step 9, §15.4).
 *
 * Single entry point the report page calls. Places are resolved in order:
 *   1. Supabase `osm_places` (seeded real data — the reliable production path)
 *   2. live OpenStreetMap (Overpass) as a fallback for un-seeded neighborhoods
 *   3. the sample dataset, so a report is never blank
 * Both real sources are cached server-side. Set `DATA_SOURCE=sample` to force
 * the sample dataset. Neighborhood definitions come from the seed registry;
 * moving them to a `neighborhoods` table later doesn't change this API.
 */

import { unstable_cache } from "next/cache";
import { OsmBaselineSource } from "@/lib/data/adapters/osm";
import { fetchNeighborhoodPlacesFromDb, supabaseConfigured } from "@/lib/data/adapters/osm-db";
import {
  OpenRouteServiceIsochroneSource,
  isochroneConfigured,
  type WalkIsochrone,
} from "@/lib/data/adapters/isochrone";
import type { BaselinePlace } from "@/lib/data/adapters/types";
import { buildNeighborhoodReport, type NeighborhoodMeta, type NeighborhoodReport } from "./build";
import { resolveNeighborhoodPlaces } from "./source";
import { getProfile } from "@/lib/scoring/profiles";
import {
  SAMPLE_NEIGHBORHOODS,
  SAMPLE_DEMOGRAPHICS,
  getSampleNeighborhood,
  getSamplePlaces,
} from "@/lib/data/seed/ankara";

/** Reference year for demographic freshness; injectable for tests. */
const CURRENT_YEAR = 2026;

/** Radius around the centroid to collect live places (meters) — matches reachable band. */
const OSM_RADIUS_M = 1200;

/** Live OSM changes slowly; cache a day to stay well within Overpass limits. */
const OSM_REVALIDATE_SECONDS = 60 * 60 * 24;
/** Seeded DB is authoritative but re-seeded periodically; a short cache is plenty. */
const DB_REVALIDATE_SECONDS = 60 * 60;

// 8s keeps the whole request under Vercel's default function limit (Hobby ~10s),
// so a slow Overpass triggers the next source instead of a hard timeout.
const osm = new OsmBaselineSource({ timeoutMs: 8_000 });

const fetchLiveCached = unstable_cache(
  async (_slug: string, lat: number, lng: number): Promise<BaselinePlace[]> =>
    osm.fetchNearby({ lat, lng }, OSM_RADIUS_M),
  ["osm-neighborhood-places"],
  { revalidate: OSM_REVALIDATE_SECONDS },
);

const fetchDbCached = unstable_cache(
  async (slug: string): Promise<BaselinePlace[]> => fetchNeighborhoodPlacesFromDb(slug),
  ["osm-db-neighborhood-places"],
  { revalidate: DB_REVALIDATE_SECONDS },
);

/** Walk isochrones change only with the street network — cache a week. */
const ISOCHRONE_REVALIDATE_SECONDS = 60 * 60 * 24 * 7;

const fetchIsochronesCached = unstable_cache(
  async (_slug: string, lat: number, lng: number): Promise<WalkIsochrone[]> => {
    const src = new OpenRouteServiceIsochroneSource({
      apiKey: process.env.OPENROUTESERVICE_API_KEY!,
    });
    return src.getWalkingIsochrones({ lat, lng });
  },
  ["walk-isochrones"],
  { revalidate: ISOCHRONE_REVALIDATE_SECONDS },
);

/** Fetch routed walk isochrones when configured; undefined on absence/failure (→ estimate). */
async function getIsochrones(n: NeighborhoodMeta): Promise<WalkIsochrone[] | undefined> {
  if (!isochroneConfigured()) return undefined;
  try {
    return await fetchIsochronesCached(n.slug, n.centroid.lat, n.centroid.lng);
  } catch {
    return undefined;
  }
}

function forceSample(): boolean {
  return process.env.DATA_SOURCE === "sample";
}

export function listReportNeighborhoods() {
  return SAMPLE_NEIGHBORHOODS.map((n) => ({
    slug: n.slug,
    name: n.name,
    district: n.district,
    city: n.city,
  }));
}

/**
 * Report for an arbitrary point (§19.4) — e.g. a pin dropped on the map. No
 * pre-seeded data exists for random coordinates, so places come from live
 * Overpass around the point; empty on failure (an honest low-coverage report).
 */
export async function getPointReport(
  lat: number,
  lng: number,
  profileSlug: string | undefined,
  label: string,
): Promise<NeighborhoodReport> {
  const neighborhood: NeighborhoodMeta = {
    slug: "nokta",
    name: label,
    district: "",
    city: "",
    centroid: { lat, lng },
    boundaryConfidence: "experimental",
    isApproximate: true,
  };

  let places: BaselinePlace[] = [];
  if (!forceSample()) {
    try {
      places = await fetchLiveCached(`${lat},${lng}`, lat, lng);
    } catch {
      places = [];
    }
  }

  const profile = getProfile(profileSlug);
  const isochrones = await getIsochrones(neighborhood);

  return buildNeighborhoodReport({
    neighborhood,
    places,
    demographics: null,
    profile,
    currentYear: CURRENT_YEAR,
    sample: false,
    isochrones,
  });
}

export async function getNeighborhoodReport(
  slug: string,
  profileSlug: string | undefined,
): Promise<NeighborhoodReport | null> {
  const neighborhood = getSampleNeighborhood(slug);
  if (!neighborhood) return null;

  const { places, sample } = await resolveNeighborhoodPlaces(neighborhood, {
    realSources: [
      // 1. Supabase-seeded real data (only when configured).
      supabaseConfigured() ? (n: NeighborhoodMeta) => fetchDbCached(n.slug) : null,
      // 2. Live OSM fallback for un-seeded neighborhoods.
      (n: NeighborhoodMeta) => fetchLiveCached(n.slug, n.centroid.lat, n.centroid.lng),
    ],
    getSample: getSamplePlaces,
    forceSample: forceSample(),
  });

  const demographics = SAMPLE_DEMOGRAPHICS[slug] ?? null;
  const profile = getProfile(profileSlug);
  const isochrones = await getIsochrones(neighborhood);

  return buildNeighborhoodReport({
    neighborhood,
    places,
    demographics,
    profile,
    currentYear: CURRENT_YEAR,
    sample,
    isochrones,
  });
}
