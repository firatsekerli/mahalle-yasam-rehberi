# Deployment & Go-Live Runbook

How to take Neighborhood Life live on Vercel and move from sample data to real
data. The guiding principle (CLAUDE.md §29.14, §25): **spend nothing until the
open-data report is proven.** Go live on the free path first; turn on paid Google
enrichment only once the OSM-based report is good.

> Pricing below is indicative and changes often — **verify current pricing** with
> each provider before committing. Google Maps Platform terms must be re-checked
> before implementing or changing enrichment (§12.3).

## Cost summary

| Component | Prototype | Live MVP (Ankara pilot) | Notes |
|---|---|---|---|
| Vercel | $0 Hobby | ~$20/mo Pro | Pro when commercial |
| Supabase (Postgres + PostGIS) | $0 Free | ~$25/mo Pro | Free tier auto-pauses; PostGIS on all tiers |
| OpenStreetMap / Overpass | $0 | $0 | Turkey extract (Geofabrik) is free |
| TÜİK demographics | $0 | $0 | Official open data; verify license |
| Map tiles (MapLibre) | $0 | $0–25/mo | Cheapest: self-host PMTiles on Cloudflare R2 (no egress) |
| Python worker | $0 (GH Actions) | $5–10/mo | Railway/Fly small instance |
| Geocoding | $0 self-host | $0–20/mo | Nominatim self-host or Google (~$5/1k) |
| Sentry + PostHog | $0 | $0 | Free tiers cover MVP |
| **Google Places** | ~$0 (free tier) | **$20–150+/mo** | **Variable** — see Phase 2 |
| Domain | — | ~$1/mo | ~$12/yr |
| **Total** | **~$0** | **~$70–230/mo** | Google is the swing factor |

Google is the only cost that scales with usage. Our design controls it: lazy
per-business calls, tight field masks, caching within Google's window, and a hard
budget cap (§31.1, §25).

---

## Phase 0 — Deploy the demo (today, $0, no env)

The app runs on sample data with **no environment variables**, so it deploys as-is.

1. Create/sign in to a **Vercel** account.
2. **Add New → Project → Import** `firatsekerli/mahalle-yasam-rehberi`.
3. Set the **Production Branch** to the branch containing the report page
   (`claude/api-error-investigation-bkchq2`) or merge it to the default first.
4. Framework preset: **Next.js** (auto-detected). No env vars needed. **Deploy.**
5. You get a live URL. Try `/`, `/n/kizilay`, `/n/bahcelievler?profile=family`.

Every future PR gets an automatic **preview URL** — useful for review.

---

## Phase 1 — Real open data via Supabase ($0 in API costs)

The app reads report places in this order: **live Overpass → Supabase `osm_places`
→ sample**. The list always reflects current OSM; the Supabase snapshot is a
reliability fallback when live OSM is slow/down. `DATA_SOURCE=sample` forces the
sample dataset. The **İl/İlçe/Mahalle selector** is populated from the
`neighborhood_index` table (dynamic — nothing hardcoded), with the curated pilot
neighborhoods always available even before you import.

**One-time setup:**

1. **Create a Supabase project** (Free tier is enough for the pilot).
2. **Run the migrations** in `supabase/migrations/` in order (0001→0006) via the
   Supabase SQL editor. `0001` enables PostGIS; `0005` creates `osm_places`;
   `0006` creates `neighborhood_index` (the selector directory).
3. **Add env vars in Vercel** (Project → Settings → Environment Variables):
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (public read)
   - `SUPABASE_SERVICE_ROLE_KEY` (server-only — never exposed to the browser)
4. **Add GitHub repo secrets** (Settings → Secrets → Actions):
   - `SUPABASE_URL` (your project URL) and `SUPABASE_SERVICE_ROLE_KEY`
5. **Seed pilot places:** Actions tab → **"Seed OSM data"** → *Run workflow*.
   Fetches real OSM around each pilot neighborhood and upserts into `osm_places`.
   (Or locally: `SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… pnpm seed:osm`.)
