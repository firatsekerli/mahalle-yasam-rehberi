-- Neighborhood Life — core schema (CLAUDE.md §17, §29 step 3).
-- Covers the neighborhood, place, category, source, membership, metric, score,
-- and lifestyle-profile tables. B2B, reviews, corrections and report tables
-- follow in later migrations, once the open-data report works (§29 steps 13-15).

-- ---------------------------------------------------------------------------
-- categories: normalized platform taxonomy (§10). Mirrors src taxonomy in code.
-- ---------------------------------------------------------------------------
create table if not exists categories (
  id            bigint generated always as identity primary key,
  parent_id     bigint references categories (id),
  slug          text not null unique,
  name          text not null,
  score_group   text not null,
  essential_flag boolean not null default false,
  default_weight numeric(4, 3),           -- group-level weight lives in scoring config
  configuration jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- neighborhoods: boundary polygons with source + confidence (§12.2, §17).
-- Never present an approximate boundary as official (§12.2).
-- ---------------------------------------------------------------------------
create table if not exists neighborhoods (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  district            text,
  city                text not null,
  country             text not null default 'TR',
  geometry            geometry(MultiPolygon, 4326),
  centroid            geometry(Point, 4326),
  source              text not null,
  source_id           text,
  boundary_confidence text not null default 'experimental'
                        check (boundary_confidence in ('high', 'good', 'limited', 'experimental')),
  is_approximate      boolean not null default true,
  manual_review_status text not null default 'pending'
                        check (manual_review_status in ('pending', 'reviewed', 'rejected')),
  last_verified_at    timestamptz,
  status              text not null default 'draft'
                        check (status in ('draft', 'active', 'archived')),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists neighborhoods_geometry_gix on neighborhoods using gist (geometry);
create index if not exists neighborhoods_centroid_gix on neighborhoods using gist (centroid);
create index if not exists neighborhoods_city_idx on neighborhoods (city);

-- ---------------------------------------------------------------------------
-- places: canonical, source-independent place record (§17). Entity resolution
-- merges duplicates into one canonical row; sources tracked separately below.
-- ---------------------------------------------------------------------------
create table if not exists places (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  normalized_name     text not null,
  primary_category_id bigint references categories (id),
  location            geometry(Point, 4326) not null,
  address             text,
  phone               text,
  website             text,
  business_status     text not null default 'unknown'
                        check (business_status in ('operational', 'closed_temporarily', 'closed_permanently', 'unknown')),
  canonical_confidence numeric(4, 3) not null default 0.5,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists places_location_gix on places using gist (location);
create index if not exists places_category_idx on places (primary_category_id);
create index if not exists places_normalized_name_trgm on places using gin (normalized_name gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- place_source_references: every field stays connected to its origin (§14, §28).
-- Never overwrite source data without preserving its origin.
-- ---------------------------------------------------------------------------
create table if not exists place_source_references (
  id                     uuid primary key default gen_random_uuid(),
  place_id               uuid not null references places (id) on delete cascade,
  source_name            text not null,           -- 'osm', 'google', 'first_party', ...
  source_record_id       text not null,
  source_url             text,
  source_payload_reference text,                  -- pointer to raw payload in storage
  first_seen_at          timestamptz not null default now(),
  last_seen_at           timestamptz not null default now(),
  match_confidence       numeric(4, 3) not null default 1.0,
  data_license           text,
  storage_policy         text,                    -- e.g. 'permanent', 'ephemeral-google'
  unique (source_name, source_record_id)
);
create index if not exists psr_place_idx on place_source_references (place_id);

-- ---------------------------------------------------------------------------
-- neighborhood_place_membership: precomputed spatial relation (§17).
-- ---------------------------------------------------------------------------
create table if not exists neighborhood_place_membership (
  neighborhood_id     uuid not null references neighborhoods (id) on delete cascade,
  place_id            uuid not null references places (id) on delete cascade,
  distance_to_centroid double precision,          -- meters
  inside_boundary     boolean not null default false,
  last_calculated_at  timestamptz not null default now(),
  primary key (neighborhood_id, place_id)
);
create index if not exists npm_place_idx on neighborhood_place_membership (place_id);

-- ---------------------------------------------------------------------------
-- neighborhood_metrics: raw calculated metrics with source version (§17).
-- ---------------------------------------------------------------------------
create table if not exists neighborhood_metrics (
  id              uuid primary key default gen_random_uuid(),
  neighborhood_id uuid not null references neighborhoods (id) on delete cascade,
  metric_key      text not null,
  metric_value    jsonb not null,
  source_version  text not null,
  confidence      numeric(4, 3),
  calculated_at   timestamptz not null default now(),
  unique (neighborhood_id, metric_key, source_version)
);

-- ---------------------------------------------------------------------------
-- lifestyle_profiles: weight sets; change weights, never facts (§9.2, §17).
-- ---------------------------------------------------------------------------
create table if not exists lifestyle_profiles (
  id                uuid primary key default gen_random_uuid(),
  slug              text not null unique,
  name              text not null,
  description       text,
  weights           jsonb not null,               -- WeightKey -> number, sums to 1
  is_system_profile boolean not null default false,
  owner_user_id     uuid,
  created_at        timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- neighborhood_scores: computed per (neighborhood, profile), versioned (§17, §28).
-- explanation_data carries the breakdown so scores stay explainable (§11.5).
-- ---------------------------------------------------------------------------
create table if not exists neighborhood_scores (
  id              uuid primary key default gen_random_uuid(),
  neighborhood_id uuid not null references neighborhoods (id) on delete cascade,
  profile_id      uuid references lifestyle_profiles (id),
  overall_score   numeric(5, 2) not null,
  category_scores jsonb not null,
  explanation_data jsonb not null default '{}'::jsonb,
  confidence_score numeric(5, 2) not null,
  scoring_version text not null,
  data_version    text,
  calculated_at   timestamptz not null default now(),
  unique (neighborhood_id, profile_id, scoring_version)
);
create index if not exists scores_neighborhood_idx on neighborhood_scores (neighborhood_id);

-- keep updated_at fresh -------------------------------------------------------
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger neighborhoods_set_updated_at before update on neighborhoods
  for each row execute function set_updated_at();
create trigger places_set_updated_at before update on places
  for each row execute function set_updated_at();
