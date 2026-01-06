-- Add meal_types and experiences columns to restaurants table
ALTER TABLE public.restaurants 
ADD COLUMN IF NOT EXISTS meal_types text[] DEFAULT '{}'::text[],
ADD COLUMN IF NOT EXISTS experiences text[] DEFAULT '{}'::text[];

-- Add comment for documentation
COMMENT ON COLUMN public.restaurants.meal_types IS 'Types of meals served: breakfast, brunch, lunch, dinner';
COMMENT ON COLUMN public.restaurants.experiences IS 'Experience tags: quick-bite, comfort-food, culinary-experience, late-night, celebration';