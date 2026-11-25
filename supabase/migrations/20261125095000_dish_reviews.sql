-- Reviews about one dish, about the restaurant, or both, plus optional part scores for the restaurant.
-- A guest now picks what the review is about. Dish ratings were already stored per review in
-- dish_ratings (review_id, dish_id, rating); a review that is only about dishes gets
-- about_restaurant = false, so it never counts towards the restaurant's own score. Its rating
-- column holds the average of its dish ratings, because reviews.rating is NOT NULL.
-- Idempotent on purpose (Lovable may apply it under another number, or twice).

ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS about_restaurant boolean NOT NULL DEFAULT true;
-- Optional part scores of a restaurant review: service, sfeer and prijs-kwaliteit (1 to 5).
ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS service_rating smallint,
  ADD COLUMN IF NOT EXISTS atmosphere_rating smallint,
  ADD COLUMN IF NOT EXISTS value_rating smallint;
ALTER TABLE public.reviews DROP CONSTRAINT IF EXISTS reviews_aspects_check;
ALTER TABLE public.reviews ADD CONSTRAINT reviews_aspects_check CHECK (
  (service_rating IS NULL OR service_rating BETWEEN 1 AND 5)
  AND (atmosphere_rating IS NULL OR atmosphere_rating BETWEEN 1 AND 5)
  AND (value_rating IS NULL OR value_rating BETWEEN 1 AND 5));
CREATE INDEX IF NOT EXISTS reviews_restaurant_published ON public.reviews (restaurant_id) WHERE status = 'published';

-- The author may also change what the review is about; the rest of 20261120100000_security_hardening.sql stays.
CREATE OR REPLACE FUNCTION public.guard_review_write()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v public.reviews;
BEGIN
  IF NOT public.guard_is_restricted_mod() THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.is_verified := false;
    NEW.owner_response := NULL;
    NEW.owner_response_at := NULL;
    RETURN NEW;
  END IF;
  v := OLD;
  IF auth.uid() IS NOT NULL AND auth.uid() = OLD.user_id THEN
    -- Author: content fields only.
    v.rating := NEW.rating; v.title := NEW.title; v.body := NEW.body; v.photos := NEW.photos;
    v.tag_votes := NEW.tag_votes; v.suggested_tags := NEW.suggested_tags; v.dishes_eaten := NEW.dishes_eaten;
    v.about_restaurant := NEW.about_restaurant; v.service_rating := NEW.service_rating;
    v.atmosphere_rating := NEW.atmosphere_rating; v.value_rating := NEW.value_rating;
  ELSE
    -- Restaurant owner: the response only.
    v.owner_response := NEW.owner_response; v.owner_response_at := NEW.owner_response_at;
  END IF;
  v.updated_at := NEW.updated_at;
  RETURN v;
END $$;
