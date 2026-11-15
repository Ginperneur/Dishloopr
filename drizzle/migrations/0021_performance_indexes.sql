CREATE INDEX IF NOT EXISTS idx_search_logs_city_created
  ON public.search_logs (lower(city), created_at DESC);
CREATE INDEX IF NOT EXISTS idx_search_logs_created
  ON public.search_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reviews_restaurant_status_created
  ON public.reviews (restaurant_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_restaurant_dishes_dish_status
  ON public.restaurant_dishes (dish_id, status);
CREATE INDEX IF NOT EXISTS idx_restaurants_claimed_by_owner
  ON public.restaurants (claimed_by_owner_id)
  WHERE claimed_by_owner_id IS NOT NULL;
ANALYZE public.search_logs;
ANALYZE public.reviews;
ANALYZE public.restaurant_dishes;
ANALYZE public.restaurants;