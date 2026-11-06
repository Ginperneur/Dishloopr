ALTER TABLE public.restaurant_events
  ADD COLUMN IF NOT EXISTS recurrence text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS weekdays smallint[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS start_time time,
  ADD COLUMN IF NOT EXISTS end_time time,
  ADD COLUMN IF NOT EXISTS offer text,
  ADD COLUMN IF NOT EXISTS promotion_status text NOT NULL DEFAULT 'unpaid',
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text,
  ADD COLUMN IF NOT EXISTS paid_until timestamptz,
  ADD COLUMN IF NOT EXISTS released_by uuid,
  ADD COLUMN IF NOT EXISTS released_at timestamptz;

ALTER TABLE public.restaurant_events
  ADD CONSTRAINT restaurant_events_recurrence_check CHECK (recurrence IN ('none', 'weekly')),
  ADD CONSTRAINT restaurant_events_weekdays_check CHECK (weekdays <@ ARRAY[1,2,3,4,5,6,7]::smallint[]),
  ADD CONSTRAINT restaurant_events_promotion_status_check CHECK (promotion_status IN ('unpaid', 'paid', 'comped', 'lapsed'));

CREATE UNIQUE INDEX IF NOT EXISTS restaurant_events_stripe_subscription_key
  ON public.restaurant_events (stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_restaurant_events_restaurant ON public.restaurant_events (restaurant_id);
CREATE INDEX IF NOT EXISTS idx_restaurant_events_status ON public.restaurant_events (promotion_status) WHERE is_active;

UPDATE public.restaurant_events
   SET promotion_status = 'comped', released_at = now()
 WHERE is_active AND coalesce(end_date, event_date) >= now() AND promotion_status = 'unpaid';

CREATE OR REPLACE FUNCTION public.restaurant_event_visible(
  p_is_active boolean, p_status text, p_recurrence text, p_event_date timestamptz, p_end_date timestamptz
) RETURNS boolean LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT coalesce(p_is_active, false)
    AND p_status IN ('paid', 'comped')
    AND coalesce(p_end_date, CASE WHEN p_recurrence = 'weekly' THEN 'infinity'::timestamptz ELSE p_event_date END) >= now();
$$;

DROP POLICY IF EXISTS "Anyone can view active events" ON public.restaurant_events;
DROP POLICY IF EXISTS "Owners can manage their events" ON public.restaurant_events;

CREATE POLICY "Anyone can view released events"
  ON public.restaurant_events FOR SELECT
  USING (
    public.restaurant_event_visible(is_active, promotion_status, recurrence, event_date, end_date)
    AND EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = restaurant_id AND r.is_active)
  );

CREATE POLICY "Owners view their events"
  ON public.restaurant_events FOR SELECT
  USING (
    auth.uid() IS NOT NULL AND (
      public.is_verified_owner(auth.uid(), restaurant_id)
      OR EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = restaurant_id AND r.claimed_by_owner_id = auth.uid())
    )
  );

