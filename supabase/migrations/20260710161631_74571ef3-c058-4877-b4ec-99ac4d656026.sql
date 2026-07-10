ALTER TABLE public.restaurant_dishes
  ADD COLUMN IF NOT EXISTS dietary_tags text[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS restaurant_dishes_dietary_tags_gin
  ON public.restaurant_dishes USING GIN (dietary_tags);