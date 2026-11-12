-- Founding Partner and Menuservice orders, created only by stripe-webhook.
--
-- Before this table the packages page sent owners to loose Stripe payment links
-- that the webhook never processed, so a payment activated nothing. Orders now
-- start in create-package-checkout and land here from checkout.session.completed:
--   founding_partner: €59/month or €590/year, one dish×city page (page_slug),
--                     max 5 live per page, minimum term 6 months, billing starts
--                     on the launch date (Stripe trial until then).
--   menu_service:     €79 once or €19/month; an admin delivers it by hand
--                     (fulfillment_status) within 3 working days.

CREATE TABLE IF NOT EXISTS public.package_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  package text NOT NULL,
  plan text NOT NULL,
  page_slug text,
  status text NOT NULL DEFAULT 'active',
  fulfillment_status text NOT NULL DEFAULT 'todo',
  amount_cents integer NOT NULL,
  stripe_session_id text,
  stripe_subscription_id text,
  stripe_customer_id text,
  commitment_until timestamptz,
  current_period_end timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT package_orders_package_check CHECK (package IN ('founding_partner', 'menu_service')),
  CONSTRAINT package_orders_plan_check CHECK (plan IN ('month', 'year', 'once')),
  CONSTRAINT package_orders_status_check CHECK (status IN ('active', 'trialing', 'past_due', 'cancelled')),
  CONSTRAINT package_orders_fulfillment_check CHECK (fulfillment_status IN ('todo', 'in_progress', 'done', 'n_a')),
  CONSTRAINT package_orders_founding_page_check CHECK (package <> 'founding_partner' OR page_slug IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS package_orders_session_key ON public.package_orders (stripe_session_id) WHERE stripe_session_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS package_orders_subscription_key ON public.package_orders (stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_package_orders_page ON public.package_orders (page_slug) WHERE package = 'founding_partner';
CREATE INDEX IF NOT EXISTS idx_package_orders_restaurant ON public.package_orders (restaurant_id);

ALTER TABLE public.package_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners view their package orders"
  ON public.package_orders FOR SELECT
  USING (auth.uid() IS NOT NULL AND public.is_verified_owner(auth.uid(), restaurant_id));

CREATE POLICY "Admins manage package orders"
  ON public.package_orders FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- A Founding Partner place counts while its subscription is live (trial included).
CREATE OR REPLACE FUNCTION public.founding_partner_live(p_status text)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT p_status IN ('active', 'trialing', 'past_due');
$$;

-- Public: which restaurants hold a Founding Partner place on a dish×city page.
CREATE OR REPLACE FUNCTION public.founding_partners_for_page(p_page_slug text)
RETURNS TABLE (restaurant_id uuid) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT DISTINCT o.restaurant_id
    FROM public.package_orders o
    JOIN public.restaurants r ON r.id = o.restaurant_id AND r.is_active
   WHERE o.package = 'founding_partner'
     AND o.page_slug = p_page_slug
     AND public.founding_partner_live(o.status);
$$;

-- Public: places left on a page (5 per dish×city page), for the packages page.
CREATE OR REPLACE FUNCTION public.founding_places_left(p_page_slug text)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT GREATEST(0, 5 - count(*)::int)
    FROM public.package_orders
   WHERE package = 'founding_partner' AND page_slug = p_page_slug
     AND public.founding_partner_live(status);
$$;

GRANT EXECUTE ON FUNCTION public.founding_partners_for_page(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.founding_places_left(text) TO anon, authenticated;

-- Proof that a Founding Partner place works: anonymous daily counters for the
-- "Uitgelicht" block on the dish×city page, without browser identifiers.
-- impressie = card at least half on screen, klik = card opened from the block.
CREATE TABLE IF NOT EXISTS public.founding_stats_daily (
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  page_slug text NOT NULL,
  dag date NOT NULL DEFAULT ((now() AT TIME ZONE 'Europe/Amsterdam')::date),
  metric text NOT NULL CHECK (metric IN ('impressie', 'klik')),
  n integer NOT NULL DEFAULT 0,
  PRIMARY KEY (restaurant_id, page_slug, dag, metric)
);
ALTER TABLE public.founding_stats_daily ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.founding_stats_daily FROM anon, authenticated;
GRANT ALL ON public.founding_stats_daily TO service_role;

CREATE OR REPLACE FUNCTION public.track_founding_metrics(p_items jsonb)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count integer;
BEGIN
  IF jsonb_typeof(p_items) IS DISTINCT FROM 'array' OR jsonb_array_length(p_items) > 60 THEN
    RETURN 0;
  END IF;
  WITH items AS (
    SELECT (i->>'r')::uuid AS restaurant_id, left(i->>'p', 200) AS page_slug, i->>'m' AS metric
      FROM jsonb_array_elements(p_items) i
     WHERE jsonb_typeof(i) = 'object'
       AND i->>'r' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       AND i->>'m' IN ('impressie', 'klik')
  ), agg AS (
    SELECT it.restaurant_id, it.page_slug, it.metric, count(*)::int AS n
      FROM items it
     WHERE EXISTS (SELECT 1 FROM public.package_orders o
                    WHERE o.restaurant_id = it.restaurant_id AND o.page_slug = it.page_slug
                      AND o.package = 'founding_partner' AND public.founding_partner_live(o.status))
     GROUP BY 1, 2, 3
  ), ins AS (
    INSERT INTO public.founding_stats_daily AS s (restaurant_id, page_slug, dag, metric, n)
    SELECT restaurant_id, page_slug, (now() AT TIME ZONE 'Europe/Amsterdam')::date, metric, n FROM agg
    ON CONFLICT (restaurant_id, page_slug, dag, metric) DO UPDATE SET n = s.n + EXCLUDED.n
    RETURNING 1
  )
  SELECT count(*) INTO v_count FROM ins;
  RETURN v_count;
END;
$$;
REVOKE ALL ON FUNCTION public.track_founding_metrics(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.track_founding_metrics(jsonb) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.owner_founding_stats(p_restaurant_id uuid, p_from date DEFAULT NULL, p_to date DEFAULT NULL)
RETURNS TABLE(page_slug text, metric text, totaal bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT (public.has_role(auth.uid(), 'admin') OR public.is_verified_owner(auth.uid(), p_restaurant_id)) THEN
    RAISE EXCEPTION 'Not authorized to view Founding Partner statistics' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT s.page_slug, s.metric, sum(s.n)::bigint
      FROM public.founding_stats_daily s
     WHERE s.restaurant_id = p_restaurant_id
       AND (p_from IS NULL OR s.dag >= p_from)
       AND (p_to IS NULL OR s.dag <= p_to)
     GROUP BY 1, 2;
END;
$$;
REVOKE ALL ON FUNCTION public.owner_founding_stats(uuid, date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owner_founding_stats(uuid, date, date) TO authenticated;

-- Monthly Founding Partner report: opt-out next to the other owner mail preferences.
ALTER TABLE public.owner_email_preferences
  ADD COLUMN IF NOT EXISTS founding_report boolean NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS public.owner_founding_report_log (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  month date NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, month)
);
ALTER TABLE public.owner_founding_report_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.owner_founding_report_log FROM anon, authenticated;
GRANT ALL ON public.owner_founding_report_log TO service_role;

-- 1st of every month, 07:15 UTC, for the previous month.
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'send-monthly-founding-report';
SELECT cron.schedule(
  'send-monthly-founding-report',
  '15 7 1 * *',
  $cron$
  SELECT net.http_post(
    url := 'https://uktafmxojymsojqewzuy.supabase.co/functions/v1/send-monthly-founding-report',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT secret FROM public.internal_job_secrets WHERE name = 'cron')
    ),
    body := '{}'::jsonb
  );
  $cron$
);

GRANT SELECT ON public.package_orders TO authenticated;
GRANT ALL ON public.package_orders TO service_role;
