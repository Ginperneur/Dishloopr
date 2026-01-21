-- Add is_signature field to restaurant_dishes to distinguish signature dishes from regular menu items
-- Signature dishes (is_signature = true) will appear in "Bekend om" section and boost search ranking
ALTER TABLE public.restaurant_dishes 
ADD COLUMN IF NOT EXISTS is_signature boolean NOT NULL DEFAULT false;

-- Create index for faster queries on signature dishes
CREATE INDEX IF NOT EXISTS idx_restaurant_dishes_signature 
ON public.restaurant_dishes(restaurant_id, is_signature) 
WHERE is_signature = true;

-- Add comment for documentation
COMMENT ON COLUMN public.restaurant_dishes.is_signature IS 'When true, this dish appears in the "Bekend om" section and provides extra search ranking points. Max 3-5 per restaurant.';