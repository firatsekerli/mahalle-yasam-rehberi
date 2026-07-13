# Architecture

This document tracks architecture decisions as the project is built. The product
source of truth is [`../CLAUDE.md`](../CLAUDE.md); this file records _how_ we
implement it. High-level target architecture is in `CLAUDE.md` §16.

## Layers

```
Next.js Web App (Vercel)
  ├── Server Actions / Route Handlers
  │     └── Supabase Postgres + PostGIS   (neighborhoods, places, scores, users)
  ├── Map tiles                            (commercial / self-hosted vector tiles)
  └── Lazy licensed enrichment            (Google Places, per-business, on demand)

Python Data Worker (Railway/Fly/VM)  — separate from the web app
  ├── OSM extract / Overpass prototype
  ├── Boundary import
  ├── Normalization + deduplication (entity resolution)
  ├── PostGIS import
  └── Metric + score (re)computation
```

## Key decisions so far

### Scoring engine is pure, versioned, and explainable

`src/lib/scoring` holds a `ScoringConfig` (weights + tunables, §11.2) and a set
of pure functions (`src/lib/scoring/engine.ts`). Every score carries a
`version` and a `breakdown` so the UI can explain _why_ a score is what it is
(§11.4, §11.5). Weights never live in code branches — only in config.

Enforced rules: diminishing returns on count, confidence-adjusted (Bayesian)
ratings, missing-essential penalties, and sponsored places excluded by callers.

### Sources sit behind adapters

`src/lib/data/adapters` defines two contracts:

- `PlaceBaselineSource` (OSM) — the permanent, license-friendly record.
- `PlaceEnrichmentSource` (Google) — refreshable, isolated, **lazy per place**.

This keeps provider specifics out of scoring/UI and lets us swap sources (§28).

### Google enrichment is lazy and isolated (§31.1)

The neighborhood business list comes from the free OSM baseline. Google rating +
up to **5** review excerpts are fetched only when a user opens a specific
business, are kept isolated from the permanent record, always carry attribution,
and are cached only within Google's allowed window. See `CLAUDE.md` §31.1.

### Demographics are facts-only, official, and isolated from scoring (§12.5, §28)

Population data comes solely from an authoritative official source — **TÜİK
ADNKS** (Address-Based Population Registration System). It is shown as
**attributed, dated facts**, never inferred, estimated, or used as a scoring
input (§28 forbids demographic claims without reliable licensed data; profiling
is out of scope, §18.3).

- Stored in `demographics` (migration `0004`), keyed by administrative unit and
  reference year, with source, dataset, license, attribution and confidence.
- `TuikDemographicsSource` (`src/lib/data/adapters/demographics.ts`) reads
  worker-imported rows behind an injectable lookup — the app never scrapes or
  fabricates figures.
- `buildDemographicFacts` / `summarizeDemographics`
  (`src/lib/demographics/facts.ts`) compute shares + a freshness label and emit a
  deterministic, source-cited statement. This module never imports scoring.
- Finer breakdowns (age/sex/household) exist mostly at province/district level;
  at mahalle level they're commonly absent and are left null, not interpolated.

### Live OSM data with a sample fallback (§12.1, §15.5 prototype flow)

The report fetches **real** places from OpenStreetMap (Overpass) around the
neighborhood centroid, server-side, cached a day via `unstable_cache` to respect
Overpass limits. `src/lib/report/source.ts` resolves the source: on any live
error or an empty result it falls back to the clearly-labeled sample dataset, so
a report is never blank. `DATA_SOURCE=sample` forces the sample dataset.

- Live results render with real data confidence; sample results are capped to
  "experimental" and show the honesty banner (§13).
- No database is required for this prototype — neighborhoods come from the seed
  registry. Moving places/neighborhoods into PostGIS later doesn't change
  `getNeighborhoodReport`'s signature (the page is unaffected).
- The Overpass fetch has a 15s timeout so a slow endpoint can't stall a render.

### Data model

Canonical `places` are source-independent; `place_source_references` preserves
every origin (§14). Neighborhood boundaries store source + confidence and are
never presented as official when approximate (§12.2). Scores are stored per
`(neighborhood, profile, scoring_version)`.

## Open items (next steps)

- Persist OSM places into PostGIS (worker import) for scale + dedup, replacing
  the on-demand Overpass fetch (§29 step 5); reuse the same taxonomy mapping.
- Geospatial query helpers (address + radius) over PostGIS (§29 step 7).
- Comparison page (§29 step 10).
- Address search + geocoding, and the interactive map (§29, deployment Phase 3).
- Admin screen for places/duplicates (§29 step 12).
