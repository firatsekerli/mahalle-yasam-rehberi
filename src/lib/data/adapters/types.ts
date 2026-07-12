/**
 * Data-source adapter contracts (CLAUDE.md §28).
 *
 * All provider-specific integrations sit behind these interfaces so sources can
 * be swapped without touching scoring or UI. Two distinct roles:
 *
 *  - `PlaceBaselineSource`: the permanent, license-friendly place record
 *    (OpenStreetMap). Safe to store and republish with attribution (§12.1).
 *  - `PlaceEnrichmentSource`: refreshable, licensed enrichment (Google Places).
 *    Fetched lazily per place, isolated from the permanent record, never bulk
 *    scraped, capped and cached only within provider terms (§12.3, §31.1).
 */

export interface GeoPoint {
  lng: number;
  lat: number;
}

/** A place as stored in the permanent open-data record. */
export interface BaselinePlace {
  /** Provider-native id (e.g. "node/123"), namespaced by `source`. */
  sourceId: string;
  source: "osm";
  name: string;
  /** Normalized platform category slug (see taxonomy). */
  categorySlug: string;
  location: GeoPoint;
  address?: string;
  /** ISO timestamp of the source snapshot — freshness feeds confidence (§13). */
  sourceTimestamp: string;
}

export interface PlaceBaselineSource {
  readonly source: "osm";
  /** Fetch baseline places within `radiusMeters` of a point. */
  fetchNearby(center: GeoPoint, radiusMeters: number): Promise<BaselinePlace[]>;
}

/** One Google review excerpt — displayed with attribution, never stored long-term (§31.1). */
export interface ReviewExcerpt {
  authorName: string;
  rating: number;
  text: string;
  /** Relative time description as provided by the source ("a month ago"). */
  relativeTime: string;
  /** Link back to the review on the provider — required attribution. */
  authorUrl?: string;
}

/** Licensed enrichment for a single place. Treated as ephemeral/refreshable. */
export interface PlaceEnrichment {
  provider: "google";
  providerPlaceId: string;
  rating?: number;
  ratingCount?: number;
  businessStatus?: "operational" | "closed_temporarily" | "closed_permanently";
  /** Up to 5 — the Places API ceiling and our policy cap (§31.1). */
  reviews: ReviewExcerpt[];
  mapsUrl?: string;
  /** When this was fetched — enrichment must be refreshed, not permanently kept. */
  fetchedAt: string;
  /** Attribution string that MUST be shown wherever this data appears. */
  attribution: string;
}

export interface PlaceEnrichmentSource {
  readonly provider: "google";
  /**
   * LAZY enrichment for ONE place, called only when a user opens/expands that
   * business (§31.1). Never call this in a loop over a whole neighborhood.
   */
  enrichPlace(place: BaselinePlace): Promise<PlaceEnrichment | null>;
}
