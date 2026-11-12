-- Reservation provider integrations (Zenchef first, provider-agnostic schema).
--
-- Zenchef stays the single source of truth for availability, booking status and
-- tables. Dishloopr stores only what it needs to route guests and to prove which
-- bookings it generated:
--   restaurant_integrations   one row per restaurant per provider (no secrets)
--   reservations              bookings created through Dishloopr's native flow,
--                             only with provider evidence, without guest data
--   integration_events        webhook/sync events, deduplicated per provider event id
--   reservation_funnel_daily  anonymous daily counters for flow starts and
--                             widget-reported bookings (never counted as confirmed)
-- Writes go through SECURITY DEFINER functions or the service role (edge functions);
-- clients never write these tables directly.

-- ---------------------------------------------------------------------------
-- Integrations
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.restaurant_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('zenchef')),
  external_restaurant_id text NOT NULL CHECK (external_restaurant_id ~ '^[0-9]{1,10}$'),
  method text NOT NULL DEFAULT 'widget' CHECK (method IN ('widget', 'api')),
  status text NOT NULL DEFAULT 'testing'
    CHECK (status IN ('config_required', 'testing', 'connected', 'limited', 'error')),
  enabled boolean NOT NULL DEFAULT false,
  -- Non-secret settings only (lang, timezone). API credentials never live here.
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  verified_at timestamptz,
  verified_by uuid,
  last_synced_at timestamptz,
  last_error_code text,
  last_error_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (restaurant_id, provider),
  -- One provider venue can only be linked to one Dishloopr restaurant.
  UNIQUE (provider, external_restaurant_id)
);

ALTER TABLE public.restaurant_integrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners and admins read integrations" ON public.restaurant_integrations;
CREATE POLICY "Owners and admins read integrations" ON public.restaurant_integrations
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.is_verified_owner(auth.uid(), restaurant_id));

-- Keep the public restaurants.zenchef_id (read by the restaurant page) in step with
-- the integration: set only while the integration is enabled and usable.
CREATE OR REPLACE FUNCTION public.sync_restaurant_zenchef_id()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.provider = 'zenchef' THEN
      UPDATE public.restaurants SET zenchef_id = NULL WHERE id = OLD.restaurant_id;
    END IF;
    RETURN OLD;
  END IF;
  IF NEW.provider = 'zenchef' THEN
    UPDATE public.restaurants
       SET zenchef_id = CASE WHEN NEW.enabled AND NEW.status IN ('connected', 'limited')
                             THEN NEW.external_restaurant_id ELSE NULL END
     WHERE id = NEW.restaurant_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS restaurant_integrations_sync_zenchef ON public.restaurant_integrations;
CREATE TRIGGER restaurant_integrations_sync_zenchef
  AFTER INSERT OR UPDATE OR DELETE ON public.restaurant_integrations
  FOR EACH ROW EXECUTE FUNCTION public.sync_restaurant_zenchef_id();

