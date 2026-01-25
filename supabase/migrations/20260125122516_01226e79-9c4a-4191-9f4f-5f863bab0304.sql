-- Add cooling_off_days column to featured_slots
ALTER TABLE public.featured_slots 
ADD COLUMN IF NOT EXISTS cooling_off_days INTEGER NOT NULL DEFAULT 30;