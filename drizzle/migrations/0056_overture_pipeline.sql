-- Unattended Overture pipeline (supabase/functions/overture-bulk, action "tick").
-- One switch row; pg_cron calls the tick every minute and the tick does nothing while it is off.
-- Idempotent: Lovable may renumber or re-run this migration.
CREATE TABLE IF NOT EXISTS public.overture_pipeline (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  enabled boolean NOT NULL DEFAULT false,
  per_tick integer NOT NULL DEFAULT 6 CHECK (per_tick BETWEEN 1 AND 12),
  last_tick_at timestamptz,
  last_result jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.overture_pipeline (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.overture_pipeline ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage overture pipeline" ON public.overture_pipeline;
CREATE POLICY "Admins manage overture pipeline" ON public.overture_pipeline FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'overture-pipeline';
    PERFORM cron.schedule('overture-pipeline', '* * * * *', $cron$
      SELECT net.http_post(url := 'https://uktafmxojymsojqewzuy.supabase.co/functions/v1/overture-bulk',
        headers := jsonb_build_object('Content-Type', 'application/json',
          'x-cron-secret', (SELECT secret FROM public.internal_job_secrets WHERE name = 'cron')),
        body := '{"action":"tick"}'::jsonb,
        timeout_milliseconds := 150000)
      WHERE EXISTS (SELECT 1 FROM public.overture_pipeline WHERE id = 1 AND enabled);
    $cron$);
  END IF;
END $do$;
