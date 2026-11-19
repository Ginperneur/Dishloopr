CREATE TABLE IF NOT EXISTS public.cuisine_dishes (cuisine text NOT NULL, dish_slug text NOT NULL, PRIMARY KEY (cuisine, dish_slug));
GRANT SELECT ON public.cuisine_dishes TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.cuisine_dishes TO authenticated;
GRANT ALL ON public.cuisine_dishes TO service_role;
ALTER TABLE public.cuisine_dishes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read cuisine dishes" ON public.cuisine_dishes;
CREATE POLICY "Anyone can read cuisine dishes" ON public.cuisine_dishes FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins manage cuisine dishes" ON public.cuisine_dishes;
CREATE POLICY "Admins manage cuisine dishes" ON public.cuisine_dishes FOR ALL USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));