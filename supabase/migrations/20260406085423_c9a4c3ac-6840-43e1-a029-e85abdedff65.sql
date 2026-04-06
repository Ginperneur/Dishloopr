
-- Fix overly permissive SELECT policy on newsletter_subscribers
DROP POLICY IF EXISTS "Users can view own subscription" ON public.newsletter_subscribers;

CREATE POLICY "Users can view own subscription"
ON public.newsletter_subscribers
FOR SELECT
USING (
  (user_id = auth.uid())
  OR has_role(auth.uid(), 'admin'::app_role)
);
