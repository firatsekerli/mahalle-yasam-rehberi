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
import {
  estimateWalkMinutes,
  walkMinutesFor,
  type WalkIsochrone,
} from "@/lib/data/adapters/isochrone";
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
  /** Walking minutes — routed when available, else a straight-line estimate (§15.7). */
  walkMinutes: number;
  /** True when `walkMinutes` is a straight-line estimate, not a routed time. */
  walkEstimated: boolean;
  /** Location, for map markers. */
  location: GeoPoint;
}

export interface ReportGroupHighlights {
  group: ScoreGroup;
  groupName: string;
  options: NearbyOption[];
}

/** Count of one tracked category near the measurement center (§19.3 "Yakın çevre"). */
export interface NearbyCategoryCount {
  categorySlug: string;
  categoryName: string;
  count: number;
  /** Straight-line distance to the closest instance, in meters. */
  nearestMeters: number;
}

/** Category counts rolled up by score group, for the "nearby" overview. */
export interface NearbyGroupCounts {
  group: ScoreGroup;
  groupName: string;
  /** Total tracked places in this group near the center. */
  total: number;
  /** Per-category breakdown, most-common first. */
  categories: NearbyCategoryCount[];
}

export interface NeighborhoodReport {
  neighborhood: NeighborhoodMeta;
  profile: { slug: string; name: string; description: string };
  score: NeighborhoodScore;
  demographics: DemographicFacts | null;
  /** Closest options per score group, for the "top nearby" section. */
  highlights: ReportGroupHighlights[];
  /** Facility counts by category, rolled up by group — the "Yakın çevre" overview. */
  nearbyCounts: NearbyGroupCounts[];
  /** Flat list of the nearest businesses, for the neighborhood business list (§31.1). */
  businesses: NearbyOption[];
  /** Total baseline places considered (may exceed `businesses.length`). */
  placeCount: number;
  /** Honesty banner state — true when data is prototype/sample, not live. */
  dataNotice: { sample: boolean; message: string };
  /** True when places were filtered to the real mahalle boundary (not a radius). */
  boundaryPrecise: boolean;
  /** Routed walk isochrones (if available), for the map overlay. */
  isochrones?: WalkIsochrone[];
}

/**
 * Max businesses shown in the list — the nearest N (the count still reports the
 * true total, e.g. "480 işletme bulundu — en yakın 50 gösteriliyor"). The list is
 * a supporting view, not a directory (§31.1); a tight cap keeps it readable.
 */
const MAX_BUSINESSES = 50;

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
  /** Routed walk isochrones from the neighborhood centroid; enables walk-based reach (§15.7). */
  isochrones?: WalkIsochrone[];
  /** True when `places` were already filtered to the real mahalle boundary (§12.2). */
  boundaryPrecise?: boolean;
}

/** Per-place walking assessment: display minutes, estimate flag, and a scoring input. */
interface WalkInfo {
  /** Minutes to show the user. */
  minutes: number;
  /** True when `minutes` is a straight-line estimate, not routed. */
  estimated: boolean;
  /** Minutes fed to scoring — only set when routed (else scoring uses distance). */
  scoringMinutes?: number;
}

