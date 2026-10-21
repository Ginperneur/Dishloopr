CREATE TABLE IF NOT EXISTS public.internal_job_secrets (
  name text PRIMARY KEY,
  secret text NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  created_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON public.internal_job_secrets FROM anon, authenticated;
GRANT ALL ON public.internal_job_secrets TO service_role;
ALTER TABLE public.internal_job_secrets ENABLE ROW LEVEL SECURITY;
INSERT INTO public.internal_job_secrets(name) VALUES ('cron') ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.verify_cron_secret(p_secret text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.internal_job_secrets WHERE name = 'cron' AND secret = p_secret AND length(coalesce(p_secret,'')) > 0);
$$;
REVOKE ALL ON FUNCTION public.verify_cron_secret(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_cron_secret(text) TO service_role;

CREATE OR REPLACE FUNCTION public.get_search_term_heatmap(p_restaurant_id uuid, p_days integer DEFAULT 30, p_limit integer DEFAULT 15)
 RETURNS TABLE(search_term text, hits bigint)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT
    LOWER(TRIM(COALESCE(metadata->>'search_term', metadata->>'query', metadata->>'term'))) AS search_term,
    COUNT(*) AS hits
  FROM public.analytics_events
  WHERE restaurant_id = p_restaurant_id
    AND (public.has_role(auth.uid(), 'admin') OR public.is_verified_owner(auth.uid(), p_restaurant_id) OR public.has_restaurant_access(auth.uid(), p_restaurant_id, 'viewer'))
    AND created_at >= now() - (p_days || ' days')::interval
    AND (metadata ? 'search_term' OR metadata ? 'query' OR metadata ? 'term')
  GROUP BY 1
  HAVING LOWER(TRIM(COALESCE(metadata->>'search_term', metadata->>'query', metadata->>'term'))) IS NOT NULL
  ORDER BY hits DESC
  LIMIT p_limit;
$function$;
REVOKE EXECUTE ON FUNCTION public.get_search_term_heatmap(uuid,integer,integer) FROM anon;

DROP POLICY IF EXISTS "Authenticated users can upload food photos" ON storage.objects;
CREATE POLICY "Authenticated users can upload food photos" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'food-photos' AND (storage.foldername(name))[1] = (select auth.uid()::text));
DROP POLICY IF EXISTS "Authenticated users can upload review photos" ON storage.objects;
CREATE POLICY "Authenticated users can upload review photos" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'review-photos' AND (storage.foldername(name))[1] = (select auth.uid()::text));