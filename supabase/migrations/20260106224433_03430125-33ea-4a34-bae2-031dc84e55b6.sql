-- Drop the overly permissive app_settings SELECT policy
-- Service role bypasses RLS automatically, so this policy is unnecessary
-- and was exposing settings to unauthenticated users
DROP POLICY IF EXISTS "Service role can read settings" ON public.app_settings;

-- Add a proper policy that only allows admins to read settings
CREATE POLICY "Admins can read settings"
ON public.app_settings FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));