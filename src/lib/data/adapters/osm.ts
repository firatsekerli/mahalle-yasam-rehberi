/**
 * OpenStreetMap baseline adapter (CLAUDE.md §12.1).
 *
 * OSM is the permanent, license-friendly place baseline. For the prototype this
 * queries Overpass for a single neighborhood/radius; for production the Turkey
 * extract is imported into PostGIS by the Python worker and this reads from the
 * DB instead. Raw OSM tags are normalized to the platform taxonomy (§10, §29
 * step 6) before a place is returned.
 *
 * The Overpass query builder and response parser are pure and exported so they
 * can be unit-tested without hitting the network; the class only adds the fetch.
 */

import { normalizeOsmTags, type OsmTags } from "@/lib/taxonomy/osm-mapping";
import type { BaselinePlace, GeoPoint, PlaceBaselineSource } from "./types";

const DEFAULT_ENDPOINT = "https://overpass-api.de/api/interpreter";

/** Minimal shape of an Overpass element we consume (`out center tags`). */
interface OverpassElement {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: OsmTags;
}

interface OverpassResponse {
  elements?: OverpassElement[];
}

/**
 * Build an Overpass QL query for all candidate places within `radiusMeters` of
 * a point. We fetch the broad keys we normalize from and filter/categorize in
 * code, so the query stays stable as the taxonomy grows. `out center` resolves a
 * representative point for ways/relations; nodes carry their own lat/lon.
 */
export function overpassQuery(center: GeoPoint, radiusMeters: number): string {
  const r = Math.round(radiusMeters);
  const at = `${center.lat},${center.lng}`;
  const around = (filter: string) => `  nwr(around:${r},${at})${filter};`;
  const filters = [
    "[shop]",
    "[amenity]",
    "[leisure]",
    "[healthcare]",
    '[railway~"^(station|subway_entrance)$"]',
    "[highway=bus_stop]",
    "[sport]",
  ];
  return [
    "[out:json][timeout:25];",
    "(",
    ...filters.map(around),
    ");",
    "out center tags;",
  ].join("\n");
}

function elementLocation(el: OverpassElement): GeoPoint | null {
  if (typeof el.lat === "number" && typeof el.lon === "number") {
    return { lat: el.lat, lng: el.lon };
  }
  if (el.center) return { lat: el.center.lat, lng: el.center.lon };
  return null;
}

function bestName(tags: OsmTags, fallback: string): string {
  return tags.name || tags["name:tr"] || tags["name:en"] || fallback;
}

/**
 * Parse an Overpass JSON response into normalized baseline places. Elements that
 * don't map to a tracked category, or that lack a resolvable location, are
 * dropped. `sourceTimestamp` stamps freshness (§13) — pass the fetch time.
 */
export function parseOverpassResponse(
  json: OverpassResponse,
  sourceTimestamp: string,
): BaselinePlace[] {
  const places: BaselinePlace[] = [];
  for (const el of json.elements ?? []) {
    const tags = el.tags;
    if (!tags) continue;
    const categorySlug = normalizeOsmTags(tags);
    if (!categorySlug) continue;
    const location = elementLocation(el);
    if (!location) continue;
    places.push({
      source: "osm",
      sourceId: `${el.type}/${el.id}`,
      // Unnamed evidence (e.g. a bus stop) still counts toward coverage; label
      // it by category so the baseline never carries an empty name.
      name: bestName(tags, categorySlug),
      categorySlug,
      location,
      address: composeAddress(tags),
      sourceTimestamp,
    });
  }
  return places;
}

function composeAddress(tags: OsmTags): string | undefined {
  const parts = [
    [tags["addr:street"], tags["addr:housenumber"]].filter(Boolean).join(" "),
    tags["addr:neighbourhood"] ?? tags["addr:suburb"],
    tags["addr:city"],
  ].filter(Boolean);
  return parts.length ? parts.join(", ") : undefined;
}

export interface OsmBaselineSourceOptions {
  /** Overpass endpoint; override for a self-hosted instance or tests. */
  endpoint?: string;
  /** Injectable fetch for testing; defaults to the global fetch. */
  fetchImpl?: typeof fetch;
  /** Injectable clock for deterministic `sourceTimestamp` in tests. */
  now?: () => Date;
  /** Abort the request after this many ms so a slow Overpass can't stall a page. */
  timeoutMs?: number;
}

export class OsmBaselineSource implements PlaceBaselineSource {
  readonly source = "osm" as const;
  private readonly endpoint: string;
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => Date;
  private readonly timeoutMs: number;

  constructor(opts: OsmBaselineSourceOptions = {}) {
    this.endpoint = opts.endpoint ?? DEFAULT_ENDPOINT;
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.now = opts.now ?? (() => new Date());
    this.timeoutMs = opts.timeoutMs ?? 15_000;
  }

  async fetchNearby(center: GeoPoint, radiusMeters: number): Promise<BaselinePlace[]> {
    const query = overpassQuery(center, radiusMeters);
    const res = await this.fetchImpl(this.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        // Identify the client politely on the shared public endpoint.
        "User-Agent": "MahalleYasam/0.1 (neighborhood report prototype)",
      },
      body: new URLSearchParams({ data: query }).toString(),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!res.ok) {
      // Surface a clear, actionable API error (Overpass rate-limits with 429).
      throw new Error(`Overpass API error ${res.status} ${res.statusText}`);
    }
    const json = (await res.json()) as OverpassResponse;
    return parseOverpassResponse(json, this.now().toISOString());
  }
}
