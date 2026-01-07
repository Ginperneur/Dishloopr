-- Create storage bucket for collection cover images
INSERT INTO storage.buckets (id, name, public)
VALUES ('collection-covers', 'collection-covers', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies for collection covers
CREATE POLICY "Collection covers are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'collection-covers');

CREATE POLICY "Admins can upload collection covers"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'collection-covers' 
  AND has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins can update collection covers"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'collection-covers' 
  AND has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins can delete collection covers"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'collection-covers' 
  AND has_role(auth.uid(), 'admin'::app_role)
);