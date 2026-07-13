/**
 * Report data access (CLAUDE.md §29 step 9, §12.1 prototype flow).
 *
 * Single entry point the report page calls. It fetches REAL places from
 * OpenStreetMap (Overpass) for the neighborhood, cached server-side to respect
 * Overpass usage limits, and falls back to the sample dataset if live data is
 * unavailable (offline dev, rate limit, network policy). Set `DATA_SOURCE=sample`
 * to force the sample dataset.
 *
 * Neighborhood definitions (centroid + metadata) come from the seed registry;
 * moving them to a PostGIS `neighborhoods` table later doesn't change this API.
 */

import { unstable_cache } from "next/cache";
import { OsmBaselineSource } from "@/lib/data/adapters/osm";
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

/** Radius around the centroid to collect places (meters) — matches reachable band. */
const OSM_RADIUS_M = 1200;

/** Live OSM data changes slowly; cache a day to stay well within Overpass limits. */
const OSM_REVALIDATE_SECONDS = 60 * 60 * 24;

// 8s keeps the whole request under Vercel's default function limit (Hobby ~10s),
// so a slow Overpass triggers our sample fallback instead of a hard timeout.
const osm = new OsmBaselineSource({ timeoutMs: 8_000 });

/** Cached live fetch, keyed by slug + coordinates. */
const fetchLiveCached = unstable_cache(
  async (_slug: string, lat: number, lng: number): Promise<BaselinePlace[]> => {
    return osm.fetchNearby({ lat, lng }, OSM_RADIUS_M);
  },
  ["osm-neighborhood-places"],
  { revalidate: OSM_REVALIDATE_SECONDS },
);

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

export async function getNeighborhoodReport(
  slug: string,
  profileSlug: string | undefined,
): Promise<NeighborhoodReport | null> {
  const neighborhood = getSampleNeighborhood(slug);
  if (!neighborhood) return null;

  const { places, sample } = await resolveNeighborhoodPlaces(neighborhood, {
    fetchLive: (n: NeighborhoodMeta) => fetchLiveCached(n.slug, n.centroid.lat, n.centroid.lng),
    getSample: getSamplePlaces,
    forceSample: forceSample(),
  });

  const demographics = SAMPLE_DEMOGRAPHICS[slug] ?? null;
  const profile = getProfile(profileSlug);

  return buildNeighborhoodReport({
    neighborhood,
    places,
    demographics,
    profile,
    currentYear: CURRENT_YEAR,
    sample,
  });
}