CREATE OR REPLACE FUNCTION public.save_restaurant_event(
  p_event_id uuid, p_restaurant_id uuid, p_title text, p_description text, p_event_type text,
  p_recurrence text, p_weekdays smallint[], p_date date, p_until date, p_start_time time,
  p_end_time time, p_price numeric, p_offer text, p_image_url text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_tz constant text := 'Europe/Amsterdam';
  v_start timestamptz;
  v_end timestamptz;
  v_id uuid;
  v_weekdays smallint[];
BEGIN
  IF auth.uid() IS NULL OR NOT (public.has_role(auth.uid(), 'admin') OR public.is_verified_owner(auth.uid(), p_restaurant_id)) THEN
    RAISE EXCEPTION 'Not authorized to edit events for this restaurant' USING ERRCODE = '42501';
  END IF;
  IF nullif(trim(p_title), '') IS NULL OR length(trim(p_title)) > 80 THEN
    RAISE EXCEPTION 'Title is required and at most 80 characters' USING ERRCODE = '22023';
  END IF;
  IF length(coalesce(p_description, '')) > 600 OR length(coalesce(p_offer, '')) > 120 THEN
    RAISE EXCEPTION 'Event text exceeds maximum length' USING ERRCODE = '22023';
  END IF;
  IF p_event_type NOT IN ('ladies_night', 'all_you_can_eat', 'happy_hour', 'pubquiz', 'live_music', 'tasting',
                          'special_menu', 'chefs_table', 'workshop', 'discount', 'other') THEN
    RAISE EXCEPTION 'Unknown event type' USING ERRCODE = '22023';
  END IF;
  IF p_price IS NOT NULL AND (p_price < 0 OR p_price > 10000) THEN
    RAISE EXCEPTION 'Price out of range' USING ERRCODE = '22023';
  END IF;
  IF nullif(trim(p_image_url), '') IS NOT NULL
     AND trim(p_image_url) !~ ('^https://[a-z0-9]+\.supabase\.co/storage/v1/object/public/restaurant-images/' || p_restaurant_id::text || '/') THEN
    RAISE EXCEPTION 'Image must be uploaded through Dishloopr' USING ERRCODE = '22023';
  END IF;

  IF p_recurrence = 'weekly' THEN
    SELECT coalesce(array_agg(DISTINCT d ORDER BY d), '{}') INTO v_weekdays FROM unnest(p_weekdays) d;
    IF cardinality(v_weekdays) = 0 OR NOT (v_weekdays <@ ARRAY[1,2,3,4,5,6,7]::smallint[]) THEN
      RAISE EXCEPTION 'Choose at least one weekday' USING ERRCODE = '22023';
    END IF;
    v_start := (coalesce(p_date, (now() AT TIME ZONE v_tz)::date)::timestamp) AT TIME ZONE v_tz;
    v_end := CASE WHEN p_until IS NULL THEN NULL ELSE (p_until + time '23:59') AT TIME ZONE v_tz END;
    IF v_end IS NOT NULL AND v_end < v_start THEN
      RAISE EXCEPTION 'End date is before start date' USING ERRCODE = '22023';
    END IF;
  ELSIF p_recurrence = 'none' THEN
    IF p_date IS NULL THEN
      RAISE EXCEPTION 'Date is required' USING ERRCODE = '22023';
    END IF;
    v_weekdays := '{}';
    v_start := (p_date + coalesce(p_start_time, time '00:00')) AT TIME ZONE v_tz;
    v_end := (p_date + coalesce(p_end_time, time '23:59')) AT TIME ZONE v_tz;
    IF v_end < v_start THEN v_end := v_end + interval '1 day'; END IF;
  ELSE
    RAISE EXCEPTION 'Unknown recurrence' USING ERRCODE = '22023';
  END IF;

  IF p_event_id IS NULL THEN
    INSERT INTO public.restaurant_events (
      restaurant_id, title, description, event_type, recurrence, weekdays, event_date, end_date,
      start_time, end_time, price, offer, image_url, is_active
    ) VALUES (
      p_restaurant_id, trim(p_title), nullif(trim(p_description), ''), p_event_type, p_recurrence, v_weekdays, v_start, v_end,
      p_start_time, p_end_time, p_price, nullif(trim(p_offer), ''), nullif(trim(p_image_url), ''), true
    ) RETURNING id INTO v_id;
  ELSE
    UPDATE public.restaurant_events SET
      title = trim(p_title), description = nullif(trim(p_description), ''), event_type = p_event_type,
      recurrence = p_recurrence, weekdays = v_weekdays, event_date = v_start, end_date = v_end,
      start_time = p_start_time, end_time = p_end_time, price = p_price, offer = nullif(trim(p_offer), ''),
      image_url = nullif(trim(p_image_url), '')
    WHERE id = p_event_id AND restaurant_id = p_restaurant_id
    RETURNING id INTO v_id;
    IF v_id IS NULL THEN RAISE EXCEPTION 'Event not found' USING ERRCODE = '22023'; END IF;
  END IF;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.save_restaurant_event(uuid, uuid, text, text, text, text, smallint[], date, date, time, time, numeric, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_restaurant_event(uuid, uuid, text, text, text, text, smallint[], date, date, time, time, numeric, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_restaurant_event_active(p_event_id uuid, p_active boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_restaurant uuid;
BEGIN
  SELECT restaurant_id INTO v_restaurant FROM public.restaurant_events WHERE id = p_event_id;
  IF v_restaurant IS NULL THEN RAISE EXCEPTION 'Event not found' USING ERRCODE = '22023'; END IF;
  IF auth.uid() IS NULL OR NOT (public.has_role(auth.uid(), 'admin') OR public.is_verified_owner(auth.uid(), v_restaurant)) THEN
    RAISE EXCEPTION 'Not authorized to edit this event' USING ERRCODE = '42501';
  END IF;
  UPDATE public.restaurant_events SET is_active = p_active WHERE id = p_event_id;
END;
$$;
REVOKE ALL ON FUNCTION public.set_restaurant_event_active(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_restaurant_event_active(uuid, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.delete_restaurant_event(p_event_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_restaurant uuid; v_status text;
BEGIN
  SELECT restaurant_id, promotion_status INTO v_restaurant, v_status FROM public.restaurant_events WHERE id = p_event_id;
  IF v_restaurant IS NULL THEN RAISE EXCEPTION 'Event not found' USING ERRCODE = '22023'; END IF;
  IF auth.uid() IS NULL OR NOT (public.has_role(auth.uid(), 'admin') OR public.is_verified_owner(auth.uid(), v_restaurant)) THEN
    RAISE EXCEPTION 'Not authorized to delete this event' USING ERRCODE = '42501';
  END IF;
  IF v_status = 'paid' AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Cancel the subscription before deleting a paid event' USING ERRCODE = '22023';
  END IF;
  DELETE FROM public.restaurant_events WHERE id = p_event_id;
END;
$$;
REVOKE ALL ON FUNCTION public.delete_restaurant_event(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_restaurant_event(uuid) TO authenticated;

CREATE TABLE IF NOT EXISTS public.restaurant_event_stats_daily (
  event_id uuid NOT NULL REFERENCES public.restaurant_events(id) ON DELETE CASCADE,
  dag date NOT NULL DEFAULT ((now() AT TIME ZONE 'Europe/Amsterdam')::date),
  metric text NOT NULL CHECK (metric IN ('impressie', 'bekeken', 'klik')),
  n integer NOT NULL DEFAULT 0,
  PRIMARY KEY (event_id, dag, metric)
);
ALTER TABLE public.restaurant_event_stats_daily ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.restaurant_event_stats_daily FROM anon, authenticated;
GRANT ALL ON public.restaurant_event_stats_daily TO service_role;

CREATE OR REPLACE FUNCTION public.track_event_metrics(p_items jsonb)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count integer;
BEGIN
  IF jsonb_typeof(p_items) IS DISTINCT FROM 'array' OR jsonb_array_length(p_items) > 60 THEN
    RETURN 0;
  END IF;
  WITH items AS (
    SELECT (i->>'e')::uuid AS event_id, i->>'m' AS metric
      FROM jsonb_array_elements(p_items) i
     WHERE jsonb_typeof(i) = 'object'
       AND i->>'e' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       AND i->>'m' IN ('impressie', 'bekeken', 'klik')
  ), agg AS (
    SELECT it.event_id, it.metric, count(*)::int AS n
      FROM items it
      JOIN public.restaurant_events e ON e.id = it.event_id
      JOIN public.restaurants r ON r.id = e.restaurant_id AND r.is_active
     WHERE public.restaurant_event_visible(e.is_active, e.promotion_status, e.recurrence, e.event_date, e.end_date)
     GROUP BY 1, 2
  ), ins AS (
    INSERT INTO public.restaurant_event_stats_daily AS s (event_id, dag, metric, n)
    SELECT event_id, (now() AT TIME ZONE 'Europe/Amsterdam')::date, metric, n FROM agg
    ON CONFLICT (event_id, dag, metric) DO UPDATE SET n = s.n + EXCLUDED.n
    RETURNING 1
  )
  SELECT count(*) INTO v_count FROM ins;
  RETURN v_count;
END;
$$;
REVOKE ALL ON FUNCTION public.track_event_metrics(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.track_event_metrics(jsonb) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.owner_event_stats(p_restaurant_id uuid, p_from date DEFAULT NULL, p_to date DEFAULT NULL)
RETURNS TABLE(event_id uuid, metric text, totaal bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT (public.has_role(auth.uid(), 'admin') OR public.is_verified_owner(auth.uid(), p_restaurant_id)) THEN
    RAISE EXCEPTION 'Not authorized to view event statistics' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT s.event_id, s.metric, sum(s.n)::bigint
      FROM public.restaurant_event_stats_daily s
      JOIN public.restaurant_events e ON e.id = s.event_id
     WHERE e.restaurant_id = p_restaurant_id
       AND (p_from IS NULL OR s.dag >= p_from)
       AND (p_to IS NULL OR s.dag <= p_to)
     GROUP BY 1, 2;
END;
$$;
REVOKE ALL ON FUNCTION public.owner_event_stats(uuid, date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owner_event_stats(uuid, date, date) TO authenticated;

ALTER TABLE public.owner_email_preferences
  ADD COLUMN IF NOT EXISTS event_report boolean NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS public.owner_event_report_log (
  user_id uuid NOT NULL,
  month date NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, month)
);
ALTER TABLE public.owner_event_report_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.owner_event_report_log FROM anon, authenticated;
GRANT ALL ON public.owner_event_report_log TO service_role;

SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'send-monthly-event-report';
SELECT cron.schedule(
  'send-monthly-event-report',
  '0 7 1 * *',
  $cron$
  SELECT net.http_post(
    url := 'https://uktafmxojymsojqewzuy.supabase.co/functions/v1/send-monthly-event-report',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT secret FROM public.internal_job_secrets WHERE name = 'cron')
    ),
    body := '{}'::jsonb
  );
  $cron$
);