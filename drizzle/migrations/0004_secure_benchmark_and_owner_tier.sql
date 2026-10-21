CREATE OR REPLACE FUNCTION public.get_owner_historical_benchmark(p_restaurant_id uuid, p_days integer DEFAULT 90)
 RETURNS TABLE(current_views bigint, previous_views bigint, current_clicks bigint, previous_clicks bigint, current_conversions bigint, previous_conversions bigint)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin'::app_role)
          OR public.has_restaurant_access(auth.uid(), p_restaurant_id, 'viewer'::manager_role)) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
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
END;
$function$;

CREATE OR REPLACE FUNCTION public.protect_restaurant_owner_tier()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.owner_tier IS DISTINCT FROM OLD.owner_tier
     AND current_setting('request.jwt.claim.role', true) IN ('authenticated','anon')
     AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    NEW.owner_tier := OLD.owner_tier;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_restaurant_owner_tier ON public.restaurants;
CREATE TRIGGER protect_restaurant_owner_tier BEFORE UPDATE ON public.restaurants
FOR EACH ROW EXECUTE FUNCTION public.protect_restaurant_owner_tier();