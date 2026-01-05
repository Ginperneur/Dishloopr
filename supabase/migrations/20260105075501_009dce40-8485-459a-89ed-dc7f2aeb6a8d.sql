-- Add verified status to reviews
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS is_verified boolean DEFAULT false;

-- Add reviewer stats to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS total_reviews integer DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS helpful_votes integer DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS reviewer_level text DEFAULT 'bronze';

-- Create function to calculate reviewer level
CREATE OR REPLACE FUNCTION public.calculate_reviewer_level(review_count integer, helpful_count integer)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  -- Platinum: 50+ reviews with 100+ helpful votes
  IF review_count >= 50 AND helpful_count >= 100 THEN
    RETURN 'platinum';
  -- Gold: 25+ reviews with 50+ helpful votes
  ELSIF review_count >= 25 AND helpful_count >= 50 THEN
    RETURN 'gold';
  -- Silver: 10+ reviews with 20+ helpful votes
  ELSIF review_count >= 10 AND helpful_count >= 20 THEN
    RETURN 'silver';
  -- Bronze: default
  ELSE
    RETURN 'bronze';
  END IF;
END;
$$;

-- Create function to update profile stats after review
CREATE OR REPLACE FUNCTION public.update_reviewer_stats()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  review_count integer;
  helpful_count integer;
  new_level text;
BEGIN
  -- Count total reviews for this user
  SELECT COUNT(*) INTO review_count
  FROM reviews
  WHERE user_id = COALESCE(NEW.user_id, OLD.user_id)
    AND status = 'published';
  
  -- Get helpful votes (from profiles, we'll track this separately)
  SELECT COALESCE(helpful_votes, 0) INTO helpful_count
  FROM profiles
  WHERE id = COALESCE(NEW.user_id, OLD.user_id);
  
  -- Calculate new level
  new_level := calculate_reviewer_level(review_count, helpful_count);
  
  -- Update profile
  UPDATE profiles
  SET total_reviews = review_count,
      reviewer_level = new_level,
      updated_at = now()
  WHERE id = COALESCE(NEW.user_id, OLD.user_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Create trigger for review changes
DROP TRIGGER IF EXISTS on_review_change ON reviews;
CREATE TRIGGER on_review_change
  AFTER INSERT OR UPDATE OR DELETE ON reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.update_reviewer_stats();

-- Create helpful_votes table for tracking
CREATE TABLE IF NOT EXISTS public.helpful_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid REFERENCES reviews(id) ON DELETE CASCADE NOT NULL,
  user_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  UNIQUE(review_id, user_id)
);

-- Enable RLS on helpful_votes
ALTER TABLE public.helpful_votes ENABLE ROW LEVEL SECURITY;

-- RLS policies for helpful_votes
CREATE POLICY "Users can vote on reviews"
ON public.helpful_votes
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove own votes"
ON public.helpful_votes
FOR DELETE
USING (auth.uid() = user_id);

CREATE POLICY "Anyone can view helpful votes"
ON public.helpful_votes
FOR SELECT
USING (true);

-- Function to update helpful count when vote is added/removed
CREATE OR REPLACE FUNCTION public.update_helpful_votes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  review_user_id uuid;
  vote_count integer;
  review_count integer;
  new_level text;
BEGIN
  -- Get the user_id of the review author
  SELECT user_id INTO review_user_id
  FROM reviews
  WHERE id = COALESCE(NEW.review_id, OLD.review_id);
  
  -- Count total helpful votes for this reviewer
  SELECT COUNT(*) INTO vote_count
  FROM helpful_votes hv
  JOIN reviews r ON r.id = hv.review_id
  WHERE r.user_id = review_user_id;
  
  -- Get review count
  SELECT COALESCE(total_reviews, 0) INTO review_count
  FROM profiles
  WHERE id = review_user_id;
  
  -- Calculate new level
  new_level := calculate_reviewer_level(review_count, vote_count);
  
  -- Update profile
  UPDATE profiles
  SET helpful_votes = vote_count,
      reviewer_level = new_level,
      updated_at = now()
  WHERE id = review_user_id;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Create trigger for helpful votes
DROP TRIGGER IF EXISTS on_helpful_vote_change ON helpful_votes;
CREATE TRIGGER on_helpful_vote_change
  AFTER INSERT OR DELETE ON helpful_votes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_helpful_votes();

-- Allow owners to update only owner_response fields on reviews for their restaurant
CREATE POLICY "Owners can respond to reviews on their restaurant"
ON public.reviews
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM restaurants
    WHERE restaurants.id = reviews.restaurant_id
      AND restaurants.claimed_by_owner_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM restaurants
    WHERE restaurants.id = reviews.restaurant_id
      AND restaurants.claimed_by_owner_id = auth.uid()
  )
);