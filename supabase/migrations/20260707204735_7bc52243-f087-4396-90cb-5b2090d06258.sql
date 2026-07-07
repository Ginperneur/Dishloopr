
CREATE TABLE IF NOT EXISTS public.restaurants_backup_fase4 AS
SELECT id, price_level, ambience_tags, meal_types FROM public.restaurants;
GRANT ALL ON public.restaurants_backup_fase4 TO service_role;
ALTER TABLE public.restaurants_backup_fase4 ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS price_source text;
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS tag_source text;
