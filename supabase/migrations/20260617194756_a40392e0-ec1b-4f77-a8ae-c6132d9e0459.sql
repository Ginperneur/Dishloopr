ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS google_enriched_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_restaurants_google_enriched_at ON public.restaurants(google_enriched_at);