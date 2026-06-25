
ALTER TABLE public.dishes ADD COLUMN IF NOT EXISTS canonical_slug text;
ALTER TABLE public.dishes ADD COLUMN IF NOT EXISTS course text;
CREATE INDEX IF NOT EXISTS idx_dishes_canonical_slug ON public.dishes(canonical_slug);
CREATE INDEX IF NOT EXISTS idx_dishes_course ON public.dishes(course);

CREATE TABLE IF NOT EXISTS public.dish_canonical_stage_20260625 (
  dish_slug text,
  dish_name text,
  restaurant_count integer,
  canonical_slug text,
  action text,
  course text
);
GRANT ALL ON public.dish_canonical_stage_20260625 TO service_role;
ALTER TABLE public.dish_canonical_stage_20260625 ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin manages dish canonical stage" ON public.dish_canonical_stage_20260625
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
