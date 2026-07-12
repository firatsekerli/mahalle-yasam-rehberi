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
- Import **official demographics** from TÜİK ADNKS into the `demographics`
  table — facts only, attributed and dated, never fed into scores (see below).

## Demographics import (TÜİK ADNKS)

Population figures are **facts, not a score** (CLAUDE.md §12.5, §28). The only
acceptable source is authoritative official data:

- **TÜİK** (Türkiye İstatistik Kurumu) — **ADNKS**, the Address-Based Population
  Registration System. Publishes total population down to the **mahalle
  (neighborhood)** level annually, plus age/sex/household breakdowns at
  **province/district** level.

Rules for this importer:

1. Load only official TÜİK datasets — **never scrape, never estimate**. If a
   breakdown isn't published at a level, leave it null (don't interpolate).
2. Upsert into `demographics` keyed by `(source, admin_level, admin_code,
   reference_year)`, stamping `source_dataset`, `reference_year`, `license` and
   `attribution` on every row.
3. Link `neighborhood_id` when the admin unit matches a known neighborhood.
4. **Verify TÜİK's current terms of use / redistribution license** before the
   first production import (same discipline as every source, §12.5).

The web app reads these rows via `TuikDemographicsSource` and renders them with
`buildDemographicFacts` — attributed, dated, and isolated from scoring.

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
