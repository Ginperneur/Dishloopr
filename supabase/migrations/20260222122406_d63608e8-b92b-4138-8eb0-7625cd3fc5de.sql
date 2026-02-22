
-- Fix overly permissive policies on newsletter_subscribers
DROP POLICY "Anyone can subscribe to newsletter" ON public.newsletter_subscribers;
DROP POLICY "Users can update own subscription" ON public.newsletter_subscribers;

-- More restrictive insert: prevent abuse by requiring valid email format (basic)
CREATE POLICY "Anyone can subscribe to newsletter"
  ON public.newsletter_subscribers FOR INSERT
  WITH CHECK (email IS NOT NULL AND length(email) > 5);

-- Only allow updating if user is the subscriber (by user_id) or admin
CREATE POLICY "Users can update own subscription"
  ON public.newsletter_subscribers FOR UPDATE
  USING (
    user_id = auth.uid() 
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );
