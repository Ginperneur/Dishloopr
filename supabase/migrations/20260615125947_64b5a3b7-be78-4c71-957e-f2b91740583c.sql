ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS website_status text,
  ADD COLUMN IF NOT EXISTS website_status_code integer,
  ADD COLUMN IF NOT EXISTS website_checked_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_restaurants_website_status
  ON public.restaurants (website_status)
  WHERE website_url IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_restaurants_website_checked_at
  ON public.restaurants (website_checked_at NULLS FIRST)
  WHERE website_url IS NOT NULL;