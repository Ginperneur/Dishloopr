ALTER TYPE public.verification_method ADD VALUE IF NOT EXISTS 'manual_proof';
CREATE POLICY "Users upload own claim proofs" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'claim-proofs' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users read own claim proofs" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'claim-proofs' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.has_role(auth.uid(), 'admin')));