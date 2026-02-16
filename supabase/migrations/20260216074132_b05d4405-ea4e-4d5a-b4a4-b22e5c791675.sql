
-- Drop the broken restrictive policies
DROP POLICY IF EXISTS "Admins can manage all managers" ON public.restaurant_managers;
DROP POLICY IF EXISTS "Managers can view their assignments" ON public.restaurant_managers;
DROP POLICY IF EXISTS "Primary owners can manage managers" ON public.restaurant_managers;

-- Recreate as PERMISSIVE policies
CREATE POLICY "Admins can manage all managers"
ON public.restaurant_managers
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Managers can view their assignments"
ON public.restaurant_managers
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Primary owners can manage managers"
ON public.restaurant_managers
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM restaurant_managers rm
    WHERE rm.restaurant_id = restaurant_managers.restaurant_id
    AND rm.user_id = auth.uid()
    AND rm.role = 'primary_owner'
  )
);
