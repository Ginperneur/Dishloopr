
-- Add dietary option columns to restaurant_dishes
ALTER TABLE public.restaurant_dishes 
  ADD COLUMN IF NOT EXISTS is_halal BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_vegetarian BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_vegan BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_gluten_free BOOLEAN NOT NULL DEFAULT false;
