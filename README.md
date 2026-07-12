# Neighborhood Life

A neighborhood **intelligence** platform for Turkey (launching in Ankara) that
answers one question well:

> **“What would my daily life be like if I lived here?”**

Before renting or buying, a user enters an address or picks a neighborhood and
sees how easily they can reach groceries, pharmacies, schools, transport, food,
gyms, vets, and other daily needs — as an **explainable, personalized score**,
not a raw business list.

> This is **not** a Google Maps clone or a business directory. Businesses are
> _evidence_ used to evaluate a neighborhood. The full product spec and product
> principles live in [`CLAUDE.md`](./CLAUDE.md) — read it before building.

## Stack

- **App:** Next.js (App Router) · TypeScript · Tailwind CSS v4 · shadcn-style UI
- **Data:** Supabase (PostgreSQL + **PostGIS**), Row Level Security
- **Map:** MapLibre GL (open) with a commercial/self-hosted tile provider
- **Ingestion:** a separate **Python worker** (OSM → PostGIS) — see [`worker/`](./worker)
- **Enrichment:** Google Places, **lazy and isolated** (see `CLAUDE.md` §31.1)
- **Tests:** Vitest (unit) · Playwright (e2e, later)

## Getting started

```bash
pnpm install
cp .env.example .env.local   # fill in Supabase + provider keys
pnpm dev                     # http://localhost:3000
```

### Scripts

| Command          | Purpose                          |
| ---------------- | -------------------------------- |
| `pnpm dev`       | Run the app in development       |
| `pnpm build`     | Production build                 |
| `pnpm test`      | Run unit tests (Vitest)          |
| `pnpm typecheck` | TypeScript, no emit              |
| `pnpm lint`      | ESLint (next config)             |

### Database

SQL migrations live in [`supabase/migrations`](./supabase/migrations):

1. `0001_enable_postgis.sql` — PostGIS + trigram/unaccent extensions
2. `0002_core_schema.sql` — neighborhoods, places, categories, sources, metrics, scores, profiles
3. `0003_seed_taxonomy_and_profiles.sql` — normalized taxonomy + system lifestyle profiles

Apply with the Supabase CLI (`supabase db reset` locally) once a project is linked.

## Repository layout

```
src/
  app/                 Next.js App Router (landing page today)
  components/ui/        shadcn-style primitives
  lib/
    taxonomy/           normalized platform category taxonomy (§10)
    scoring/            versioned config + explainable scoring engine (§11)
    data/adapters/      OSM baseline + Google enrichment behind interfaces (§28)
    supabase/           server + browser clients
supabase/migrations/    PostGIS schema + seeds
worker/                 Python ingestion worker (separate from the web app)
docs/                   architecture notes
```

## Project principles

See `CLAUDE.md` §28. In short: build the decision engine (not a directory),
keep scoring configurable and versioned, keep every field tied to its source,
isolate Google-derived data, show confidence, never claim complete coverage,
and use PostGIS for geographic logic.
