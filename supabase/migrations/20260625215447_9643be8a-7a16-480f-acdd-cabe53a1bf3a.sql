ALTER TABLE public.restaurant_dishes
  ADD COLUMN IF NOT EXISTS screen_score numeric,
  ADD COLUMN IF NOT EXISTS screen_canonical text,
  ADD COLUMN IF NOT EXISTS screen_course text,
  ADD COLUMN IF NOT EXISTS screen_reason text;
CREATE INDEX IF NOT EXISTS idx_restaurant_dishes_status ON public.restaurant_dishes(status);