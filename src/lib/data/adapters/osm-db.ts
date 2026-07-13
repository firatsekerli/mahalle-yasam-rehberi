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
import type { BaselinePlace } from "./types";

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
