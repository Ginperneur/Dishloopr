
ALTER TABLE public.owner_email_preferences
  ADD COLUMN IF NOT EXISTS anomaly_alert_frequency text NOT NULL DEFAULT 'daily',
  ADD COLUMN IF NOT EXISTS anomaly_alert_severity text NOT NULL DEFAULT 'critical';

ALTER TABLE public.owner_email_preferences
  DROP CONSTRAINT IF EXISTS owner_email_prefs_freq_check;
ALTER TABLE public.owner_email_preferences
  ADD CONSTRAINT owner_email_prefs_freq_check
  CHECK (anomaly_alert_frequency IN ('daily','weekly'));

ALTER TABLE public.owner_email_preferences
  DROP CONSTRAINT IF EXISTS owner_email_prefs_sev_check;
ALTER TABLE public.owner_email_preferences
  ADD CONSTRAINT owner_email_prefs_sev_check
  CHECK (anomaly_alert_severity IN ('critical','critical_and_warning'));
