ALTER TABLE IF EXISTS public.restaurants_buitenland_backup_20261023 ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.restaurants_geo_backup_20261023 ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view other badges" ON public.user_badges;