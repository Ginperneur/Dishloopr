-- Outreach: a send run every 20 minutes instead of every hour.
--
-- One run sends about 100 mails before it stops itself (time budget in outreach-send-wave), so 8 hourly
-- runs capped outreach at about 800 a day. 24 runs on weekdays 09:00 to 16:40 Amsterdam (08:00 to 15:40
-- UTC in winter) allow 2,000 a day; outreach_settings.daily_cap and batch_size still decide how many go out.
-- Idempotent: unschedules the old job before scheduling again.

SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'outreach-send-wave';
SELECT cron.schedule(
  'outreach-send-wave',
  '*/20 8-15 * * 1-5',
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
