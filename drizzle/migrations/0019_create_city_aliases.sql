CREATE TABLE IF NOT EXISTS public.city_aliases (
  alias_name text PRIMARY KEY,
  city_id uuid NOT NULL REFERENCES public.cities(id)
);
GRANT SELECT ON public.city_aliases TO anon, authenticated;
GRANT ALL ON public.city_aliases TO service_role;
ALTER TABLE public.city_aliases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "City aliases are public" ON public.city_aliases FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins manage city aliases" ON public.city_aliases FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));