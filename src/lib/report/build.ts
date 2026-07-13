/**
 * Neighborhood report assembly (CLAUDE.md §19.3, §29 step 9).
 *
 * Pure and deterministic: takes a neighborhood, its baseline places, an optional
 * official demographic record and a lifestyle profile, and returns a complete
 * report view model. Distances are straight-line from the centroid (§15.7);
 * baseline places carry no ratings (Google enrichment is lazy per-business),
 * so the quality dimension is naturally "unavailable" here — as designed.
 */

import type { BaselinePlace, GeoPoint } from "@/lib/data/adapters/types";
import type { TuikDemographicRecord } from "@/lib/data/adapters/demographics";
import { haversineMeters } from "@/lib/geo/distance";
import {
  scoreNeighborhood,
  type NeighborhoodScore,
} from "@/lib/scoring/neighborhood";
import type { ScorablePlace } from "@/lib/scoring/engine";
import type { LifestyleProfile } from "@/lib/scoring/profiles";
import { DEFAULT_SCORING_CONFIG, type ScoringConfig } from "@/lib/scoring/config";
import {
  buildDemographicFacts,
  type DemographicFacts,
} from "@/lib/demographics/facts";
import {
  getCategory,
  scoreGroupNameTr,
  categoryNameTr,
  type ScoreGroup,
} from "@/lib/taxonomy/categories";

export interface NeighborhoodMeta {
  slug: string;
  name: string;
  district: string;
  city: string;
  centroid: GeoPoint;
  /** Boundary/coverage confidence label (§12.2). */
  boundaryConfidence: "high" | "good" | "limited" | "experimental";
  isApproximate: boolean;
}

/** A place surfaced in the report (§19.3, §31.1 business list). */
export interface NearbyOption {
  /** Best display name: the real business name, else the Turkish category label. */
  name: string;
  /** True when `name` is a real business name (live data), not a category label. */
  named: boolean;
  categorySlug: string;
  categoryName: string;
  distanceMeters: number;
}

export interface ReportGroupHighlights {
  group: ScoreGroup;
  groupName: string;
  options: NearbyOption[];
}

export interface NeighborhoodReport {
  neighborhood: NeighborhoodMeta;
  profile: { slug: string; name: string; description: string };
  score: NeighborhoodScore;
  demographics: DemographicFacts | null;
  /** Closest options per score group, for the "top nearby" section. */
  highlights: ReportGroupHighlights[];
  /** Flat list of the nearest businesses, for the neighborhood business list (§31.1). */
  businesses: NearbyOption[];
  /** Total baseline places considered (may exceed `businesses.length`). */
  placeCount: number;
  /** Honesty banner state — true when data is prototype/sample, not live. */
  dataNotice: { sample: boolean; message: string };
}

/** Max businesses sent to the client for the list (the count still reports the true total). */
const MAX_BUSINESSES = 150;

/**
 * Categories excluded from the *business list* (they still count toward scoring).
 * These are transit/parking infrastructure, not businesses — and OSM names bus
 * stops after nearby landmarks (e.g. a stop named "Kuğulu Park"), which reads as
 * noise in a venue list.
 */
const NON_BUSINESS_CATEGORIES = new Set(["bus_stop", "taxi_stand", "parking", "bicycle_infra"]);

/** Collapse repeated *named* places (OSM often has a point + a building for one venue). */
function dedupeNamed(options: NearbyOption[]): NearbyOption[] {
  const seen = new Set<string>();
  const out: NearbyOption[] = [];
  for (const o of options) {
    if (o.named) {
      const key = `${o.name.toLocaleLowerCase("tr-TR")}|${o.categorySlug}`;
      if (seen.has(key)) continue;
      seen.add(key);
    }
    out.push(o);
  }
  return out;
}

export interface BuildReportArgs {
  neighborhood: NeighborhoodMeta;
  places: BaselinePlace[];
  demographics: TuikDemographicRecord | null;
  profile: LifestyleProfile;
  currentYear: number;
  sample: boolean;
  cfg?: ScoringConfig;
  /** Max options to surface per group. */
  highlightsPerGroup?: number;
}

