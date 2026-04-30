
CREATE TABLE public.scrape_queue (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  restaurant_name text NOT NULL,
  website_url text NOT NULL,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','processing','done','failed')),
  attempts integer NOT NULL DEFAULT 0,
  error text,
  added_dishes integer,
  source text DEFAULT 'menu_scraper',
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_scrape_queue_status ON public.scrape_queue(status, created_at);
CREATE UNIQUE INDEX idx_scrape_queue_active_restaurant
  ON public.scrape_queue(restaurant_id)
  WHERE status IN ('queued','processing');

ALTER TABLE public.scrape_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view scrape queue"
  ON public.scrape_queue FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert into scrape queue"
  ON public.scrape_queue FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update scrape queue"
  ON public.scrape_queue FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete from scrape queue"
  ON public.scrape_queue FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_scrape_queue_updated_at
  BEFORE UPDATE ON public.scrape_queue
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
