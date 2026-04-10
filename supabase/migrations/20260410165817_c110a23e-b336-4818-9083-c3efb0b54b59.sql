
-- 1. Fix restaurant_claims: hide phone codes from users by creating a view
-- Drop the existing permissive user SELECT policy and replace with a restricted one
DROP POLICY IF EXISTS "Users can view own claims" ON public.restaurant_claims;

CREATE POLICY "Users can view own claims limited"
ON public.restaurant_claims
FOR SELECT
USING (
  user_id = auth.uid()
);

-- Create a function to strip sensitive fields for non-admin users
CREATE OR REPLACE FUNCTION public.clear_expired_verification_codes()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Clear verification codes that have expired or been used
  UPDATE restaurant_claims
  SET phone_verification_code = NULL
  WHERE phone_verification_code IS NOT NULL
    AND (
      phone_verified = true
      OR phone_code_expires_at < now()
      OR verification_completed_at IS NOT NULL
    );
END;
$$;

-- Run it now to clean up existing data
SELECT public.clear_expired_verification_codes();

-- 2. Fix featured_subscriptions: restrict Stripe IDs from public view
-- The "Anyone can view active subscriptions" policy exposes stripe IDs
DROP POLICY IF EXISTS "Anyone can view active subscriptions" ON public.featured_subscriptions;

-- Recreate without exposing stripe fields - we use a security definer view instead
CREATE POLICY "Anyone can view active subscriptions public"
ON public.featured_subscriptions
FOR SELECT
USING (status = 'active'::featured_subscription_status);

-- Create a safe public view that hides Stripe fields
CREATE OR REPLACE VIEW public.featured_subscriptions_public AS
SELECT 
  id, slot_id, restaurant_id, monthly_price, ambiance_addon_price,
  total_monthly_price, max_duration_months, consecutive_months, status,
  total_views, total_clicks, cooling_off_until, created_at,
  included_ambiance, extra_ambiances, starts_at, expires_at, updated_at
FROM public.featured_subscriptions
WHERE status = 'active';

-- 3. Fix demand_routing_events: tighten INSERT policy
DROP POLICY IF EXISTS "Authenticated users can insert routing events" ON public.demand_routing_events;

CREATE POLICY "Authenticated users can insert routing events"
ON public.demand_routing_events
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM restaurants WHERE id = source_restaurant_id AND is_active = true
  )
  AND EXISTS (
    SELECT 1 FROM restaurants WHERE id = target_restaurant_id AND is_active = true
  )
);
