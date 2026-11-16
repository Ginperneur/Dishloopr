-- Fix "high load" on Lovable Cloud: add indexes for the hottest unindexed reads.
-- All statements are idempotent (IF NOT EXISTS) and only add indexes; no data changes.

-- search_logs grows with every public search and had no index at all.
-- get_search_term_heatmap and owner_missed_demand filter on lower(city) + created_at window.
CREATE INDEX IF NOT EXISTS idx_search_logs_city_created
  ON public.search_logs (lower(city), created_at DESC);

-- search_log_report and admin SearchAnalytics order/filter by created_at only.
CREATE INDEX IF NOT EXISTS idx_search_logs_created
  ON public.search_logs (created_at DESC);

-- Public restaurant page reviews (restaurant_id + status, newest first) and
-- get_owner_historical_benchmark (restaurant_id + status + last 60 days).
CREATE INDEX IF NOT EXISTS idx_reviews_restaurant_status_created
  ON public.reviews (restaurant_id, status, created_at DESC);

-- Dish pillar and dish x city pages: restaurant_dishes by dish_id + status.
CREATE INDEX IF NOT EXISTS idx_restaurant_dishes_dish_status
  ON public.restaurant_dishes (dish_id, status);

-- Owner dashboard lookups and RLS checks on claimed restaurants.
CREATE INDEX IF NOT EXISTS idx_restaurants_claimed_by_owner
  ON public.restaurants (claimed_by_owner_id)
  WHERE claimed_by_owner_id IS NOT NULL;

ANALYZE public.search_logs;
ANALYZE public.reviews;
ANALYZE public.restaurant_dishes;
ANALYZE public.restaurants;
