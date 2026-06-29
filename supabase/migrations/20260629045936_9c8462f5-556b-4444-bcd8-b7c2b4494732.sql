CREATE TABLE IF NOT EXISTS public.staging_review_decisions (
  dish_slug text,
  decision text,
  canonical_slug text,
  course text,
  score numeric,
  reason text
);
GRANT ALL ON public.staging_review_decisions TO service_role;