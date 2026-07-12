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

### Data model

Canonical `places` are source-independent; `place_source_references` preserves
every origin (§14). Neighborhood boundaries store source + confidence and are
never presented as official when approximate (§12.2). Scores are stored per
`(neighborhood, profile, scoring_version)`.

## Open items (next steps)

- Geospatial query helpers (address + radius) over PostGIS (§29 step 7).
- Wire the OSM Overpass prototype in the worker and normalize tags (§29 step 5–6).
- Neighborhood report page consuming real scores (§29 step 9).
- Comparison page (§29 step 10) and confidence indicators (§29 step 11).
- Admin screen for places/duplicates (§29 step 12).
