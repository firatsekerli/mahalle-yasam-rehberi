/**
 * Walk-isochrone adapter (CLAUDE.md §15.7).
 *
 * Real "reachable within N minutes on foot" shapes come from a routing engine —
 * openrouteservice here, behind an interface so Valhalla/GraphHopper/pgRouting
 * can be swapped in. Until a routing key is configured the app falls back to a
 * straight-line ESTIMATE, which must be labeled as an estimate, never a real
 * walk time (§15.7).
 *
 * Pure helpers (`parseOrsIsochrones`, `walkMinutesFor`, `estimateWalkMinutes`)
 * are exported for testing; only the class touches the network.
 */

import type { GeoPoint } from "./types";
import { pointInRing } from "@/lib/geo/polygon";

const ORS_ENDPOINT = "https://api.openrouteservice.org/v2/isochrones/foot-walking";
/** Minute bands we compute — the 10- and 15-minute walk tests. */
export const WALK_BANDS_MIN = [10, 15];
/** Typical walking speed for the straight-line estimate (~4.8 km/h). */
const WALK_METERS_PER_MIN = 80;

export interface WalkIsochrone {
  minutes: number;
  /** Outer ring as GeoJSON `[lng, lat]` pairs. */
  ring: number[][];
}

export interface IsochroneSource {
  readonly provider: "openrouteservice";
  getWalkingIsochrones(center: GeoPoint, minutes?: number[]): Promise<WalkIsochrone[]>;
}

interface OrsFeature {
  properties?: { value?: number };
  geometry?: { coordinates?: number[][][] };
}
interface OrsResponse {
  features?: OrsFeature[];
}

/** Parse an ORS isochrones response into ascending-by-minutes rings. */
export function parseOrsIsochrones(json: OrsResponse): WalkIsochrone[] {
  const out: WalkIsochrone[] = [];
  for (const f of json.features ?? []) {
    const seconds = f.properties?.value;
    const ring = f.geometry?.coordinates?.[0];
    if (typeof seconds !== "number" || !ring) continue;
    out.push({ minutes: Math.round(seconds / 60), ring });
  }
  return out.sort((a, b) => a.minutes - b.minutes);
}

/**
 * Tightest walk band (in minutes) whose isochrone contains the point, or null if
 * outside all of them. Bands must be sorted ascending.
 */
export function walkMinutesFor(pt: GeoPoint, isochrones: WalkIsochrone[]): number | null {
  for (const iso of isochrones) {
    if (pointInRing(pt, iso.ring)) return iso.minutes;
  }
  return null;
}

/** Straight-line walk-time ESTIMATE from distance — label it as an estimate (§15.7). */
export function estimateWalkMinutes(distanceMeters: number): number {
  return Math.max(1, Math.round(distanceMeters / WALK_METERS_PER_MIN));
}

/** True when a routing key is configured for real isochrones. */
export function isochroneConfigured(): boolean {
  return Boolean(process.env.OPENROUTESERVICE_API_KEY);
}

export interface OrsIsochroneSourceOptions {
  apiKey: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export class OpenRouteServiceIsochroneSource implements IsochroneSource {
  readonly provider = "openrouteservice" as const;
  private readonly apiKey: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(opts: OrsIsochroneSourceOptions) {
    this.apiKey = opts.apiKey;
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.timeoutMs = opts.timeoutMs ?? 8_000;
  }

  async getWalkingIsochrones(
    center: GeoPoint,
    minutes: number[] = WALK_BANDS_MIN,
  ): Promise<WalkIsochrone[]> {
    const res = await this.fetchImpl(ORS_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: this.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        locations: [[center.lng, center.lat]],
        range: minutes.map((m) => m * 60),
        range_type: "time",
      }),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!res.ok) {
      throw new Error(`openrouteservice isochrones error ${res.status} ${res.statusText}`);
    }
    return parseOrsIsochrones((await res.json()) as OrsResponse);
  }
}
