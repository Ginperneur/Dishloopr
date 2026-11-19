-- Homepage "Uitgelicht in Nederland": shown only while the visitor has not chosen a city.
-- No separate product: it rotates restaurants that already pay for this week's Stadsspotlight
-- or hold a Topplek, at most one per city, so every card can name its own city. Order changes
-- daily. page_slug is 'spotlight' for a Stadsspotlight or the Topplek page, so impressions count in
-- the owner's report (track_paid_metrics). Idempotent so Lovable can re-run it after renumbering.

DROP FUNCTION IF EXISTS public.national_uitgelicht(int);

CREATE OR REPLACE FUNCTION public.national_uitgelicht(p_limit int DEFAULT 4)
RETURNS TABLE (restaurant_id uuid, city_id uuid, city_name text, page_slug text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH spotlight AS (
    SELECT b.restaurant_id, b.city_id, 'spotlight'::text AS page_slug, 0 AS rank_group, md5(b.id::text || current_date::text) AS k
      FROM public.spotlight_bookings b
      JOIN public.restaurants r ON r.id = b.restaurant_id AND r.is_active
     WHERE b.status = 'active' AND b.week_start = public.spotlight_week_start(current_date)
  ), toppleks AS (
    SELECT o.restaurant_id, p.city_id, p.slug AS page_slug, 1 AS rank_group, md5(o.restaurant_id::text || p.slug || current_date::text) AS k
      FROM public.package_orders o
      JOIN public.seo_landing_pages p ON p.slug = o.page_slug AND p.is_active
      JOIN public.restaurants r ON r.id = o.restaurant_id AND r.is_active
     WHERE o.package IN ('topplek', 'dominant') AND public.founding_partner_live(o.status)
       AND p.city_id IS NOT NULL
  ), one_per_city AS (
    SELECT DISTINCT ON (x.city_id) x.restaurant_id, x.city_id, x.page_slug, x.rank_group, x.k
      FROM (SELECT * FROM spotlight UNION ALL SELECT * FROM toppleks) x
     ORDER BY x.city_id, x.rank_group, x.k
  )
  SELECT c.restaurant_id, c.city_id, ci.name, c.page_slug
    FROM one_per_city c JOIN public.cities ci ON ci.id = c.city_id
   ORDER BY c.k
   LIMIT GREATEST(1, LEAST(p_limit, 8))
$$;

REVOKE ALL ON FUNCTION public.national_uitgelicht(int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.national_uitgelicht(int) TO anon, authenticated, service_role;
