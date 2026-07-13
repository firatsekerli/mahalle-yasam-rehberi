-- Prototype OSM ingestion table (CLAUDE.md §12.1, §15.5 prototype flow).
--
-- Real OpenStreetMap places for the pilot neighborhoods, populated by the seed
-- job (scripts/seed-osm.ts) and read by the app at request time — so reports use
-- real data without depending on Overpass in the request path. Plain lng/lat
-- columns keep the read path free of PostGIS/RPC; this migrates into the
-- canonical `places` model when scaling (§14, §17).

create table if not exists osm_places (
  id                bigint generated always as identity primary key,
  neighborhood_slug text not null,
  source_id         text not null,           -- OSM element id, e.g. 'node/123'
  name              text not null,
  category_slug     text not null,           -- platform taxonomy slug (normalized)
  lng               double precision not null,
  lat               double precision not null,
  source_timestamp  timestamptz,             -- OSM snapshot time — freshness (§13)
  imported_at       timestamptz not null default now(),
  -- Re-running the seed upserts on this key rather than duplicating.
  unique (neighborhood_slug, source_id)
);
create index if not exists osm_places_slug_idx on osm_places (neighborhood_slug);

-- Public OpenStreetMap data: world-readable. Writes happen only via the service
-- role (the seed job), which bypasses RLS; no anon write policy is defined.
alter table osm_places enable row level security;
drop policy if exists osm_places_public_read on osm_places;
create policy osm_places_public_read on osm_places for select using (true);
