/**
 * Report place-source resolution (CLAUDE.md §12.1, §15.5 prototype flow).
 *
 * Decides where a report's places come from and whether the result is real or
 * sample data. Kept pure and injectable (no `next/cache`, no `fetch`) so the
 * fallback logic is unit-testable; the live wiring lives in `data.ts`.
 *
 * Policy:
 *  - `forceSample` (env-driven) → always sample.
 *  - Otherwise try live OpenStreetMap; on error OR an empty result, fall back to
 *    sample so a report is never blank. An empty live result for a real
 *    neighborhood almost always means a transient/blocked fetch, not "nothing
 *    exists here", so sample is the safer render.
 */

import type { BaselinePlace } from "@/lib/data/adapters/types";
import type { NeighborhoodMeta } from "./build";

export interface ResolvedPlaces {
  places: BaselinePlace[];
  /** True when these are sample/prototype places (drives the honesty banner + confidence cap). */
  sample: boolean;
}

export interface ResolvePlacesDeps {
  /** Fetch real OSM places for the neighborhood; may throw or return []. */
  fetchLive: (neighborhood: NeighborhoodMeta) => Promise<BaselinePlace[]>;
  /** Sample fallback places for the neighborhood. */
  getSample: (slug: string) => BaselinePlace[];
  /** When true, skip live entirely and use sample (env: DATA_SOURCE=sample). */
  forceSample: boolean;
}

export async function resolveNeighborhoodPlaces(
  neighborhood: NeighborhoodMeta,
  deps: ResolvePlacesDeps,
): Promise<ResolvedPlaces> {
  if (deps.forceSample) {
    return { places: deps.getSample(neighborhood.slug), sample: true };
  }
  try {
    const live = await deps.fetchLive(neighborhood);
    if (live.length === 0) {
      return { places: deps.getSample(neighborhood.slug), sample: true };
    }
    return { places: live, sample: false };
  } catch {
    // Overpass down / rate-limited / blocked → never show a blank report.
    return { places: deps.getSample(neighborhood.slug), sample: true };
  }
}
