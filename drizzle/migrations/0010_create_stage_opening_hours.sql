CREATE TABLE IF NOT EXISTS public.stage_opening_hours (
  restaurant_id uuid,
  opening_hours jsonb
);
GRANT ALL ON public.stage_opening_hours TO service_role;
ALTER TABLE public.stage_opening_hours ENABLE ROW LEVEL SECURITY;