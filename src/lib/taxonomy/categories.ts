/**
 * Normalized platform taxonomy (CLAUDE.md §10).
 *
 * Raw provider categories (OSM tags, Google types) MUST map into this stable
 * taxonomy — never scored directly. Score groups map subcategories to the
 * scoring model's weighted category groups (§11.2).
 *
 * This is the source of truth for the taxonomy in code; it is mirrored into the
 * database `categories` table by a seed migration so both stay in sync.
 */

export type ScoreGroup =
  | "daily_essentials"
  | "health_wellbeing"
  | "transport_mobility"
  | "family_education"
  | "food_social"
  | "fitness_recreation"
  | "pet_services"
  | "personal_household"
  | "late_hour_convenience";

export interface CategoryDef {
  /** Stable slug — never reuse or repurpose. */
  slug: string;
  /** Human label (English; Turkish labels added via i18n later). */
  name: string;
  scoreGroup: ScoreGroup;
  /**
   * Essential subcategories drive coverage scoring and missing-service
   * penalties (§11.3, §11.4). A neighborhood missing an essential is penalized.
   */
  essential: boolean;
}

export const SCORE_GROUPS: Record<ScoreGroup, { slug: ScoreGroup; name: string }> = {
  daily_essentials: { slug: "daily_essentials", name: "Daily essentials" },
  health_wellbeing: { slug: "health_wellbeing", name: "Health and wellbeing" },
  transport_mobility: { slug: "transport_mobility", name: "Transport and mobility" },
  family_education: { slug: "family_education", name: "Family and education" },
  food_social: { slug: "food_social", name: "Food and social life" },
  fitness_recreation: { slug: "fitness_recreation", name: "Fitness and recreation" },
  pet_services: { slug: "pet_services", name: "Pet services" },
  personal_household: { slug: "personal_household", name: "Personal and household services" },
  late_hour_convenience: { slug: "late_hour_convenience", name: "Late-hour convenience" },
};

