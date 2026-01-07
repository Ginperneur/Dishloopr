
-- Fix function search_path for update_claim_updated_at
CREATE OR REPLACE FUNCTION public.update_claim_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Fix overly permissive INSERT policy on claim_activity_logs
-- Currently allows any authenticated user to insert - should validate actor_id matches auth.uid()
DROP POLICY IF EXISTS "System can insert logs" ON public.claim_activity_logs;

CREATE POLICY "Authenticated users can insert own activity logs"
ON public.claim_activity_logs FOR INSERT
TO authenticated
WITH CHECK (actor_id = auth.uid());
