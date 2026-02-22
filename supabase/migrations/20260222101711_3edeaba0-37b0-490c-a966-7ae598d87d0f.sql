-- Add has_terrace boolean to restaurants
ALTER TABLE public.restaurants ADD COLUMN has_terrace boolean NOT NULL DEFAULT false;

-- Allow owners to update this field (already covered by existing RLS policies on restaurants)