6. **Import the selector hierarchy:** Actions tab → **"Import admin data"** → *Run
   workflow* → enter a province (start with `Ankara`). Fetches every ilçe + its
   mahalle from OSM and upserts into `neighborhood_index`, filling the dropdowns.
   (Or locally: `… PROVINCES="Ankara" pnpm import:admin`.) Re-run per province to
   expand coverage — no code change needed.
7. **Redeploy** (or wait for the ISR cache to expire). The report serves live OSM
   data with the green "Canlı OpenStreetMap verisi" badge, and the selector lists
   every imported mahalle.

**To refresh** later, or after adding areas, just re-run the relevant action.
Reports for imported mahalle are generated live at the mahalle's **approximate**
centroid and clearly labeled "yaklaşık sınır" (§12.2) — verified boundaries come
later via the canonical `neighborhoods` table.

**Later (scale):** move `osm_places` into the canonical `places` +
`place_source_references` model with dedup (§14), and import **TÜİK demographics**
into the `demographics` table (**verify TÜİK's redistribution license first**).

---

## Phase 2 — Google enrichment (this is where cost starts)

Only after Phase 1 reports are good (§29.14).

1. **Google Cloud**: create a project, enable **Places API (New)**, create an API
   key, and **restrict the key** (API + referrer/IP restrictions).
2. **Set a billing budget + quota alerts BEFORE any traffic** (§25). Cap daily
   quota so a bug can't run up a bill.
3. **Re-verify current Maps Platform terms** (§12.3) — caching window, attribution,
   review display rules.
4. Add `GOOGLE_PLACES_API_KEY` (server-only) in Vercel.
5. Implement `GooglePlacesEnrichmentSource.enrichPlace` (currently stubbed) with a
   **strict field mask** (id, rating, userRatingCount, businessStatus,
   reviews≤5, googleMapsUri), enforce `MAX_REVIEWS`, attach attribution, and cache
   within the permitted window. Keep it **lazy** (fires only when a user opens a
   business) and behind a feature flag.

Cost example: 1,000 report views/mo × ~5 business expansions ≈ 5,000 detail calls
≈ **$25–150/mo** depending on review fields and free-tier coverage. Ratings/hours
without review excerpts is cheaper.

---

## Phase 3 — Search + interactive map

1. **Geocoding** for address search: self-host Nominatim (Turkey extract) or use a
   paid provider. Do **not** use public Nominatim in production (§15.6). Set
   `GEOCODING_PROVIDER` / `GEOCODING_API_KEY`.
2. **Map tiles**: MapLibre GL + a tile source. Cheapest is a Turkey **PMTiles**
   file on Cloudflare R2 (no egress fees); or MapTiler free tier. Set
   `NEXT_PUBLIC_MAP_TILES_URL`. Do not use the public OSM tile server (§12.1).

---

## Env var reference

See `.env.example`. Set these in Vercel per environment (Production/Preview):

| Var | Scope | Phase |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | public | 1 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | public | 1 |
| `SUPABASE_SERVICE_ROLE_KEY` | server | 1 |
| `GOOGLE_PLACES_API_KEY` | server | 2 |
| `GEOCODING_PROVIDER` / `GEOCODING_API_KEY` | server | 3 |
| `NEXT_PUBLIC_MAP_TILES_URL` | public | 3 |

## Security checklist

- Service-role key is **server-only** — never in a `NEXT_PUBLIC_` var or the client bundle.
- Enable **Row Level Security** on all user-owned tables before auth ships.
- **Restrict** the Google + geocoding API keys (API + referrer/IP).
- **Budget cap + quota alerts** on Google Cloud before go-live.
- Rotate any key that ever lands in git history.

## Accounts you'll need to create (I can't create these for you)

- **Vercel** (Phase 0) · **Supabase** (Phase 1) · **Google Cloud w/ billing**
  (Phase 2) · optionally **Cloudflare** (R2 tiles) and a **domain registrar**.

Paste keys into Vercel/Supabase settings — **never commit them**.
