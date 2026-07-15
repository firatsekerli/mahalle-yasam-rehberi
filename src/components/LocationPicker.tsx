"use client";

/**
 * Guided location picker (CLAUDE.md §19.2) — cascading İl → İlçe → Mahalle with
 * search, then "Rapor oluştur" to open the report. Compare mode and "Haritadan
 * seç" are scaffolded but disabled ("yakında") — they land in later phases
 * (arbitrary-point reports, comparison §29.10).
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, MapPin, ArrowRight } from "lucide-react";
import { T } from "@/lib/i18n/tr";

export interface PickerItem {
  slug: string;
  name: string;
  district: string;
  city: string;
}

const lc = (s: string) => s.toLocaleLowerCase("tr-TR");
const uniq = (xs: string[]) => Array.from(new Set(xs));

export default function LocationPicker({ neighborhoods }: { neighborhoods: PickerItem[] }) {
  const router = useRouter();

  const cities = useMemo(() => uniq(neighborhoods.map((n) => n.city)), [neighborhoods]);
  const [city, setCity] = useState(cities[0] ?? "");

  const districts = useMemo(
    () => uniq(neighborhoods.filter((n) => n.city === city).map((n) => n.district)),
    [neighborhoods, city],
  );
  const [district, setDistrict] = useState(districts[0] ?? "");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  const options = useMemo(
    () =>
      neighborhoods
        .filter((n) => n.city === city && n.district === district && lc(n.name).includes(lc(query)))
        .sort((a, b) => a.name.localeCompare(b.name, "tr")),
    [neighborhoods, city, district, query],
  );

  const selectedItem = neighborhoods.find((n) => n.slug === selected) ?? null;

  function pickCity(c: string) {
    setCity(c);
    const firstDistrict = uniq(neighborhoods.filter((n) => n.city === c).map((n) => n.district))[0] ?? "";
    setDistrict(firstDistrict);
    setSelected(null);
    setQuery("");
  }
  function pickDistrict(d: string) {
    setDistrict(d);
    setSelected(null);
    setQuery("");
  }

  return (
    <div className="mx-auto max-w-md rounded-[var(--radius-card)] border border-line bg-surface p-5 text-left shadow-sm">
      {/* Mode tabs */}
      <div className="grid grid-cols-2 gap-2 rounded-lg bg-surface-2 p-1">
        <span className="rounded-md bg-brand-600 px-3 py-2 text-center text-sm font-medium text-white">
          {T.picker.singleReport}
        </span>
        <span
          className="cursor-not-allowed rounded-md px-3 py-2 text-center text-sm font-medium text-muted"
          title={T.picker.comingSoon}
        >
          {T.picker.compare} · {T.picker.comingSoon}
        </span>
      </div>

      {/* Cascading select */}
      <div className="mt-4 rounded-lg border border-line p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted">{T.picker.heading}</p>

        <ChipRow label={T.picker.city} items={cities} value={city} onPick={pickCity} />
        <ChipRow label={T.picker.district} items={districts} value={district} onPick={pickDistrict} />

        <label className="mt-3 block text-xs font-medium text-muted">{T.picker.selectNeighborhood}</label>
        <div className="mt-1 flex items-center gap-2 rounded-lg border border-line bg-surface-2 px-3">
          <Search className="h-4 w-4 shrink-0 text-muted" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={T.picker.searchPlaceholder}
            className="h-10 w-full bg-transparent text-sm outline-none placeholder:text-muted"
          />
        </div>

        <ul className="mt-2 max-h-48 overflow-y-auto">
          {options.length === 0 ? (
            <li className="px-1 py-2 text-sm text-muted">{T.picker.noResults}</li>
          ) : (
            options.map((n) => (
              <li key={n.slug}>
                <button
                  type="button"
                  onClick={() => setSelected(n.slug)}
                  className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm ${
                    selected === n.slug
                      ? "bg-brand-100 font-medium text-brand-700"
                      : "hover:bg-surface-2"
                  }`}
                >
                  {n.name}
                  {selected === n.slug && <span aria-hidden>✓</span>}
                </button>
              </li>
            ))
          )}
        </ul>
      </div>

      {/* Select a point from the map (§19.2, §19.4) */}
      <Link
        href="/haritadan-sec"
        className="mt-3 inline-flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm text-ink hover:border-brand-500"
      >
        <MapPin className="h-4 w-4" aria-hidden /> {T.picker.fromMap}
      </Link>

      {/* Selection summary */}
      <p className="mt-3 text-sm text-muted">
        {selectedItem
          ? `${selectedItem.name} · ${selectedItem.district} · ${selectedItem.city}`
          : T.picker.selectPrompt}
      </p>

      {/* Create report */}
      <button
        type="button"
        disabled={!selected}
        onClick={() => selected && router.push(`/n/${selected}`)}
        className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-3 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {T.picker.createReport}
        <ArrowRight className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}

function ChipRow({
  label,
  items,
  value,
  onPick,
}: {
  label: string;
  items: string[];
  value: string;
  onPick: (v: string) => void;
}) {
  return (
    <div className="mt-3">
      <span className="text-xs font-medium text-muted">{label}</span>
      <div className="mt-1 flex flex-wrap gap-2">
        {items.map((it) => (
          <button
            key={it}
            type="button"
            onClick={() => onPick(it)}
            className={`rounded-full border px-3 py-1 text-sm ${
              value === it
                ? "border-brand-600 bg-brand-100 font-medium text-brand-700"
                : "border-line bg-surface-2 text-ink hover:border-brand-500"
            }`}
          >
            {it}
          </button>
        ))}
      </div>
    </div>
  );
}
