-- Moderator + Admin shared management policies on moderation tables

-- restaurant_claims
DROP POLICY IF EXISTS "Mods and admins can manage all claims" ON public.restaurant_claims;
CREATE POLICY "Mods and admins can manage all claims"
ON public.restaurant_claims
FOR ALL
USING (public.is_moderator_or_admin(auth.uid()))
WITH CHECK (public.is_moderator_or_admin(auth.uid()));

-- claim_requests
DROP POLICY IF EXISTS "Mods and admins can manage claim requests" ON public.claim_requests;
CREATE POLICY "Mods and admins can manage claim requests"
ON public.claim_requests
FOR ALL
USING (public.is_moderator_or_admin(auth.uid()))
WITH CHECK (public.is_moderator_or_admin(auth.uid()));

-- restaurant_dishes
DROP POLICY IF EXISTS "Mods and admins can manage restaurant dishes" ON public.restaurant_dishes;
CREATE POLICY "Mods and admins can manage restaurant dishes"
ON public.restaurant_dishes
FOR ALL
USING (public.is_moderator_or_admin(auth.uid()))
WITH CHECK (public.is_moderator_or_admin(auth.uid()));

-- dishes (taxonomy)
DROP POLICY IF EXISTS "Mods and admins can manage dishes" ON public.dishes;
CREATE POLICY "Mods and admins can manage dishes"
ON public.dishes
FOR ALL
USING (public.is_moderator_or_admin(auth.uid()))
WITH CHECK (public.is_moderator_or_admin(auth.uid()));

-- reviews
DROP POLICY IF EXISTS "Mods and admins can manage all reviews" ON public.reviews;
CREATE POLICY "Mods and admins can manage all reviews"
ON public.reviews
FOR ALL
USING (public.is_moderator_or_admin(auth.uid()))
WITH CHECK (public.is_moderator_or_admin(auth.uid()));