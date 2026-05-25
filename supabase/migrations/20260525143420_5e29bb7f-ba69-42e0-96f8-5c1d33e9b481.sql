
-- 1. Owner tier on restaurants
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS owner_tier text NOT NULL DEFAULT 'basic'
  CHECK (owner_tier IN ('basic', 'pro'));

-- 2. Owner notifications
CREATE TABLE IF NOT EXISTS public.owner_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  restaurant_id uuid,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  link text,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_owner_notifications_user
  ON public.owner_notifications(user_id, is_read, created_at DESC);

ALTER TABLE public.owner_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view own notifications"
  ON public.owner_notifications FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Owners can update own notifications"
  ON public.owner_notifications FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Admins can manage all notifications"
  ON public.owner_notifications FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 3. Owner email preferences
CREATE TABLE IF NOT EXISTS public.owner_email_preferences (
  user_id uuid PRIMARY KEY,
  weekly_report boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.owner_email_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view own email prefs"
  ON public.owner_email_preferences FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Owners can upsert own email prefs"
  ON public.owner_email_preferences FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Owners can update own email prefs"
  ON public.owner_email_preferences FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view all email prefs"
  ON public.owner_email_preferences FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_owner_email_prefs_updated_at
  BEFORE UPDATE ON public.owner_email_preferences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
