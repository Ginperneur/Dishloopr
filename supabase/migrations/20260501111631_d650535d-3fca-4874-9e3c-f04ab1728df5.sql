ALTER TABLE public.scrape_queue
  DROP CONSTRAINT IF EXISTS scrape_queue_status_check;

ALTER TABLE public.scrape_queue
  ADD CONSTRAINT scrape_queue_status_check
  CHECK (status IN ('queued','processing','done','failed','canceled'));

DROP INDEX IF EXISTS public.idx_scrape_queue_active_restaurant;
CREATE UNIQUE INDEX idx_scrape_queue_active_restaurant
  ON public.scrape_queue(restaurant_id)
  WHERE status IN ('queued','processing');