ALTER TABLE public.restaurants ADD COLUMN added_by_source text NOT NULL DEFAULT 'system';

COMMENT ON COLUMN public.restaurants.added_by_source IS 'Tracks who added the restaurant: system, admin, or owner';