-- Who may manage a restaurant's integrations: admins and verified owners.
CREATE OR REPLACE FUNCTION public.can_manage_reservation_integration(p_restaurant_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL
     AND (public.has_role(auth.uid(), 'admin') OR public.is_verified_owner(auth.uid(), p_restaurant_id));
$$;

-- Validates the non-secret config keys. Unknown keys are rejected.
CREATE OR REPLACE FUNCTION public.clean_reservation_config(p_config jsonb)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  k text;
  out jsonb := '{}'::jsonb;
BEGIN
  IF p_config IS NULL THEN RETURN out; END IF;
  IF jsonb_typeof(p_config) <> 'object' THEN
    RAISE EXCEPTION 'Ongeldige configuratie' USING ERRCODE = '22023';
  END IF;
  FOR k IN SELECT jsonb_object_keys(p_config) LOOP
    IF k = 'lang' THEN
      IF NOT (p_config->>'lang' = ANY (ARRAY['nl', 'en', 'de', 'fr', 'es', 'it', 'pt'])) THEN
        RAISE EXCEPTION 'Ongeldige taal' USING ERRCODE = '22023';
      END IF;
      out := out || jsonb_build_object('lang', p_config->>'lang');
    ELSIF k = 'timezone' THEN
      IF NOT (p_config->>'timezone' ~ '^[A-Za-z]+/[A-Za-z_]+$') THEN
        RAISE EXCEPTION 'Ongeldige tijdzone' USING ERRCODE = '22023';
      END IF;
      out := out || jsonb_build_object('timezone', p_config->>'timezone');
    ELSE
      RAISE EXCEPTION 'Onbekende instelling: %', k USING ERRCODE = '22023';
    END IF;
  END LOOP;
  RETURN out;
END;
$$;

-- Saves (or replaces) the Zenchef venue ID. A new or changed ID always goes back to
-- 'testing' and is disabled until the owner confirms it shows their own restaurant.
-- The API method is accepted but stays 'config_required' until server-side API access exists.
CREATE OR REPLACE FUNCTION public.save_reservation_integration(
  p_restaurant_id uuid, p_provider text, p_external_id text, p_method text DEFAULT 'widget', p_config jsonb DEFAULT '{}'::jsonb
) RETURNS public.restaurant_integrations
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id text := btrim(coalesce(p_external_id, ''));
  v_row public.restaurant_integrations;
  v_status text := CASE WHEN p_method = 'api' THEN 'config_required' ELSE 'testing' END;
BEGIN
  IF NOT public.can_manage_reservation_integration(p_restaurant_id) THEN
    RAISE EXCEPTION 'Not authorized to manage this restaurant' USING ERRCODE = '42501';
  END IF;
  IF p_provider IS DISTINCT FROM 'zenchef' THEN
    RAISE EXCEPTION 'Onbekend reserveringssysteem' USING ERRCODE = '22023';
  END IF;
  IF p_method NOT IN ('widget', 'api') THEN
    RAISE EXCEPTION 'Onbekende koppelmethode' USING ERRCODE = '22023';
  END IF;
  IF v_id !~ '^[0-9]{1,10}$' THEN
    RAISE EXCEPTION 'Ongeldig Zenchef-restaurant-ID' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM public.restaurant_integrations
              WHERE provider = p_provider AND external_restaurant_id = v_id AND restaurant_id <> p_restaurant_id) THEN
    RAISE EXCEPTION 'Dit Zenchef-restaurant is al aan een ander restaurant gekoppeld' USING ERRCODE = '23505';
  END IF;

  INSERT INTO public.restaurant_integrations AS ri
    (restaurant_id, provider, external_restaurant_id, method, status, enabled, config)
  VALUES (p_restaurant_id, p_provider, v_id, p_method, v_status, false, public.clean_reservation_config(p_config))
  ON CONFLICT (restaurant_id, provider) DO UPDATE SET
    -- Changing the ID or method resets verification; a config-only change keeps it.
    status = CASE WHEN ri.external_restaurant_id = EXCLUDED.external_restaurant_id AND ri.method = EXCLUDED.method
                  THEN ri.status ELSE EXCLUDED.status END,
    enabled = CASE WHEN ri.external_restaurant_id = EXCLUDED.external_restaurant_id AND ri.method = EXCLUDED.method
                   THEN ri.enabled ELSE false END,
    verified_at = CASE WHEN ri.external_restaurant_id = EXCLUDED.external_restaurant_id AND ri.method = EXCLUDED.method
                       THEN ri.verified_at ELSE NULL END,
    external_restaurant_id = EXCLUDED.external_restaurant_id,
    method = EXCLUDED.method,
    config = EXCLUDED.config,
    last_error_code = NULL,
    last_error_at = NULL,
    updated_at = now()
  RETURNING * INTO v_row;
  RETURN v_row;
