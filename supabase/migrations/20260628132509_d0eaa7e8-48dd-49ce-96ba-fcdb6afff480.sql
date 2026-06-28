
CREATE TABLE IF NOT EXISTS public.dishes_backup_20260628 AS TABLE public.dishes;
CREATE TABLE IF NOT EXISTS public.restaurant_dishes_backup_20260628 AS TABLE public.restaurant_dishes;

ALTER TABLE public.restaurant_dishes ADD COLUMN IF NOT EXISTS price numeric;

CREATE TABLE IF NOT EXISTS public.scraped_dishes_stage_20260628 (
  restaurant_id uuid,
  restaurant_name text,
  city text,
  dish_name text,
  dish_slug text,
  price numeric,
  source text
);
TRUNCATE public.scraped_dishes_stage_20260628;
GRANT ALL ON public.scraped_dishes_stage_20260628 TO service_role;
