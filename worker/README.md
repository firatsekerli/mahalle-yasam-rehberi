# Neighborhood Life — Data Worker

A **separate** Python service for data ingestion and geospatial processing, kept
independent from the Next.js web app (CLAUDE.md §15.5, §28). The web app never
imports or scrapes; it reads prepared data from PostGIS.

## Responsibilities

- Fetch places from **OpenStreetMap** (Overpass for the prototype; the Turkey
  PBF extract → PostGIS for production).
- Import and validate **neighborhood boundaries** (with source + confidence).
- **Normalize** raw OSM tags into the platform taxonomy (`categories.slug`).
- **Deduplicate** / entity-resolve places into canonical records (§14).
- Compute **neighborhood metrics** and (re)compute **scores** on a schedule.

## Planned stack (§15.5)

Python 3.11+ · FastAPI (internal endpoints, if needed) · pandas · GeoPandas ·
Shapely · pyrosm / osmium / osm2pgsql · psycopg (bulk import).

## Prototype flow (§15.5)

1. Small GeoJSON polygons for 2 Ankara neighborhoods.
2. Overpass query limited to those areas + core categories.
3. Map OSM tags → taxonomy slugs.
4. Upsert into `places` + `place_source_references`.
5. Compute `neighborhood_place_membership` and metrics.

> Not yet implemented — this directory is a placeholder establishing the
> separation of concerns. Ingestion code lands at build order §29 step 5.
