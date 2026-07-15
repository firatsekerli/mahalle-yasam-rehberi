/**
 * Report data access (CLAUDE.md §29 step 9, §15.4, §12.2).
 *
 * Single entry point the report page calls. There are three report kinds:
 *   - Curated pilot (`getNeighborhoodReport` → sample registry): live OSM first,
 *     Supabase `osm_places` snapshot as a reliability fallback, then sample.
 *   - Dynamic OSM-indexed mahalle (`getIndexedNeighborhoodReport`): looked up by
 *     slug in `neighborhood_index`; when it's a boundary relation we fetch the
 *     real polygon and keep only the live places *inside* it (no radius overlap),
 *     falling back to a centroid radius otherwise.
 *   - Arbitrary point (`getPointReport`): seeded-near then live OSM by radius.
 * All external fetches are cached server-side. `DATA_SOURCE=sample` forces the
 * sample dataset.
 */

import { unstable_cache } from "next/cache";
import { OsmBaselineSource } from "@/lib/data/adapters/osm";
import {
  fetchNeighborhoodPlacesFromDb,
  fetchPlacesNearFromDb,
  supabaseConfigured,
} from "@/lib/data/adapters/osm-db";
import {
  fetchIndexedNeighborhoods,
  fetchIndexedNeighborhoodBySlug,
} from "@/lib/data/adapters/neighborhood-index-db";
import { AdminOsmSource } from "@/lib/data/adapters/admin-osm";
import { areaSlug } from "@/lib/text/slug";
import { pointInArea, type Area } from "@/lib/geo/polygon";
import { haversineMeters } from "@/lib/geo/distance";
import {
  OpenRouteServiceIsochroneSource,
  isochroneConfigured,
  type WalkIsochrone,
} from "@/lib/data/adapters/isochrone";
import type { BaselinePlace, GeoPoint } from "@/lib/data/adapters/types";
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
/** Indexed hierarchy changes only when the import job runs — cache generously. */
const INDEX_REVALIDATE_SECONDS = 60 * 60 * 24;

// 8s keeps the whole request under Vercel's default function limit (Hobby ~10s),
// so a slow Overpass triggers the next source instead of a hard timeout.
const osm = new OsmBaselineSource({ timeoutMs: 8_000 });

const fetchLiveCached = unstable_cache(
  async (_slug: string, lat: number, lng: number): Promise<BaselinePlace[]> =>
    osm.fetchNearby({ lat, lng }, OSM_RADIUS_M),
  ["osm-neighborhood-places"],
  { revalidate: OSM_REVALIDATE_SECONDS },
);

/** Live places within a caller-chosen radius (used to cover a mahalle boundary bbox). */
const fetchLiveRadiusCached = unstable_cache(
  async (_key: string, lat: number, lng: number, radius: number): Promise<BaselinePlace[]> =>
    osm.fetchNearby({ lat, lng }, radius),
  ["osm-places-radius"],
  { revalidate: OSM_REVALIDATE_SECONDS },
);

/** Boundaries change very rarely — cache a month. */
const BOUNDARY_REVALIDATE_SECONDS = 60 * 60 * 24 * 30;
// Generous timeout still under Vercel's function limit; a slow boundary fetch
// just means we fall back to a radius rather than blocking the report.
const admin = new AdminOsmSource({ timeoutMs: 8_000 });

const fetchBoundaryCached = unstable_cache(
  async (relationId: number): Promise<Area | null> => admin.fetchBoundary(relationId),
  ["mahalle-boundary"],
  { revalidate: BOUNDARY_REVALIDATE_SECONDS },
);

const fetchIndexBySlugCached = unstable_cache(
  async (slug: string) => fetchIndexedNeighborhoodBySlug(slug),
  ["neighborhood-index-by-slug"],
  { revalidate: INDEX_REVALIDATE_SECONDS },
);

/** "relation/123" → 123; null for place nodes (no boundary). */
function relationIdOf(osmId: string | undefined): number | null {
  const m = osmId ? /^relation\/(\d+)$/.exec(osmId) : null;
  return m ? Number(m[1]) : null;
}

/** Radius from the centroid that covers the whole boundary, clamped to a sane range. */
function boundaryFetchRadius(centroid: GeoPoint, area: Area): number {
  let max = 0;
  for (const ring of area.outer) {
    for (const [lng, lat] of ring) {
      max = Math.max(max, haversineMeters(centroid, { lat, lng }));
    }
  }
  return Math.min(Math.max(Math.ceil(max * 1.05), 300), 5000);
}

const fetchDbCached = unstable_cache(
  async (slug: string): Promise<BaselinePlace[]> => fetchNeighborhoodPlacesFromDb(slug),
  ["osm-db-neighborhood-places"],
  { revalidate: DB_REVALIDATE_SECONDS },
);

const fetchDbNearCached = unstable_cache(
  async (lat: number, lng: number): Promise<BaselinePlace[]> =>
    fetchPlacesNearFromDb({ lat, lng }, OSM_RADIUS_M),
  ["osm-db-places-near"],
  { revalidate: DB_REVALIDATE_SECONDS },
);

/** Drop places that share an OSM id (a POI can be seeded under two neighborhoods). */
function dedupeBySourceId(places: BaselinePlace[]): BaselinePlace[] {
  const seen = new Set<string>();
  return places.filter((p) => (seen.has(p.sourceId) ? false : (seen.add(p.sourceId), true)));
}

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

