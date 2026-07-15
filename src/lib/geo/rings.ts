/**
 * Assemble OSM relation member ways into closed rings (CLAUDE.md §12.2).
 *
 * A mahalle boundary in OSM is a relation whose member ways (role "outer"/"inner")
 * are unordered polylines that must be stitched end-to-end into closed rings
 * before point-in-polygon works. Pure and dependency-free; exact endpoint match is
 * safe because OSM shares node coordinates between adjacent ways. Ways that can't
 * be closed into a ring are dropped (incomplete data → no polygon, caller falls
 * back to a radius rather than inventing a boundary).
 */

type LngLat = [number, number];

const same = (a: LngLat, b: LngLat) => a[0] === b[0] && a[1] === b[1];
const isClosed = (ring: LngLat[]) => ring.length >= 4 && same(ring[0], ring[ring.length - 1]);

/**
 * Stitch `ways` (each an ordered list of `[lng, lat]`) into closed rings.
 * Returns only rings that close; partial chains are discarded.
 */
export function assembleRings(ways: number[][][]): number[][][] {
  const segments = ways.map((w) => w.map((p) => [p[0], p[1]] as LngLat)).filter((w) => w.length >= 2);
  const used = new Array(segments.length).fill(false);
  const rings: LngLat[][] = [];

  for (let s = 0; s < segments.length; s++) {
    if (used[s]) continue;
    used[s] = true;
    const ring: LngLat[] = [...segments[s]];

    // Extend from the current end until the ring closes or nothing else connects.
    let extended = true;
    while (!isClosed(ring) && extended) {
      extended = false;
      const end = ring[ring.length - 1];
      for (let t = 0; t < segments.length; t++) {
        if (used[t]) continue;
        const seg = segments[t];
        if (same(end, seg[0])) {
          ring.push(...seg.slice(1));
        } else if (same(end, seg[seg.length - 1])) {
          ring.push(...seg.slice(0, -1).reverse());
        } else {
          continue;
        }
        used[t] = true;
        extended = true;
        break;
      }
    }

    if (isClosed(ring)) rings.push(ring);
  }

  return rings;
}
