
-- Create user_badges table for gamification
CREATE TABLE public.user_badges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  badge_type TEXT NOT NULL,
  badge_level INTEGER DEFAULT 1,
  progress INTEGER DEFAULT 0,
  target INTEGER NOT NULL,
  earned_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, badge_type)
);

-- Create user_stats table for tracking insights
CREATE TABLE public.user_stats (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
  cuisines_tried TEXT[] DEFAULT '{}',
  cities_visited TEXT[] DEFAULT '{}',
  total_restaurants_visited INTEGER DEFAULT 0,
  total_reviews_written INTEGER DEFAULT 0,
  favorite_cuisine TEXT,
  favorite_price_level INTEGER,
  first_review_date TIMESTAMP WITH TIME ZONE,
  streak_days INTEGER DEFAULT 0,
  last_activity_date DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create yearly_wrapped table for year overview data
CREATE TABLE public.yearly_wrapped (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  total_restaurants INTEGER DEFAULT 0,
  total_reviews INTEGER DEFAULT 0,
  total_cuisines INTEGER DEFAULT 0,
  cuisines_list TEXT[] DEFAULT '{}',
  cities_list TEXT[] DEFAULT '{}',
  top_cuisine TEXT,
  top_restaurant_id UUID REFERENCES public.restaurants(id),
  top_dish TEXT,
  total_photos INTEGER DEFAULT 0,
  foodie_personality TEXT,
  generated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, year)
);

-- Create early_adopter_perks table
CREATE TABLE public.user_perks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  perk_type TEXT NOT NULL,
  perk_code TEXT,
  discount_percent INTEGER,
  valid_until TIMESTAMP WITH TIME ZONE,
  is_redeemed BOOLEAN DEFAULT false,
  redeemed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, perk_type)
);

-- Enable RLS
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.yearly_wrapped ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_perks ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_badges
CREATE POLICY "Users can view own badges" ON public.user_badges
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view other badges" ON public.user_badges
FOR SELECT USING (true);

CREATE POLICY "System can manage badges" ON public.user_badges
FOR ALL USING (auth.uid() = user_id);

-- RLS policies for user_stats
CREATE POLICY "Users can view own stats" ON public.user_stats
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own stats" ON public.user_stats
FOR ALL USING (auth.uid() = user_id);

-- RLS policies for yearly_wrapped
CREATE POLICY "Users can view own wrapped" ON public.yearly_wrapped
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own wrapped" ON public.yearly_wrapped
FOR ALL USING (auth.uid() = user_id);

-- RLS policies for user_perks
CREATE POLICY "Users can view own perks" ON public.user_perks
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage perks" ON public.user_perks
FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Triggers for updated_at
CREATE TRIGGER update_user_badges_updated_at
BEFORE UPDATE ON public.user_badges
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_stats_updated_at
BEFORE UPDATE ON public.user_stats
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to update user stats when a review is created
CREATE OR REPLACE FUNCTION public.update_user_stats_on_review()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  restaurant_record RECORD;
  city_record RECORD;
BEGIN
  -- Get restaurant and city info
  SELECT r.*, c.name as city_name, c.id as city_uuid
  INTO restaurant_record
  FROM restaurants r
  JOIN cities c ON c.id = r.city_id
  WHERE r.id = NEW.restaurant_id;

  -- Upsert user_stats
  INSERT INTO user_stats (user_id, cuisines_tried, cities_visited, total_restaurants_visited, total_reviews_written, first_review_date, last_activity_date)
  VALUES (
    NEW.user_id,
    COALESCE(restaurant_record.cuisines, '{}'),
    ARRAY[restaurant_record.city_name],
    1,
    1,
    now(),
    CURRENT_DATE
  )
  ON CONFLICT (user_id) DO UPDATE SET
    cuisines_tried = (
      SELECT ARRAY(SELECT DISTINCT unnest(user_stats.cuisines_tried || COALESCE(restaurant_record.cuisines, '{}')))
    ),
    cities_visited = (
      SELECT ARRAY(SELECT DISTINCT unnest(user_stats.cities_visited || ARRAY[restaurant_record.city_name]))
    ),
    total_reviews_written = user_stats.total_reviews_written + 1,
    last_activity_date = CURRENT_DATE,
    updated_at = now();

  -- Check and update badges
  PERFORM update_user_badges(NEW.user_id);

  RETURN NEW;
END;
$$;

-- Function to update badges based on stats
CREATE OR REPLACE FUNCTION public.update_user_badges(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  stats_record RECORD;
  cuisine_count INTEGER;
  city_count INTEGER;
BEGIN
  SELECT * INTO stats_record FROM user_stats WHERE user_id = p_user_id;
  
  IF stats_record IS NULL THEN
    RETURN;
  END IF;

  cuisine_count := COALESCE(array_length(stats_record.cuisines_tried, 1), 0);
  city_count := COALESCE(array_length(stats_record.cities_visited, 1), 0);

  -- Cuisine Explorer badge
  INSERT INTO user_badges (user_id, badge_type, progress, target, earned_at)
  VALUES (p_user_id, 'cuisine_explorer', cuisine_count, 10, 
    CASE WHEN cuisine_count >= 10 THEN now() ELSE NULL END)
  ON CONFLICT (user_id, badge_type) DO UPDATE SET
    progress = cuisine_count,
    earned_at = CASE WHEN cuisine_count >= 10 AND user_badges.earned_at IS NULL THEN now() ELSE user_badges.earned_at END,
    updated_at = now();

  -- City Hopper badge
  INSERT INTO user_badges (user_id, badge_type, progress, target, earned_at)
  VALUES (p_user_id, 'city_hopper', city_count, 5,
    CASE WHEN city_count >= 5 THEN now() ELSE NULL END)
  ON CONFLICT (user_id, badge_type) DO UPDATE SET
    progress = city_count,
    earned_at = CASE WHEN city_count >= 5 AND user_badges.earned_at IS NULL THEN now() ELSE user_badges.earned_at END,
    updated_at = now();

  -- Review Master badge
  INSERT INTO user_badges (user_id, badge_type, progress, target, earned_at)
  VALUES (p_user_id, 'review_master', stats_record.total_reviews_written, 25,
    CASE WHEN stats_record.total_reviews_written >= 25 THEN now() ELSE NULL END)
  ON CONFLICT (user_id, badge_type) DO UPDATE SET
    progress = stats_record.total_reviews_written,
    earned_at = CASE WHEN stats_record.total_reviews_written >= 25 AND user_badges.earned_at IS NULL THEN now() ELSE user_badges.earned_at END,
    updated_at = now();

END;
$$;

-- Trigger to update stats when review is created
CREATE TRIGGER on_review_created_update_stats
AFTER INSERT ON public.reviews
FOR EACH ROW
WHEN (NEW.status = 'published')
EXECUTE FUNCTION public.update_user_stats_on_review();
