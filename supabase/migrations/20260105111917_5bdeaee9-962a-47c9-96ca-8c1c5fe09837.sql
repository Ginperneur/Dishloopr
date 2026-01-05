-- Add zenchef_id column for Zenchef widget integration
ALTER TABLE public.restaurants 
ADD COLUMN zenchef_id TEXT DEFAULT NULL;

-- Add comment for clarity
COMMENT ON COLUMN public.restaurants.zenchef_id IS 'Zenchef restaurant ID for embedded booking widget';