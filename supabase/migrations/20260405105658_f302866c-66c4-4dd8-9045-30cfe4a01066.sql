
ALTER TABLE public.restaurants 
ADD COLUMN IF NOT EXISTS is_fully_halal boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS is_fully_vegetarian boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS is_fully_vegan boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS accepts_reservations boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS has_delivery boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS has_takeaway boolean NOT NULL DEFAULT false;
