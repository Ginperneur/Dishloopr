-- Signals for ordering restaurants when browsing a city (src/lib/browseOrder.ts): how full the menu is,
-- how much of it has prices, and whether the owner maintains it. Public data (restaurant_dishes is
-- readable by everyone); one grouped read instead of thousands of dish rows. Idempotent.
CREATE OR REPLACE FUNCTION public.restaurant_listing_signals(p_ids uuid[])
RETURNS TABLE (restaurant_id uuid, food_dishes integer, priced_dishes integer, owner_dishes integer, menu_updated_at timestamptz)
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT rd.restaurant_id,
         count(*) FILTER (WHERE rd.course_type IS DISTINCT FROM 'drank')::integer,
         count(*) FILTER (WHERE rd.course_type IS DISTINCT FROM 'drank' AND rd.price IS NOT NULL)::integer,
         count(*) FILTER (WHERE rd.status = 'verified_by_owner')::integer,
         max(rd.updated_at)
    FROM public.restaurant_dishes rd
   WHERE rd.restaurant_id = ANY (p_ids)
     AND rd.status IN ('approved_by_admin', 'verified_by_owner')
   GROUP BY rd.restaurant_id
$$;

GRANT EXECUTE ON FUNCTION public.restaurant_listing_signals(uuid[]) TO anon, authenticated;
