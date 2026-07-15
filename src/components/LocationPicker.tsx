"use client";

/**
 * Guided location picker (CLAUDE.md §19.2) — cascading İl → İlçe → Mahalle as
 * native select fields, then "Rapor oluştur" to open the report. İl/İlçe/Mahalle
 * come from the data layer (curated pilots + OSM-indexed mahalle), so nothing is
 * hardcoded. "Haritadan seç" opens the map point-picker; Compare is "yakında".
 */

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MapPin, ArrowRight, ChevronDown } from "lucide-react";
import { T } from "@/lib/i18n/tr";

export interface PickerItem {
  slug: string;
  name: string;
  district: string;
  city: string;
  /** Present for dynamic (OSM-indexed) mahalle → routed to a point report. */
  lat?: number;
  lng?: number;
}

/** Where "Rapor oluştur" navigates: curated areas have rich slug pages; dynamic
 *  mahalle use the point-report route at their approximate centroid. */
function reportHref(item: PickerItem): string {
  if (typeof item.lat === "number" && typeof item.lng === "number") {
    const params = new URLSearchParams({
      lat: String(item.lat),
      lng: String(item.lng),
      label: item.name,
      il: item.city,
      ilce: item.district,
    });
    return `/nokta?${params.toString()}`;
  }
  return `/n/${item.slug}`;
}

const uniq = (xs: string[]) => Array.from(new Set(xs));
const sortTr = (xs: string[]) => [...xs].sort((a, b) => a.localeCompare(b, "tr"));

export default function LocationPicker({ neighborhoods }: { neighborhoods: PickerItem[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const cities = useMemo(() => sortTr(uniq(neighborhoods.map((n) => n.city))), [neighborhoods]);
  const [city, setCity] = useState(cities[0] ?? "");

  const districts = useMemo(
    () => sortTr(uniq(neighborhoods.filter((n) => n.city === city).map((n) => n.district))),
    [neighborhoods, city],
  );
  const [district, setDistrict] = useState(districts[0] ?? "");
  const [selected, setSelected] = useState<string | null>(null);

  const options = useMemo(
    () =>
      neighborhoods
        .filter((n) => n.city === city && n.district === district)
        .sort((a, b) => a.name.localeCompare(b.name, "tr")),
    [neighborhoods, city, district],
  );

  const selectedItem = neighborhoods.find((n) => n.slug === selected) ?? null;

  function pickCity(c: string) {
    setCity(c);
    const firstDistrict =
      sortTr(uniq(neighborhoods.filter((n) => n.city === c).map((n) => n.district)))[0] ?? "";
    setDistrict(firstDistrict);
    setSelected(null);
  }
  function pickDistrict(d: string) {
    setDistrict(d);
    setSelected(null);
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

      {/* Cascading selects */}
      <div className="mt-4 rounded-lg border border-line p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted">{T.picker.heading}</p>

        <SelectField
          label={T.picker.city}
          value={city}
          onChange={pickCity}
          disabled={cities.length === 0}
        >
          {cities.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </SelectField>

        <SelectField
          label={T.picker.district}
          value={district}
          onChange={pickDistrict}
          disabled={districts.length === 0}
        >
          {districts.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </SelectField>

        <SelectField
          label={T.picker.selectNeighborhood}
          value={selected ?? ""}
          onChange={(v) => setSelected(v || null)}
          disabled={options.length === 0}
          placeholder={options.length === 0 ? T.picker.noResults : T.picker.selectPrompt}
        >
          {options.map((n) => (
            <option key={n.slug} value={n.slug}>
              {n.name}
            </option>
          ))}
        </SelectField>
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
        disabled={!selectedItem || pending}
        onClick={() =>
          selectedItem && startTransition(() => router.push(reportHref(selectedItem)))
        }
        className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-3 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? (
          <>
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            {T.picker.creating}
          </>
        ) : (
          <>
            {T.picker.createReport}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </>
        )}
      </button>
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  children,
  disabled,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
  disabled?: boolean;
  /** When set, renders a leading empty option (e.g. "Bir mahalle seçin"). */
  placeholder?: string;
}) {
  return (
    <label className="mt-3 block">
      <span className="text-xs font-medium text-muted">{label}</span>
      <div className="relative mt-1">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="h-11 w-full appearance-none rounded-lg border border-line bg-surface-2 px-3 pr-9 text-sm text-ink outline-none focus:border-brand-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {placeholder !== undefined && <option value="">{placeholder}</option>}
          {children}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
          aria-hidden
        />
      </div>
    </label>
  );
}
