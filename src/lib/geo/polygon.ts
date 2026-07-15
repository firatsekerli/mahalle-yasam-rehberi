/**
 * Point-in-polygon test for walk isochrones (CLAUDE.md §15.7).
 *
 * Used to decide whether a place falls inside a "reachable within N minutes"
 * walk shape. Pure and dependency-free (ray casting). Rings are GeoJSON-style
 * `[lng, lat]` coordinate pairs.
 */

import type { GeoPoint } from "@/lib/data/adapters/types";

/** True if `pt` lies inside the polygon described by `ring` (`[lng, lat]` pairs). */
export function pointInRing(pt: GeoPoint, ring: number[][]): boolean {
  const x = pt.lng;
  const y = pt.lat;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    const intersects = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}
