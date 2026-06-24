
ALTER TABLE public.restaurants_backup_20260624 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.restaurants_backup_20260624 FROM anon, authenticated;
GRANT ALL ON public.restaurants_backup_20260624 TO service_role;
DROP POLICY IF EXISTS "Admins can view restaurants backup" ON public.restaurants_backup_20260624;
CREATE POLICY "Admins can view restaurants backup"
  ON public.restaurants_backup_20260624
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));
