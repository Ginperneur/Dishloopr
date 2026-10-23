CREATE OR REPLACE FUNCTION public.public_package_links()
RETURNS TABLE(key text, url text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.key, s.value FROM app_settings s
  WHERE s.key IN ('founding_month_url','founding_year_url','menu_once_url','menu_month_url')
    AND s.value ~ '^https://[^\s"<>]+$';
$$;
REVOKE ALL ON FUNCTION public.public_package_links() FROM public;
GRANT EXECUTE ON FUNCTION public.public_package_links() TO anon, authenticated, service_role;

CREATE TABLE public.pro_waitlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  restaurant_id uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX pro_waitlist_email_unique ON public.pro_waitlist (lower(email));
GRANT INSERT ON public.pro_waitlist TO anon, authenticated;
GRANT SELECT ON public.pro_waitlist TO authenticated;
GRANT ALL ON public.pro_waitlist TO service_role;
ALTER TABLE public.pro_waitlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can join pro waitlist" ON public.pro_waitlist FOR INSERT TO anon, authenticated
  WITH CHECK (length(email) <= 255 AND email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$');
CREATE POLICY "Admins read pro waitlist" ON public.pro_waitlist FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));