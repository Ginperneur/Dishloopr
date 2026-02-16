
-- Allow verified restaurant owners to insert new dishes
CREATE POLICY "Verified owners can add dishes"
ON public.dishes FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.restaurants
    WHERE claimed_by_owner_id = auth.uid()
    AND claim_status = 'verified_owner'
  )
);
