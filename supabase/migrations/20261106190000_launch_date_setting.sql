-- The public launch date drives when Founding Partners start paying (their
-- Stripe trial ends on it). It used to be hard-coded in create-package-checkout,
-- so moving the launch would still have charged on the old date. It now lives in
-- app_settings; sync-launch-date moves every open trial when it changes (called
-- from the admin settings screen and once a day as a safety net).

INSERT INTO public.app_settings (key, value, description)
SELECT 'launch_date', '2026-12-10',
       'Publieke launch (JJJJ-MM-DD). Founding Partners betalen pas vanaf deze datum; bij wijzigen schuiven hun proefperiodes in Stripe automatisch mee.'
WHERE NOT EXISTS (SELECT 1 FROM public.app_settings WHERE key = 'launch_date');

CREATE OR REPLACE FUNCTION public.public_launch_date()
RETURNS date LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN value ~ '^\d{4}-\d{2}-\d{2}$' THEN value::date END
    FROM public.app_settings WHERE key = 'launch_date';
$$;
GRANT EXECUTE ON FUNCTION public.public_launch_date() TO anon, authenticated;

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'sync-launch-date';
SELECT cron.schedule(
  'sync-launch-date',
  '0 5 * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://uktafmxojymsojqewzuy.supabase.co/functions/v1/sync-launch-date',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT secret FROM public.internal_job_secrets WHERE name = 'cron')
    ),
    body := '{}'::jsonb
  );
  $cron$
);
