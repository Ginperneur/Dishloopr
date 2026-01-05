-- Add dish-specific review linking and weighted scoring

-- Add dish_ratings table to store per-dish ratings from reviews
CREATE TABLE public.dish_ratings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  review_id UUID NOT NULL REFERENCES public.reviews(id) ON DELETE CASCADE,
  dish_id UUID NOT NULL REFERENCES public.dishes(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(review_id, dish_id)
);

-- Enable RLS
ALTER TABLE public.dish_ratings ENABLE ROW LEVEL SECURITY;

-- Anyone can view dish ratings
CREATE POLICY "Anyone can view dish ratings" 
ON public.dish_ratings 
FOR SELECT 
USING (true);

-- Users can create dish ratings through reviews
CREATE POLICY "Users can create dish ratings" 
ON public.dish_ratings 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM reviews 
    WHERE reviews.id = review_id AND reviews.user_id = auth.uid()
  )
);

-- Users can delete their own dish ratings
CREATE POLICY "Users can delete own dish ratings" 
ON public.dish_ratings 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM reviews 
    WHERE reviews.id = review_id AND reviews.user_id = auth.uid()
  )
);

-- Add indexes for performance
CREATE INDEX idx_dish_ratings_dish ON public.dish_ratings(dish_id);
CREATE INDEX idx_dish_ratings_review ON public.dish_ratings(review_id);

-- Create a view for weighted dish scores per restaurant
CREATE OR REPLACE VIEW public.restaurant_dish_scores AS
SELECT 
  rd.restaurant_id,
  rd.dish_id,
  d.name as dish_name,
  COUNT(dr.id) as review_count,
  -- Weighted average: recent reviews count more
  COALESCE(
    SUM(
      dr.rating * 
      -- Recency weight: reviews from last 30 days get 2x weight, last 90 days 1.5x
      CASE 
        WHEN dr.created_at > NOW() - INTERVAL '30 days' THEN 2.0
        WHEN dr.created_at > NOW() - INTERVAL '90 days' THEN 1.5
        ELSE 1.0
      END *
      -- Verified reviewer weight: verified reviews get 1.5x weight
      CASE WHEN r.is_verified THEN 1.5 ELSE 1.0 END
    ) / 
    NULLIF(SUM(
      CASE 
        WHEN dr.created_at > NOW() - INTERVAL '30 days' THEN 2.0
        WHEN dr.created_at > NOW() - INTERVAL '90 days' THEN 1.5
        ELSE 1.0
      END *
      CASE WHEN r.is_verified THEN 1.5 ELSE 1.0 END
    ), 0),
    0
  )::NUMERIC(3,2) as weighted_rating,
  -- Simple average for comparison
  COALESCE(AVG(dr.rating), 0)::NUMERIC(3,2) as simple_rating
FROM restaurant_dishes rd
JOIN dishes d ON d.id = rd.dish_id
LEFT JOIN dish_ratings dr ON dr.dish_id = rd.dish_id
LEFT JOIN reviews r ON r.id = dr.review_id AND r.restaurant_id = rd.restaurant_id AND r.status = 'published'
GROUP BY rd.restaurant_id, rd.dish_id, d.name;

-- Add tag_confirmations table for reviewer-validated tags
CREATE TABLE public.tag_confirmations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  tag TEXT NOT NULL,
  tag_type TEXT NOT NULL DEFAULT 'ambience', -- ambience, cuisine, concept
  user_id UUID NOT NULL,
  is_confirmed BOOLEAN NOT NULL DEFAULT true, -- true = confirms tag, false = disputes tag
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(restaurant_id, tag, tag_type, user_id)
);

-- Enable RLS
ALTER TABLE public.tag_confirmations ENABLE ROW LEVEL SECURITY;

-- Anyone can view tag confirmations
CREATE POLICY "Anyone can view tag confirmations" 
ON public.tag_confirmations 
FOR SELECT 
USING (true);

-- Authenticated users can add tag confirmations
CREATE POLICY "Authenticated users can confirm tags" 
ON public.tag_confirmations 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Users can update their own confirmations
CREATE POLICY "Users can update own confirmations" 
ON public.tag_confirmations 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Users can delete their own confirmations
CREATE POLICY "Users can delete own confirmations" 
ON public.tag_confirmations 
FOR DELETE 
USING (auth.uid() = user_id);

-- Add indexes
CREATE INDEX idx_tag_confirmations_restaurant ON public.tag_confirmations(restaurant_id);
CREATE INDEX idx_tag_confirmations_tag ON public.tag_confirmations(tag, tag_type);

-- Create view for tag validation scores
CREATE OR REPLACE VIEW public.restaurant_tag_scores AS
SELECT 
  restaurant_id,
  tag,
  tag_type,
  COUNT(*) FILTER (WHERE is_confirmed = true) as confirmations,
  COUNT(*) FILTER (WHERE is_confirmed = false) as disputes,
  COUNT(*) as total_votes,
  CASE 
    WHEN COUNT(*) = 0 THEN 0.5
    ELSE (COUNT(*) FILTER (WHERE is_confirmed = true))::NUMERIC / COUNT(*)
  END as confidence_score
FROM public.tag_confirmations
GROUP BY restaurant_id, tag, tag_type;