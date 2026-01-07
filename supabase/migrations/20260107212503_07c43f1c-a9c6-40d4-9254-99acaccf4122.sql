-- Add social media columns to restaurants table
ALTER TABLE public.restaurants 
ADD COLUMN IF NOT EXISTS instagram_url text,
ADD COLUMN IF NOT EXISTS tiktok_url text;