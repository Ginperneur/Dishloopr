-- Core dish pages that must exist in every city where enough restaurants serve the dish.
-- Every page is a place to rank and 5 Uitgelicht places to sell, so the dishes guests search
-- most (pizza, sushi, burger, steak, ramen, poke bowl, shoarma, ...) get a page per city as soon
-- as at least 3 restaurants there serve them. Matching follows the dish page itself: a hub dish
-- (pizza, sushi, pasta, hamburger, biefstuk) by dish_group, any other by canonical_slug.
-- Runs once now and every Sunday at 04:00 UTC, so pages appear as restaurants join.
-- Idempotent on purpose (Lovable may apply it under another number, or twice).

CREATE OR REPLACE FUNCTION public.core_landing_dish_slugs()
RETURNS text[] LANGUAGE sql IMMUTABLE AS $$
  SELECT ARRAY[
    -- hubs
    'pizza', 'sushi', 'pasta', 'hamburger', 'biefstuk',
    -- Asian
    'ramen', 'pho', 'pad-thai', 'curry', 'dumplings', 'gyoza', 'dim-sum', 'poke-bowl', 'bibimbap',
    'korean-fried-chicken', 'peking-eend', 'loempia', 'nasi-goreng', 'bami-goreng', 'rendang',
    'sate', 'roti', 'butter-chicken', 'tikka-masala', 'biryani',
    -- Street food and grill
    'shoarma', 'kapsalon', 'doner', 'kebab', 'gyros', 'souvlaki', 'falafel', 'hummus', 'tacos',
    'burrito', 'spareribs', 'fried-chicken', 'chicken-wings', 'schnitzel', 'friet',
    -- Italian and Mediterranean
    'carbonara', 'lasagne', 'risotto', 'paella', 'tapas', 'shakshuka',
    -- Fish
    'mosselen', 'oesters', 'garnalen', 'kibbeling', 'fish-and-chips', 'ceviche',
    -- Dutch, brunch and sweet
    'stamppot', 'bitterballen', 'kroket', 'pannenkoeken', 'poffertjes', 'eggs-benedict',
    'acai-bowl', 'ijs', 'tiramisu', 'cheesecake'
  ]
$$;

CREATE OR REPLACE FUNCTION public.ensure_core_landing_pages(p_min_restaurants int DEFAULT 3)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count int;
BEGIN
  WITH core AS (
    -- The canonical dish behind each core slug (slug itself, or what it points to).
    SELECT DISTINCT ON (coalesce(d.canonical_slug, d.slug)) cd.id AS dish_id, cd.name, cd.slug,
           (coalesce(cd.canonical_slug, cd.slug) = cd.dish_group) AS is_hub, coalesce(cd.canonical_slug, cd.slug) AS canon
      FROM unnest(public.core_landing_dish_slugs()) s(slug)
      JOIN public.dishes d ON d.slug = s.slug
      JOIN public.dishes cd ON cd.slug = coalesce(d.canonical_slug, d.slug)
     WHERE cd.canonical_slug IS NULL OR cd.canonical_slug = cd.slug
     ORDER BY coalesce(d.canonical_slug, d.slug)
  ), supply AS (
    SELECT c.dish_id, c.name, c.slug, r.city_id, count(DISTINCT r.id) AS n
      FROM core c
      JOIN public.dishes dd ON (coalesce(c.is_hub, false) AND dd.dish_group = c.canon)
                            OR (NOT coalesce(c.is_hub, false) AND dd.canonical_slug = c.canon)
      JOIN public.restaurant_dishes rd ON rd.dish_id = dd.id AND rd.status IN ('approved_by_admin', 'verified_by_owner')
      JOIN public.restaurants r ON r.id = rd.restaurant_id AND r.is_active
     GROUP BY c.dish_id, c.name, c.slug, r.city_id
    HAVING count(DISTINCT r.id) >= p_min_restaurants
  ), ins AS (
    INSERT INTO public.seo_landing_pages (slug, dish_id, city_id, meta_title, meta_description, h1_title, keywords,
                                          canonical_url, is_active, is_auto_generated)
    SELECT s.slug || '-' || ci.slug, s.dish_id, s.city_id,
           'Beste ' || s.name || ' in ' || ci.name || ' | Dishloopr',
           s.n || ' restaurants in ' || ci.name || ' met ' || lower(s.name) || ' op de kaart. Vergelijk gerechten en prijzen en kies je plek.',
           'Beste ' || s.name || ' in ' || ci.name,
           ARRAY[lower(s.name), lower(ci.name), 'restaurant', 'eten', 'beste'],
           'https://dishloopr.com/eten/' || s.slug || '-' || ci.slug,
           true, true
      FROM supply s
      JOIN public.cities ci ON ci.id = s.city_id AND ci.is_active
     -- No second page for the same dish in this city, also not under another name (tacos / taco).
     WHERE NOT EXISTS (SELECT 1 FROM public.seo_landing_pages p JOIN public.dishes pd ON pd.id = p.dish_id
                        WHERE p.city_id = s.city_id AND coalesce(pd.canonical_slug, pd.slug) = s.slug)
    ON CONFLICT (slug) DO NOTHING
    RETURNING 1
  )
  SELECT count(*) INTO v_count FROM ins;
  RETURN v_count;
END $$;

REVOKE ALL ON FUNCTION public.ensure_core_landing_pages(int) FROM public, anon, authenticated;

SELECT public.ensure_core_landing_pages();

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'core-landing-pages';
    PERFORM cron.schedule('core-landing-pages', '0 4 * * 0', $cron$ SELECT public.ensure_core_landing_pages(); $cron$);
  END IF;
END $do$;