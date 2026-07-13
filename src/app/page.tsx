import Link from "next/link";
import { Search, Scale, SlidersHorizontal, Building2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { listReportNeighborhoods } from "@/lib/report/data";

const PROFILES = [
  "General daily life",
  "Family with children",
  "Student",
  "Car-free lifestyle",
  "Pet owner",
];

export default function Home() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-16 sm:py-24">
      {/* Hero — the central product question (§19.1) */}
      <section className="text-center">
        <p className="text-sm font-medium uppercase tracking-wide text-brand-600">
          Neighborhood Life · Ankara
        </p>
        <h1 className="mt-4 text-balance text-4xl font-semibold leading-tight sm:text-5xl">
          What is daily life like in this neighborhood?
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-pretty text-lg text-muted">
          Before you rent or buy, see how easily a neighborhood covers your daily
          needs — groceries, health, transport, food, family, pets and more — with
          an explainable, personalized score.
        </p>

        {/* Search entry point (backend wiring comes in a later step) */}
        <form
          className="mx-auto mt-8 flex max-w-xl items-center gap-2 rounded-xl border border-line bg-surface-2 p-2"
          aria-label="Search for an address or neighborhood"
        >
          <Search className="ml-2 h-5 w-5 shrink-0 text-muted" aria-hidden />
          <input
            type="search"
            placeholder="Search an Ankara address or neighborhood…"
            className="h-10 w-full bg-transparent px-1 text-base outline-none placeholder:text-muted"
            disabled
          />
          <Button size="lg" type="submit" disabled>
            Search
          </Button>
        </form>
        <p className="mt-3 text-sm text-muted">
          Coverage begins with a small set of manually reviewed Ankara
          neighborhoods. We show data confidence and never claim complete coverage.
        </p>

        {/* Reachable sample reports (§29 step 9) */}
        <div className="mx-auto mt-6 flex max-w-xl flex-wrap justify-center gap-2">
          <span className="self-center text-sm text-muted">Try a sample report:</span>
          {listReportNeighborhoods().map((n) => (
            <Link
              key={n.slug}
              href={`/n/${n.slug}`}
              className="inline-flex items-center gap-1 rounded-full border border-brand-500 px-4 py-1.5 text-sm font-medium text-brand-700 hover:bg-brand-100"
            >
              {n.name}, {n.district}
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          ))}
        </div>
      </section>

      {/* What makes it different (§8) */}
      <section className="mt-20 grid gap-6 sm:grid-cols-3">
        <FeatureCard
          icon={<SlidersHorizontal className="h-5 w-5" aria-hidden />}
          title="Personalized to your life"
          body="Choose a lifestyle profile — family, student, car-free, pet owner — and the score reweights to what matters to you. The facts never change, only their weight."
        />
        <FeatureCard
          icon={<Scale className="h-5 w-5" aria-hidden />}
          title="Compare neighborhoods"
          body="Put two or three areas side by side using the same model — daily essentials, health, transport, food, and more — and see which fits you better."
        />
        <FeatureCard
          icon={<Building2 className="h-5 w-5" aria-hidden />}
          title="For real-estate pros"
          body="Generate branded neighborhood reports for a listing and embed a widget on your property pages. Objective, shareable, lead-capturing."
        />
      </section>

      {/* Profile examples (§19.1) */}
      <section className="mt-20 text-center">
        <h2 className="text-2xl font-semibold">One neighborhood, many lives</h2>
        <p className="mx-auto mt-3 max-w-2xl text-muted">
          The same neighborhood scores differently depending on who you are.
        </p>
        <ul className="mx-auto mt-6 flex max-w-3xl flex-wrap justify-center gap-2">
          {PROFILES.map((p) => (
            <li
              key={p}
              className="rounded-full border border-line bg-surface-2 px-4 py-2 text-sm font-medium"
            >
              {p}
            </li>
          ))}
        </ul>
      </section>

      <footer className="mt-24 border-t border-line pt-8 text-center text-sm text-muted">
        <p>
          Place data © OpenStreetMap contributors. Ratings and reviews shown per
          business are sourced on demand and attributed to their provider.
        </p>
        <p className="mt-2">
          Scores are based on currently available data and may not include every
          business or recent change.
        </p>
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
