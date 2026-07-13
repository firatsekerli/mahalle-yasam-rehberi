import Link from "next/link";
import { notFound } from "next/navigation";
import { getNeighborhoodReport } from "@/lib/report/data";
import { LIFESTYLE_PROFILES } from "@/lib/scoring/profiles";
import type { DimensionScore } from "@/lib/scoring/neighborhood";
import { T, CONFIDENCE_LABEL_TR, FRESHNESS_LABEL_TR, ADMIN_LEVEL_TR } from "@/lib/i18n/tr";

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

  const { neighborhood, score, profile, demographics, highlights, businesses, placeCount, dataNotice } =
    report;

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <Link href="/" className="text-sm text-brand-600 hover:underline">
        {T.common.allNeighborhoods}
      </Link>

      {dataNotice.sample ? (
        <p className="mt-4 rounded-lg border border-line bg-surface-2 px-4 py-3 text-sm text-muted">
          <strong className="text-ink">{T.report.sampleDataLabel}</strong> {dataNotice.message}
        </p>
      ) : (
        <p className="mt-4 inline-flex items-center gap-2 rounded-full border border-brand-500 bg-brand-100 px-3 py-1 text-xs font-medium text-brand-700">
          <span aria-hidden>●</span> {T.report.liveData}
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
                {T.common.approximateBoundary}
              </span>
            )}
          </p>
        </div>
        <div className="text-right">
          <div className="text-5xl font-semibold tabular-nums">{score.overall}</div>
          <div className="text-xs uppercase tracking-wide text-muted">{T.report.scoreLabel}</div>
          <div className={`mt-1 text-sm font-medium confidence-${score.confidence.label}`}>
            {capitalize(CONFIDENCE_LABEL_TR[score.confidence.label])} {T.common.dataConfidence} ·{" "}
            {score.confidence.score}/100
          </div>
        </div>
      </header>

      {/* Lifestyle profile selector (§9.2) ------------------------------------- */}
      <section className="mt-8">
        <h2 className="text-sm font-medium text-muted">{T.report.lifestyleProfile}</h2>
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
        <p className="mt-2 text-xs text-muted">
          {profile.description} {T.report.lifestyleNote}
        </p>
      </section>

      {/* Summary --------------------------------------------------------------- */}
      <p className="mt-8 text-pretty text-lg leading-relaxed">{score.summary}</p>

      {/* Strengths / weaknesses / missing -------------------------------------- */}
      <section className="mt-8 grid gap-4 sm:grid-cols-3">
        <ListCard
          title={T.report.strengths}
          items={score.strengths}
          tone="good"
          empty={T.report.noStrengths}
        />
        <ListCard
          title={T.report.weaknesses}
          items={score.weaknesses}
          tone="warn"
          empty={T.report.noWeaknesses}
        />
        <ListCard
          title={T.report.missingEssentials}
          items={score.missingServices}
          tone="warn"
          empty={T.report.allEssentials}
        />
      </section>

      {/* Category dimensions --------------------------------------------------- */}
      <section className="mt-10">
        <h2 className="text-xl font-semibold">{T.report.categoryScores}</h2>
        <p className="mt-1 text-sm text-muted">
          {profile.name} {T.report.categoryNote}
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
          <h2 className="text-xl font-semibold">{T.report.topNearby}</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {highlights.map((g) => (
              <div key={g.group} className="rounded-[var(--radius-card)] border border-line p-4">
                <h3 className="text-sm font-semibold">{g.groupName}</h3>
                <ul className="mt-2 space-y-1 text-sm">
                  {g.options.map((o, i) => (
                    <li key={i} className="flex justify-between gap-4 text-muted">
                      <span className="min-w-0 truncate">
                        {o.name}
                        {o.named && <span className="text-xs"> · {o.categoryName}</span>}
                      </span>
                      <span className="shrink-0 tabular-nums">≈ {o.distanceMeters} m</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Neighborhood business list (§31.1) ------------------------------------ */}
      <section className="mt-10">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-xl font-semibold">{T.report.businessesTitle}</h2>
          <span className="text-xs text-muted">
            {T.report.businessesCount(businesses.length, placeCount)}
          </span>
        </div>
        {businesses.length > 0 ? (
          <ul className="mt-4 divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line">
            {businesses.map((b, i) => (
              <li key={i} className="flex items-center justify-between gap-4 px-4 py-2.5 text-sm">
                <span className="min-w-0 truncate">
                  <span className="font-medium">{b.name}</span>
                  {b.named && <span className="text-muted"> · {b.categoryName}</span>}
                </span>
                <span className="shrink-0 tabular-nums text-muted">≈ {b.distanceMeters} m</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-muted">{T.report.businessesEmpty}</p>
        )}
      </section>

      {/* Demographics (facts only, §12.5, §28) --------------------------------- */}
      <section className="mt-10">
        <h2 className="text-xl font-semibold">{T.report.demographics}</h2>
        {demographics ? (
          <div className="mt-3 rounded-[var(--radius-card)] border border-line p-5">
            <p className="text-2xl font-semibold tabular-nums">
              {demographics.totalPopulation.toLocaleString("tr-TR")}
            </p>
            <p className="text-sm text-muted">
              {T.report.registeredPopulation} · {demographics.areaName} (
              {ADMIN_LEVEL_TR[demographics.adminLevel]})
            </p>
            {demographics.averageHouseholdSize !== undefined && (
              <p className="mt-2 text-sm">
                {T.report.avgHousehold} {demographics.averageHouseholdSize}
              </p>
            )}
            <p className="mt-3 text-xs text-muted">
              {demographics.attribution} · {demographics.sourceDataset} ·{" "}
              {FRESHNESS_LABEL_TR[demographics.freshness.label]}
            </p>
          </div>
        ) : (
          <p className="mt-3 rounded-[var(--radius-card)] border border-dashed border-line p-5 text-sm text-muted">
            {T.report.demographicsPending}
          </p>
        )}
      </section>

      {/* Footer attribution ---------------------------------------------------- */}
      <footer className="mt-12 border-t border-line pt-6 text-xs text-muted">
        <p>{T.report.footer(score.scoringVersion)}</p>
      </footer>
    </main>
  );
}

function capitalize(s: string): string {
  return s.charAt(0).toLocaleUpperCase("tr-TR") + s.slice(1);
}

function DimensionCard({ d }: { d: DimensionScore }) {
  const pct = d.score ?? 0;
  return (
    <div className="rounded-[var(--radius-card)] border border-line p-4">
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-semibold">{d.name}</h3>
        <span className="text-xs text-muted">
          {T.report.weight} {Math.round(d.weight * 100)}%
        </span>
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
            <p className="mt-2 text-xs text-muted">Eksik: {d.missingEssentials.join(", ")}</p>
          )}
        </>
      ) : (
        <p className="mt-2 text-xs text-muted">{T.report.unavailable}</p>
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
