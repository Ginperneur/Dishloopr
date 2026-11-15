-- restaurant_positions(): every dish x city page a restaurant appears on, with its position.
-- The previous version only returned hub pages (e.g. biefstuk): for a page whose dish has no
-- dish_group, is_hub was NULL instead of false, so `NOT is_hub` dropped every ordinary page and an
-- owner with dishes on the shrimp or mussels page could only pick one page for Uitgelicht. This version uses the same matching as
-- the dish page itself (seoLandingLoader): a hub page lists dishes by dish_group, any other page by
-- canonical_slug. The order is unchanged and must stay
-- identical to compareLandingOrder: featured, top listing, rating, id. Up to 50 pages.
-- Idempotent on purpose (Lovable may apply it under another number, or twice).
CREATE OR REPLACE FUNCTION public.restaurant_positions(p_slug text)
RETURNS TABLE(page_slug text, dish_name text, "position" integer, total integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
WITH r AS (
  SELECT id, city_id, coalesce(is_featured, false) f, coalesce(is_top_listing, false) t, coalesce(rating, 0) rt
  FROM restaurants WHERE slug = p_slug AND is_active = true LIMIT 1
), own AS (
  SELECT DISTINCT d.canonical_slug AS canon, d.dish_group
  FROM restaurant_dishes rd JOIN dishes d ON d.id = rd.dish_id JOIN r ON r.id = rd.restaurant_id
  WHERE rd.status IN ('approved_by_admin', 'verified_by_owner')
), pages AS (
  SELECT p.slug AS page_slug, d.name AS dish_name, p.city_id,
         coalesce(d.canonical_slug, d.slug) AS canon,
         coalesce(coalesce(d.canonical_slug, d.slug) = d.dish_group, false) AS is_hub
  FROM seo_landing_pages p
  JOIN dishes d ON d.id = p.dish_id
  JOIN r ON r.city_id = p.city_id
  WHERE p.is_active = true AND p.slug NOT LIKE 'gerecht-%'
    AND (d.canonical_slug IS NULL OR d.canonical_slug = d.slug)
), mine AS (
  SELECT pg.* FROM pages pg
  WHERE (pg.is_hub AND EXISTS (SELECT 1 FROM own o WHERE o.dish_group = pg.canon))
     OR (NOT pg.is_hub AND EXISTS (SELECT 1 FROM own o WHERE o.canon = pg.canon))
), comp AS (
  SELECT pg.page_slug, pg.dish_name, x.id, x.f, x.t, x.rt
  FROM mine pg
  JOIN LATERAL (
    SELECT DISTINCT rs.id, coalesce(rs.is_featured, false) f, coalesce(rs.is_top_listing, false) t, coalesce(rs.rating, 0) rt
    FROM restaurant_dishes rd
    JOIN dishes dd ON dd.id = rd.dish_id
    JOIN restaurants rs ON rs.id = rd.restaurant_id AND rs.city_id = pg.city_id AND rs.is_active = true
    WHERE rd.status IN ('approved_by_admin', 'verified_by_owner')
      AND ((pg.is_hub AND dd.dish_group = pg.canon) OR (NOT pg.is_hub AND dd.canonical_slug = pg.canon))
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
LIMIT 50;
$$;
REVOKE ALL ON FUNCTION public.restaurant_positions(text) FROM public;
GRANT EXECUTE ON FUNCTION public.restaurant_positions(text) TO anon, authenticated, service_role;
