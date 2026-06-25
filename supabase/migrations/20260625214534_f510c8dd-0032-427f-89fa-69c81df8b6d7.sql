CREATE TABLE public.suggested_decisions_stage_20260625 (
  dish_slug text,
  decision text,
  canonical_slug text,
  course text
);
GRANT ALL ON public.suggested_decisions_stage_20260625 TO service_role;
ALTER TABLE public.suggested_decisions_stage_20260625 ENABLE ROW LEVEL SECURITY;