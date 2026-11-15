ALTER TABLE public.restaurant_pending_edits ADD COLUMN IF NOT EXISTS checked_at timestamptz;
ALTER TABLE public.newsletter_placements ADD COLUMN IF NOT EXISTS checked_at timestamptz;

CREATE OR REPLACE FUNCTION public.admin_digest()
RETURNS TABLE (key text, label text, section text, open_count int, new_24h int, oldest_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH q(key, label, section, created) AS (
    SELECT 'claims', 'Claims die op goedkeuring wachten', 'claims', created_at FROM public.restaurant_claims
      WHERE status IN ('pending', 'email_verified', 'phone_verified', 'pending_admin_review')
    UNION ALL SELECT 'claims', 'Claims die op goedkeuring wachten', 'claims', created_at FROM public.claim_requests WHERE status = 'pending'
    UNION ALL SELECT 'edits', 'Naam of beschrijving gewijzigd', 'edits', created_at FROM public.restaurant_pending_edits WHERE status = 'pending'
    UNION ALL SELECT 'contact', 'Contactberichten', 'contact', created_at FROM public.contact_messages WHERE status = 'nieuw'
    UNION ALL SELECT 'support', 'Supportchats die een mens vragen', 'support', created_at FROM public.support_conversations
      WHERE escalated AND resolved_at IS NULL
    UNION ALL SELECT 'outreach', 'Antwoorden op de mailgolf', 'outreach', received_at FROM public.outreach_replies WHERE status = 'te_beoordelen'
    UNION ALL SELECT 'newsletter', 'Nieuwsbriefplaatsingen te beoordelen', 'newsletter', created_at FROM public.newsletter_placements WHERE status = 'paid'
    UNION ALL SELECT 'menu_service', 'Menuservice te leveren', 'package-orders', created_at FROM public.package_orders
      WHERE package = 'menu_service' AND fulfillment_status IN ('todo', 'in_progress')
    UNION ALL SELECT 'tags', 'Tag-aanvragen', 'tag-requests', created_at FROM public.restaurant_tag_requests WHERE status = 'pending'
    UNION ALL SELECT 'suggestions', 'Nieuwe restaurants voorgesteld door gasten', 'suggestions', created_at FROM public.restaurant_suggestions WHERE status = 'pending'
    UNION ALL SELECT 'reviews', 'Reviews in moderatie', 'reviews', created_at FROM public.reviews WHERE status IN ('pending', 'flagged')
    UNION ALL SELECT 'dishes', 'Gerecht-suggesties', 'dish-approval', created_at FROM public.restaurant_dishes WHERE status = 'suggested'
  )
  SELECT key, min(label), min(section), count(*)::int,
         count(*) FILTER (WHERE created > now() - interval '24 hours')::int, min(created)
    FROM q GROUP BY key
$$;
REVOKE ALL ON FUNCTION public.admin_digest() FROM public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.apply_pending_edit(p_id uuid, p_decision text, p_note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE e public.restaurant_pending_edits;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Alleen admins' USING ERRCODE = '42501';
  END IF;
  IF p_decision NOT IN ('approved', 'auto_applied', 'rejected') THEN
    RAISE EXCEPTION 'Onbekende beslissing' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO e FROM public.restaurant_pending_edits WHERE id = p_id AND status = 'pending' FOR UPDATE;
  IF e.id IS NULL THEN RAISE EXCEPTION 'Wijziging niet gevonden of al verwerkt' USING ERRCODE = 'P0002'; END IF;
  IF p_decision <> 'rejected' THEN
    IF coalesce(trim(e.proposed_changes ->> 'name'), '') <> '' THEN
      UPDATE public.restaurants SET name = left(trim(e.proposed_changes ->> 'name'), 120), updated_at = now() WHERE id = e.restaurant_id;
    END IF;
    IF coalesce(trim(e.proposed_changes ->> 'description_nl'), '') <> '' THEN
      INSERT INTO public.restaurant_translations (restaurant_id, language_code, description)
        VALUES (e.restaurant_id, 'nl', left(trim(e.proposed_changes ->> 'description_nl'), 4000))
        ON CONFLICT (restaurant_id, language_code) DO UPDATE SET description = EXCLUDED.description, updated_at = now();
    END IF;
  END IF;
  UPDATE public.restaurant_pending_edits
     SET status = p_decision, reviewed_by = auth.uid(), reviewed_at = now(), review_notes = coalesce(p_note, review_notes), updated_at = now()
   WHERE id = p_id;
END $$;
REVOKE ALL ON FUNCTION public.apply_pending_edit(uuid, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.apply_pending_edit(uuid, text, text) TO authenticated;

DROP POLICY IF EXISTS "Admins read pending edits" ON public.restaurant_pending_edits;
CREATE POLICY "Admins read pending edits" ON public.restaurant_pending_edits FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::app_role));

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname IN ('admin-automation', 'admin-daily-digest');
    PERFORM cron.schedule('admin-automation', '15 * * * *', $cron$
      SELECT net.http_post(url := 'https://uktafmxojymsojqewzuy.supabase.co/functions/v1/admin-automation',
        headers := jsonb_build_object('Content-Type', 'application/json',
          'x-cron-secret', (SELECT secret FROM public.internal_job_secrets WHERE name = 'cron')),
        body := '{}'::jsonb);
    $cron$);
    PERFORM cron.schedule('admin-daily-digest', '0 6 * * *', $cron$
      SELECT net.http_post(url := 'https://uktafmxojymsojqewzuy.supabase.co/functions/v1/admin-daily-digest',
        headers := jsonb_build_object('Content-Type', 'application/json',
          'x-cron-secret', (SELECT secret FROM public.internal_job_secrets WHERE name = 'cron')),
        body := '{}'::jsonb);
    $cron$);
  END IF;
END $do$;