END;
$$;

-- The owner confirms the widget showed their own restaurant: the widget route goes live.
CREATE OR REPLACE FUNCTION public.confirm_reservation_integration(p_restaurant_id uuid, p_provider text)
RETURNS public.restaurant_integrations
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_row public.restaurant_integrations;
BEGIN
  IF NOT public.can_manage_reservation_integration(p_restaurant_id) THEN
    RAISE EXCEPTION 'Not authorized to manage this restaurant' USING ERRCODE = '42501';
  END IF;
  UPDATE public.restaurant_integrations
     SET status = 'connected', enabled = true, verified_at = now(), verified_by = auth.uid(),
         last_error_code = NULL, last_error_at = NULL, updated_at = now()
   WHERE restaurant_id = p_restaurant_id AND provider = p_provider
     AND method = 'widget' AND status IN ('testing', 'connected', 'error')
  RETURNING * INTO v_row;
  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Er is geen widgetkoppeling om te bevestigen' USING ERRCODE = 'P0002';
  END IF;
  RETURN v_row;
END;
$$;

-- Temporarily switch reservations on or off without losing the configuration.
CREATE OR REPLACE FUNCTION public.set_reservation_integration_enabled(p_restaurant_id uuid, p_provider text, p_enabled boolean)
RETURNS public.restaurant_integrations
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_row public.restaurant_integrations;
BEGIN
  IF NOT public.can_manage_reservation_integration(p_restaurant_id) THEN
    RAISE EXCEPTION 'Not authorized to manage this restaurant' USING ERRCODE = '42501';
  END IF;
  UPDATE public.restaurant_integrations
     SET enabled = p_enabled, updated_at = now()
   WHERE restaurant_id = p_restaurant_id AND provider = p_provider
     AND (NOT p_enabled OR status IN ('connected', 'limited'))
  RETURNING * INTO v_row;
  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Koppeling is nog niet bevestigd' USING ERRCODE = 'P0002';
  END IF;
  RETURN v_row;
END;
$$;

-- Disconnect removes the integration and its event log. Reservation rows hold no
-- guest data and stay for the owner's history; their provider link is kept as evidence.
CREATE OR REPLACE FUNCTION public.disconnect_reservation_integration(p_restaurant_id uuid, p_provider text)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.can_manage_reservation_integration(p_restaurant_id) THEN
    RAISE EXCEPTION 'Not authorized to manage this restaurant' USING ERRCODE = '42501';
  END IF;
  DELETE FROM public.integration_events WHERE restaurant_id = p_restaurant_id AND provider = p_provider;
  DELETE FROM public.restaurant_integrations WHERE restaurant_id = p_restaurant_id AND provider = p_provider;
  UPDATE public.reservations SET manage_token_hash = NULL
   WHERE restaurant_id = p_restaurant_id AND provider = p_provider;
  RETURN true;
END;
$$;

-- Public, non-sensitive view of how a restaurant takes bookings.
CREATE OR REPLACE FUNCTION public.public_reservation_options(p_restaurant_id uuid)
RETURNS TABLE (provider text, method text, external_restaurant_id text, lang text, timezone text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT ri.provider, ri.method, ri.external_restaurant_id, ri.config->>'lang',
         coalesce(ri.config->>'timezone', 'Europe/Amsterdam')
    FROM public.restaurant_integrations ri
    JOIN public.restaurants r ON r.id = ri.restaurant_id AND coalesce(r.is_active, true)
   WHERE ri.restaurant_id = p_restaurant_id AND ri.enabled AND ri.status IN ('connected', 'limited');
$$;

-- ---------------------------------------------------------------------------
-- Reservations made through Dishloopr (no guest personal data)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('zenchef')),
  external_reservation_id text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'cancelled', 'rejected', 'failed', 'no_show', 'completed')),
  starts_at timestamptz NOT NULL,
  party_size int NOT NULL CHECK (party_size BETWEEN 1 AND 50),
  source text NOT NULL DEFAULT 'dishloopr_native' CHECK (source IN ('dishloopr_native')),
  -- provider_confirmed = the provider API accepted the booking and returned its id.
  evidence text CHECK (evidence IN ('provider_confirmed')),
  dish_context text CHECK (dish_context IS NULL OR dish_context ~ '^[a-z0-9-]{1,80}$'),
  campaign_id text CHECK (campaign_id IS NULL OR campaign_id ~ '^[A-Za-z0-9_-]{1,64}$'),
  idempotency_key text NOT NULL UNIQUE CHECK (length(idempotency_key) BETWEEN 16 AND 100),
  manage_token_hash text,
  provider_updated_at timestamptz,
  error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, external_reservation_id)
);

