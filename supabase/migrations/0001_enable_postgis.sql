-- Neighborhood Life — enable geospatial extensions (CLAUDE.md §29 step 2).
-- PostGIS powers all geographic logic: boundaries, membership, radius queries.

create extension if not exists postgis;

-- Trigram + unaccent help entity resolution on normalized business names (§14).
create extension if not exists pg_trgm;
create extension if not exists unaccent;
