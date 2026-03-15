-- Track every menu scrape attempt so admin filters can reliably identify restaurants
-- that were never scraped (including failed/empty attempts).
CREATE TABLE IF NOT EXISTS public.menu_scrape_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'firecrawl_ai',
  scraped_url TEXT,
  dishes_extracted INTEGER NOT NULL DEFAULT 0,
  dishes_added INTEGER NOT NULL DEFAULT 0,
  dishes_existing INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_menu_scrape_runs_restaurant_id
  ON public.menu_scrape_runs(restaurant_id);

CREATE INDEX IF NOT EXISTS idx_menu_scrape_runs_completed_at
  ON public.menu_scrape_runs(completed_at DESC);

ALTER TABLE public.menu_scrape_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view menu scrape runs" ON public.menu_scrape_runs;
CREATE POLICY "Admins can view menu scrape runs"
  ON public.menu_scrape_runs
  FOR SELECT
  TO public
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));