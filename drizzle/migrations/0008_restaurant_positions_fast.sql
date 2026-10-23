CREATE OR REPLACE FUNCTION public.restaurant_positions(p_slug text)
RETURNS TABLE(page_slug text, dish_name text, "position" integer, total integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
WITH r AS (
  SELECT id, city_id, coalesce(is_featured,false) f, coalesce(is_top_listing,false) t, coalesce(rating,0) rt
  FROM restaurants WHERE slug = p_slug AND is_active = true LIMIT 1
), own AS (
  SELECT DISTINCT d.canonical_slug, d.dish_group
  FROM restaurant_dishes rd JOIN dishes d ON d.id = rd.dish_id JOIN r ON r.id = rd.restaurant_id
  WHERE rd.status IN ('approved_by_admin','verified_by_owner')
), pages AS (
  SELECT p.slug AS page_slug, d.name AS dish_name, p.city_id,
         coalesce(d.canonical_slug, d.slug) AS canon,
         (coalesce(d.canonical_slug, d.slug) = d.dish_group) AS is_hub
  FROM seo_landing_pages p
  JOIN dishes d ON d.id = p.dish_id
  JOIN r ON r.city_id = p.city_id
  WHERE p.is_active = true AND p.slug NOT LIKE 'gerecht-%'
    AND (d.canonical_slug IS NULL OR d.canonical_slug = d.slug)
    AND (EXISTS (SELECT 1 FROM own o WHERE o.canonical_slug = coalesce(d.canonical_slug, d.slug))
      OR (coalesce(d.canonical_slug, d.slug) = d.dish_group
          AND EXISTS (SELECT 1 FROM own o WHERE o.dish_group = d.dish_group)))
), comp AS (
  SELECT pg.page_slug, pg.dish_name, x.id, x.f, x.t, x.rt
  FROM pages pg
  JOIN LATERAL (
    SELECT DISTINCT rs.id, coalesce(rs.is_featured,false) f, coalesce(rs.is_top_listing,false) t, coalesce(rs.rating,0) rt
    FROM dishes dd
    JOIN restaurant_dishes rd ON rd.dish_id = dd.id AND rd.status IN ('approved_by_admin','verified_by_owner')
    JOIN restaurants rs ON rs.id = rd.restaurant_id AND rs.city_id = pg.city_id AND rs.is_active = true
    WHERE (pg.is_hub AND dd.dish_group = pg.canon) OR (NOT pg.is_hub AND dd.canonical_slug = pg.canon)
  ) x ON true
)
SELECT c.page_slug, min(c.dish_name),
  (count(*) FILTER (WHERE (NOT r.f AND c.f) OR (c.f = r.f AND NOT r.t AND c.t)
     OR (c.f = r.f AND c.t = r.t AND (c.rt > r.rt OR (c.rt = r.rt AND c.id < r.id)))) + 1)::int,
  count(*)::int
FROM comp c, r
GROUP BY c.page_slug
HAVING bool_or(c.id = r.id)
ORDER BY 3, 4 DESC, 1
LIMIT 10;
$$;