CREATE INDEX IF NOT EXISTS reservations_restaurant_created ON public.reservations (restaurant_id, created_at DESC);

ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners and admins read reservations" ON public.reservations;
CREATE POLICY "Owners and admins read reservations" ON public.reservations
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.is_verified_owner(auth.uid(), restaurant_id));

-- ---------------------------------------------------------------------------
-- Integration events (webhooks and reconciliation), idempotent per provider event
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.integration_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  event_id text NOT NULL,
  restaurant_id uuid REFERENCES public.restaurants(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  processing_status text NOT NULL DEFAULT 'received'
    CHECK (processing_status IN ('received', 'processed', 'ignored', 'failed')),
  attempts int NOT NULL DEFAULT 1,
  error_code text,
  UNIQUE (provider, event_id)
);

ALTER TABLE public.integration_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners and admins read integration events" ON public.integration_events;
CREATE POLICY "Owners and admins read integration events" ON public.integration_events
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin')
         OR (restaurant_id IS NOT NULL AND public.is_verified_owner(auth.uid(), restaurant_id)));

-- Event log retention: 90 days is enough for retries and troubleshooting.
CREATE OR REPLACE FUNCTION public.purge_old_integration_events()
RETURNS int LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  WITH d AS (DELETE FROM public.integration_events WHERE received_at < now() - interval '90 days' RETURNING 1)
  SELECT count(*)::int FROM d;
$$;

-- ---------------------------------------------------------------------------
-- Anonymous funnel counters (no browser identifiers)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reservation_funnel_daily (
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  dag date NOT NULL,
  stage text NOT NULL CHECK (stage IN ('flow_started', 'widget_opened', 'widget_booking_reported')),
  context text NOT NULL DEFAULT 'zoek',
  n int NOT NULL DEFAULT 0,
  PRIMARY KEY (restaurant_id, dag, stage, context)
);

ALTER TABLE public.reservation_funnel_daily ENABLE ROW LEVEL SECURITY;

-- p_items: [{"r": restaurant uuid, "s": stage, "c": context}], at most 20 per call.
CREATE OR REPLACE FUNCTION public.track_reservation_funnel(p_items jsonb)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_count int := 0;
  it jsonb;
  v_ctx text;
BEGIN
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN RETURN 0; END IF;
  FOR it IN SELECT value FROM jsonb_array_elements(p_items) LIMIT 20 LOOP
    CONTINUE WHEN coalesce(it->>'r', '') !~ '^[0-9a-f-]{36}$';
    CONTINUE WHEN coalesce(it->>'s', '') NOT IN ('flow_started', 'widget_opened', 'widget_booking_reported');
    v_ctx := lower(coalesce(it->>'c', ''));
    IF v_ctx !~ '^[a-z0-9-]{1,80}$' THEN v_ctx := 'zoek'; END IF;
    CONTINUE WHEN NOT EXISTS (SELECT 1 FROM public.restaurants WHERE id = (it->>'r')::uuid);
    INSERT INTO public.reservation_funnel_daily AS f (restaurant_id, dag, stage, context, n)
    VALUES ((it->>'r')::uuid, (now() AT TIME ZONE 'Europe/Amsterdam')::date, it->>'s', v_ctx, 1)
    ON CONFLICT (restaurant_id, dag, stage, context) DO UPDATE SET n = f.n + 1;
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

