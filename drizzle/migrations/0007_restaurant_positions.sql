CREATE OR REPLACE FUNCTION public.restaurant_positions(p_slug text)
RETURNS TABLE(page_slug text, dish_name text, "position" integer, total integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
WITH r AS (
  SELECT id, city_id FROM restaurants WHERE slug = p_slug AND is_active = true LIMIT 1
), pages AS (
  SELECT p.slug AS page_slug, d.name AS dish_name, p.city_id,
         coalesce(d.canonical_slug, d.slug) AS canon,
         (coalesce(d.canonical_slug, d.slug) = d.dish_group) AS is_hub
  FROM seo_landing_pages p
  JOIN dishes d ON d.id = p.dish_id
  JOIN r ON r.city_id = p.city_id
  WHERE p.is_active = true
    AND p.slug NOT LIKE 'gerecht-%'
    AND (d.canonical_slug IS NULL OR d.canonical_slug = d.slug)
), ranked AS (
  SELECT pg.page_slug, pg.dish_name, x.id AS rid,
         row_number() OVER (PARTITION BY pg.page_slug ORDER BY x.is_featured DESC, x.is_top_listing DESC,
           coalesce(x.rating, 0) DESC, x.id ASC) AS pos,
         count(*) OVER (PARTITION BY pg.page_slug) AS tot
  FROM pages pg
  JOIN LATERAL (
    SELECT DISTINCT rs.id, coalesce(rs.is_featured,false) AS is_featured,
           coalesce(rs.is_top_listing,false) AS is_top_listing, rs.rating
    FROM restaurant_dishes rd
    JOIN dishes dd ON dd.id = rd.dish_id
    JOIN restaurants rs ON rs.id = rd.restaurant_id
    WHERE rs.city_id = pg.city_id AND rs.is_active = true
      AND rd.status IN ('approved_by_admin','verified_by_owner')
      AND (CASE WHEN pg.is_hub THEN dd.dish_group = pg.canon ELSE dd.canonical_slug = pg.canon END)
  ) x ON true
)
SELECT page_slug, dish_name, pos::int, tot::int
FROM ranked, r WHERE ranked.rid = r.id
ORDER BY pos, tot DESC, page_slug
LIMIT 10;
$$;
REVOKE ALL ON FUNCTION public.restaurant_positions(text) FROM public;
GRANT EXECUTE ON FUNCTION public.restaurant_positions(text) TO anon, authenticated, service_role;