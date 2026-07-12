-- Neighborhood Life — official demographics (CLAUDE.md §12.5, §28; decision 2026-07-12).
--
-- FACTS ONLY. This table holds official population statistics from an
-- authoritative source (TÜİK — Türkiye İstatistik Kurumu, the Address-Based
-- Population Registration System / ADNKS). It exists so reports can show
-- *attributed, dated* demographic facts — never inferred profiles, and NEVER an
-- input to the neighborhood score (§28 forbids demographic claims without
-- reliable licensed data, and profiling is out of scope, §18.3).
--
-- Unlike ephemeral Google enrichment, this is open official data and may be
-- stored permanently, but it still carries its source, dataset, reference year,
-- license and attribution so freshness and provenance are always visible (§13).
-- Numbers are loaded ONLY by the data worker from the official TÜİK dataset;
-- the app never invents or estimates them.

create table if not exists demographics (
  id                    uuid primary key default gen_random_uuid(),
  -- Linked to a neighborhood when the admin unit matches one; kept even if the
  -- neighborhood row is later removed, so imported official facts aren't lost.
  neighborhood_id       uuid references neighborhoods (id) on delete set null,
  admin_level           text not null
                          check (admin_level in ('province', 'district', 'neighborhood')),
  admin_code            text not null,              -- TÜİK administrative unit code
  area_name             text not null,
  source                text not null default 'tuik',
  source_dataset        text not null,              -- e.g. 'TUIK ADNKS 2024'
  reference_year        integer not null,           -- the ADNKS reference year
  total_population      integer not null check (total_population >= 0),
  -- Optional finer breakdowns. Often only available at province/district level;
  -- absent (null) at mahalle level rather than estimated (§13 honesty).
  population_by_age     jsonb,                       -- { "0-14": n, "15-64": n, "65+": n }
  population_by_sex     jsonb,                       -- { "male": n, "female": n }
  average_household_size numeric(4, 2),
  license               text,
  attribution           text not null,
  confidence            text not null default 'good'
                          check (confidence in ('high', 'good', 'limited', 'experimental')),
  imported_at           timestamptz not null default now(),
  -- One row per unit per reference year; re-imports upsert on this key.
  unique (source, admin_level, admin_code, reference_year)
);

create index if not exists demographics_neighborhood_idx on demographics (neighborhood_id);
create index if not exists demographics_admin_idx on demographics (admin_level, admin_code);