/** Flat list of leaf categories. Order is presentational only. */
export const CATEGORIES: CategoryDef[] = [
  // 10.1 Daily essentials
  { slug: "supermarket", name: "Supermarket", scoreGroup: "daily_essentials", essential: true },
  { slug: "grocery", name: "Local grocery store", scoreGroup: "daily_essentials", essential: true },
  { slug: "convenience", name: "Convenience store", scoreGroup: "daily_essentials", essential: false },
  { slug: "bakery", name: "Bakery", scoreGroup: "daily_essentials", essential: true },
  { slug: "butcher", name: "Butcher", scoreGroup: "daily_essentials", essential: false },
  { slug: "greengrocer", name: "Produce shop", scoreGroup: "daily_essentials", essential: false },
  { slug: "water_supplier", name: "Drinking-water supplier", scoreGroup: "daily_essentials", essential: false },
  { slug: "shopping_center", name: "Shopping center", scoreGroup: "daily_essentials", essential: false },

  // 10.2 Health and wellbeing
  { slug: "pharmacy", name: "Pharmacy", scoreGroup: "health_wellbeing", essential: true },
  { slug: "hospital", name: "Hospital", scoreGroup: "health_wellbeing", essential: false },
  { slug: "clinic", name: "Clinic", scoreGroup: "health_wellbeing", essential: true },
  { slug: "family_health_center", name: "Family health center", scoreGroup: "health_wellbeing", essential: false },
  { slug: "dentist", name: "Dentist", scoreGroup: "health_wellbeing", essential: false },
  { slug: "laboratory", name: "Laboratory", scoreGroup: "health_wellbeing", essential: false },
  { slug: "optician", name: "Optician", scoreGroup: "health_wellbeing", essential: false },
  { slug: "physiotherapy", name: "Physiotherapy center", scoreGroup: "health_wellbeing", essential: false },
  { slug: "psychologist", name: "Psychologist / counseling", scoreGroup: "health_wellbeing", essential: false },

  // 10.3 Food and social life
  { slug: "restaurant", name: "Restaurant", scoreGroup: "food_social", essential: true },
  { slug: "cafe", name: "Café", scoreGroup: "food_social", essential: false },
  { slug: "coffee_shop", name: "Coffee shop", scoreGroup: "food_social", essential: false },
  { slug: "fast_food", name: "Fast food", scoreGroup: "food_social", essential: false },
  { slug: "dessert", name: "Dessert shop", scoreGroup: "food_social", essential: false },
  { slug: "breakfast", name: "Breakfast venue", scoreGroup: "food_social", essential: false },

  // 10.4 Family and education
  { slug: "nursery", name: "Nursery", scoreGroup: "family_education", essential: false },
  { slug: "kindergarten", name: "Kindergarten", scoreGroup: "family_education", essential: true },
  { slug: "primary_school", name: "Primary school", scoreGroup: "family_education", essential: true },
  { slug: "secondary_school", name: "Secondary school", scoreGroup: "family_education", essential: false },
  { slug: "high_school", name: "High school", scoreGroup: "family_education", essential: false },
  { slug: "tutoring", name: "Tutoring center", scoreGroup: "family_education", essential: false },
  { slug: "library", name: "Library", scoreGroup: "family_education", essential: false },
  { slug: "playground", name: "Playground", scoreGroup: "family_education", essential: false },
  { slug: "kids_activity", name: "Children's activity center", scoreGroup: "family_education", essential: false },

  // 10.5 Transport and mobility
  { slug: "metro_station", name: "Metro station", scoreGroup: "transport_mobility", essential: true },
  { slug: "train_station", name: "Train station", scoreGroup: "transport_mobility", essential: false },
  { slug: "bus_stop", name: "Bus stop", scoreGroup: "transport_mobility", essential: true },
  { slug: "taxi_stand", name: "Taxi stand", scoreGroup: "transport_mobility", essential: false },
  { slug: "bicycle_infra", name: "Bicycle infrastructure", scoreGroup: "transport_mobility", essential: false },
  { slug: "parking", name: "Parking", scoreGroup: "transport_mobility", essential: false },

  // 10.6 Fitness and recreation
  { slug: "gym", name: "Gym", scoreGroup: "fitness_recreation", essential: false },
  { slug: "sports_center", name: "Sports center", scoreGroup: "fitness_recreation", essential: false },
  { slug: "swimming_pool", name: "Swimming pool", scoreGroup: "fitness_recreation", essential: false },
  { slug: "park", name: "Park", scoreGroup: "fitness_recreation", essential: true },
  { slug: "walking_path", name: "Walking path", scoreGroup: "fitness_recreation", essential: false },
  { slug: "sports_field", name: "Sports field", scoreGroup: "fitness_recreation", essential: false },
  { slug: "yoga_pilates", name: "Yoga / pilates studio", scoreGroup: "fitness_recreation", essential: false },

  // 10.7 Pet services
  { slug: "veterinarian", name: "Veterinarian", scoreGroup: "pet_services", essential: true },
  { slug: "pet_shop", name: "Pet shop", scoreGroup: "pet_services", essential: false },
  { slug: "pet_grooming", name: "Pet grooming", scoreGroup: "pet_services", essential: false },
  { slug: "dog_park", name: "Dog park", scoreGroup: "pet_services", essential: false },

  // 10.8 Personal and household services
  { slug: "hairdresser", name: "Hairdresser", scoreGroup: "personal_household", essential: false },
  { slug: "barber", name: "Barber", scoreGroup: "personal_household", essential: false },
  { slug: "dry_cleaning", name: "Dry cleaning", scoreGroup: "personal_household", essential: false },
  { slug: "tailor", name: "Tailor", scoreGroup: "personal_household", essential: false },
  { slug: "repair", name: "Repair service", scoreGroup: "personal_household", essential: false },
  { slug: "bank", name: "Bank", scoreGroup: "personal_household", essential: false },
  { slug: "atm", name: "ATM", scoreGroup: "personal_household", essential: true },
  { slug: "cargo", name: "Cargo / parcel service", scoreGroup: "personal_household", essential: false },
];

const BY_SLUG = new Map(CATEGORIES.map((c) => [c.slug, c]));

export function getCategory(slug: string): CategoryDef | undefined {
  return BY_SLUG.get(slug);
}

export function categoriesInGroup(group: ScoreGroup): CategoryDef[] {
  return CATEGORIES.filter((c) => c.scoreGroup === group);
}

export function essentialCategoriesInGroup(group: ScoreGroup): CategoryDef[] {
  return CATEGORIES.filter((c) => c.scoreGroup === group && c.essential);
}