export function buildNeighborhoodReport(args: BuildReportArgs): NeighborhoodReport {
  const {
    neighborhood,
    places,
    demographics,
    profile,
    currentYear,
    sample,
    cfg = DEFAULT_SCORING_CONFIG,
    highlightsPerGroup = 3,
  } = args;

  // Attach straight-line distance from the centroid to each place.
  const withDistance = places.map((p) => ({
    place: p,
    distanceMeters: Math.round(haversineMeters(neighborhood.centroid, p.location)),
  }));

  const scorable: ScorablePlace[] = withDistance.map(({ place, distanceMeters }) => ({
    categorySlug: place.categorySlug,
    distanceMeters,
  }));

  const computed = scoreNeighborhood(scorable, profile.weights, cfg);
  // Sample/prototype data must never read as trustworthy, however "complete" it
  // looks — the Data Confidence Score reports data quality, and unverified sample
  // data is experimental by definition (§13, §28). Cap it, keep the raw inputs.
  const score = sample
    ? {
        ...computed,
        confidence: {
          ...computed.confidence,
          score: Math.min(computed.confidence.score, 20),
          label: "experimental" as const,
        },
      }
    : computed;

  const highlights = buildHighlights(withDistance, highlightsPerGroup);

  // Flat nearest-first business list (§31.1): tracked categories, minus transit
  // infrastructure, de-duplicated, nearest first. Bus stops etc. still feed the
  // scoring above — they're just excluded from the *venue list*.
  const listable = dedupeNamed(
    withDistance
      .filter(({ place }) => {
        const cat = getCategory(place.categorySlug);
        return cat && !NON_BUSINESS_CATEGORIES.has(place.categorySlug);
      })
      .map(({ place, distanceMeters }) => toOption(place, distanceMeters))
      .sort((a, b) => a.distanceMeters - b.distanceMeters),
  );
  const businesses = listable.slice(0, MAX_BUSINESSES);

  return {
    neighborhood,
    profile: { slug: profile.slug, name: profile.name, description: profile.description },
    score,
    demographics: demographics ? buildDemographicFacts(demographics, currentYear) : null,
    highlights,
    businesses,
    placeCount: listable.length,
    dataNotice: {
      sample,
      message: sample
        ? "Bu rapor, gösterim amacıyla örnek prototip verisi kullanır — canlı kapsam değildir. Gerçek OpenStreetMap verileri içe aktarıldığında puanlar ve güvenilirlik değişecektir."
        : "Puanlar hâlihazırda mevcut verilere dayanır ve her işletmeyi veya son değişiklikleri içermeyebilir.",
    },
  };
}

/**
 * Build a display option from a baseline place. Uses the real business name when
 * present; sample places carry their category slug as the name, so we fall back
 * to the Turkish category label (never show a raw slug to the user).
 */
function toOption(place: BaselinePlace, distanceMeters: number): NearbyOption {
  const categoryName = categoryNameTr(place.categorySlug);
  const named = Boolean(place.name && place.name !== place.categorySlug);
  return {
    name: named ? place.name : categoryName,
    named,
    categorySlug: place.categorySlug,
    categoryName,
    distanceMeters,
  };
}

function buildHighlights(
  withDistance: { place: BaselinePlace; distanceMeters: number }[],
  perGroup: number,
): ReportGroupHighlights[] {
  const byGroup = new Map<ScoreGroup, NearbyOption[]>();
  for (const { place, distanceMeters } of withDistance) {
    const cat = getCategory(place.categorySlug);
    if (!cat) continue;
    const list = byGroup.get(cat.scoreGroup) ?? [];
    list.push(toOption(place, distanceMeters));
    byGroup.set(cat.scoreGroup, list);
  }
  const groups: ReportGroupHighlights[] = [];
  for (const [group, options] of byGroup) {
    options.sort((a, b) => a.distanceMeters - b.distanceMeters);
    groups.push({
      group,
      groupName: scoreGroupNameTr(group),
      options: options.slice(0, perGroup),
    });
  }
  // Stable, presentational order by group name.
  groups.sort((a, b) => a.groupName.localeCompare(b.groupName));
  return groups;
}
