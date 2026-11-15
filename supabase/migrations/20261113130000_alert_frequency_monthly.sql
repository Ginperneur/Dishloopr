-- Funnel alerts: free owners get them monthly, Owner Pro can choose daily, weekly or monthly.
-- The send function enforces the plan; this only allows the new value.
ALTER TABLE public.owner_email_preferences
  DROP CONSTRAINT IF EXISTS owner_email_prefs_freq_check;
ALTER TABLE public.owner_email_preferences
  ADD CONSTRAINT owner_email_prefs_freq_check
  CHECK (anomaly_alert_frequency IN ('daily', 'weekly', 'monthly'));
