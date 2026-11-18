-- Scrape queue for the Overture server pipeline (overture-bulk, action tick), as one indexed query.
-- A hidden bulk restaurant is due when it has a website and no scrape run yet; a "bulk_started"
-- claim older than 15 minutes without any other run counts as abandoned (the tick that claimed
-- it was cut off), so the restaurant comes back. Service role only. Idempotent.
CREATE INDEX IF NOT EXISTS idx_menu_scrape_runs_restaurant_status
  ON public.menu_scrape_runs (restaurant_id, status, created_at);

CREATE OR REPLACE FUNCTION public.overture_scrape_queue(p_limit integer DEFAULT 6)
RETURNS TABLE (id uuid, name text, website_url text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT r.id, r.name, r.website_url
  FROM public.restaurants_verborgen v
  JOIN public.restaurants r ON r.id = v.id
  WHERE v.reden = 'menu: Overture-import, wacht op 5 gerechten'
    AND r.website_url IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.menu_scrape_runs m
      WHERE m.restaurant_id = r.id
        AND (m.status <> 'bulk_started' OR m.created_at > now() - interval '15 minutes')
    )
  ORDER BY v.hidden_at NULLS LAST, r.id
  LIMIT greatest(1, least(coalesce(p_limit, 6), 50));
$$;
REVOKE ALL ON FUNCTION public.overture_scrape_queue(integer) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.overture_scrape_queue(integer) TO service_role;
