
CREATE TABLE public.owner_weekly_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  summary TEXT,
  model TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (restaurant_id, week_start)
);

CREATE INDEX idx_owr_restaurant_week ON public.owner_weekly_recommendations(restaurant_id, week_start DESC);

GRANT SELECT ON public.owner_weekly_recommendations TO authenticated;
GRANT ALL ON public.owner_weekly_recommendations TO service_role;

ALTER TABLE public.owner_weekly_recommendations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view their restaurant recommendations"
ON public.owner_weekly_recommendations
FOR SELECT
TO authenticated
USING (public.has_restaurant_access(auth.uid(), restaurant_id, 'viewer'::manager_role));

-- =========================================================
-- Cohort analyse: per week aantal unieke sessies en hoeveel
-- daarvan al eerder (in de voorgaande periode) bezocht hebben.
-- =========================================================
CREATE OR REPLACE FUNCTION public.get_guest_cohorts(
  p_restaurant_id uuid,
  p_weeks integer DEFAULT 8
)
RETURNS TABLE (week_start date, new_visitors bigint, returning_visitors bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH sessions_per_week AS (
    SELECT
      date_trunc('week', created_at)::date AS week_start,
      session_id,
      MIN(created_at) AS first_seen_in_week
    FROM public.analytics_events
    WHERE restaurant_id = p_restaurant_id
      AND session_id IS NOT NULL
      AND created_at >= (now() - (p_weeks || ' weeks')::interval)
    GROUP BY 1, 2
  ),
  first_ever AS (
    SELECT session_id, MIN(created_at) AS first_ever_seen
    FROM public.analytics_events
    WHERE restaurant_id = p_restaurant_id
      AND session_id IS NOT NULL
    GROUP BY session_id
  )
  SELECT
    spw.week_start,
    COUNT(*) FILTER (WHERE fe.first_ever_seen >= spw.week_start)::bigint AS new_visitors,
    COUNT(*) FILTER (WHERE fe.first_ever_seen < spw.week_start)::bigint AS returning_visitors
  FROM sessions_per_week spw
  LEFT JOIN first_ever fe ON fe.session_id = spw.session_id
  GROUP BY spw.week_start
  ORDER BY spw.week_start;
$$;

-- =========================================================
-- Attributie per kanaal (utm_source uit metadata)
-- =========================================================
CREATE OR REPLACE FUNCTION public.get_owner_attribution(
  p_restaurant_id uuid,
  p_days integer DEFAULT 30
)
RETURNS TABLE (
  channel text,
  views bigint,
  clicks bigint,
  conversions bigint
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    COALESCE(
      NULLIF(LOWER(TRIM(metadata->>'utm_source')), ''),
      NULLIF(LOWER(TRIM(metadata->>'source')), ''),
      'direct'
    ) AS channel,
    COUNT(*) FILTER (WHERE event_type IN ('view', 'restaurant_view')) AS views,
    COUNT(*) FILTER (WHERE event_type IN ('click', 'restaurant_click')) AS clicks,
    COUNT(*) FILTER (WHERE event_type IN ('website_click','phone_click','reservation_click','map_click')) AS conversions
  FROM public.analytics_events
  WHERE restaurant_id = p_restaurant_id
    AND created_at >= now() - (p_days || ' days')::interval
  GROUP BY 1
  HAVING COUNT(*) > 0
  ORDER BY (
    COUNT(*) FILTER (WHERE event_type IN ('website_click','phone_click','reservation_click','map_click'))
  ) DESC, 2 DESC;
$$;

-- =========================================================
-- Benchmark: dit kwartaal vs vorig jaar zelfde kwartaal.
-- =========================================================
CREATE OR REPLACE FUNCTION public.get_owner_historical_benchmark(
  p_restaurant_id uuid,
  p_days integer DEFAULT 90
)
RETURNS TABLE (
  current_views bigint,
  previous_views bigint,
  current_clicks bigint,
  previous_clicks bigint,
  current_conversions bigint,
  previous_conversions bigint
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH cur AS (
    SELECT
      COUNT(*) FILTER (WHERE event_type IN ('view','restaurant_view')) AS v,
      COUNT(*) FILTER (WHERE event_type IN ('click','restaurant_click')) AS c,
      COUNT(*) FILTER (WHERE event_type IN ('website_click','phone_click','reservation_click','map_click')) AS conv
    FROM public.analytics_events
    WHERE restaurant_id = p_restaurant_id
      AND created_at >= now() - (p_days || ' days')::interval
  ),
  prev AS (
    SELECT
      COUNT(*) FILTER (WHERE event_type IN ('view','restaurant_view')) AS v,
      COUNT(*) FILTER (WHERE event_type IN ('click','restaurant_click')) AS c,
      COUNT(*) FILTER (WHERE event_type IN ('website_click','phone_click','reservation_click','map_click')) AS conv
    FROM public.analytics_events
    WHERE restaurant_id = p_restaurant_id
      AND created_at >= (now() - '1 year'::interval) - (p_days || ' days')::interval
      AND created_at <  (now() - '1 year'::interval)
  )
  SELECT cur.v, prev.v, cur.c, prev.c, cur.conv, prev.conv FROM cur, prev;
$$;
