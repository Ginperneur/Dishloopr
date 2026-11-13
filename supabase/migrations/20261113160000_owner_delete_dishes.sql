-- Owners could view, add and update their restaurant's dishes but had no DELETE policy, so
-- removing a dish silently affected 0 rows while the app said "Gerecht verwijderd".
DROP POLICY IF EXISTS "Owners can delete their dishes" ON public.restaurant_dishes;
CREATE POLICY "Owners can delete their dishes"
ON public.restaurant_dishes
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.restaurants r
    WHERE r.id = restaurant_dishes.restaurant_id
      AND r.claimed_by_owner_id = auth.uid()
      AND r.claim_status = 'verified_owner'
  )
);
