import { Scale, SlidersHorizontal, Building2 } from "lucide-react";
import { listReportNeighborhoods } from "@/lib/report/data";
import { LIFESTYLE_PROFILES } from "@/lib/scoring/profiles";
import { T } from "@/lib/i18n/tr";
import LocationPicker from "@/components/LocationPicker";

export default async function Home() {
  const neighborhoods = await listReportNeighborhoods();
  return (
    <main className="mx-auto max-w-5xl px-6 py-16 sm:py-24">
      {/* Hero — the central product question (§19.1) */}
      <section className="text-center">
        <p className="text-sm font-medium uppercase tracking-wide text-brand-600">
          {T.home.eyebrow}
        </p>
        <h1 className="mt-4 text-balance text-4xl font-semibold leading-tight sm:text-5xl">
          {T.home.heroTitle}
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-pretty text-lg text-muted">{T.home.heroLead}</p>

        {/* Guided location picker (§19.2) */}
        <div className="mt-8">
          <LocationPicker neighborhoods={neighborhoods} />
        </div>
        <p className="mx-auto mt-3 max-w-xl text-sm text-muted">{T.home.searchNote}</p>
      </section>

      {/* What makes it different (§8) */}
      <section className="mt-20 grid gap-6 sm:grid-cols-3">
        <FeatureCard
          icon={<SlidersHorizontal className="h-5 w-5" aria-hidden />}
          title={T.home.features.personalTitle}
          body={T.home.features.personalBody}
        />
        <FeatureCard
          icon={<Scale className="h-5 w-5" aria-hidden />}
          title={T.home.features.compareTitle}
          body={T.home.features.compareBody}
        />
        <FeatureCard
          icon={<Building2 className="h-5 w-5" aria-hidden />}
          title={T.home.features.prosTitle}
          body={T.home.features.prosBody}
        />
      </section>

      {/* Profile examples (§19.1) */}
      <section className="mt-20 text-center">
        <h2 className="text-2xl font-semibold">{T.home.profilesTitle}</h2>
        <p className="mx-auto mt-3 max-w-2xl text-muted">{T.home.profilesLead}</p>
        <ul className="mx-auto mt-6 flex max-w-3xl flex-wrap justify-center gap-2">
          {LIFESTYLE_PROFILES.map((p) => (
            <li
              key={p.slug}
              className="rounded-full border border-line bg-surface-2 px-4 py-2 text-sm font-medium"
            >
              {p.name}
            </li>
          ))}
        </ul>
      </section>

      <footer className="mt-24 border-t border-line pt-8 text-center text-sm text-muted">
        <p>{T.home.footerData}</p>
        <p className="mt-2">{T.home.footerDisclaimer}</p>
      </footer>
    </main>
  );
}

function FeatureCard({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-[var(--radius-card)] border border-line bg-surface p-6 text-left">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-100 text-brand-700">
        {icon}
      </div>
      <h3 className="mt-4 text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>
    </div>
  );
}
