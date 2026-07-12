-- Neighborhood Life — seed taxonomy + system lifestyle profiles.
-- Categories mirror src/lib/taxonomy/categories.ts (that file is the code-side
-- source of truth). Weights mirror the default scoring config (§11.2); profiles
-- change weights only, never the underlying facts (§9.2).

insert into categories (slug, name, score_group, essential_flag) values
  -- daily essentials
  ('supermarket', 'Supermarket', 'daily_essentials', true),
  ('grocery', 'Local grocery store', 'daily_essentials', true),
  ('convenience', 'Convenience store', 'daily_essentials', false),
  ('bakery', 'Bakery', 'daily_essentials', true),
  ('butcher', 'Butcher', 'daily_essentials', false),
  ('greengrocer', 'Produce shop', 'daily_essentials', false),
  ('water_supplier', 'Drinking-water supplier', 'daily_essentials', false),
  ('shopping_center', 'Shopping center', 'daily_essentials', false),
  -- health and wellbeing
  ('pharmacy', 'Pharmacy', 'health_wellbeing', true),
  ('hospital', 'Hospital', 'health_wellbeing', false),
  ('clinic', 'Clinic', 'health_wellbeing', true),
  ('family_health_center', 'Family health center', 'health_wellbeing', false),
  ('dentist', 'Dentist', 'health_wellbeing', false),
  ('laboratory', 'Laboratory', 'health_wellbeing', false),
  ('optician', 'Optician', 'health_wellbeing', false),
  ('physiotherapy', 'Physiotherapy center', 'health_wellbeing', false),
  ('psychologist', 'Psychologist / counseling', 'health_wellbeing', false),
  -- food and social life
  ('restaurant', 'Restaurant', 'food_social', true),
  ('cafe', 'Café', 'food_social', false),
  ('coffee_shop', 'Coffee shop', 'food_social', false),
  ('fast_food', 'Fast food', 'food_social', false),
  ('dessert', 'Dessert shop', 'food_social', false),
  ('breakfast', 'Breakfast venue', 'food_social', false),
  -- family and education
  ('nursery', 'Nursery', 'family_education', false),
  ('kindergarten', 'Kindergarten', 'family_education', true),
  ('primary_school', 'Primary school', 'family_education', true),
  ('secondary_school', 'Secondary school', 'family_education', false),
  ('high_school', 'High school', 'family_education', false),
  ('tutoring', 'Tutoring center', 'family_education', false),
  ('library', 'Library', 'family_education', false),
  ('playground', 'Playground', 'family_education', false),
  ('kids_activity', 'Children''s activity center', 'family_education', false),
  -- transport and mobility
  ('metro_station', 'Metro station', 'transport_mobility', true),
  ('train_station', 'Train station', 'transport_mobility', false),
  ('bus_stop', 'Bus stop', 'transport_mobility', true),
  ('taxi_stand', 'Taxi stand', 'transport_mobility', false),
  ('bicycle_infra', 'Bicycle infrastructure', 'transport_mobility', false),
  ('parking', 'Parking', 'transport_mobility', false),
  -- fitness and recreation
  ('gym', 'Gym', 'fitness_recreation', false),
  ('sports_center', 'Sports center', 'fitness_recreation', false),
  ('swimming_pool', 'Swimming pool', 'fitness_recreation', false),
  ('park', 'Park', 'fitness_recreation', true),
  ('walking_path', 'Walking path', 'fitness_recreation', false),
  ('sports_field', 'Sports field', 'fitness_recreation', false),
  ('yoga_pilates', 'Yoga / pilates studio', 'fitness_recreation', false),
  -- pet services
  ('veterinarian', 'Veterinarian', 'pet_services', true),
  ('pet_shop', 'Pet shop', 'pet_services', false),
  ('pet_grooming', 'Pet grooming', 'pet_services', false),
  ('dog_park', 'Dog park', 'pet_services', false),
  -- personal and household services
  ('hairdresser', 'Hairdresser', 'personal_household', false),
  ('barber', 'Barber', 'personal_household', false),
  ('dry_cleaning', 'Dry cleaning', 'personal_household', false),
  ('tailor', 'Tailor', 'personal_household', false),
  ('repair', 'Repair service', 'personal_household', false),
  ('bank', 'Bank', 'personal_household', false),
  ('atm', 'ATM', 'personal_household', true),
  ('cargo', 'Cargo / parcel service', 'personal_household', false)
on conflict (slug) do nothing;

-- System lifestyle profiles. Each weights object uses WeightKeys and sums to 1.0.
insert into lifestyle_profiles (slug, name, description, is_system_profile, weights) values
  ('general', 'General daily life', 'Balanced weighting across everyday needs.', true, '{
    "daily_essentials": 0.20, "health_wellbeing": 0.15, "transport_mobility": 0.15,
    "family_education": 0.10, "food_social": 0.10, "fitness_recreation": 0.10,
    "business_quality": 0.10, "pet_services": 0.05, "late_hour_convenience": 0.05
  }'::jsonb),
  ('family', 'Family with children', 'Emphasizes schools, health and daily essentials.', true, '{
    "daily_essentials": 0.18, "health_wellbeing": 0.15, "transport_mobility": 0.12,
    "family_education": 0.22, "food_social": 0.06, "fitness_recreation": 0.08,
    "business_quality": 0.08, "pet_services": 0.04, "late_hour_convenience": 0.07
  }'::jsonb),
  ('student', 'Student', 'Emphasizes transport, food, social life and late hours.', true, '{
    "daily_essentials": 0.15, "health_wellbeing": 0.08, "transport_mobility": 0.20,
    "family_education": 0.02, "food_social": 0.20, "fitness_recreation": 0.10,
    "business_quality": 0.08, "pet_services": 0.02, "late_hour_convenience": 0.15
  }'::jsonb),
  ('car_free', 'Car-free lifestyle', 'Heavily weights public transport and walkable access.', true, '{
    "daily_essentials": 0.22, "health_wellbeing": 0.13, "transport_mobility": 0.28,
    "family_education": 0.06, "food_social": 0.08, "fitness_recreation": 0.06,
    "business_quality": 0.07, "pet_services": 0.03, "late_hour_convenience": 0.07
  }'::jsonb),
  ('pet_owner', 'Pet owner', 'Emphasizes veterinary, pet services and green space.', true, '{
    "daily_essentials": 0.18, "health_wellbeing": 0.12, "transport_mobility": 0.12,
    "family_education": 0.05, "food_social": 0.07, "fitness_recreation": 0.13,
    "business_quality": 0.08, "pet_services": 0.18, "late_hour_convenience": 0.07
  }'::jsonb)
on conflict (slug) do nothing;
