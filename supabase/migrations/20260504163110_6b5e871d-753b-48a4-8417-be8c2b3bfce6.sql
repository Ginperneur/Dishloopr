CREATE TABLE IF NOT EXISTS public.error_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NULL,
  message text NOT NULL,
  stack text NULL,
  component_stack text NULL,
  route text NULL,
  user_agent text NULL,
  app_version text NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_error_logs_created_at ON public.error_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_logs_route ON public.error_logs (route);

ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY;

-- Anyone (anon or authenticated) can insert a crash report
CREATE POLICY "Anyone can report errors"
ON public.error_logs
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Only admins/moderators can read
CREATE POLICY "Mods and admins can view error logs"
ON public.error_logs
FOR SELECT
TO authenticated
USING (public.is_moderator_or_admin(auth.uid()));

-- Only admins can delete
CREATE POLICY "Admins can delete error logs"
ON public.error_logs
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));