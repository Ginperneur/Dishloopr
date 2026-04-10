
-- Fix the SECURITY DEFINER view warning by recreating as SECURITY INVOKER
CREATE OR REPLACE VIEW public.featured_subscriptions_public
WITH (security_invoker = true)
AS
SELECT 
  id, slot_id, restaurant_id, monthly_price, ambiance_addon_price,
  total_monthly_price, max_duration_months, consecutive_months, status,
  total_views, total_clicks, cooling_off_until, created_at,
  included_ambiance, extra_ambiances, starts_at, expires_at, updated_at
FROM public.featured_subscriptions
WHERE status = 'active';
