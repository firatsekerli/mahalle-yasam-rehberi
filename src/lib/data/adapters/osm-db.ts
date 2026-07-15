/**
 * Supabase-backed OSM place source (CLAUDE.md §15.4, §29 step 7).
 *
 * Reads real OpenStreetMap places (populated by the seed job) from the
 * `osm_places` table for a neighborhood. This is the reliable production read
 * path — no request-time Overpass dependency. Public OSM data is read with the
 * anon key under a permissive RLS select policy.
 *
 * The row → `BaselinePlace` mapping is pure and exported for testing.
 */

import { createClient } from "@supabase/supabase-js";
import type { BaselinePlace, GeoPoint } from "./types";
import { haversineMeters } from "@/lib/geo/distance";

export interface OsmPlaceRow {
  source_id: string;
  name: string;
  category_slug: string;
  lng: number;
  lat: number;
  source_timestamp: string | null;
}

export function rowToBaselinePlace(row: OsmPlaceRow): BaselinePlace {
  return {
    source: "osm",
    sourceId: row.source_id,
    name: row.name,
    categorySlug: row.category_slug,
    location: { lat: row.lat, lng: row.lng },
    // Missing timestamp is treated as very old (epoch) rather than "now" (§13).
    sourceTimestamp: row.source_timestamp ?? new Date(0).toISOString(),
  };
}

/** True when the public Supabase env is configured for reads. */
export function supabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

/**
 * Fetch a neighborhood's places from `osm_places`. Throws on a query error so
 * the caller can fall back to another source (§ report/source.ts).
 */
export async function fetchNeighborhoodPlacesFromDb(slug: string): Promise<BaselinePlace[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const { data, error } = await supabase
    .from("osm_places")
    .select("source_id,name,category_slug,lng,lat,source_timestamp")
    .eq("neighborhood_slug", slug);

  if (error) throw new Error(`Supabase osm_places read failed: ${error.message}`);
  return (data ?? []).map(rowToBaselinePlace);
}

/**
 * Fetch seeded places within `radiusMeters` of an arbitrary point, across all
 * neighborhoods. Used by point reports (§19.4): a pin dropped near a seeded area
 * gets reliable real data instead of depending on live Overpass in the request
 * path. Filters by a lng/lat bounding box in SQL, then trims to a true circle in
 * JS (the prototype table has no PostGIS geometry — plain columns by design).
 * Throws on a query error so the caller can fall back to live OSM.
 */
export async function fetchPlacesNearFromDb(
  center: GeoPoint,
  radiusMeters: number,
): Promise<BaselinePlace[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  // Degrees per meter — longitude shrinks with latitude. A small over-fetch in
  // the box is fine; the haversine pass below enforces the exact radius.
  const dLat = radiusMeters / 111_320;
  const dLng = radiusMeters / (111_320 * Math.cos((center.lat * Math.PI) / 180) || 1);

  const { data, error } = await supabase
    .from("osm_places")
    .select("source_id,name,category_slug,lng,lat,source_timestamp")
    .gte("lat", center.lat - dLat)
    .lte("lat", center.lat + dLat)
    .gte("lng", center.lng - dLng)
    .lte("lng", center.lng + dLng);

  if (error) throw new Error(`Supabase osm_places radius read failed: ${error.message}`);

  return (data ?? [])
    .map(rowToBaselinePlace)
    .filter((p) => haversineMeters(center, p.location) <= radiusMeters);
}
