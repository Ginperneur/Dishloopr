
ALTER TABLE public.dishes
  ADD COLUMN IF NOT EXISTS is_halal boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_vegetarian boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_vegan boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_gluten_free boolean NOT NULL DEFAULT false;
