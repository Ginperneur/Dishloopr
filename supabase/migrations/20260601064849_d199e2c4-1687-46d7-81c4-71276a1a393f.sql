
CREATE TABLE public.owner_pro_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  stripe_customer_id text,
  stripe_subscription_id text UNIQUE,
  stripe_price_id text,
  status text NOT NULL DEFAULT 'inactive',
  billing_interval text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_owner_pro_subs_user ON public.owner_pro_subscriptions(user_id);
CREATE INDEX idx_owner_pro_subs_status ON public.owner_pro_subscriptions(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.owner_pro_subscriptions TO authenticated;
GRANT ALL ON public.owner_pro_subscriptions TO service_role;

ALTER TABLE public.owner_pro_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own pro subscription"
ON public.owner_pro_subscriptions FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE TRIGGER trg_owner_pro_subs_updated_at
BEFORE UPDATE ON public.owner_pro_subscriptions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Helper: is user a Pro owner?
CREATE OR REPLACE FUNCTION public.is_owner_pro(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.owner_pro_subscriptions
    WHERE user_id = _user_id
      AND status = 'active'
      AND (current_period_end IS NULL OR current_period_end > now())
  );
$$;

-- Sync helper: flip all restaurants owned by a user to pro/basic based on active sub
CREATE OR REPLACE FUNCTION public.sync_owner_pro_restaurants(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_pro boolean;
BEGIN
  v_is_pro := public.is_owner_pro(_user_id);
  UPDATE public.restaurants r
  SET owner_tier = CASE WHEN v_is_pro THEN 'pro' ELSE 'basic' END
  WHERE r.id IN (
    SELECT rm.restaurant_id FROM public.restaurant_managers rm
    WHERE rm.user_id = _user_id AND rm.accepted_at IS NOT NULL
  );
END;
$$;
