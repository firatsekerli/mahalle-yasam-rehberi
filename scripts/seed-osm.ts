/**
 * Seed job — populate Supabase `osm_places` with real OpenStreetMap data
 * (CLAUDE.md §12.1, §15.5). Run where there is outbound network (your machine or
 * the "Seed OSM data" GitHub Action) — NOT from the app request path.
 *
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... pnpm seed:osm
 *
 * Fetches places around each pilot neighborhood's centroid via Overpass,
 * normalizes OSM tags to the platform taxonomy (reusing the app's tested
 * adapter), and upserts them keyed by (neighborhood_slug, source_id) so re-runs
 * refresh rather than duplicate.
 */

import { createClient } from "@supabase/supabase-js";
import { OsmBaselineSource } from "@/lib/data/adapters/osm";
import { SAMPLE_NEIGHBORHOODS } from "@/lib/data/seed/ankara";

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error(
    "Missing env. Set SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY.",
  );
  process.exit(1);
}

const RADIUS_M = 1200;

const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });
// Generous timeout — no Vercel function limit applies to the seed job.
const osm = new OsmBaselineSource({ timeoutMs: 60_000 });

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Overpass 504/429s under load on dense areas (e.g. central Kızılay). Retry with
 * backoff — the seed has no time limit, so give the server time to recover.
 */
async function fetchWithRetry(neighborhood: (typeof SAMPLE_NEIGHBORHOODS)[number]) {
  const backoffs = [5_000, 15_000, 30_000, 45_000];
  for (let attempt = 0; ; attempt++) {
    try {
      return await osm.fetchNearby(neighborhood.centroid, RADIUS_M);
    } catch (err) {
      if (attempt >= backoffs.length) throw err;
      const wait = backoffs[attempt];
      console.log(
        `\n  ${neighborhood.slug}: ${err instanceof Error ? err.message : String(err)} — retrying in ${wait / 1000}s (attempt ${attempt + 2}/${backoffs.length + 1})`,
      );
      await sleep(wait);
    }
  }
}

let hadError = false;

for (const n of SAMPLE_NEIGHBORHOODS) {
  try {
    process.stdout.write(`Fetching ${n.name} (${n.slug})… `);
    const places = await fetchWithRetry(n);
    const rows = places.map((p) => ({
      neighborhood_slug: n.slug,
      source_id: p.sourceId,
      name: p.name,
      category_slug: p.categorySlug,
      lng: p.location.lng,
      lat: p.location.lat,
      source_timestamp: p.sourceTimestamp,
    }));
    if (rows.length === 0) {
      console.log("0 places (skipped)");
      continue;
    }
    const { error } = await supabase
      .from("osm_places")
      .upsert(rows, { onConflict: "neighborhood_slug,source_id" });
    if (error) throw new Error(error.message);
    console.log(`${rows.length} places upserted`);
  } catch (err) {
    hadError = true;
    console.error(`\n  failed for ${n.slug}: ${err instanceof Error ? err.message : String(err)}`);
  }
}

console.log(hadError ? "Done with errors." : "Done.");
process.exit(hadError ? 1 : 0);
