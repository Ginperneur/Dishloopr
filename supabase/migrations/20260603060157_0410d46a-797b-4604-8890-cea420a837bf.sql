CREATE OR REPLACE FUNCTION public.get_owner_funnel_anomalies(p_restaurant_id uuid)
RETURNS TABLE (
  metric text,
  current_value numeric,
  previous_value numeric,
  delta_pct numeric,
  severity text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH cur AS (
    SELECT
      COUNT(*) FILTER (WHERE event_type IN ('view','restaurant_view'))::numeric AS views,
      COUNT(*) FILTER (WHERE event_type IN ('click','restaurant_click'))::numeric AS clicks,
      COUNT(*) FILTER (WHERE event_type IN ('website_click','phone_click','reservation_click','map_click'))::numeric AS conv
    FROM public.analytics_events
    WHERE restaurant_id = p_restaurant_id
      AND created_at >= now() - interval '7 days'
  ),
  prev AS (
    SELECT
      COUNT(*) FILTER (WHERE event_type IN ('view','restaurant_view'))::numeric AS views,
      COUNT(*) FILTER (WHERE event_type IN ('click','restaurant_click'))::numeric AS clicks,
      COUNT(*) FILTER (WHERE event_type IN ('website_click','phone_click','reservation_click','map_click'))::numeric AS conv
    FROM public.analytics_events
    WHERE restaurant_id = p_restaurant_id
      AND created_at >= now() - interval '14 days'
      AND created_at <  now() - interval '7 days'
  ),
  cur_reviews AS (
    SELECT AVG(rating)::numeric AS avg_rating, COUNT(*)::numeric AS cnt
    FROM public.reviews
    WHERE restaurant_id = p_restaurant_id
      AND status = 'published'
      AND created_at >= now() - interval '30 days'
  ),
  prev_reviews AS (
    SELECT AVG(rating)::numeric AS avg_rating, COUNT(*)::numeric AS cnt
    FROM public.reviews
    WHERE restaurant_id = p_restaurant_id
      AND status = 'published'
      AND created_at >= now() - interval '60 days'
      AND created_at <  now() - interval '30 days'
  ),
  base AS (
    SELECT 'views'::text  AS metric, cur.views AS cur_v, prev.views AS prev_v FROM cur, prev
    UNION ALL SELECT 'clicks', cur.clicks, prev.clicks FROM cur, prev
    UNION ALL SELECT 'conversions', cur.conv, prev.conv FROM cur, prev
    UNION ALL SELECT 'conversion_rate',
      CASE WHEN cur.views  > 0 THEN ROUND((cur.conv  / cur.views ) * 100, 2) ELSE 0 END,
      CASE WHEN prev.views > 0 THEN ROUND((prev.conv / prev.views) * 100, 2) ELSE 0 END
      FROM cur, prev
    UNION ALL SELECT 'avg_review_rating',
      COALESCE(ROUND(cur_reviews.avg_rating, 2), 0),
      COALESCE(ROUND(prev_reviews.avg_rating, 2), 0)
      FROM cur_reviews, prev_reviews
  )
  SELECT
    metric,
    cur_v AS current_value,
    prev_v AS previous_value,
    CASE
      WHEN prev_v = 0 AND cur_v = 0 THEN 0
      WHEN prev_v = 0 THEN 100
      ELSE ROUND(((cur_v - prev_v) / prev_v) * 100, 1)
    END AS delta_pct,
    CASE
      WHEN prev_v = 0 THEN 'none'
      WHEN metric = 'avg_review_rating' AND (cur_v - prev_v) <= -0.5 THEN 'critical'
      WHEN metric = 'avg_review_rating' AND (cur_v - prev_v) <= -0.2 THEN 'warning'
      WHEN ((cur_v - prev_v) / prev_v) <= -0.4 THEN 'critical'
      WHEN ((cur_v - prev_v) / prev_v) <= -0.2 THEN 'warning'
      ELSE 'ok'
    END AS severity
  FROM base;
$$;

GRANT EXECUTE ON FUNCTION public.get_owner_funnel_anomalies(uuid) TO authenticated, service_role;