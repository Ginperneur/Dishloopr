-- Allow verified restaurant owners to upload images to their restaurant folder
CREATE POLICY "Owners can upload restaurant images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'restaurant-images'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] IN (
    SELECT r.id::text FROM public.restaurants r
    WHERE r.claimed_by_owner_id = auth.uid()
    AND r.claim_status = 'verified_owner'
  )
);

-- Allow verified owners to delete their restaurant images
CREATE POLICY "Owners can delete restaurant images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'restaurant-images'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] IN (
    SELECT r.id::text FROM public.restaurants r
    WHERE r.claimed_by_owner_id = auth.uid()
    AND r.claim_status = 'verified_owner'
  )
);
