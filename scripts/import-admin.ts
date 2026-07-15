/**
 * Import job — populate Supabase `neighborhood_index` with Turkey's il / ilçe /
 * mahalle from OpenStreetMap administrative data (CLAUDE.md §12.1, §12.2, §19.2).
 * Run where there is outbound network (your machine or the "Import admin data"
 * GitHub Action) — NOT from the app request path.
 *
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... PROVINCES="Ankara" pnpm import:admin
 *
 * For each province it fetches ilçe (admin_level 6), then the mahalle inside each
 * ilçe (boundary relations + place nodes), and upserts them keyed by a stable
 * il-ilçe-mahalle slug so re-runs refresh rather than duplicate. Centroids are
 * approximate (§12.2); every report built from them is labeled as such.
 */

import { createClient } from "@supabase/supabase-js";
import { AdminOsmSource, type AdminUnit } from "@/lib/data/adapters/admin-osm";
import { areaSlug } from "@/lib/text/slug";

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
// Comma-separated il names; defaults to the Ankara pilot (§18.1).
const provinces = (process.env.PROVINCES ?? "Ankara")
  .split(",")
  .map((p) => p.trim())
  .filter(Boolean);

if (!url || !serviceKey) {
  console.error(
    "Missing env. Set SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY.",
  );
  process.exit(1);
}

/** Be polite to the shared Overpass server between heavy queries. */
const BETWEEN_QUERIES_MS = 8_000;

const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });
const osm = new AdminOsmSource({ timeoutMs: 180_000 });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Retry Overpass with backoff — the import job has no time limit. */
async function withRetry<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const backoffs = [5_000, 15_000, 30_000, 45_000];
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt >= backoffs.length) throw err;
      const wait = backoffs[attempt];
      console.log(
        `\n  ${label}: ${err instanceof Error ? err.message : String(err)} — retrying in ${wait / 1000}s (attempt ${attempt + 2}/${backoffs.length + 1})`,
      );
      await sleep(wait);
    }
  }
}

function toRows(province: string, district: string, mahalle: AdminUnit[]) {
  const rows = mahalle.map((m) => ({
    slug: areaSlug(province, district, m.name),
    name: m.name,
    district,
    province,
    lat: m.lat,
    lng: m.lng,
    osm_id: m.osmId,
    source: "openstreetmap",
    boundary_confidence: "experimental",
  }));
  // Guard against duplicate slugs within one batch (two same-named mahalle in an
  // ilçe) — upsert would otherwise reject the batch on its unique constraint.
  const seen = new Set<string>();
  return rows.filter((r) => (seen.has(r.slug) ? false : (seen.add(r.slug), true)));
}

let hadError = false;
let firstQuery = true;

for (const province of provinces) {
  try {
    if (!firstQuery) await sleep(BETWEEN_QUERIES_MS);
    firstQuery = false;
    process.stdout.write(`\n${province}: fetching ilçe… `);
    const districts = await withRetry(`${province} ilçe`, () => osm.fetchDistricts(province));
    console.log(`${districts.length} ilçe`);
    if (districts.length === 0) {
      console.warn(`  no ilçe found for "${province}" — check the province name.`);
      continue;
    }

    for (const d of districts) {
      await sleep(BETWEEN_QUERIES_MS);
      try {
        process.stdout.write(`  ${d.name}: fetching mahalle… `);
        const mahalle = await withRetry(`${province}/${d.name}`, () =>
          osm.fetchNeighborhoods(d.osmNumericId),
        );
        const rows = toRows(province, d.name, mahalle);
        if (rows.length === 0) {
          console.log("0 (skipped)");
          continue;
        }
        const { error } = await supabase
          .from("neighborhood_index")
          .upsert(rows, { onConflict: "slug" });
        if (error) throw new Error(error.message);
        console.log(`${rows.length} mahalle upserted`);
      } catch (err) {
        hadError = true;
        console.error(
          `\n    failed for ${province}/${d.name}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  } catch (err) {
    hadError = true;
    console.error(
      `\n  failed for ${province}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

console.log(hadError ? "\nDone with errors." : "\nDone.");
process.exit(hadError ? 1 : 0);
