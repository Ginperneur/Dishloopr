
ALTER TABLE public.restaurants 
ADD COLUMN IF NOT EXISTS google_rating numeric(2,1),
ADD COLUMN IF NOT EXISTS google_reviews_count integer DEFAULT 0;
