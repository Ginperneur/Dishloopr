-- Create storage bucket for menu PDFs
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('menus', 'menus', false, 20971520, ARRAY['application/pdf']);

-- RLS policies for menu uploads (admins only)
CREATE POLICY "Admins can upload menus"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'menus' AND
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Admins can view menus"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'menus' AND
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Admins can delete menus"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'menus' AND
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);