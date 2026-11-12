-- Owner outreach ("mail golf") with an agent loop:
--   outreach_targets    one row per restaurant: segment, contact data and whether it may be mailed
--   outreach_settings   single row with the switches the cron job reads (off by default)
--   outreach_messages   one row per restaurant per wave; UNIQUE so nobody is mailed twice in a wave
--   outreach_replies    inbound replies with the AI triage (category, priority, draft answer)
-- Plus the visibility rule for hidden restaurants: a restaurant hidden for its menu becomes
-- visible again by itself once it has menu_minimum (default 5) approved dishes, drinks not
-- counted. Owners can claim such a hidden restaurant and complete the menu themselves.
-- Everything is admin-only. Edge functions use the service role; the public can only
-- unsubscribe through outreach_unsubscribe(token).

CREATE TABLE IF NOT EXISTS public.outreach_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  enabled boolean NOT NULL DEFAULT false,
  wave integer NOT NULL DEFAULT 1 CHECK (wave >= 1),
  batch_size integer NOT NULL DEFAULT 40 CHECK (batch_size BETWEEN 1 AND 200),
  daily_cap integer NOT NULL DEFAULT 150 CHECK (daily_cap BETWEEN 1 AND 2000),
  -- Dutch law (Telecommunicatiewet 11.7) needs prior consent for sole traders and
  -- partnerships (natural persons). Skipped unless an admin switches this off.
  skip_natural_persons boolean NOT NULL DEFAULT true,
  -- Visibility rule: approved dishes (drinks excluded) a hidden restaurant needs to go live.
  menu_minimum integer NOT NULL DEFAULT 5 CHECK (menu_minimum BETWEEN 1 AND 50),
  -- Owner flyer (storage bucket "marketing", outreach/dishloopr-flyer.pdf): attached, linked or left out.
  flyer_mode text NOT NULL DEFAULT 'bijlage' CHECK (flyer_mode IN ('bijlage', 'link', 'uit')),
  -- Set by the send agent when the flyer could not be fetched (mails then go out without it).
  flyer_warning text,
  flyer_checked_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.outreach_settings (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.outreach_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  wave integer NOT NULL,
  segment text NOT NULL CHECK (segment IN ('zichtbaar', 'onzichtbaar_menu')),
  to_email text NOT NULL,
  subject text NOT NULL,
  status text NOT NULL DEFAULT 'sending' CHECK (status IN ('sending', 'sent', 'failed')),
  provider_id text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  UNIQUE (restaurant_id, wave)
);
CREATE INDEX IF NOT EXISTS outreach_messages_created_idx ON public.outreach_messages (created_at DESC);

CREATE TABLE IF NOT EXISTS public.outreach_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_email_id text UNIQUE,
  restaurant_id uuid REFERENCES public.restaurants(id) ON DELETE SET NULL,
  from_email text NOT NULL,
  from_name text,
  subject text,
  body_text text,
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  message_id text,
  received_at timestamptz NOT NULL DEFAULT now(),
  categorie text,
  prioriteit text CHECK (prioriteit IN ('hoog', 'normaal', 'laag')),
  deal_kans integer CHECK (deal_kans BETWEEN 0 AND 100),
  samenvatting text,
  aanbevolen_actie text,
  concept_antwoord text,
  classified_at timestamptz,
  classify_error text,
  status text NOT NULL DEFAULT 'te_beoordelen'
    CHECK (status IN ('te_beoordelen', 'beantwoord', 'afgehandeld', 'automatisch')),
  answer_text text,
  answered_at timestamptz
);
CREATE INDEX IF NOT EXISTS outreach_replies_status_idx ON public.outreach_replies (status, received_at DESC);

ALTER TABLE public.outreach_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outreach_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outreach_replies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS outreach_settings_admin ON public.outreach_settings;
CREATE POLICY outreach_settings_admin ON public.outreach_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS outreach_messages_admin ON public.outreach_messages;
CREATE POLICY outreach_messages_admin ON public.outreach_messages FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS outreach_replies_admin_read ON public.outreach_replies;
CREATE POLICY outreach_replies_admin_read ON public.outreach_replies FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS outreach_replies_admin_update ON public.outreach_replies;
CREATE POLICY outreach_replies_admin_update ON public.outreach_replies FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Public bucket for marketing files such as the owner flyer; only admins upload or replace.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('marketing', 'marketing', true, 10485760, ARRAY['application/pdf', 'image/png', 'image/jpeg'])
ON CONFLICT (id) DO NOTHING;
DROP POLICY IF EXISTS "Admins manage marketing files" ON storage.objects;
CREATE POLICY "Admins manage marketing files" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'marketing' AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (bucket_id = 'marketing' AND public.has_role(auth.uid(), 'admin'));

