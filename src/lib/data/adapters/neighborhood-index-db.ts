/**
 * Supabase read path for the neighborhood selector (CLAUDE.md §19.2).
 *
 * Reads the `neighborhood_index` table (populated by scripts/import-admin.ts)
 * into flat picker items — province (il) / district (ilçe) / mahalle + an
 * approximate centroid. The cascading dropdowns derive their İl and İlçe lists
 * from these rows, so the selector lists exactly what we can report on, with
 * nothing hardcoded. Public reference data is read with the anon key under a
 * permissive select policy.
 */

import { createClient } from "@supabase/supabase-js";
import { supabaseConfigured } from "./osm-db";

export interface NeighborhoodIndexRow {
  slug: string;
  name: string;
  district: string;
  province: string;
  lat: number;
  lng: number;
}

/** A selectable area for the picker — a dynamic mahalle with an approximate center. */
export interface IndexedNeighborhood {
  slug: string;
  name: string;
  district: string;
  city: string;
  lat: number;
  lng: number;
}

export function rowToIndexedNeighborhood(row: NeighborhoodIndexRow): IndexedNeighborhood {
  return {
    slug: row.slug,
    name: row.name,
    district: row.district,
    city: row.province,
    lat: row.lat,
    lng: row.lng,
  };
}

/** PostgREST returns at most 1000 rows per request; page through larger sets. */
const PAGE = 1000;

/**
 * Fetch all indexed neighborhoods (paged). Returns [] when Supabase isn't
 * configured so callers fall back to the curated sample set. Throws only on a
 * real query error, so a misconfiguration is visible rather than silent.
 */
export async function fetchIndexedNeighborhoods(): Promise<IndexedNeighborhood[]> {
  if (!supabaseConfigured()) return [];
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const out: IndexedNeighborhood[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("neighborhood_index")
      .select("slug,name,district,province,lat,lng")
      .order("province")
      .order("district")
      .order("name")
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`Supabase neighborhood_index read failed: ${error.message}`);
    const rows = (data ?? []) as NeighborhoodIndexRow[];
    out.push(...rows.map(rowToIndexedNeighborhood));
    if (rows.length < PAGE) break;
  }
  return out;
}
