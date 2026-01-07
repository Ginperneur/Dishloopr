-- Create storage bucket for restaurant images
INSERT INTO storage.buckets (id, name, public) 
VALUES ('restaurant-images', 'restaurant-images', true)
ON CONFLICT (id) DO NOTHING;

-- Create RLS policies for restaurant images bucket
CREATE POLICY "Anyone can view restaurant images"
ON storage.objects FOR SELECT
USING (bucket_id = 'restaurant-images');

CREATE POLICY "Admins can upload restaurant images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'restaurant-images' 
  AND has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins can update restaurant images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'restaurant-images' 
  AND has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins can delete restaurant images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'restaurant-images' 
  AND has_role(auth.uid(), 'admin'::app_role)
);