-- ---------------------------------------------------------------------------
-- Visibility rule
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.visibility_menu_minimum()
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce((SELECT menu_minimum FROM public.outreach_settings LIMIT 1), 5);
$$;

CREATE OR REPLACE FUNCTION public.menu_dish_count(p_restaurant_id uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT count(*)::int FROM public.restaurant_dishes rd
  WHERE rd.restaurant_id = p_restaurant_id
    AND rd.status IN ('approved_by_admin', 'verified_by_owner')
    AND coalesce(rd.course_type::text, '') <> 'drank';
$$;
GRANT EXECUTE ON FUNCTION public.visibility_menu_minimum() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.menu_dish_count(uuid) TO anon, authenticated;

-- Hidden for a menu reason (or without a reason), as opposed to closed or duplicate.
CREATE OR REPLACE FUNCTION public.hidden_for_menu(p_restaurant_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.restaurants_verborgen v
    WHERE v.id = p_restaurant_id AND (v.reden IS NULL OR v.reden ~* '(menu|gerecht|kaart|dish)')
  );
$$;

-- Goes live by itself once the menu meets the minimum (owner upload, owner edits or admin import).
CREATE OR REPLACE FUNCTION public.unhide_restaurant_when_menu_complete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status NOT IN ('approved_by_admin', 'verified_by_owner') THEN RETURN NULL; END IF;
  IF NOT public.hidden_for_menu(NEW.restaurant_id) THEN RETURN NULL; END IF;
  IF public.menu_dish_count(NEW.restaurant_id) >= public.visibility_menu_minimum() THEN
    UPDATE public.restaurants SET is_active = true, updated_at = now() WHERE id = NEW.restaurant_id;
    DELETE FROM public.restaurants_verborgen WHERE id = NEW.restaurant_id;
  END IF;
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS unhide_restaurant_when_menu_complete ON public.restaurant_dishes;
CREATE TRIGGER unhide_restaurant_when_menu_complete
  AFTER INSERT OR UPDATE OF status, course_type ON public.restaurant_dishes
  FOR EACH ROW EXECUTE FUNCTION public.unhide_restaurant_when_menu_complete();

-- Claim page: also finds restaurants hidden for their menu, which the public RLS hides.
CREATE OR REPLACE FUNCTION public.claimable_restaurant(p_slug text)
RETURNS TABLE (id uuid, name text, slug text, is_active boolean, menu_count integer, menu_minimum integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT r.id, r.name, r.slug, r.is_active, public.menu_dish_count(r.id), public.visibility_menu_minimum()
  FROM public.restaurants r
  WHERE r.slug = p_slug AND (r.is_active OR public.hidden_for_menu(r.id))
  LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.claimable_restaurant(text) TO anon, authenticated;

-- Owners see their own hidden restaurant in the dashboard (the public policy only shows active ones).
-- NOT is_active first keeps the ownership check off the hot path for active restaurants.
DROP POLICY IF EXISTS "Owners can view their own hidden restaurants" ON public.restaurants;
CREATE POLICY "Owners can view their own hidden restaurants" ON public.restaurants
  FOR SELECT TO authenticated
  USING (NOT is_active AND (claimed_by_owner_id = (SELECT auth.uid()) OR public.is_verified_owner((SELECT auth.uid()), id)));

-- Segment rules:
--   zichtbaar         active restaurant (listable: it has approved dishes)
--   onzichtbaar_menu  hidden for a menu reason (or no reason) and still below the menu minimum
--   uitgesloten       inactive for another reason (closed, duplicate, ...): never mailed
-- mail_status says why a row is or is not mailable; only 'mailbaar' rows are sent.
CREATE OR REPLACE VIEW public.outreach_targets WITH (security_invoker = true) AS
SELECT
  r.id AS restaurant_id,
  r.name,
  r.slug,
  ci.name AS stad,
  r.address,
  r.phone,
  r.website_url,
  r.is_active,
  r.claim_status::text AS claim_status,
  v.reden AS verborgen_reden,
  v.hidden_at,
  coalesce(d.n, 0)::int AS goedgekeurde_gerechten,
  mm.m AS menu_minimum,
  k.email,
  k.email_kwaliteit,
  k.email_bron,
  k.rechtsvorm,
  k.kvk,
  k.instagram,
  k.facebook,
  k.telefoon_site,
  k.status AS contact_status,
  k.mail_golf,
  k.laatst_gemaild_op,
  k.afgemeld_op,
  CASE
    WHEN r.is_active THEN 'zichtbaar'
    WHEN v.id IS NOT NULL AND (v.reden IS NULL OR v.reden ~* '(menu|gerecht|kaart|dish)') AND coalesce(d.n, 0) < mm.m THEN 'onzichtbaar_menu'
    ELSE 'uitgesloten'
  END AS segment,
  CASE
    WHEN NOT r.is_active AND NOT (v.id IS NOT NULL AND (v.reden IS NULL OR v.reden ~* '(menu|gerecht|kaart|dish)') AND coalesce(d.n, 0) < mm.m) THEN 'uitgesloten'
    WHEN r.claim_status::text <> 'unclaimed' OR r.claimed_by_owner_id IS NOT NULL THEN 'al_geclaimd'
    WHEN k.email IS NULL OR k.email !~* '^[^@[:space:]]+@[^@[:space:]]+\.[a-z]{2,}$' THEN 'geen_email'
    WHEN k.afgemeld_op IS NOT NULL OR opt.hit THEN 'afgemeld'
    WHEN (SELECT s.skip_natural_persons FROM public.outreach_settings s LIMIT 1)
         AND k.rechtsvorm ~* '(eenmanszaak|onder firma|v\.?o\.?f|maatschap|commanditaire)' THEN 'natuurlijk_persoon'
    ELSE 'mailbaar'
  END AS mail_status
FROM public.restaurants r
CROSS JOIN (SELECT public.visibility_menu_minimum() AS m) mm
LEFT JOIN public.cities ci ON ci.id = r.city_id
LEFT JOIN public.restaurants_verborgen v ON v.id = r.id
LEFT JOIN public.restaurant_contacts k ON k.restaurant_id = r.id
LEFT JOIN LATERAL (
  SELECT count(*) AS n FROM public.restaurant_dishes rd
  WHERE rd.restaurant_id = r.id AND rd.status IN ('approved_by_admin', 'verified_by_owner')
    AND coalesce(rd.course_type::text, '') <> 'drank'
) d ON true
LEFT JOIN LATERAL (
  SELECT true AS hit FROM public.restaurant_optout_requests x
  WHERE x.restaurant_id = r.id OR (k.email IS NOT NULL AND lower(x.email) = lower(k.email))
  LIMIT 1
) opt ON true;

REVOKE ALL ON public.outreach_targets FROM anon;
GRANT SELECT ON public.outreach_targets TO authenticated;

-- One-click unsubscribe by token (link in every outreach mail). Safe for anon:
-- it only flips the opt-out for the matching contact and returns the restaurant name.
CREATE OR REPLACE FUNCTION public.outreach_unsubscribe(p_token text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_name text;
BEGIN
  IF p_token IS NULL OR length(p_token) < 16 THEN RETURN NULL; END IF;
  UPDATE public.restaurant_contacts k
     SET afgemeld_op = coalesce(k.afgemeld_op, now()), updated_at = now()
   WHERE k.afmeld_token::text = p_token
  RETURNING (SELECT name FROM public.restaurants WHERE id = k.restaurant_id) INTO v_name;
  RETURN v_name;
END $$;
REVOKE ALL ON FUNCTION public.outreach_unsubscribe(text) FROM public;
GRANT EXECUTE ON FUNCTION public.outreach_unsubscribe(text) TO anon, authenticated;

-- Weekdays, every hour 09:00 to 16:00 Amsterdam (08:00 to 15:00 UTC in winter).
-- The function itself does nothing while outreach_settings.enabled = false.
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'outreach-send-wave';
SELECT cron.schedule(
  'outreach-send-wave',
  '0 8-15 * * 1-5',
  $cron$
  SELECT net.http_post(
    url := 'https://uktafmxojymsojqewzuy.supabase.co/functions/v1/outreach-send-wave',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT secret FROM public.internal_job_secrets WHERE name = 'cron')
    ),
    body := '{"mode":"cron"}'::jsonb
  );
  $cron$
);
