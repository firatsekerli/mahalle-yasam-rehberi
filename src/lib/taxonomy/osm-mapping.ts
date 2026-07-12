/**
 * OpenStreetMap tag → platform taxonomy normalization (CLAUDE.md §10, §12.1, §29 step 6).
 *
 * Raw OSM tags MUST be normalized into a stable platform category slug before a
 * place is stored or scored — provider categories are never scored directly
 * (§10, §28). This is the single mapping used by the OSM baseline adapter.
 *
 * Rules are evaluated in order, most-specific first; the first match wins. A tag
 * set that matches nothing returns `null` and the place is dropped from the
 * baseline (we only keep places we can honestly categorize).
 */

import { getCategory } from "./categories";

/** Raw OSM tag bag (all values are strings in Overpass output). */
export type OsmTags = Record<string, string>;

interface OsmRule {
  slug: string;
  match(tags: OsmTags): boolean;
}

const has = (tags: OsmTags, key: string, ...values: string[]) =>
  values.length === 0 ? key in tags : values.includes(tags[key]);

/**
 * Ordered rules. Earlier rules win, so put narrow/derived cases (e.g. metro vs
 * generic railway station) before broad ones.
 */
const RULES: OsmRule[] = [
  // --- Daily essentials ---
  { slug: "supermarket", match: (t) => has(t, "shop", "supermarket") },
  { slug: "greengrocer", match: (t) => has(t, "shop", "greengrocer") },
  { slug: "bakery", match: (t) => has(t, "shop", "bakery", "pastry") },
  { slug: "butcher", match: (t) => has(t, "shop", "butcher") },
  { slug: "convenience", match: (t) => has(t, "shop", "convenience", "kiosk") },
  { slug: "grocery", match: (t) => has(t, "shop", "grocery", "general", "food") },
  { slug: "shopping_center", match: (t) => has(t, "shop", "mall", "department_store") },
  { slug: "water_supplier", match: (t) => has(t, "shop", "water") },

  // --- Health and wellbeing ---
  { slug: "pharmacy", match: (t) => has(t, "amenity", "pharmacy") },
  { slug: "hospital", match: (t) => has(t, "amenity", "hospital") },
  { slug: "dentist", match: (t) => has(t, "amenity", "dentist") || has(t, "healthcare", "dentist") },
  { slug: "laboratory", match: (t) => has(t, "healthcare", "laboratory") },
  { slug: "optician", match: (t) => has(t, "shop", "optician") },
  { slug: "physiotherapy", match: (t) => has(t, "healthcare", "physiotherapist") },
  { slug: "psychologist", match: (t) => has(t, "healthcare", "psychotherapist") },
  {
    slug: "family_health_center",
    // Turkish "aile sağlığı merkezi" is commonly tagged as a health centre.
    match: (t) => has(t, "healthcare", "centre"),
  },
  { slug: "clinic", match: (t) => has(t, "amenity", "clinic", "doctors") || has(t, "healthcare", "clinic", "doctor") },

  // --- Food and social life ---
  { slug: "restaurant", match: (t) => has(t, "amenity", "restaurant") },
  { slug: "fast_food", match: (t) => has(t, "amenity", "fast_food") },
  { slug: "dessert", match: (t) => has(t, "shop", "confectionery", "pastry") || has(t, "amenity", "ice_cream") },
  {
    slug: "coffee_shop",
    match: (t) => has(t, "shop", "coffee") || (has(t, "amenity", "cafe") && has(t, "cuisine", "coffee_shop")),
  },
  { slug: "cafe", match: (t) => has(t, "amenity", "cafe") },

  // --- Family and education ---
  { slug: "kindergarten", match: (t) => has(t, "amenity", "kindergarten") },
  { slug: "nursery", match: (t) => has(t, "amenity", "childcare") },
  { slug: "library", match: (t) => has(t, "amenity", "library") },
  { slug: "primary_school", match: (t) => isSchoolLevel(t, "primary") },
  { slug: "high_school", match: (t) => isSchoolLevel(t, "high") },
  { slug: "secondary_school", match: (t) => isSchoolLevel(t, "secondary") },

  // --- Transport and mobility ---
  {
    slug: "metro_station",
    match: (t) =>
      has(t, "station", "subway") ||
      has(t, "railway", "subway_entrance") ||
      (has(t, "railway", "station") && has(t, "subway", "yes")),
  },
  { slug: "train_station", match: (t) => has(t, "railway", "station", "halt") },
  { slug: "bus_stop", match: (t) => has(t, "highway", "bus_stop") || has(t, "amenity", "bus_station") },
  { slug: "taxi_stand", match: (t) => has(t, "amenity", "taxi") },
  { slug: "parking", match: (t) => has(t, "amenity", "parking") },

  // --- Fitness and recreation ---
  { slug: "swimming_pool", match: (t) => has(t, "leisure", "swimming_pool", "swimming_area") },
  { slug: "yoga_pilates", match: (t) => has(t, "sport", "yoga", "pilates") },
  {
    slug: "gym",
    match: (t) => has(t, "leisure", "fitness_centre") || has(t, "amenity", "gym") || has(t, "sport", "fitness"),
  },
  { slug: "sports_center", match: (t) => has(t, "leisure", "sports_centre") },
  { slug: "sports_field", match: (t) => has(t, "leisure", "pitch", "track", "stadium") },
  { slug: "park", match: (t) => has(t, "leisure", "park") },
  { slug: "walking_path", match: (t) => has(t, "leisure", "fitness_station") },

  // --- Pet services ---
  { slug: "veterinarian", match: (t) => has(t, "amenity", "veterinary") },
  { slug: "pet_grooming", match: (t) => has(t, "shop", "pet_grooming") },
  { slug: "pet_shop", match: (t) => has(t, "shop", "pet") },

  // --- Personal and household services ---
  { slug: "atm", match: (t) => has(t, "amenity", "atm") },
  { slug: "bank", match: (t) => has(t, "amenity", "bank") },
  { slug: "dry_cleaning", match: (t) => has(t, "shop", "dry_cleaning", "laundry") },
  { slug: "tailor", match: (t) => has(t, "shop", "tailor") },
  { slug: "hairdresser", match: (t) => has(t, "shop", "hairdresser", "beauty") },
  { slug: "cargo", match: (t) => has(t, "amenity", "post_office") || has(t, "shop", "cargo") },
];

/** OSM schools carry an `isced:level` (1 primary, 2 secondary, 3 high). */
function isSchoolLevel(tags: OsmTags, want: "primary" | "secondary" | "high"): boolean {
  if (!has(tags, "amenity", "school")) return false;
  const levels = (tags["isced:level"] ?? "").split(/[;,\s]+/).filter(Boolean);
  const wants = { primary: "1", secondary: "2", high: "3" }[want];
  if (levels.length > 0) return levels.includes(wants);
  // No level tagged: default an untyped school to primary so it isn't dropped.
  return want === "primary";
}

/**
 * Normalize an OSM tag set to a platform category slug, or `null` if the place
 * is not one of our tracked categories. Guarantees the returned slug exists in
 * the taxonomy (a rule referencing an unknown slug would be a programming error,
 * caught here rather than propagated into scoring).
 */
export function normalizeOsmTags(tags: OsmTags): string | null {
  for (const rule of RULES) {
    if (rule.match(tags)) {
      if (!getCategory(rule.slug)) {
        throw new Error(`OSM rule maps to unknown category slug "${rule.slug}"`);
      }
      return rule.slug;
    }
  }
  return null;
}
