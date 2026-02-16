
-- Fix overly permissive RLS policy on verification_credits
DROP POLICY "Service role can manage credits" ON public.verification_credits;

-- Only allow inserts/updates via service role (edge functions), not via anon/authenticated
-- The service role bypasses RLS anyway, so we don't need an explicit policy for it.
-- Instead, add a policy so authenticated users can only view their own credits (already exists).
