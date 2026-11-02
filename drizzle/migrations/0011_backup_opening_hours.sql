CREATE TABLE IF NOT EXISTS public.restaurants_backup_openingstijden AS
  SELECT r.id, r.opening_hours FROM public.restaurants r JOIN public.stage_opening_hours s ON s.restaurant_id = r.id;
GRANT ALL ON public.restaurants_backup_openingstijden TO service_role;
ALTER TABLE public.restaurants_backup_openingstijden ENABLE ROW LEVEL SECURITY;