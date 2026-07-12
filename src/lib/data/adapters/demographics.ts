/**
 * Demographics source adapter (CLAUDE.md §12.5, §28; decision 2026-07-12).
 *
 * FACTS ONLY. Demographics come from an authoritative official source — TÜİK
 * (Türkiye İstatistik Kurumu) and its Address-Based Population Registration
 * System (ADNKS) — and are shown as attributed, dated facts. They are NEVER
 * inferred, estimated, or fed into the neighborhood score (§28, §18.3).
 *
 * Like the other providers, this sits behind an interface so the source can be
 * swapped. The concrete TÜİK source reads rows the Python worker imported from
 * the official dataset into the `demographics` table — the app never scrapes or
 * fabricates figures. A `lookup` is injected so production plugs in a PostGIS
 * read and tests plug in a fixture.
 */

export type AdminLevel = "province" | "district" | "neighborhood";

/**
 * One official demographic record for an administrative unit, exactly as
 * imported from the TÜİK dataset. Optional breakdowns are absent (not zeroed)
 * when the dataset doesn't publish them at that level (§13 honesty).
 */
export interface TuikDemographicRecord {
  adminLevel: AdminLevel;
  /** TÜİK administrative unit code. */
  adminCode: string;
  areaName: string;
  /** ADNKS reference year (e.g. 2024). */
  referenceYear: number;
  /** Name of the source dataset for attribution/freshness, e.g. "TUIK ADNKS 2024". */
  sourceDataset: string;
  totalPopulation: number;
  /** Broad age bands → population, e.g. { "0-14": n, "15-64": n, "65+": n }. */
  populationByAgeBand?: Record<string, number>;
  populationBySex?: { male: number; female: number };
  averageHouseholdSize?: number;
}

/** Required attribution — MUST be displayed wherever these figures appear. */
export const TUIK_ATTRIBUTION =
  "Population data © Türkiye İstatistik Kurumu (TÜİK), Address-Based Population Registration System (ADNKS)";

export interface DemographicsSource {
  readonly source: "tuik";
  /** Official facts for an administrative unit, or null if not imported. */
  getByAdminCode(adminLevel: AdminLevel, adminCode: string): Promise<TuikDemographicRecord | null>;
}

/** Reads worker-imported official rows; `lookup` models the PostGIS/dataset read. */
export type DemographicLookup = (
  adminLevel: AdminLevel,
  adminCode: string,
) => Promise<TuikDemographicRecord | null>;

export class TuikDemographicsSource implements DemographicsSource {
  readonly source = "tuik" as const;

  constructor(private readonly lookup: DemographicLookup) {}

  getByAdminCode(adminLevel: AdminLevel, adminCode: string): Promise<TuikDemographicRecord | null> {
    return this.lookup(adminLevel, adminCode);
  }
}

/**
 * Build an in-memory lookup from a fixed set of records (tests, or a small
 * prototype seed the worker has already validated). Keyed by level + code.
 */
export function staticDemographicLookup(
  records: readonly TuikDemographicRecord[],
): DemographicLookup {
  const index = new Map(records.map((r) => [`${r.adminLevel}:${r.adminCode}`, r]));
  return async (adminLevel, adminCode) => index.get(`${adminLevel}:${adminCode}`) ?? null;
}
