/**
 * Report place-source resolution (CLAUDE.md §12.1, §15.4/§15.5).
 *
 * Decides where a report's places come from and whether the result is real or
 * sample. Kept pure and injectable (no `next/cache`, no `fetch`, no Supabase) so
 * the ordering/fallback logic is unit-testable; the live wiring lives in
 * `data.ts`.
 *
 * Order of preference:
 *  1. `forceSample` (env) → always sample.
 *  2. Each real source in order (Supabase DB, then live OSM) — the first that
 *     returns a non-empty result wins (`sample: false`).
 *  3. Otherwise the sample dataset, so a report is never blank.
 *
 * A source that throws or returns [] is skipped, not fatal — an empty/failed
 * real source almost always means "not seeded / transient", not "nothing here".
 */

import type { BaselinePlace } from "@/lib/data/adapters/types";
import type { NeighborhoodMeta } from "./build";

export interface ResolvedPlaces {
  places: BaselinePlace[];
  /** True when these are sample/prototype places (drives the honesty banner + confidence cap). */
  sample: boolean;
}

export type PlaceFetcher = (neighborhood: NeighborhoodMeta) => Promise<BaselinePlace[]>;

export interface ResolvePlacesDeps {
  /** Real sources tried in order; first non-empty wins. Falsy entries are skipped. */
  realSources: (PlaceFetcher | undefined | false | null)[];
  /** Sample fallback places for the neighborhood. */
  getSample: (slug: string) => BaselinePlace[];
  /** When true, skip real sources and use sample (env: DATA_SOURCE=sample). */
  forceSample: boolean;
}

export async function resolveNeighborhoodPlaces(
  neighborhood: NeighborhoodMeta,
  deps: ResolvePlacesDeps,
): Promise<ResolvedPlaces> {
  if (!deps.forceSample) {
    for (const source of deps.realSources) {
      if (!source) continue;
      try {
        const places = await source(neighborhood);
        if (places.length > 0) return { places, sample: false };
      } catch {
        // Skip this source (down / rate-limited / not seeded) and try the next.
      }
    }
  }
  return { places: deps.getSample(neighborhood.slug), sample: true };
}
