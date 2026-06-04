
ALTER TABLE public.owner_email_preferences
  ADD COLUMN IF NOT EXISTS anomaly_alerts boolean NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS public.owner_anomaly_alerts_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  metric text NOT NULL,
  severity text NOT NULL,
  delta_pct numeric,
  week_start date NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (restaurant_id, metric, week_start)
);

GRANT SELECT ON public.owner_anomaly_alerts_log TO authenticated;
GRANT ALL ON public.owner_anomaly_alerts_log TO service_role;

ALTER TABLE public.owner_anomaly_alerts_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners view own alert log"
  ON public.owner_anomaly_alerts_log
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins view all alert log"
  ON public.owner_anomaly_alerts_log
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_owner_anomaly_alerts_user ON public.owner_anomaly_alerts_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_owner_anomaly_alerts_restaurant ON public.owner_anomaly_alerts_log(restaurant_id, created_at DESC);
