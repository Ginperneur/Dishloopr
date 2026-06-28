CREATE TABLE IF NOT EXISTS public.staging_screening_decisions (
  dish_slug text PRIMARY KEY,
  decision text,
  canonical_slug text,
  course text,
  score numeric,
  reason text
);
GRANT ALL ON public.staging_screening_decisions TO service_role;
ALTER TABLE public.staging_screening_decisions ENABLE ROW LEVEL SECURITY;