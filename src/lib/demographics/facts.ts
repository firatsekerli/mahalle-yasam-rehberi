/**
 * Demographic facts for reports (CLAUDE.md §12.5, §13, §19.3; decision 2026-07-12).
 *
 * Turns an official TÜİK record into a presentation-ready, ATTRIBUTED, DATED
 * facts object with computed shares and a freshness label. Pure and
 * deterministic. Hard guarantees, by construction:
 *  - No value is invented — every field is derived from the source record.
 *  - Shares are computed only when the underlying breakdown exists.
 *  - This module never imports scoring; demographics are facts, not a score (§28).
 */

import {
  TUIK_ATTRIBUTION,
  type AdminLevel,
  type TuikDemographicRecord,
} from "@/lib/data/adapters/demographics";

export type FreshnessLabel = "current" | "recent" | "dated" | "stale";

export interface AgeBandFact {
  band: string;
  population: number;
  /** Share of total population, 0..1, rounded to 3 dp. */
  share: number;
}

export interface SexFact {
  male: number;
  female: number;
  maleShare: number; // 0..1
  femaleShare: number; // 0..1
}

export interface DemographicFacts {
  source: "tuik";
  attribution: string;
  sourceDataset: string;
  referenceYear: number;
  adminLevel: AdminLevel;
  areaName: string;
  totalPopulation: number;
  /** Present only when the source published an age breakdown at this level. */
  ageBands?: AgeBandFact[];
  /** Present only when the source published a sex breakdown at this level. */
  sex?: SexFact;
  /** Present only when the source published it. */
  averageHouseholdSize?: number;
  freshness: {
    referenceYear: number;
    ageYears: number;
    label: FreshnessLabel;
  };
}

function freshnessLabel(ageYears: number): FreshnessLabel {
  if (ageYears <= 1) return "current";
  if (ageYears <= 3) return "recent";
  if (ageYears <= 6) return "dated";
  return "stale";
}

function share(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((part / total) * 1000) / 1000;
}

/**
 * Assemble display facts from an official record. `currentYear` is supplied by
 * the caller (kept out of this pure function) to compute data freshness (§13).
 */
export function buildDemographicFacts(
  record: TuikDemographicRecord,
  currentYear: number,
): DemographicFacts {
  const facts: DemographicFacts = {
    source: "tuik",
    attribution: TUIK_ATTRIBUTION,
    sourceDataset: record.sourceDataset,
    referenceYear: record.referenceYear,
    adminLevel: record.adminLevel,
    areaName: record.areaName,
    totalPopulation: record.totalPopulation,
    freshness: {
      referenceYear: record.referenceYear,
      ageYears: Math.max(0, currentYear - record.referenceYear),
      label: freshnessLabel(Math.max(0, currentYear - record.referenceYear)),
    },
  };

  if (record.populationByAgeBand) {
    facts.ageBands = Object.entries(record.populationByAgeBand).map(([band, population]) => ({
      band,
      population,
      share: share(population, record.totalPopulation),
    }));
  }
  if (record.populationBySex) {
    const { male, female } = record.populationBySex;
    const total = male + female;
    facts.sex = {
      male,
      female,
      maleShare: share(male, total),
      femaleShare: share(female, total),
    };
  }
  if (record.averageHouseholdSize !== undefined) {
    facts.averageHouseholdSize = record.averageHouseholdSize;
  }
  return facts;
}

const LEVEL_NOUN: Record<AdminLevel, string> = {
  province: "province",
  district: "district",
  neighborhood: "neighborhood",
};

/**
 * Deterministic plain-language statement of the facts (§15.8 — templates before
 * any LLM). States only what the record actually contains, always cites the
 * source and year, and never characterizes or infers.
 */
export function summarizeDemographics(facts: DemographicFacts): string {
  const parts: string[] = [
    `As of the ${facts.referenceYear} official register (${facts.sourceDataset}), the ${LEVEL_NOUN[facts.adminLevel]} of ${facts.areaName} had a registered population of ${facts.totalPopulation.toLocaleString("en-US")}.`,
  ];
  if (facts.averageHouseholdSize !== undefined) {
    parts.push(`Average household size was ${facts.averageHouseholdSize}.`);
  }
  if (facts.freshness.label === "dated" || facts.freshness.label === "stale") {
    parts.push(
      `This figure is ${facts.freshness.ageYears} years old; more recent official data may be available.`,
    );
  }
  return parts.join(" ");
}
