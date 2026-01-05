-- Add concepts column to restaurants table
ALTER TABLE public.restaurants 
ADD COLUMN concepts text[] DEFAULT '{}'::text[];