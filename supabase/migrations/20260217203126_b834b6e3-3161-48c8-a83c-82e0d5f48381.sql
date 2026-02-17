
-- Add dietary_options array column to restaurants
ALTER TABLE public.restaurants ADD COLUMN dietary_options text[] DEFAULT '{}'::text[];

-- Create index for overlap queries
CREATE INDEX idx_restaurants_dietary_options ON public.restaurants USING GIN(dietary_options);