-- Owner-facing reservation numbers, kept strictly apart:
--   clicks                    reserve-button clicks (restaurant_stats_daily 'reserveren')
--   flow_started / widget_opened   started booking flows
--   widget_booking_reported   the Zenchef widget reported a booking in the browser (not verifiable)
--   confirmed / cancelled     native bookings with provider evidence
CREATE OR REPLACE FUNCTION public.reservation_stats_summary(p_restaurant_id uuid, p_days integer DEFAULT 30)
RETURNS TABLE (metric text, context text, n bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_from date := (now() AT TIME ZONE 'Europe/Amsterdam')::date - greatest(1, least(coalesce(p_days, 30), 400));
BEGIN
  IF NOT public.owner_analytics_allowed(p_restaurant_id) THEN
    RAISE EXCEPTION 'Not authorized to view these statistics' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT 'clicks'::text, s.context, sum(s.n)::bigint
      FROM public.restaurant_stats_daily s
     WHERE s.restaurant_id = p_restaurant_id AND s.metric = 'reserveren' AND s.dag > v_from
     GROUP BY s.context
    UNION ALL
    SELECT f.stage, f.context, sum(f.n)::bigint
      FROM public.reservation_funnel_daily f
     WHERE f.restaurant_id = p_restaurant_id AND f.dag > v_from
     GROUP BY f.stage, f.context
    UNION ALL
    SELECT CASE WHEN r.status = 'cancelled' THEN 'cancelled' ELSE 'confirmed' END,
           coalesce(r.dish_context, 'zoek'), count(*)::bigint
      FROM public.reservations r
     WHERE r.restaurant_id = p_restaurant_id
       AND r.evidence = 'provider_confirmed'
       AND r.status IN ('confirmed', 'completed', 'no_show', 'cancelled')
       AND (r.created_at AT TIME ZONE 'Europe/Amsterdam')::date > v_from
     GROUP BY 1, 2;
END;
$$;

-- ---------------------------------------------------------------------------
-- Grants: clients only reach the functions above.
-- ---------------------------------------------------------------------------
REVOKE ALL ON public.restaurant_integrations, public.reservations, public.integration_events, public.reservation_funnel_daily FROM anon, authenticated;
GRANT SELECT ON public.restaurant_integrations, public.reservations, public.integration_events TO authenticated;

REVOKE EXECUTE ON FUNCTION public.save_reservation_integration(uuid, text, text, text, jsonb),
  public.confirm_reservation_integration(uuid, text),
  public.set_reservation_integration_enabled(uuid, text, boolean),
  public.disconnect_reservation_integration(uuid, text),
  public.reservation_stats_summary(uuid, integer),
  public.purge_old_integration_events() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_reservation_integration(uuid, text, text, text, jsonb),
  public.confirm_reservation_integration(uuid, text),
  public.set_reservation_integration_enabled(uuid, text, boolean),
  public.disconnect_reservation_integration(uuid, text),
  public.reservation_stats_summary(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.purge_old_integration_events() TO service_role;
GRANT EXECUTE ON FUNCTION public.public_reservation_options(uuid), public.track_reservation_funnel(jsonb) TO anon, authenticated;

-- Existing restaurants with a numeric zenchef_id keep working as live widget integrations.
INSERT INTO public.restaurant_integrations (restaurant_id, provider, external_restaurant_id, method, status, enabled, verified_at)
SELECT r.id, 'zenchef', btrim(r.zenchef_id), 'widget', 'connected', true, now()
  FROM public.restaurants r
 WHERE r.zenchef_id ~ '^\s*[0-9]{1,10}\s*$'
ON CONFLICT DO NOTHING;