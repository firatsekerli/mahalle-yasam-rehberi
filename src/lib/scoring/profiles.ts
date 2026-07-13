/**
 * System lifestyle profiles (CLAUDE.md §9.2, §11.2).
 *
 * A profile only changes scoring *weights*, never the underlying facts (§9.2).
 * This is the code-side source of truth for the system profiles; it mirrors the
 * seed migration `0003_seed_taxonomy_and_profiles.sql` so both stay in sync.
 * Each weight set uses `WeightKey`s and must sum to 1.0.
 */

import { DEFAULT_SCORING_CONFIG, type WeightKey } from "./config";

export interface LifestyleProfile {
  slug: string;
  name: string;
  description: string;
  weights: Record<WeightKey, number>;
}

export const LIFESTYLE_PROFILES: LifestyleProfile[] = [
  {
    slug: "general",
    name: "General daily life",
    description: "Balanced weighting across everyday needs.",
    weights: { ...DEFAULT_SCORING_CONFIG.weights },
  },
  {
    slug: "family",
    name: "Family with children",
    description: "Emphasizes schools, health and daily essentials.",
    weights: {
      daily_essentials: 0.18, health_wellbeing: 0.15, transport_mobility: 0.12,
      family_education: 0.22, food_social: 0.06, fitness_recreation: 0.08,
      business_quality: 0.08, pet_services: 0.04, late_hour_convenience: 0.07,
    },
  },
  {
    slug: "student",
    name: "Student",
    description: "Emphasizes transport, food, social life and late hours.",
    weights: {
      daily_essentials: 0.15, health_wellbeing: 0.08, transport_mobility: 0.2,
      family_education: 0.02, food_social: 0.2, fitness_recreation: 0.1,
      business_quality: 0.08, pet_services: 0.02, late_hour_convenience: 0.15,
    },
  },
  {
    slug: "car_free",
    name: "Car-free lifestyle",
    description: "Heavily weights public transport and walkable access.",
    weights: {
      daily_essentials: 0.22, health_wellbeing: 0.13, transport_mobility: 0.28,
      family_education: 0.06, food_social: 0.08, fitness_recreation: 0.06,
      business_quality: 0.07, pet_services: 0.03, late_hour_convenience: 0.07,
    },
  },
  {
    slug: "pet_owner",
    name: "Pet owner",
    description: "Emphasizes veterinary, pet services and green space.",
    weights: {
      daily_essentials: 0.18, health_wellbeing: 0.12, transport_mobility: 0.12,
      family_education: 0.05, food_social: 0.07, fitness_recreation: 0.13,
      business_quality: 0.08, pet_services: 0.18, late_hour_convenience: 0.07,
    },
  },
];

const BY_SLUG = new Map(LIFESTYLE_PROFILES.map((p) => [p.slug, p]));

export const DEFAULT_PROFILE_SLUG = "general";

export function getProfile(slug: string | undefined): LifestyleProfile {
  return (slug && BY_SLUG.get(slug)) || BY_SLUG.get(DEFAULT_PROFILE_SLUG)!;
}
