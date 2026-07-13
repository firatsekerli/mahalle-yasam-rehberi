/**
 * Report data access (CLAUDE.md §29 step 9).
 *
 * The single entry point the report page calls. Today it reads the sample
 * prototype dataset; when the worker import lands it will read the live OSM
 * baseline + demographics from PostGIS behind this same function, so the page
 * and view model don't change (§28 — sources sit behind adapters).
 */

import { buildNeighborhoodReport, type NeighborhoodReport } from "./build";
import { getProfile } from "@/lib/scoring/profiles";
import {
  SAMPLE_NEIGHBORHOODS,
  SAMPLE_DEMOGRAPHICS,
  getSampleNeighborhood,
  getSamplePlaces,
} from "@/lib/data/seed/ankara";

/** Reference year for demographic freshness; injectable for tests. */
const CURRENT_YEAR = 2026;

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

  const places = getSamplePlaces(slug);
  const demographics = SAMPLE_DEMOGRAPHICS[slug] ?? null;
  const profile = getProfile(profileSlug);

  return buildNeighborhoodReport({
    neighborhood,
    places,
    demographics,
    profile,
    currentYear: CURRENT_YEAR,
    sample: true,
  });
}
