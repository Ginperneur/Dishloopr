-- Security fixes

-- 1) analytics_events: tighten INSERT so users can only attribute events to themselves (or anonymous)
DROP POLICY IF EXISTS "Authenticated users can insert events" ON public.analytics_events;
CREATE POLICY "Anyone can insert own events"
ON public.analytics_events
FOR INSERT
WITH CHECK (
  user_id IS NULL OR user_id = auth.uid()
);

-- 2) promo_code_redemptions: tighten INSERT so user_id must match auth user (or be NULL for anon)
DROP POLICY IF EXISTS "Anyone can redeem promo code" ON public.promo_code_redemptions;
CREATE POLICY "Anyone can redeem promo code"
ON public.promo_code_redemptions
FOR INSERT
WITH CHECK (
  user_id IS NULL OR user_id = auth.uid()
);

-- 3) user_badges: prevent users from self-awarding badges. Only server (SECURITY DEFINER functions
--    running as definer / service_role) may mutate; users keep SELECT on their own badges.
DROP POLICY IF EXISTS "System can manage badges" ON public.user_badges;
DROP POLICY IF EXISTS "Users can view own badges" ON public.user_badges;

CREATE POLICY "Users can view own badges"
ON public.user_badges
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage badges"
ON public.user_badges
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 4) Views without security_invoker leak the creator's privileges. Recreate the two affected
--    views with security_invoker=true so RLS of the querying user applies.
DROP VIEW IF EXISTS public.sponsored_purchases_public;
CREATE VIEW public.sponsored_purchases_public
WITH (security_invoker = true) AS
SELECT id, restaurant_id, product_id, is_active, expires_at, starts_at, created_at
FROM public.sponsored_purchases
WHERE is_active = true AND expires_at > now();

GRANT SELECT ON public.sponsored_purchases_public TO anon, authenticated;

DROP VIEW IF EXISTS public.featured_subscriptions_public;
CREATE VIEW public.featured_subscriptions_public
WITH (security_invoker = true) AS
SELECT id, restaurant_id, slot_id, status, starts_at, expires_at, monthly_price,
       consecutive_months, included_ambiance, extra_ambiances, total_views, total_clicks, created_at
FROM public.featured_subscriptions
WHERE status = 'active'::featured_subscription_status AND expires_at > now();

GRANT SELECT ON public.featured_subscriptions_public TO anon, authenticated;