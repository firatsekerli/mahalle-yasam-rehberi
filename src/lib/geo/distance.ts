/**
 * Geographic distance helpers (CLAUDE.md §15.7).
 *
 * MVP proximity uses straight-line (great-circle) distance, honestly labeled as
 * such — NOT a real walking time. Real isochrones come later with a routing
 * engine (§15.7). Kept dependency-free and pure so it is easy to test.
 */

import type { GeoPoint } from "@/lib/data/adapters/types";

const EARTH_RADIUS_M = 6_371_008.8; // mean Earth radius (meters)

const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance between two lng/lat points, in meters (haversine). */
export function haversineMeters(a: GeoPoint, b: GeoPoint): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Offset a point by north/east meters — used to place seed points relative to a
 * neighborhood centroid without hand-computing coordinates.
 */
export function offsetMeters(origin: GeoPoint, northMeters: number, eastMeters: number): GeoPoint {
  const dLat = northMeters / 111_320;
  const dLng = eastMeters / (111_320 * Math.cos(toRad(origin.lat)));
  return { lat: origin.lat + dLat, lng: origin.lng + dLng };
}
