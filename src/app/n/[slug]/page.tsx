import Link from "next/link";
import { notFound } from "next/navigation";
import { getNeighborhoodReport } from "@/lib/report/data";
import { LIFESTYLE_PROFILES } from "@/lib/scoring/profiles";
import type { DimensionScore } from "@/lib/scoring/neighborhood";

export default async function NeighborhoodReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ profile?: string }>;
}) {
  const { slug } = await params;
  const { profile: profileSlug } = await searchParams;
  const report = await getNeighborhoodReport(slug, profileSlug);
  if (!report) notFound();

  const { neighborhood, score, profile, demographics, highlights, dataNotice } = report;

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <Link href="/" className="text-sm text-brand-600 hover:underline">
        ← All neighborhoods
      </Link>

      {dataNotice.sample && (
        <p className="mt-4 rounded-lg border border-line bg-surface-2 px-4 py-3 text-sm text-muted">
          <strong className="text-ink">Sample data.</strong> {dataNotice.message}
        </p>
      )}

      {/* Header ---------------------------------------------------------------- */}
      <header className="mt-6 flex flex-wrap items-end justify-between gap-6">
        <div>
          <h1 className="text-3xl font-semibold">{neighborhood.name}</h1>
          <p className="mt-1 text-muted">
            {neighborhood.district} · {neighborhood.city}
            {neighborhood.isApproximate && (
              <span className="ml-2 rounded bg-surface-2 px-2 py-0.5 text-xs">
                approximate boundary
              </span>
            )}
          </p>
        </div>
        <div className="text-right">
          <div className="text-5xl font-semibold tabular-nums">{score.overall}</div>
          <div className="text-xs uppercase tracking-wide text-muted">Neighborhood Life Score / 100</div>
          <div className={`mt-1 text-sm font-medium confidence-${score.confidence.label}`}>
            {labelText(score.confidence.label)} data confidence · {score.confidence.score}/100
          </div>
        </div>
      </header>

      {/* Lifestyle profile selector (§9.2) ------------------------------------- */}
      <section className="mt-8">
        <h2 className="text-sm font-medium text-muted">Lifestyle profile</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          {LIFESTYLE_PROFILES.map((p) => {
            const active = p.slug === profile.slug;
            return (
              <Link
                key={p.slug}
                href={`/n/${neighborhood.slug}?profile=${p.slug}`}
                className={`rounded-full border px-4 py-1.5 text-sm font-medium ${
                  active
                    ? "border-brand-600 bg-brand-100 text-brand-700"
                    : "border-line bg-surface-2 text-ink hover:border-brand-500"
                }`}
              >
                {p.name}
              </Link>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-muted">{profile.description} Weights change; the facts do not.</p>
      </section>

      {/* Summary --------------------------------------------------------------- */}
      <p className="mt-8 text-pretty text-lg leading-relaxed">{score.summary}</p>

      {/* Strengths / weaknesses / missing -------------------------------------- */}
      <section className="mt-8 grid gap-4 sm:grid-cols-3">
        <ListCard title="Strengths" items={score.strengths} tone="good" empty="No standout strengths yet." />
        <ListCard title="Weaknesses" items={score.weaknesses} tone="warn" empty="No major weaknesses." />
        <ListCard
          title="Missing nearby essentials"
          items={score.missingServices}
          tone="warn"
          empty="All essentials covered nearby."
        />
      </section>

      {/* Category dimensions --------------------------------------------------- */}
      <section className="mt-10">
        <h2 className="text-xl font-semibold">Category scores</h2>
        <p className="mt-1 text-sm text-muted">
          Weighted for the {profile.name.toLowerCase()} profile. Distances are straight-line from the
          neighborhood center (not a walking route).
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {score.dimensions.map((d) => (
            <DimensionCard key={d.weightKey} d={d} />
          ))}
        </div>
      </section>

      {/* Top nearby options ---------------------------------------------------- */}
      {highlights.length > 0 && (
        <section className="mt-10">
          <h2 className="text-xl font-semibold">Top nearby options</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {highlights.map((g) => (
              <div key={g.group} className="rounded-[var(--radius-card)] border border-line p-4">
                <h3 className="text-sm font-semibold">{g.groupName}</h3>
                <ul className="mt-2 space-y-1 text-sm">
                  {g.options.map((o, i) => (
                    <li key={i} className="flex justify-between gap-4 text-muted">
                      <span>{o.categoryName}</span>
                      <span className="tabular-nums">≈ {o.distanceMeters} m</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Demographics (facts only, §12.5, §28) --------------------------------- */}
      <section className="mt-10">
        <h2 className="text-xl font-semibold">Demographics</h2>
        {demographics ? (
          <div className="mt-3 rounded-[var(--radius-card)] border border-line p-5">
            <p className="text-2xl font-semibold tabular-nums">
              {demographics.totalPopulation.toLocaleString("en-US")}
            </p>
            <p className="text-sm text-muted">
              registered population · {demographics.areaName} ({demographics.adminLevel})
            </p>
            {demographics.averageHouseholdSize !== undefined && (
              <p className="mt-2 text-sm">Average household size: {demographics.averageHouseholdSize}</p>
            )}
            <p className="mt-3 text-xs text-muted">
              {demographics.attribution} · {demographics.sourceDataset} · {demographics.freshness.label}
            </p>
          </div>
        ) : (
          <p className="mt-3 rounded-[var(--radius-card)] border border-dashed border-line p-5 text-sm text-muted">
            Official population figures are not yet imported for this area. They will be sourced only from{" "}
            <strong className="text-ink">TÜİK ADNKS</strong> (Türkiye İstatistik Kurumu, Address-Based
            Population Registration System) and shown as attributed, dated facts — never estimated, and never
            used to change the score.
          </p>
        )}
      </section>

      {/* Footer attribution ---------------------------------------------------- */}
      <footer className="mt-12 border-t border-line pt-6 text-xs text-muted">
        <p>
          Place data © OpenStreetMap contributors. Scoring version {score.scoringVersion}. Scores reflect
          currently available data and do not claim to include every business.
        </p>
      </footer>
    </main>
  );
}

function labelText(label: string): string {
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function DimensionCard({ d }: { d: DimensionScore }) {
  const pct = d.score ?? 0;
  return (
    <div className="rounded-[var(--radius-card)] border border-line p-4">
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-semibold">{d.name}</h3>
        <span className="text-xs text-muted">weight {Math.round(d.weight * 100)}%</span>
      </div>
      {d.available && d.score !== null ? (
        <>
          <div className="mt-2 flex items-center gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
              <div className="h-full rounded-full bg-brand-500" style={{ width: `${pct}%` }} />
            </div>
            <span className="w-10 text-right text-sm font-medium tabular-nums">{d.score}</span>
          </div>
          {d.missingEssentials.length > 0 && (
            <p className="mt-2 text-xs text-muted">Missing: {d.missingEssentials.join(", ")}</p>
          )}
        </>
      ) : (
        <p className="mt-2 text-xs text-muted">
          Not yet available — needs data we don&apos;t have yet (kept out of the score, not counted as zero).
        </p>
      )}
    </div>
  );
}

function ListCard({
  title,
  items,
  tone,
  empty,
}: {
  title: string;
  items: string[];
  tone: "good" | "warn";
  empty: string;
}) {
  return (
    <div className="rounded-[var(--radius-card)] border border-line p-4">
      <h3 className="text-sm font-semibold">{title}</h3>
      {items.length > 0 ? (
        <ul className="mt-2 space-y-1 text-sm text-muted">
          {items.map((it) => (
            <li key={it} className="flex gap-2">
              <span className={tone === "good" ? "text-brand-600" : "text-muted"}>•</span>
              {it}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-muted">{empty}</p>
      )}
    </div>
  );
}
