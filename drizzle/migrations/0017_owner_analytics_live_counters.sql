CREATE OR REPLACE FUNCTION public.get_owner_funnel_anomalies(p_restaurant_id uuid)
RETURNS TABLE (metric text, current_value numeric, previous_value numeric, delta_pct numeric, severity text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_today date := (now() AT TIME ZONE 'Europe/Amsterdam')::date;
BEGIN
  IF NOT public.owner_analytics_allowed(p_restaurant_id) THEN
    RAISE EXCEPTION 'Not authorized to view these statistics' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  WITH win AS (
    SELECT
      coalesce(sum(s.n) FILTER (WHERE s.metric = 'impressie' AND s.dag > v_today - 7), 0)::numeric AS cur_views,
      coalesce(sum(s.n) FILTER (WHERE s.metric = 'bekeken' AND s.dag > v_today - 7), 0)::numeric AS cur_clicks,
      coalesce(sum(s.n) FILTER (WHERE s.metric IN ('website', 'telefoon', 'route', 'reserveren') AND s.dag > v_today - 7), 0)::numeric AS cur_conv,
      coalesce(sum(s.n) FILTER (WHERE s.metric = 'impressie' AND s.dag <= v_today - 7), 0)::numeric AS prev_views,
      coalesce(sum(s.n) FILTER (WHERE s.metric = 'bekeken' AND s.dag <= v_today - 7), 0)::numeric AS prev_clicks,
      coalesce(sum(s.n) FILTER (WHERE s.metric IN ('website', 'telefoon', 'route', 'reserveren') AND s.dag <= v_today - 7), 0)::numeric AS prev_conv
    FROM public.restaurant_stats_daily s
    WHERE s.restaurant_id = p_restaurant_id AND s.dag > v_today - 14
  ),
  rev AS (
    SELECT
      avg(rating) FILTER (WHERE created_at >= now() - interval '30 days')::numeric AS cur_rating,
      avg(rating) FILTER (WHERE created_at < now() - interval '30 days')::numeric AS prev_rating
    FROM public.reviews
    WHERE restaurant_id = p_restaurant_id AND status = 'published' AND created_at >= now() - interval '60 days'
  ),
  base AS (
    SELECT 'views'::text AS m, cur_views AS cur_v, prev_views AS prev_v FROM win
    UNION ALL SELECT 'clicks', cur_clicks, prev_clicks FROM win
    UNION ALL SELECT 'conversions', cur_conv, prev_conv FROM win
    UNION ALL SELECT 'conversion_rate',
      CASE WHEN cur_views > 0 THEN round(cur_conv / cur_views * 100, 2) ELSE 0 END,
      CASE WHEN prev_views > 0 THEN round(prev_conv / prev_views * 100, 2) ELSE 0 END FROM win
    UNION ALL SELECT 'avg_review_rating', coalesce(round(cur_rating, 2), 0), coalesce(round(prev_rating, 2), 0) FROM rev
  )
  SELECT b.m, b.cur_v, b.prev_v,
    CASE WHEN b.prev_v = 0 AND b.cur_v = 0 THEN 0 WHEN b.prev_v = 0 THEN 100
         ELSE round((b.cur_v - b.prev_v) / b.prev_v * 100, 1) END,
    CASE WHEN b.prev_v = 0 THEN 'none'
         WHEN b.m = 'avg_review_rating' AND b.cur_v - b.prev_v <= -0.5 THEN 'critical'
         WHEN b.m = 'avg_review_rating' AND b.cur_v - b.prev_v <= -0.2 THEN 'warning'
         WHEN b.m <> 'avg_review_rating' AND (b.cur_v - b.prev_v) / b.prev_v <= -0.4 THEN 'critical'
         WHEN b.m <> 'avg_review_rating' AND (b.cur_v - b.prev_v) / b.prev_v <= -0.2 THEN 'warning'
         ELSE 'ok' END
  FROM base b;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_owner_historical_benchmark(p_restaurant_id uuid, p_days integer DEFAULT 90)
RETURNS TABLE (current_views bigint, previous_views bigint, current_clicks bigint, previous_clicks bigint, current_conversions bigint, previous_conversions bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_today date := (now() AT TIME ZONE 'Europe/Amsterdam')::date;
  v_year_ago date := v_today - 365;
BEGIN
  IF NOT public.owner_analytics_allowed(p_restaurant_id) THEN
    RAISE EXCEPTION 'Not authorized to view these statistics' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT
      coalesce(sum(n) FILTER (WHERE metric = 'impressie' AND dag > v_today - p_days), 0)::bigint,
      coalesce(sum(n) FILTER (WHERE metric = 'impressie' AND dag > v_year_ago - p_days AND dag <= v_year_ago), 0)::bigint,
      coalesce(sum(n) FILTER (WHERE metric = 'bekeken' AND dag > v_today - p_days), 0)::bigint,
      coalesce(sum(n) FILTER (WHERE metric = 'bekeken' AND dag > v_year_ago - p_days AND dag <= v_year_ago), 0)::bigint,
      coalesce(sum(n) FILTER (WHERE metric IN ('website', 'telefoon', 'route', 'reserveren') AND dag > v_today - p_days), 0)::bigint,
      coalesce(sum(n) FILTER (WHERE metric IN ('website', 'telefoon', 'route', 'reserveren') AND dag > v_year_ago - p_days AND dag <= v_year_ago), 0)::bigint
    FROM public.restaurant_stats_daily
    WHERE restaurant_id = p_restaurant_id AND dag > v_year_ago - p_days;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_owner_attribution(p_restaurant_id uuid, p_days integer DEFAULT 30)
RETURNS TABLE (channel text, views bigint, clicks bigint, conversions bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.owner_analytics_allowed(p_restaurant_id) THEN
    RAISE EXCEPTION 'Not authorized to view these statistics' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT CASE s.context WHEN 'zoek' THEN 'Zoeken' WHEN 'stad' THEN 'Stadspagina' WHEN 'collectie' THEN 'Collecties'
                ELSE 'Gerechtpagina of zoekterm' END AS ch,
           coalesce(sum(s.n) FILTER (WHERE s.metric = 'impressie'), 0)::bigint,
           coalesce(sum(s.n) FILTER (WHERE s.metric = 'bekeken'), 0)::bigint,
           coalesce(sum(s.n) FILTER (WHERE s.metric IN ('website', 'telefoon', 'route', 'reserveren')), 0)::bigint
      FROM public.restaurant_stats_daily s
     WHERE s.restaurant_id = p_restaurant_id
       AND s.dag > (now() AT TIME ZONE 'Europe/Amsterdam')::date - p_days
     GROUP BY 1
     ORDER BY 4 DESC, 2 DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.restaurant_menu_terms(p_restaurant_id uuid)
RETURNS TABLE (term text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT DISTINCT t FROM public.restaurant_dishes rd JOIN public.dishes d ON d.id = rd.dish_id,
    LATERAL (VALUES (lower(d.name)), (replace(lower(coalesce(d.canonical_slug, d.slug)), '-', ' '))) v(t)
   WHERE rd.restaurant_id = p_restaurant_id AND rd.status IN ('approved_by_admin', 'verified_by_owner');
$$;
REVOKE ALL ON FUNCTION public.restaurant_menu_terms(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.owner_search_hours(p_restaurant_id uuid, p_days integer DEFAULT 60)
RETURNS TABLE (weekday integer, hour integer, searches bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.owner_analytics_allowed(p_restaurant_id) THEN
    RAISE EXCEPTION 'Not authorized to view these statistics' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT extract(isodow FROM s.created_at AT TIME ZONE 'Europe/Amsterdam')::int,
           extract(hour FROM s.created_at AT TIME ZONE 'Europe/Amsterdam')::int,
           count(*)::bigint
      FROM public.search_logs s
      JOIN public.restaurants r ON r.id = p_restaurant_id
      JOIN public.cities c ON c.id = r.city_id
     WHERE lower(s.city) = lower(c.name)
       AND s.created_at > now() - make_interval(days => p_days)
       AND (s.clicked_restaurant_id = p_restaurant_id
            OR s.query_norm IN (SELECT term FROM public.restaurant_menu_terms(p_restaurant_id)))
     GROUP BY 1, 2;
END;
$$;

CREATE OR REPLACE FUNCTION public.owner_lost_to_competitor(p_restaurant_id uuid, p_days integer DEFAULT 60)
RETURNS TABLE (target_restaurant_id uuid, name text, rating numeric, clicks bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.owner_analytics_allowed(p_restaurant_id) THEN
    RAISE EXCEPTION 'Not authorized to view these statistics' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT t.id, t.name, t.rating::numeric, count(*)::bigint
      FROM public.search_logs s
      JOIN public.restaurants home ON home.id = p_restaurant_id
      JOIN public.cities c ON c.id = home.city_id
      JOIN public.restaurants t ON t.id = s.clicked_restaurant_id AND t.is_active
     WHERE lower(s.city) = lower(c.name)
       AND s.created_at > now() - make_interval(days => p_days)
       AND s.clicked_restaurant_id <> p_restaurant_id
       AND s.query_norm IN (SELECT term FROM public.restaurant_menu_terms(p_restaurant_id))
     GROUP BY t.id, t.name, t.rating
     ORDER BY 4 DESC
     LIMIT 10;
END;
$$;

REVOKE ALL ON FUNCTION public.owner_search_hours(uuid, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.owner_lost_to_competitor(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owner_search_hours(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.owner_lost_to_competitor(uuid, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.owner_stats_between(p_restaurant_id uuid, p_from date, p_to date)
RETURNS TABLE (impressions bigint, views bigint, conversions bigint)
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
     WHERE s.restaurant_id = p_restaurant_id AND s.dag BETWEEN p_from AND p_to;
END;
$$;
REVOKE ALL ON FUNCTION public.owner_stats_between(uuid, date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owner_stats_between(uuid, date, date) TO authenticated;

CREATE OR REPLACE FUNCTION public.owner_daily_metrics(p_restaurant_id uuid, p_days integer DEFAULT 30)
RETURNS TABLE (dag date, metric text, n bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.owner_analytics_allowed(p_restaurant_id) THEN
    RAISE EXCEPTION 'Not authorized to view these statistics' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT s.dag, s.metric, sum(s.n)::bigint
      FROM public.restaurant_stats_daily s
     WHERE s.restaurant_id = p_restaurant_id
       AND s.dag > (now() AT TIME ZONE 'Europe/Amsterdam')::date - p_days
     GROUP BY s.dag, s.metric;
END;
$$;
REVOKE ALL ON FUNCTION public.owner_daily_metrics(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owner_daily_metrics(uuid, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.owner_dish_daily(p_restaurant_id uuid, p_days integer DEFAULT 60)
RETURNS TABLE (dish_id uuid, dag date, impressions bigint, views bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.owner_analytics_allowed(p_restaurant_id) THEN
    RAISE EXCEPTION 'Not authorized to view these statistics' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    WITH menu AS (
      SELECT DISTINCT d.id, d.slug, d.canonical_slug, d.name
        FROM public.restaurant_dishes rd JOIN public.dishes d ON d.id = rd.dish_id
       WHERE rd.restaurant_id = p_restaurant_id AND rd.status IN ('approved_by_admin', 'verified_by_owner')
    ), ctx AS (
      SELECT m.id, lp.slug AS context FROM menu m JOIN public.seo_landing_pages lp ON lp.dish_id = m.id
      UNION SELECT m.id, lower(coalesce(m.canonical_slug, m.slug)) FROM menu m
      UNION SELECT m.id, trim(both '-' FROM regexp_replace(lower(m.name), '[^a-z0-9]+', '-', 'g')) FROM menu m
    )
    SELECT c.id, s.dag,
           coalesce(sum(s.n) FILTER (WHERE s.metric = 'impressie'), 0)::bigint,
           coalesce(sum(s.n) FILTER (WHERE s.metric = 'bekeken'), 0)::bigint
      FROM public.restaurant_stats_daily s
      JOIN ctx c ON c.context = s.context
     WHERE s.restaurant_id = p_restaurant_id
       AND s.dag > (now() AT TIME ZONE 'Europe/Amsterdam')::date - p_days
     GROUP BY c.id, s.dag;
END;
$$;
REVOKE ALL ON FUNCTION public.owner_dish_daily(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owner_dish_daily(uuid, integer) TO authenticated;