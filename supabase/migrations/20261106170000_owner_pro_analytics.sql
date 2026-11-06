-- Owner Pro analytics on the live counters.
--
-- get_owner_funnel and get_search_term_heatmap read analytics_events, which the
-- site no longer writes (counters go through track_restaurant_metrics into
-- restaurant_stats_daily), so Pro owners saw empty numbers. They also had no
-- access check. Both now read restaurant_stats_daily and require a verified
-- owner, an admin or the service role. New for Pro: position per dish×city page
-- over time, missed demand, price per dish versus the city, and a funnel per
-- search term.

CREATE OR REPLACE FUNCTION public.owner_analytics_allowed(p_restaurant_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(auth.role(), '') = 'service_role'
      OR (auth.uid() IS NOT NULL AND (public.has_role(auth.uid(), 'admin') OR public.is_verified_owner(auth.uid(), p_restaurant_id)));
$$;

-- impressie = shown in a list, bekeken = profile opened, conversions = website, phone, route or reservation.
CREATE OR REPLACE FUNCTION public.get_owner_funnel(p_restaurant_id uuid, p_days integer DEFAULT 30)
RETURNS TABLE (views bigint, clicks bigint, conversions bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.owner_analytics_allowed(p_restaurant_id) THEN
    RAISE EXCEPTION 'Not authorized to view these statistics' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT coalesce(sum(s.n) FILTER (WHERE s.metric = 'impressie'), 0)::bigint,
           coalesce(sum(s.n) FILTER (WHERE s.metric = 'bekeken'), 0)::bigint,
           coalesce(sum(s.n) FILTER (WHERE s.metric IN ('website', 'telefoon', 'route', 'reserveren')), 0)::bigint
      FROM public.restaurant_stats_daily s
     WHERE s.restaurant_id = p_restaurant_id
       AND s.dag > (now() AT TIME ZONE 'Europe/Amsterdam')::date - p_days;
END;
$$;

-- The metric context is the dish×city page slug or the normalised search term.
CREATE OR REPLACE FUNCTION public.get_search_term_heatmap(p_restaurant_id uuid, p_days integer DEFAULT 30, p_limit integer DEFAULT 15)
RETURNS TABLE (search_term text, hits bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.owner_analytics_allowed(p_restaurant_id) THEN
    RAISE EXCEPTION 'Not authorized to view these statistics' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT replace(s.context, '-', ' '), sum(s.n)::bigint
      FROM public.restaurant_stats_daily s
     WHERE s.restaurant_id = p_restaurant_id
       AND s.metric = 'impressie'
       AND s.context NOT IN ('zoek', 'stad', 'collectie', '')
       AND s.dag > (now() AT TIME ZONE 'Europe/Amsterdam')::date - p_days
     GROUP BY s.context
     ORDER BY 2 DESC
     LIMIT p_limit;
END;
$$;

-- Funnel per search term: which terms end in a reservation, website or phone click.
CREATE OR REPLACE FUNCTION public.owner_term_funnel(p_restaurant_id uuid, p_days integer DEFAULT 30)
RETURNS TABLE (term text, impressions bigint, views bigint, conversions bigint, reservations bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.owner_analytics_allowed(p_restaurant_id) THEN
    RAISE EXCEPTION 'Not authorized to view these statistics' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT replace(s.context, '-', ' '),
           coalesce(sum(s.n) FILTER (WHERE s.metric = 'impressie'), 0)::bigint,
           coalesce(sum(s.n) FILTER (WHERE s.metric = 'bekeken'), 0)::bigint,
           coalesce(sum(s.n) FILTER (WHERE s.metric IN ('website', 'telefoon', 'route', 'reserveren')), 0)::bigint,
           coalesce(sum(s.n) FILTER (WHERE s.metric = 'reserveren'), 0)::bigint
      FROM public.restaurant_stats_daily s
     WHERE s.restaurant_id = p_restaurant_id
       AND s.context NOT IN ('zoek', 'stad', 'collectie', '')
       AND s.dag > (now() AT TIME ZONE 'Europe/Amsterdam')::date - p_days
     GROUP BY s.context
     ORDER BY 4 DESC, 2 DESC
     LIMIT 20;
END;
$$;

-- Daily snapshot of restaurant_positions() for claimed restaurants, so owners see
-- their position per dish×city page over time. Uses the same function as the
-- invite page, so the order matches compareLandingOrder.
CREATE TABLE IF NOT EXISTS public.restaurant_position_history (
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  page_slug text NOT NULL,
  dag date NOT NULL,
  position integer NOT NULL,
  total integer NOT NULL,
  PRIMARY KEY (restaurant_id, page_slug, dag)
);
ALTER TABLE public.restaurant_position_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.restaurant_position_history FROM anon, authenticated;
GRANT ALL ON public.restaurant_position_history TO service_role;

CREATE OR REPLACE FUNCTION public.snapshot_restaurant_positions()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count integer;
BEGIN
  INSERT INTO public.restaurant_position_history AS h (restaurant_id, page_slug, dag, position, total)
  SELECT r.id, p.page_slug, (now() AT TIME ZONE 'Europe/Amsterdam')::date, p.position, p.total
    FROM public.restaurants r
   CROSS JOIN LATERAL public.restaurant_positions(r.slug) p
   WHERE r.is_active AND r.claimed_by_owner_id IS NOT NULL
  ON CONFLICT (restaurant_id, page_slug, dag) DO UPDATE SET position = EXCLUDED.position, total = EXCLUDED.total;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
REVOKE ALL ON FUNCTION public.snapshot_restaurant_positions() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.owner_position_history(p_restaurant_id uuid, p_days integer DEFAULT 90)
RETURNS TABLE (page_slug text, dag date, position integer, total integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.owner_analytics_allowed(p_restaurant_id) THEN
    RAISE EXCEPTION 'Not authorized to view these statistics' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT h.page_slug, h.dag, h.position, h.total
      FROM public.restaurant_position_history h
     WHERE h.restaurant_id = p_restaurant_id
       AND h.dag > (now() AT TIME ZONE 'Europe/Amsterdam')::date - p_days
     ORDER BY h.page_slug, h.dag;
END;
$$;

CREATE EXTENSION IF NOT EXISTS pg_cron;
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'snapshot-restaurant-positions';
SELECT cron.schedule('snapshot-restaurant-positions', '30 2 * * *', $cron$ SELECT public.snapshot_restaurant_positions(); $cron$);

-- Missed demand: dishes people searched for in the restaurant's city that are not on its menu.
CREATE OR REPLACE FUNCTION public.owner_missed_demand(p_restaurant_id uuid, p_days integer DEFAULT 30, p_limit integer DEFAULT 10)
RETURNS TABLE (query text, searches bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.owner_analytics_allowed(p_restaurant_id) THEN
    RAISE EXCEPTION 'Not authorized to view these statistics' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    WITH city AS (
      SELECT lower(c.name) AS name FROM public.restaurants r JOIN public.cities c ON c.id = r.city_id WHERE r.id = p_restaurant_id
    ), menu AS (
      SELECT lower(d.name) AS name, replace(lower(coalesce(d.canonical_slug, d.slug)), '-', ' ') AS canon
        FROM public.restaurant_dishes rd JOIN public.dishes d ON d.id = rd.dish_id
       WHERE rd.restaurant_id = p_restaurant_id AND rd.status IN ('approved_by_admin', 'verified_by_owner')
    )
    SELECT s.query_norm, count(*)::bigint
      FROM public.search_logs s, city
     WHERE lower(s.city) = city.name
       AND s.created_at > now() - make_interval(days => p_days)
       AND length(s.query_norm) >= 3
       AND EXISTS (SELECT 1 FROM public.dishes d
                    WHERE lower(d.name) = s.query_norm
                       OR replace(lower(coalesce(d.canonical_slug, d.slug)), '-', ' ') = s.query_norm)
       AND NOT EXISTS (SELECT 1 FROM menu m WHERE m.name = s.query_norm OR m.canon = s.query_norm)
     GROUP BY s.query_norm
    HAVING count(*) >= 3
     ORDER BY 2 DESC
     LIMIT p_limit;
END;
$$;

-- Price per dish versus the same dish at other restaurants in the city (at least 3).
CREATE OR REPLACE FUNCTION public.owner_price_benchmark(p_restaurant_id uuid)
RETURNS TABLE (dish text, my_price numeric, city_avg numeric, restaurants bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.owner_analytics_allowed(p_restaurant_id) THEN
    RAISE EXCEPTION 'Not authorized to view these statistics' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    WITH home AS (SELECT city_id FROM public.restaurants WHERE id = p_restaurant_id),
    mine AS (
      SELECT DISTINCT ON (coalesce(d.canonical_slug, d.slug)) d.name, coalesce(d.canonical_slug, d.slug) AS canon, rd.price
        FROM public.restaurant_dishes rd JOIN public.dishes d ON d.id = rd.dish_id
       WHERE rd.restaurant_id = p_restaurant_id AND rd.price > 0
         AND rd.status IN ('approved_by_admin', 'verified_by_owner')
       ORDER BY coalesce(d.canonical_slug, d.slug), rd.price
    )
    SELECT m.name, m.price, round(avg(o.price), 2), count(DISTINCT o.restaurant_id)
      FROM mine m
      JOIN public.dishes d2 ON coalesce(d2.canonical_slug, d2.slug) = m.canon
      JOIN public.restaurant_dishes o ON o.dish_id = d2.id AND o.restaurant_id <> p_restaurant_id AND o.price > 0
           AND o.status IN ('approved_by_admin', 'verified_by_owner')
      JOIN public.restaurants r ON r.id = o.restaurant_id AND r.is_active AND r.city_id = (SELECT city_id FROM home)
     GROUP BY m.name, m.price
    HAVING count(DISTINCT o.restaurant_id) >= 3
     ORDER BY abs(m.price - avg(o.price)) DESC
     LIMIT 15;
END;
$$;

REVOKE ALL ON FUNCTION public.owner_term_funnel(uuid, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.owner_position_history(uuid, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.owner_missed_demand(uuid, integer, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.owner_price_benchmark(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owner_term_funnel(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.owner_position_history(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.owner_missed_demand(uuid, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.owner_price_benchmark(uuid) TO authenticated;
