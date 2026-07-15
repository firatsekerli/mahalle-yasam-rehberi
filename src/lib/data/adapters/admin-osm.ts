/**
 * OpenStreetMap administrative-hierarchy adapter (CLAUDE.md §12.1, §12.2, §19.2).
 *
 * Fetches Turkey's il → ilçe → mahalle from OSM boundaries so the neighborhood
 * selector is data-driven, not hardcoded. Two steps, both hierarchy-correct:
 *   1. `districtsQuery(province)` — ilçe (admin_level 6) inside a named il (level 4).
 *   2. `neighborhoodsInAreaQuery(districtRelationId)` — mahalle inside one ilçe's
 *      area, so each result is parented to that ilçe without point-in-polygon.
 *
 * Mahalle appear in OSM either as boundary relations (admin_level 9/10) or as
 * place nodes (neighbourhood/quarter/suburb); we take both. Query builders and
 * the parser are pure and exported for unit testing; the class only adds fetch.
 * All centroids are approximate (§12.2) — labeled as such downstream.
 */

import type { OsmTags } from "@/lib/taxonomy/osm-mapping";
import { assembleRings } from "@/lib/geo/rings";
import type { Area } from "@/lib/geo/polygon";

const DEFAULT_ENDPOINT = "https://overpass-api.de/api/interpreter";

/** Overpass converts a relation id to an area id by adding this offset. */
const OVERPASS_AREA_OFFSET = 3_600_000_000;

/** One administrative unit parsed from Overpass (`out tags center`). */
export interface AdminUnit {
  /** OSM element id, e.g. "relation/1234" or "node/56". */
  osmId: string;
  /** Numeric OSM id (needed to derive an area id for child queries). */
  osmNumericId: number;
  osmType: "relation" | "node" | "way";
  name: string;
  lat: number;
  lng: number;
}

/** Escape a value for safe interpolation inside an Overpass `["name"="…"]` filter. */
function q(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/**
 * Ilçe (admin_level 6) within a province named `province` (il, admin_level 4).
 * Province names are unique at level 4 in Turkey, so the name filter is safe.
 */
export function districtsQuery(province: string): string {
  return [
    "[out:json][timeout:180];",
    `area["boundary"="administrative"]["admin_level"="4"]["name"="${q(province)}"]->.il;`,
    'relation(area.il)["boundary"="administrative"]["admin_level"="6"];',
    "out tags center;",
  ].join("\n");
}

/**
 * Mahalle within a single ilçe, addressed by that ilçe's OSM *relation* id.
 * Takes both administrative boundary relations (level 9/10) and place nodes.
 */
export function neighborhoodsInAreaQuery(districtRelationId: number): string {
  const areaId = OVERPASS_AREA_OFFSET + districtRelationId;
  return [
    "[out:json][timeout:180];",
    `area(${areaId})->.ilce;`,
    "(",
    '  relation(area.ilce)["boundary"="administrative"]["admin_level"~"^(9|10)$"];',
    '  node(area.ilce)["place"~"^(neighbourhood|quarter|suburb)$"];',
    ");",
    "out tags center;",
  ].join("\n");
}

interface OverpassMember {
  type: "node" | "way" | "relation";
  role?: string;
  geometry?: { lat: number; lon: number }[];
}

interface OverpassElement {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: OsmTags;
  members?: OverpassMember[];
}

interface OverpassResponse {
  elements?: OverpassElement[];
}

/** Fetch one boundary relation's full geometry, to assemble its rings. */
export function boundaryQuery(relationId: number): string {
  return [`[out:json][timeout:120];`, `rel(${relationId});`, "out geom;"].join("\n");
}

/**
 * Build an {@link Area} (outer rings minus inner holes) from a relation's member
 * ways. Returns null when there is no usable outer ring (unclosed/missing ways),
 * so the caller falls back to a radius rather than a broken polygon.
 */
export function parseBoundary(json: OverpassResponse): Area | null {
  const rel = (json.elements ?? []).find((el) => el.type === "relation" && el.members);
  if (!rel?.members) return null;

  const toWays = (role: "outer" | "inner"): number[][][] =>
    rel.members!
      .filter((m) => m.type === "way" && (m.role ?? "outer") === role && m.geometry)
      .map((m) => m.geometry!.map((g) => [g.lon, g.lat]));

  const outer = assembleRings(toWays("outer"));
  if (outer.length === 0) return null;
  const inner = assembleRings(toWays("inner"));
  return { outer, inner };
}

function elementLatLng(el: OverpassElement): { lat: number; lng: number } | null {
  if (typeof el.lat === "number" && typeof el.lon === "number") return { lat: el.lat, lng: el.lon };
  if (el.center) return { lat: el.center.lat, lng: el.center.lon };
  return null;
}

function bestName(tags: OsmTags): string | null {
  return tags["name:tr"] || tags.name || tags["name:en"] || null;
}

/**
 * Parse an Overpass response into admin units. Elements without a usable name or
 * a resolvable center are dropped (we only keep areas we can name and locate).
 * De-duplicates by name, keeping the first occurrence (relations sort before the
 * looser place nodes in our queries, so the boundary wins over a stray node).
 */
export function parseAdminUnits(json: OverpassResponse): AdminUnit[] {
  const seen = new Set<string>();
  const units: AdminUnit[] = [];
  for (const el of json.elements ?? []) {
    const tags = el.tags;
    if (!tags) continue;
    const name = bestName(tags);
    if (!name) continue;
    const loc = elementLatLng(el);
    if (!loc) continue;
    const key = name.toLocaleLowerCase("tr-TR");
    if (seen.has(key)) continue;
    seen.add(key);
    units.push({
      osmId: `${el.type}/${el.id}`,
      osmNumericId: el.id,
      osmType: el.type,
      name,
      lat: loc.lat,
      lng: loc.lng,
    });
  }
  return units;
}

export interface AdminOsmSourceOptions {
  endpoint?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export class AdminOsmSource {
  private readonly endpoint: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(opts: AdminOsmSourceOptions = {}) {
    this.endpoint = opts.endpoint ?? DEFAULT_ENDPOINT;
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.timeoutMs = opts.timeoutMs ?? 180_000;
  }

  private async post(query: string): Promise<OverpassResponse> {
    const res = await this.fetchImpl(this.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "MahalleYasam/0.1 (neighborhood report prototype)",
      },
      body: new URLSearchParams({ data: query }).toString(),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!res.ok) throw new Error(`Overpass API error ${res.status} ${res.statusText}`);
    return (await res.json()) as OverpassResponse;
  }

  /** Ilçe within a named il. */
  async fetchDistricts(province: string): Promise<AdminUnit[]> {
    return parseAdminUnits(await this.post(districtsQuery(province)));
  }

  /** Mahalle within one ilçe, addressed by its OSM relation id. */
  async fetchNeighborhoods(districtRelationId: number): Promise<AdminUnit[]> {
    return parseAdminUnits(await this.post(neighborhoodsInAreaQuery(districtRelationId)));
  }

  /** A mahalle's boundary polygon, or null when it has no closable rings. */
  async fetchBoundary(relationId: number): Promise<Area | null> {
    return parseBoundary(await this.post(boundaryQuery(relationId)));
  }
}
