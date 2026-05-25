-- Provinces lookup
CREATE TABLE IF NOT EXISTS public.nl_provinces (
  slug text PRIMARY KEY,
  name text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.nl_provinces ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view provinces" ON public.nl_provinces;
CREATE POLICY "Anyone can view provinces"
  ON public.nl_provinces FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admins can manage provinces" ON public.nl_provinces;
CREATE POLICY "Admins can manage provinces"
  ON public.nl_provinces FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

INSERT INTO public.nl_provinces (slug, name) VALUES
  ('drenthe','Drenthe'),
  ('flevoland','Flevoland'),
  ('friesland','Friesland'),
  ('gelderland','Gelderland'),
  ('groningen','Groningen'),
  ('limburg','Limburg'),
  ('noord-brabant','Noord-Brabant'),
  ('noord-holland','Noord-Holland'),
  ('overijssel','Overijssel'),
  ('utrecht','Utrecht'),
  ('zeeland','Zeeland'),
  ('zuid-holland','Zuid-Holland')
ON CONFLICT (slug) DO NOTHING;

-- Province on cities
ALTER TABLE public.cities ADD COLUMN IF NOT EXISTS province text;

-- Newsletter placement scope
ALTER TABLE public.newsletter_placements
  ADD COLUMN IF NOT EXISTS scope text NOT NULL DEFAULT 'city';

ALTER TABLE public.newsletter_placements
  ADD COLUMN IF NOT EXISTS target_city_id uuid;

ALTER TABLE public.newsletter_placements
  ADD COLUMN IF NOT EXISTS target_province text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'newsletter_placements' AND constraint_name = 'newsletter_placements_scope_check'
  ) THEN
    ALTER TABLE public.newsletter_placements
      ADD CONSTRAINT newsletter_placements_scope_check
      CHECK (scope IN ('city','province','national'));
  END IF;
END $$;

-- Biweekly draft creator (called by cron)
CREATE OR REPLACE FUNCTION public.create_biweekly_newsletter_draft()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_last_at timestamptz;
  v_edition_id uuid;
  v_attached integer;
BEGIN
  -- Only proceed if at least 14 days have passed since the last draft/edition
  SELECT MAX(created_at) INTO v_last_at FROM public.newsletter_editions;

  IF v_last_at IS NOT NULL AND v_last_at > now() - interval '14 days' THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.newsletter_editions (title, intro_text, status)
  VALUES (
    'Dishloopr nieuwsbrief — ' || to_char(now(), 'DD Mon YYYY'),
    'Automatisch aangemaakte 2-wekelijkse editie. Voeg een intro toe voordat je verstuurt.',
    'draft'
  )
  RETURNING id INTO v_edition_id;

  -- Attach all paid placements that have no edition yet
  UPDATE public.newsletter_placements
  SET edition_id = v_edition_id, updated_at = now()
  WHERE status IN ('paid','approved')
    AND edition_id IS NULL;

  GET DIAGNOSTICS v_attached = ROW_COUNT;

  INSERT INTO public.admin_activity_logs (user_id, action_type, entity_type, entity_id, details)
  VALUES (
    COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid),
    'newsletter_auto_draft_created',
    'newsletter_editions',
    v_edition_id,
    jsonb_build_object('placements_attached', v_attached)
  );

  RETURN v_edition_id;
END;
$$;