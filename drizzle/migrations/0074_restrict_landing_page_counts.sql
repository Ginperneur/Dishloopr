DROP POLICY IF EXISTS "Anyone can read landing page counts" ON public.landing_page_counts;
REVOKE SELECT ON public.landing_page_counts FROM anon, authenticated;
GRANT ALL ON public.landing_page_counts TO service_role;