function walkInfoFor(
  location: GeoPoint,
  distanceMeters: number,
  isochrones: WalkIsochrone[] | undefined,
  cfg: ScoringConfig,
): WalkInfo {
  if (isochrones && isochrones.length > 0) {
    const band = walkMinutesFor(location, isochrones);
    if (band !== null) return { minutes: band, estimated: false, scoringMinutes: band };
    // Routing available but the place is outside every band → beyond walk reach.
    return {
      minutes: estimateWalkMinutes(distanceMeters),
      estimated: true,
      scoringMinutes: cfg.walkBands.reachableMinutes + 1,
    };
  }
  return { minutes: estimateWalkMinutes(distanceMeters), estimated: true };
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
    isochrones,
    boundaryPrecise = false,
  } = args;

  // Attach straight-line distance + a walk assessment (routed or estimated) to each place.
  const withDistance = places.map((p) => {
    const distanceMeters = Math.round(haversineMeters(neighborhood.centroid, p.location));
    return { place: p, distanceMeters, walk: walkInfoFor(p.location, distanceMeters, isochrones, cfg) };
  });

  const scorable: ScorablePlace[] = withDistance.map(({ place, distanceMeters, walk }) => ({
    categorySlug: place.categorySlug,
    distanceMeters,
    walkMinutes: walk.scoringMinutes,
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
  const nearbyCounts = buildNearbyCounts(withDistance);

  // Flat nearest-first business list (§31.1): tracked categories, minus transit
  // infrastructure, de-duplicated, nearest first. Bus stops etc. still feed the
  // scoring above — they're just excluded from the *venue list*.
  const listable = dedupeNamed(
    withDistance
      .filter(({ place }) => {
        const cat = getCategory(place.categorySlug);
        return cat && !NON_BUSINESS_CATEGORIES.has(place.categorySlug);
      })
      .map(({ place, distanceMeters, walk }) => toOption(place, distanceMeters, walk))
      .sort((a, b) => a.distanceMeters - b.distanceMeters),
  );
  const businesses = listable.slice(0, MAX_BUSINESSES);

  return {
    neighborhood,
    profile: { slug: profile.slug, name: profile.name, description: profile.description },
    score,
    demographics: demographics ? buildDemographicFacts(demographics, currentYear) : null,
    highlights,
    nearbyCounts,
    businesses,
    placeCount: listable.length,
    boundaryPrecise,
    isochrones,
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
function toOption(place: BaselinePlace, distanceMeters: number, walk: WalkInfo): NearbyOption {
  const categoryName = categoryNameTr(place.categorySlug);
  const named = Boolean(place.name && place.name !== place.categorySlug);
  return {
    name: named ? place.name : categoryName,
    named,
    categorySlug: place.categorySlug,
    categoryName,
    distanceMeters,
    walkMinutes: walk.minutes,
    walkEstimated: walk.estimated,
    location: place.location,
  };
}

/**
 * Roll up facility counts by category, then by score group, for the "Yakın çevre"
 * overview (§19.3). Unlike the business list this includes transit/parking
 * infrastructure — a Metro or bus-stop count is decision-useful here — but like
 * scoring it only counts tracked (normalized) categories, never raw provider tags.
 * Counts are honest evidence of coverage, not a completeness claim (§13).
 */
function buildNearbyCounts(
  withDistance: { place: BaselinePlace; distanceMeters: number; walk: WalkInfo }[],
): NearbyGroupCounts[] {
  const byCategory = new Map<string, { count: number; nearestMeters: number }>();
  for (const { place, distanceMeters } of withDistance) {
    if (!getCategory(place.categorySlug)) continue;
    const cur = byCategory.get(place.categorySlug);
    if (cur) {
      cur.count += 1;
      cur.nearestMeters = Math.min(cur.nearestMeters, distanceMeters);
    } else {
      byCategory.set(place.categorySlug, { count: 1, nearestMeters: distanceMeters });
    }
  }

  const byGroup = new Map<ScoreGroup, NearbyCategoryCount[]>();
  for (const [slug, { count, nearestMeters }] of byCategory) {
    const cat = getCategory(slug)!;
    const list = byGroup.get(cat.scoreGroup) ?? [];
    list.push({ categorySlug: slug, categoryName: categoryNameTr(slug), count, nearestMeters });
    byGroup.set(cat.scoreGroup, list);
  }

  const groups: NearbyGroupCounts[] = [];
  for (const [group, categories] of byGroup) {
    categories.sort((a, b) => b.count - a.count || a.nearestMeters - b.nearestMeters);
    const total = categories.reduce((sum, c) => sum + c.count, 0);
    groups.push({ group, groupName: scoreGroupNameTr(group), total, categories });
  }
  // Busiest groups first; break ties by localized name for a stable order.
  groups.sort((a, b) => b.total - a.total || a.groupName.localeCompare(b.groupName, "tr"));
  return groups;
}

function buildHighlights(
  withDistance: { place: BaselinePlace; distanceMeters: number; walk: WalkInfo }[],
  perGroup: number,
): ReportGroupHighlights[] {
  const byGroup = new Map<ScoreGroup, NearbyOption[]>();
  for (const { place, distanceMeters, walk } of withDistance) {
    const cat = getCategory(place.categorySlug);
    if (!cat) continue;
    const list = byGroup.get(cat.scoreGroup) ?? [];
    list.push(toOption(place, distanceMeters, walk));
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
