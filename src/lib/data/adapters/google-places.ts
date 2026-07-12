/**
 * Google Places enrichment adapter (CLAUDE.md §12.3, §31.1).
 *
 * LAZY, on-demand, single-place enrichment only. Guardrails encoded here:
 *  - Never bulk-fetch a whole neighborhood; `enrichPlace` handles ONE place.
 *  - Cap reviews at MAX_REVIEWS (Places API returns at most 5).
 *  - Return required attribution with every result; callers MUST display it.
 *  - Data is refreshable/ephemeral — isolated from the permanent OSM record.
 *
 * Implementation is intentionally stubbed until the Places API integration and a
 * current terms review land (§12.3 requires verifying terms before implementing).
 */

import type {
  BaselinePlace,
  PlaceEnrichment,
  PlaceEnrichmentSource,
} from "./types";

/** Policy + API ceiling on review excerpts (§31.1). */
export const MAX_REVIEWS = 5;

export const GOOGLE_ATTRIBUTION = "Ratings and reviews © Google";

export class GooglePlacesEnrichmentSource implements PlaceEnrichmentSource {
  readonly provider = "google" as const;

  constructor(private readonly apiKey: string | undefined) {}

  async enrichPlace(place: BaselinePlace): Promise<PlaceEnrichment | null> {
    if (!this.apiKey) {
      // No key configured: the product still works on the open-data baseline.
      return null;
    }
    // TODO: Implement Places API (New) Text/Nearby match + Place Details with a
    // strict field mask (id, rating, userRatingCount, businessStatus,
    // reviews(<=5), googleMapsUri). Verify current Maps Platform terms first
    // (§12.3). Enforce MAX_REVIEWS and attach GOOGLE_ATTRIBUTION on the result.
    void place;
    throw new Error("GooglePlacesEnrichmentSource.enrichPlace not implemented yet");
  }
}
