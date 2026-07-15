-- Selectable neighborhood directory (CLAUDE.md §9.1, §19.2, §12.2).
--
-- A lightweight, plain lng/lat lookup of Turkish mahalle (with their il/ilçe),
-- populated from OpenStreetMap administrative data by scripts/import-admin.ts.
-- It powers the dynamic İl → İlçe → Mahalle selector so nothing is hardcoded —
-- the picker lists exactly the areas we can generate a report for.
--
-- This is deliberately separate from the canonical `neighborhoods` table (0002):
-- that one holds *verified boundary polygons* (PostGIS, a higher data-quality
-- bar, §12.2); this one is an approximate-centroid index for search/selection,
-- kept free of PostGIS so the request path needs no RPC (mirrors `osm_places`).
-- Centroids are approximate until a `neighborhoods` polygon is reviewed, so every
-- report generated from them is labeled approximate (§12.2) — never "official".

create table if not exists neighborhood_index (
  id                  bigint generated always as identity primary key,
  slug                text not null unique,     -- 'ankara-cankaya-kavaklidere'
  name                text not null,            -- mahalle
  district            text not null,            -- ilçe
  province            text not null,            -- il
  lat                 double precision not null,
  lng                 double precision not null,
  osm_id              text not null,            -- 'relation/123' | 'node/456'
  source              text not null default 'openstreetmap',
  boundary_confidence text not null default 'experimental'
                        check (boundary_confidence in ('high', 'good', 'limited', 'experimental')),
  imported_at         timestamptz not null default now()
);
create index if not exists neighborhood_index_province_idx on neighborhood_index (province);
create index if not exists neighborhood_index_district_idx on neighborhood_index (province, district);

-- Public OpenStreetMap-derived reference data: world-readable. Writes happen only
-- via the service role (the import job), which bypasses RLS.
alter table neighborhood_index enable row level security;
drop policy if exists neighborhood_index_public_read on neighborhood_index;
create policy neighborhood_index_public_read on neighborhood_index for select using (true);
