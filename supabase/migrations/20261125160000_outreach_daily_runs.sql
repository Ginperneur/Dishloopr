-- Outreach: send runs every 20 minutes on every day of the week, not only on weekdays.
--
-- All owners with an address should be mailed before the launch on 1 December. Spreading that over five days
-- (Thursday to Monday) keeps the daily volume rising gradually instead of jumping to over 2,000 a day.
-- outreach_settings.enabled, daily_cap and batch_size still decide whether and how many mails go out.
-- Idempotent: unschedules the old job before scheduling again.

SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'outreach-send-wave';
SELECT cron.schedule(
  'outreach-send-wave',
  '*/20 8-15 * * *',
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
