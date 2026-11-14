-- A newsletter placement can carry one photo. Owners upload it to their own folder in the
-- restaurant-images bucket (existing storage policies); create-newsletter-checkout only accepts a
-- URL from that folder, and this check keeps the column to Dishloopr storage as well.
-- Idempotent on purpose (Lovable may apply it under another number, or twice).
ALTER TABLE public.newsletter_placements ADD COLUMN IF NOT EXISTS image_url text;
ALTER TABLE public.newsletter_placements DROP CONSTRAINT IF EXISTS newsletter_placements_image_url_check;
ALTER TABLE public.newsletter_placements ADD CONSTRAINT newsletter_placements_image_url_check
  CHECK (image_url IS NULL OR image_url ~ '^https://[a-z0-9]+\.supabase\.co/storage/v1/object/public/restaurant-images/[0-9a-f-]{36}/[A-Za-z0-9/_.-]+$');
