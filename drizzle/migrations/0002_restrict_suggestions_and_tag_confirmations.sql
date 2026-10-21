DROP POLICY IF EXISTS "Anyone can view tag confirmations" ON public.tag_confirmations;
CREATE POLICY "Users can view own tag confirmations" ON public.tag_confirmations FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Anyone can submit suggestions" ON public.restaurant_suggestions;
CREATE POLICY "Anyone can submit suggestions" ON public.restaurant_suggestions FOR INSERT TO anon, authenticated
  WITH CHECK (
    status = 'pending'
    AND admin_notes IS NULL AND reviewed_by IS NULL AND reviewed_at IS NULL
    AND (suggested_by IS NULL OR suggested_by = auth.uid())
    AND length(coalesce(name,'')) BETWEEN 1 AND 200
    AND length(coalesce(notes,'')) <= 2000
  );