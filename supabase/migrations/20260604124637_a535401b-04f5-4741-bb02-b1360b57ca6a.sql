
CREATE TABLE public.rate_limit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier text NOT NULL,
  function_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_rate_limit_lookup ON public.rate_limit_log (function_name, identifier, created_at DESC);
CREATE INDEX idx_rate_limit_cleanup ON public.rate_limit_log (created_at);

GRANT ALL ON public.rate_limit_log TO service_role;
ALTER TABLE public.rate_limit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_only" ON public.rate_limit_log FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "admin_can_read" ON public.rate_limit_log FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.check_and_log_rate_limit(
  p_identifier text,
  p_function text,
  p_max int,
  p_window_seconds int
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int;
BEGIN
  SELECT count(*) INTO v_count
  FROM public.rate_limit_log
  WHERE function_name = p_function
    AND identifier = p_identifier
    AND created_at > now() - (p_window_seconds || ' seconds')::interval;

  IF v_count >= p_max THEN
    RETURN jsonb_build_object('allowed', false, 'count', v_count, 'limit', p_max, 'retry_after', p_window_seconds);
  END IF;

  INSERT INTO public.rate_limit_log (identifier, function_name)
  VALUES (p_identifier, p_function);

  RETURN jsonb_build_object('allowed', true, 'count', v_count + 1, 'limit', p_max);
END;
$$;

CREATE OR REPLACE FUNCTION public.cleanup_rate_limit_log() RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted int;
BEGIN
  DELETE FROM public.rate_limit_log WHERE created_at < now() - interval '24 hours';
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

INSERT INTO public.app_settings (key, value)
VALUES ('rate_limiting_enabled', 'true'::jsonb),
       ('ai_features_enabled', 'true'::jsonb)
ON CONFLICT (key) DO NOTHING;
