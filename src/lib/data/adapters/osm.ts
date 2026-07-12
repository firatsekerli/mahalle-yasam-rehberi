/**
 * OpenStreetMap baseline adapter (CLAUDE.md §12.1).
 *
 * OSM is the permanent, license-friendly place baseline. For the prototype this
 * can query Overpass for a few neighborhoods; for production the Turkey extract
 * is imported into PostGIS by the Python worker and this reads from the DB
 * instead. Raw OSM tags are normalized to the platform taxonomy before storage.
 *
 * Stubbed until the Overpass/PostGIS wiring lands (build order §29 step 5).
 */

import type { BaselinePlace, GeoPoint, PlaceBaselineSource } from "./types";

export class OsmBaselineSource implements PlaceBaselineSource {
  readonly source = "osm" as const;

  async fetchNearby(center: GeoPoint, radiusMeters: number): Promise<BaselinePlace[]> {
    // TODO: Overpass query (prototype) or PostGIS ST_DWithin read (production),
    // then map raw OSM tags -> platform category slugs before returning.
    void center;
    void radiusMeters;
    throw new Error("OsmBaselineSource.fetchNearby not implemented yet");
  }
}