/** One selectable area for the picker. Routing is always by slug (`/n/[slug]`). */
export interface ReportNeighborhoodItem {
  slug: string;
  name: string;
  district: string;
  city: string;
}

const fetchIndexCached = unstable_cache(
  async (): Promise<ReportNeighborhoodItem[]> =>
    (await fetchIndexedNeighborhoods()).map((n) => ({
      slug: n.slug,
      name: n.name,
      district: n.district,
      city: n.city,
    })),
  ["neighborhood-index"],
  { revalidate: INDEX_REVALIDATE_SECONDS },
);

const normKey = (city: string, district: string, name: string) =>
  areaSlug(city, district, name);

/**
 * The selectable neighborhoods for the picker: curated sample areas first (they
 * have rich `/n/[slug]` pages), then the dynamic OSM-indexed mahalle, with any
 * that duplicate a curated area removed. Falls back to just the curated set when
 * the index is empty or Supabase isn't configured — never empty, never hardcoded
 * beyond the pilot seed.
 */
export async function listReportNeighborhoods(): Promise<ReportNeighborhoodItem[]> {
  const curated: ReportNeighborhoodItem[] = SAMPLE_NEIGHBORHOODS.map((n) => ({
    slug: n.slug,
    name: n.name,
    district: n.district,
    city: n.city,
  }));

  let indexed: ReportNeighborhoodItem[] = [];
  try {
    indexed = await fetchIndexCached();
  } catch {
    indexed = [];
  }

  const seen = new Set(curated.map((c) => normKey(c.city, c.district, c.name)));
  const dynamic = indexed.filter((n) => {
    const key = normKey(n.city, n.district, n.name);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return [...curated, ...dynamic];
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
  place: { district?: string; city?: string } = {},
): Promise<NeighborhoodReport> {
  const neighborhood: NeighborhoodMeta = {
    slug: "nokta",
    name: label,
    district: place.district ?? "",
    city: place.city ?? "",
    centroid: { lat, lng },
    boundaryConfidence: "experimental",
    isApproximate: true,
  };

  // Prefer already-seeded data near the point (fast, reliable, no request-time
  // Overpass); fall back to live OSM for points far from any seeded area. Empty
  // on total failure — an honest low-coverage report, never a fabricated one.
  let places: BaselinePlace[] = [];
  if (!forceSample()) {
    if (supabaseConfigured()) {
      try {
        places = dedupeBySourceId(await fetchDbNearCached(lat, lng));
      } catch {
        places = [];
      }
    }
    if (places.length === 0) {
      try {
        places = await fetchLiveCached(`${lat},${lng}`, lat, lng);
      } catch {
        places = [];
      }
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
  // Not a curated pilot → try the dynamic OSM-indexed mahalle (boundary-aware).
  if (!neighborhood) return getIndexedNeighborhoodReport(slug, profileSlug);

  const { places, sample } = await resolveNeighborhoodPlaces(neighborhood, {
    realSources: [
      // 1. Live OpenStreetMap first — the list should reflect current reality
      //    (cached a day to stay within Overpass limits).
      (n: NeighborhoodMeta) => fetchLiveCached(n.slug, n.centroid.lat, n.centroid.lng),
      // 2. Supabase-seeded snapshot as a reliability fallback when live OSM is
      //    down / rate-limited / returns empty (keeps pilot areas dependable).
      supabaseConfigured() ? (n: NeighborhoodMeta) => fetchDbCached(n.slug) : null,
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

/**
 * Report for a dynamic OSM-indexed mahalle (§19.4, §12.2). Looks the mahalle up
 * by slug, fetches its real boundary polygon when it's a relation, then keeps
 * only the live places that fall *inside* that boundary — so a business in the
 * next mahalle no longer leaks in (the radius-overlap problem). Falls back to a
 * centroid radius (labeled approximate) for place-node mahalle or when the
 * boundary can't be fetched. Returns null when the slug isn't indexed.
 */
async function getIndexedNeighborhoodReport(
  slug: string,
  profileSlug: string | undefined,
): Promise<NeighborhoodReport | null> {
  if (forceSample()) return null;

  let indexed = null;
  try {
    indexed = await fetchIndexBySlugCached(slug);
  } catch {
    indexed = null;
  }
  if (!indexed) return null;

  const centroid: GeoPoint = { lat: indexed.lat, lng: indexed.lng };
  const neighborhood: NeighborhoodMeta = {
    slug,
    name: indexed.name,
    district: indexed.district,
    city: indexed.city,
    centroid,
    boundaryConfidence: "experimental",
    isApproximate: true,
  };

  // Fetch the real boundary for relation-type mahalle; null → radius fallback.
  let boundary: Area | null = null;
  const relationId = relationIdOf(indexed.osmId);
  if (relationId !== null) {
    try {
      boundary = await fetchBoundaryCached(relationId);
    } catch {
      boundary = null;
    }
  }

  const radius = boundary ? boundaryFetchRadius(centroid, boundary) : OSM_RADIUS_M;
  let places: BaselinePlace[] = [];
  try {
    places = await fetchLiveRadiusCached(slug, centroid.lat, centroid.lng, radius);
  } catch {
    places = [];
  }
  if (boundary) {
    const b = boundary;
    places = places.filter((p) => pointInArea(p.location, b));
  }

  const isochrones = await getIsochrones(neighborhood);

  return buildNeighborhoodReport({
    neighborhood,
    places,
    demographics: null,
    profile: getProfile(profileSlug),
    currentYear: CURRENT_YEAR,
    sample: false,
    isochrones,
    boundaryPrecise: boundary !== null,
  });
}
