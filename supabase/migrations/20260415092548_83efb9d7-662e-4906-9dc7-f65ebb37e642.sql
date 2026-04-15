CREATE OR REPLACE FUNCTION public.get_trending_dishes(dish_limit integer DEFAULT 8)
RETURNS TABLE(
  id uuid,
  name text,
  slug text,
  search_count integer,
  seasonal_tags text[],
  restaurant_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    d.id,
    d.name,
    d.slug,
    d.search_count,
    COALESCE(d.seasonal_tags, '{}'::text[]) as seasonal_tags,
    COUNT(rd.id) as restaurant_count
  FROM dishes d
  LEFT JOIN restaurant_dishes rd ON rd.dish_id = d.id 
    AND rd.status IN ('suggested', 'approved_by_admin', 'verified_by_owner')
  WHERE d.is_active = true
  GROUP BY d.id, d.name, d.slug, d.search_count, d.seasonal_tags
  HAVING COUNT(rd.id) > 0
  ORDER BY COUNT(rd.id) DESC, d.search_count DESC
  LIMIT dish_limit;
$$;