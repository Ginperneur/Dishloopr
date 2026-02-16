-- Create a security definer function to check if user is primary owner
CREATE OR REPLACE FUNCTION public.is_primary_owner(_user_id uuid, _restaurant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.restaurant_managers
    WHERE user_id = _user_id
      AND restaurant_id = _restaurant_id
      AND role = 'primary_owner'::manager_role
  )
$$;

-- Drop the recursive policy
DROP POLICY IF EXISTS "Primary owners can manage managers" ON public.restaurant_managers;

-- Recreate without recursion
CREATE POLICY "Primary owners can manage managers"
ON public.restaurant_managers
FOR ALL
USING (public.is_primary_owner(auth.uid(), restaurant_id))
WITH CHECK (public.is_primary_owner(auth.uid(), restaurant_id));
