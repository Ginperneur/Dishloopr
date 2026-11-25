-- Collections that fill themselves: "Beste ramen", "Halal uit eten" and so on, across the whole
-- country first, then per city. Paid places sit in their own labelled block (a later step);
-- this file is about the free, organic list and who gets in.
--
-- A restaurant gets in for free when all of these hold (decided 25 November 2026):
--   1. active on Dishloopr;
--   2. dish collections: the dish is approved on its own menu (canonical dish, dish group or name);
--   3. halal / glutenvrij: at least 3 such approved dishes, at least 1 of them a main course
--      (for halal a fully halal restaurant also counts);
--   4. all you can eat / shared dining: the concept is on the restaurant (a free basic tag);
--   5. it has a photo;
--   6. the matching dish has a price (dish and dietary collections);
--   7. at least 10 food dishes on its menu with a price;
--   8. its opening hours are known;
--   9. at least 10 published Dishloopr reviews of the matching dish (concept collections: of the
--      restaurant). Start period: this rule applies from 1 April 2027, so collections are filled
--      at launch while owners collect reviews.
-- The order is Dishloopr's own data, never Google data (docs/google-places-compliance.md) and
-- never payment: reviews of the dish 50%, reviews of the restaurant 15%, menu with prices 15%,
-- photo 10%, active owner 10%. Hand-picked collection_restaurants rows stay "Keuze van de
-- redactie": they must match the collection (rule 2 to 4) and come first when a city is chosen.
-- Rankings are precomputed in collection_entries (nightly, and once here); owners see their own
-- status live. Requires 20261125095000_dish_reviews.sql. Idempotent on purpose.

-- 1. Match rules on collections -----------------------------------------------------------------
ALTER TABLE public.collections
  ADD COLUMN IF NOT EXISTS match_dishes text[],      -- dishes.canonical_slug or dishes.dish_group
  ADD COLUMN IF NOT EXISTS match_dish_names text[],  -- ILIKE patterns on dishes.name
  ADD COLUMN IF NOT EXISTS match_dietary text,       -- 'halal' or 'gluten-free'
  ADD COLUMN IF NOT EXISTS match_concepts text[],    -- overlap with restaurants.concepts
  ADD COLUMN IF NOT EXISTS auto_cover text;          -- photo of the number 1, when no cover_image

ALTER TABLE public.collections DROP CONSTRAINT IF EXISTS collections_match_dietary_check;
ALTER TABLE public.collections ADD CONSTRAINT collections_match_dietary_check
  CHECK (match_dietary IS NULL OR match_dietary IN ('halal', 'gluten-free'));

-- 2. Precomputed entries: every restaurant that matches, with whether it is in the list ------------
CREATE TABLE IF NOT EXISTS public.collection_entries (
  collection_id uuid NOT NULL REFERENCES public.collections(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  city_id uuid,
  dish_name text,
  dish_price numeric,
  score numeric NOT NULL DEFAULT 0,
  PRIMARY KEY (collection_id, restaurant_id)
);
ALTER TABLE public.collection_entries
  ADD COLUMN IF NOT EXISTS eligible boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS review_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS review_avg numeric;
CREATE INDEX IF NOT EXISTS collection_entries_rank ON public.collection_entries (collection_id, score DESC);
CREATE INDEX IF NOT EXISTS collection_entries_city ON public.collection_entries (collection_id, city_id, score DESC);
ALTER TABLE public.collection_entries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.collection_entries FROM anon, authenticated;
GRANT ALL ON public.collection_entries TO service_role;

-- Earlier drafts of this file; replaced by collection_candidates.
DROP FUNCTION IF EXISTS public.collection_matches(uuid);
DROP FUNCTION IF EXISTS public.collection_signals(uuid[]);
DROP FUNCTION IF EXISTS public.collection_score(numeric, integer, boolean, integer, integer, boolean, boolean);
DROP FUNCTION IF EXISTS public.collection_score(numeric, integer, numeric, integer);

-- Rule 9 and its start period.
CREATE OR REPLACE FUNCTION public.collection_review_minimum()
RETURNS integer LANGUAGE sql IMMUTABLE AS $$ SELECT 10 $$;
CREATE OR REPLACE FUNCTION public.collection_reviews_enforced()
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT (now() AT TIME ZONE 'Europe/Amsterdam')::date >= date '2027-04-01'
$$;

-- Rule 8, the same test as hasOpeningHoursData in src/lib/openingHours.ts: some day has hours.
CREATE OR REPLACE FUNCTION public.opening_hours_known(p_hours jsonb)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN p_hours IS NULL OR jsonb_typeof(p_hours) <> 'object' THEN false
    WHEN jsonb_typeof(p_hours -> 'weekday_text') = 'array' THEN EXISTS (
      SELECT 1 FROM jsonb_array_elements_text(p_hours -> 'weekday_text') t
       WHERE position(':' IN t) > 0 AND btrim(substr(t, position(':' IN t) + 1)) <> '')
    ELSE EXISTS (
      SELECT 1 FROM jsonb_each(p_hours) e
       WHERE lower(e.key) IN ('mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun', 'maandag', 'dinsdag', 'woensdag',
                              'donderdag', 'vrijdag', 'zaterdag', 'zondag', 'monday', 'tuesday', 'wednesday',
                              'thursday', 'friday', 'saturday', 'sunday')
         AND jsonb_typeof(e.value) = 'string' AND btrim(e.value #>> '{}') <> '')
  END
$$;

-- An average pulled towards 3.5 while it rests on few reviews, scaled to 0..1 (3 stars = 0, 5 = 1).
CREATE OR REPLACE FUNCTION public.collection_review_part(p_avg numeric, p_n integer)
RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT greatest(0, least(1, ((coalesce(p_n, 0) * coalesce(p_avg, 0) + 5 * 3.5) / (coalesce(p_n, 0) + 5) - 3) / 2))
$$;

-- Every restaurant that matches one collection (rule 2 to 4), with each rule checked, whether it
-- is in the list, and its score. p_restaurant limits it to one restaurant (the owner's view).
CREATE OR REPLACE FUNCTION public.collection_candidates(p_collection uuid, p_restaurant uuid DEFAULT NULL)
RETURNS TABLE (restaurant_id uuid, city_id uuid, kind text, dish_name text, dish_price numeric,
               matching_dishes integer, matching_mains integer, has_photo boolean, dish_priced boolean,
               priced_dishes integer, hours_known boolean, review_count integer, review_avg numeric,
               restaurant_reviews integer, active_owner boolean, eligible boolean, score numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH c AS (
    SELECT co.*, CASE WHEN co.match_dietary IS NOT NULL THEN 'dietary'
                      WHEN co.match_dishes IS NULL AND co.match_dish_names IS NULL THEN 'concept'
                      ELSE 'dish' END AS kind
      FROM public.collections co WHERE co.id = p_collection
  ),
  dish_ids AS (
    SELECT d.id FROM public.dishes d, c
     WHERE (c.match_dishes IS NOT NULL AND (d.canonical_slug = ANY (c.match_dishes) OR d.dish_group = ANY (c.match_dishes)))
        OR (c.match_dish_names IS NOT NULL AND d.name ILIKE ANY (c.match_dish_names))
  ),
  matched AS (
    SELECT rd.restaurant_id, rd.dish_id, d.name, CASE WHEN rd.price > 0 THEN rd.price END AS price,
           rd.course_type, coalesce(rd.is_signature, false) AS is_signature
      FROM c, public.restaurant_dishes rd JOIN public.dishes d ON d.id = rd.dish_id
     WHERE rd.status IN ('approved_by_admin', 'verified_by_owner')
       AND (p_restaurant IS NULL OR rd.restaurant_id = p_restaurant)
       AND ((c.kind = 'dish' AND rd.dish_id IN (SELECT id FROM dish_ids))
         OR (c.match_dietary = 'halal' AND (rd.is_halal OR 'halal' = ANY (coalesce(rd.dietary_tags, ARRAY[]::text[]))))
         OR (c.match_dietary = 'gluten-free' AND (rd.is_gluten_free OR 'gluten-free' = ANY (coalesce(rd.dietary_tags, ARRAY[]::text[])))))
  ),
  base AS (
    SELECT r.id, r.city_id, r.images, r.opening_hours, r.claimed_by_owner_id, r.is_fully_halal, c.kind
      FROM c, public.restaurants r
     WHERE r.is_active AND (p_restaurant IS NULL OR r.id = p_restaurant)
       AND (EXISTS (SELECT 1 FROM matched m WHERE m.restaurant_id = r.id)
         OR (c.match_dietary = 'halal' AND r.is_fully_halal)
         OR (c.kind = 'concept' AND r.concepts && c.match_concepts))
  ),
  best AS (
    SELECT DISTINCT ON (m.restaurant_id) m.restaurant_id, m.name, m.price
      FROM matched m
     ORDER BY m.restaurant_id, (m.price IS NOT NULL) DESC, m.is_signature DESC, m.price, m.name
  ),
  agg AS (
    SELECT m.restaurant_id, count(*)::int AS n, count(*) FILTER (WHERE m.course_type = 'hoofdgerecht')::int AS mains,
           bool_or(m.price IS NOT NULL) AS priced
      FROM matched m GROUP BY m.restaurant_id
  ),
  menu AS (
    SELECT rd.restaurant_id,
           count(*) FILTER (WHERE rd.course_type IS DISTINCT FROM 'drank' AND rd.price > 0)::int AS priced,
           count(*) FILTER (WHERE rd.status = 'verified_by_owner')::int AS owner_dishes
      FROM public.restaurant_dishes rd
     WHERE rd.restaurant_id IN (SELECT id FROM base) AND rd.status IN ('approved_by_admin', 'verified_by_owner')
     GROUP BY rd.restaurant_id
  ),
  dish_reviews AS (
    SELECT rv.restaurant_id, count(*)::int AS n, avg(dr.rating)::numeric AS avg_rating
      FROM public.dish_ratings dr
      JOIN public.reviews rv ON rv.id = dr.review_id AND rv.status = 'published'
      JOIN matched m ON m.restaurant_id = rv.restaurant_id AND m.dish_id = dr.dish_id
     GROUP BY rv.restaurant_id
  ),
  rest_reviews AS (
    SELECT rv.restaurant_id, count(*)::int AS n, avg(rv.rating)::numeric AS avg_rating
      FROM public.reviews rv
     WHERE rv.restaurant_id IN (SELECT id FROM base) AND rv.status = 'published' AND rv.about_restaurant
     GROUP BY rv.restaurant_id
  ),
  checked AS (
    SELECT b.id, b.city_id, b.kind, bs.name AS dish_name, bs.price AS dish_price,
           coalesce(a.n, 0) AS matching_dishes, coalesce(a.mains, 0) AS matching_mains,
           coalesce(array_length(b.images, 1), 0) > 0 AND coalesce(b.images[1], '') <> '' AS has_photo,
           CASE WHEN b.kind = 'concept' OR (b.kind = 'dietary' AND b.is_fully_halal) THEN true ELSE coalesce(a.priced, false) END AS dish_priced,
           coalesce(mn.priced, 0) AS priced_dishes,
           public.opening_hours_known(b.opening_hours::jsonb) AS hours_known,
           CASE WHEN b.kind = 'concept' THEN coalesce(rr.n, 0) ELSE coalesce(dv.n, 0) END AS review_count,
           CASE WHEN b.kind = 'concept' THEN rr.avg_rating ELSE dv.avg_rating END AS review_avg,
           coalesce(rr.n, 0) AS restaurant_reviews, rr.avg_rating AS restaurant_avg,
           b.claimed_by_owner_id IS NOT NULL OR coalesce(mn.owner_dishes, 0) > 0 AS active_owner,
           b.is_fully_halal
      FROM base b
      LEFT JOIN best bs ON bs.restaurant_id = b.id
      LEFT JOIN agg a ON a.restaurant_id = b.id
      LEFT JOIN menu mn ON mn.restaurant_id = b.id
      LEFT JOIN dish_reviews dv ON dv.restaurant_id = b.id
      LEFT JOIN rest_reviews rr ON rr.restaurant_id = b.id
  )
  SELECT x.id, x.city_id, x.kind, x.dish_name, x.dish_price, x.matching_dishes, x.matching_mains,
         x.has_photo, x.dish_priced, x.priced_dishes, x.hours_known, x.review_count, x.review_avg,
         x.restaurant_reviews, x.active_owner,
         (x.kind <> 'dietary' OR x.is_fully_halal OR (x.matching_dishes >= 3 AND x.matching_mains >= 1))
           AND x.has_photo AND x.dish_priced AND x.priced_dishes >= 10 AND x.hours_known
           AND (NOT public.collection_reviews_enforced() OR x.review_count >= public.collection_review_minimum()) AS eligible,
         round((0.50 * public.collection_review_part(x.review_avg, x.review_count)
              + 0.15 * public.collection_review_part(x.restaurant_avg, x.restaurant_reviews)
              + 0.15 * least(x.priced_dishes, 30) / 30.0
              + 0.10 * CASE WHEN x.has_photo THEN 1 ELSE 0 END
              + 0.10 * CASE WHEN x.active_owner THEN 1 ELSE 0 END)::numeric, 4) AS score
    FROM checked x
$$;
REVOKE ALL ON FUNCTION public.collection_candidates(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.collection_candidates(uuid, uuid) TO service_role;

-- Rebuilds the entries of every active collection with match rules (nightly via pg_cron).
CREATE OR REPLACE FUNCTION public.refresh_collection_entries()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_col record; v_total integer := 0; v_n integer;
BEGIN
  FOR v_col IN
    SELECT id FROM public.collections
     WHERE is_active AND (match_dishes IS NOT NULL OR match_dish_names IS NOT NULL
                          OR match_dietary IS NOT NULL OR match_concepts IS NOT NULL)
  LOOP
    DELETE FROM public.collection_entries WHERE collection_id = v_col.id;
    INSERT INTO public.collection_entries (collection_id, restaurant_id, city_id, dish_name, dish_price, score,
                                           eligible, review_count, review_avg)
    SELECT v_col.id, x.restaurant_id, x.city_id, x.dish_name, x.dish_price, x.score, x.eligible, x.review_count, x.review_avg
      FROM public.collection_candidates(v_col.id) x;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_total := v_total + v_n;
    UPDATE public.collections c SET auto_cover = (
      SELECT r.images[1] FROM public.collection_entries e JOIN public.restaurants r ON r.id = e.restaurant_id
       WHERE e.collection_id = v_col.id AND e.eligible AND coalesce(array_length(r.images, 1), 0) > 0
       ORDER BY e.score DESC, e.restaurant_id LIMIT 1)
     WHERE c.id = v_col.id;
  END LOOP;
  RETURN v_total;
END $$;
REVOKE ALL ON FUNCTION public.refresh_collection_entries() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_collection_entries() TO service_role;

-- 3. Public reads -------------------------------------------------------------------------------
-- One collection, the whole country or one city (p_city_slug): the restaurants in the list, with
-- their review count and average for the matching dish. Hand-picked entries are marked; with a
-- city they come first. A rule-less (editorial) collection lists only its hand-picked entries, in
-- their own order. total = how many are in the list in that scope.
DROP FUNCTION IF EXISTS public.collection_list(text, text, integer);
CREATE OR REPLACE FUNCTION public.collection_list(p_slug text, p_city_slug text DEFAULT NULL, p_limit integer DEFAULT 15)
RETURNS TABLE (restaurant_id uuid, name text, slug text, address text, city_name text, city_slug text,
               images text[], price_level integer, cuisines text[], ambience_tags text[],
               dish_name text, dish_price numeric, review_count integer, review_avg numeric,
               is_pick boolean, pick_reason text, total integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH c AS (
    SELECT id, (match_dishes IS NOT NULL OR match_dish_names IS NOT NULL OR match_dietary IS NOT NULL
                OR match_concepts IS NOT NULL) AS has_rules
      FROM public.collections WHERE slug = p_slug AND is_active),
  city AS (SELECT id FROM public.cities WHERE p_city_slug IS NOT NULL AND slug = p_city_slug),
  picks AS (
    SELECT cr.restaurant_id, cr.featured_reason, cr.sort_order FROM public.collection_restaurants cr JOIN c ON c.id = cr.collection_id
  ),
  rows AS (
    SELECT coalesce(e.restaurant_id, p.restaurant_id) AS restaurant_id, e.dish_name, e.dish_price,
           e.review_count, e.review_avg, coalesce(e.score, 0) AS score,
           p.restaurant_id IS NOT NULL AS is_pick, p.featured_reason, p.sort_order
      FROM (SELECT ce.* FROM public.collection_entries ce JOIN c ON c.id = ce.collection_id) e
      FULL JOIN picks p ON p.restaurant_id = e.restaurant_id
      JOIN public.restaurants r ON r.id = coalesce(e.restaurant_id, p.restaurant_id) AND r.is_active
     WHERE (p_city_slug IS NULL OR r.city_id = (SELECT id FROM city))
       AND (CASE WHEN (SELECT has_rules FROM c) THEN e.restaurant_id IS NOT NULL AND (e.eligible OR p.restaurant_id IS NOT NULL)
                 ELSE p.restaurant_id IS NOT NULL END)
  )
  SELECT r.id, r.name, r.slug, r.address, ci.name, ci.slug,
         r.images::text[], r.price_level::int, r.cuisines::text[], r.ambience_tags::text[],
         x.dish_name, x.dish_price, coalesce(x.review_count, 0), x.review_avg,
         x.is_pick, x.featured_reason, (count(*) OVER ())::int
    FROM rows x JOIN public.restaurants r ON r.id = x.restaurant_id
    LEFT JOIN public.cities ci ON ci.id = r.city_id
   ORDER BY CASE WHEN x.is_pick AND (p_city_slug IS NOT NULL OR NOT (SELECT has_rules FROM c)) THEN 0 ELSE 1 END,
            CASE WHEN x.is_pick AND (p_city_slug IS NOT NULL OR NOT (SELECT has_rules FROM c)) THEN x.sort_order END NULLS LAST,
            x.score DESC, r.id
   LIMIT greatest(1, least(coalesce(p_limit, 15), 200))
$$;
GRANT EXECUTE ON FUNCTION public.collection_list(text, text, integer) TO anon, authenticated, service_role;

-- Cities for the city picker of one collection, most restaurants in the list first.
CREATE OR REPLACE FUNCTION public.collection_cities(p_slug text)
RETURNS TABLE (city_slug text, city_name text, restaurants integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH c AS (
    SELECT id, (match_dishes IS NOT NULL OR match_dish_names IS NOT NULL OR match_dietary IS NOT NULL
                OR match_concepts IS NOT NULL) AS has_rules
      FROM public.collections WHERE slug = p_slug AND is_active),
  ids AS (
    SELECT e.restaurant_id FROM public.collection_entries e JOIN c ON c.id = e.collection_id WHERE e.eligible
    UNION
    -- A hand pick counts when it matches the collection (it has an entry), or the collection is editorial.
    SELECT cr.restaurant_id FROM public.collection_restaurants cr JOIN c ON c.id = cr.collection_id
     WHERE NOT c.has_rules OR EXISTS (SELECT 1 FROM public.collection_entries e
                                       WHERE e.collection_id = c.id AND e.restaurant_id = cr.restaurant_id)
  )
  SELECT ci.slug, ci.name, count(*)::int
    FROM ids JOIN public.restaurants r ON r.id = ids.restaurant_id AND r.is_active
    JOIN public.cities ci ON ci.id = r.city_id
   GROUP BY ci.slug, ci.name
   ORDER BY count(*) DESC, ci.name
$$;
GRANT EXECUTE ON FUNCTION public.collection_cities(text) TO anon, authenticated, service_role;

-- 4. The owner's view: every collection the restaurant matches, each rule checked live ----------
-- position = its place in the city list of last night's refresh (NULL when not in the list yet);
-- in_list = how many restaurants are in that city list.
CREATE OR REPLACE FUNCTION public.owner_collection_status(p_restaurant uuid)
RETURNS TABLE (collection_slug text, title text, kind text, city_name text, city_slug text,
               dish_name text, dish_price numeric, matching_dishes integer, matching_mains integer,
               has_photo boolean, dish_priced boolean, priced_dishes integer, hours_known boolean,
               review_count integer, review_avg numeric, review_minimum integer, reviews_enforced boolean,
               eligible boolean, "position" integer, in_list integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT (public.has_role(auth.uid(), 'admin') OR public.is_verified_owner(auth.uid(), p_restaurant)) THEN
    RAISE EXCEPTION 'Alleen de geverifieerde eigenaar' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT co.slug, co.title, x.kind, ci.name, ci.slug, x.dish_name, x.dish_price, x.matching_dishes, x.matching_mains,
         x.has_photo, x.dish_priced, x.priced_dishes, x.hours_known, x.review_count, x.review_avg,
         public.collection_review_minimum(), public.collection_reviews_enforced(), x.eligible,
         CASE WHEN x.eligible THEN (SELECT (count(*) + 1)::int FROM public.collection_entries e
           WHERE e.collection_id = co.id AND e.city_id = x.city_id AND e.eligible AND e.restaurant_id <> p_restaurant
             AND e.score > x.score) END,
         (SELECT count(*)::int FROM public.collection_entries e
           WHERE e.collection_id = co.id AND e.city_id = x.city_id AND e.eligible)
    FROM public.collections co
    CROSS JOIN LATERAL public.collection_candidates(co.id, p_restaurant) x
    LEFT JOIN public.cities ci ON ci.id = x.city_id
   WHERE co.is_active AND (co.match_dishes IS NOT NULL OR co.match_dish_names IS NOT NULL
                           OR co.match_dietary IS NOT NULL OR co.match_concepts IS NOT NULL)
   ORDER BY x.eligible DESC, co.sort_order, co.slug;
END $$;
REVOKE ALL ON FUNCTION public.owner_collection_status(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owner_collection_status(uuid) TO authenticated, service_role;

-- 5. The launch collections ---------------------------------------------------------------------
-- "Beste ramen in Amsterdam" becomes "Beste ramen" (same row, so its hand-picked entries stay);
-- the client redirects the old slug to /collection/beste-ramen?stad=amsterdam.
UPDATE public.collections SET slug = 'beste-ramen'
 WHERE slug = 'beste-ramen-amsterdam'
   AND NOT EXISTS (SELECT 1 FROM public.collections WHERE slug = 'beste-ramen');

-- Older editorial lists move behind the launch collections; "Getest door Dishloopr" stays first.
UPDATE public.collections SET sort_order = 100 + coalesce(sort_order, 0)
 WHERE slug IN ('romantisch-italiaans-rotterdam', 'budget-lunch-spots', 'hidden-gems-nederland',
                'perfect-voor-de-kleintjes', 'zakelijke-lunch', 'trendy-coffee-spots', 'date-night-restaurants')
   AND coalesce(sort_order, 0) < 100;

INSERT INTO public.collections (slug, title, subtitle, description, seo_title, seo_description, city_id,
                                match_dishes, match_dish_names, match_dietary, match_concepts, is_active, sort_order)
VALUES
  ('beste-ramen', 'Beste ramen', 'De lekkerste kommen van Nederland',
   'Restaurants met ramen op hun eigen kaart, gerangschikt op wat gasten op Dishloopr van hun ramen vinden.',
   'Beste ramen in Nederland | Dishloopr', 'De best beoordeelde ramenrestaurants van Nederland, met prijzen van de kaart. Bekijk heel Nederland of kies je stad.',
   NULL, ARRAY['ramen'], NULL, NULL, NULL, true, 1),
  ('beste-steak', 'Beste steak', 'Voor als je zin hebt in vlees',
   'Restaurants met steak of biefstuk op hun eigen kaart, gerangschikt op wat gasten op Dishloopr van hun steak vinden.',
   'Beste steak in Nederland | Dishloopr', 'De best beoordeelde steakrestaurants van Nederland, met prijzen van de kaart. Kies je stad.',
   NULL, ARRAY['biefstuk', 'steak'], NULL, NULL, NULL, true, 2),
  ('beste-spareribs', 'Beste spareribs', 'Kluiven zonder spijt',
   'Restaurants met spareribs op hun eigen kaart, gerangschikt op wat gasten op Dishloopr van hun spareribs vinden.',
   'Beste spareribs in Nederland | Dishloopr', 'Waar eet je de beste spareribs? De best beoordeelde adressen van Nederland, met prijzen. Kies je stad.',
   NULL, ARRAY['spare-ribs', 'spareribs'], ARRAY['%spare%rib%'], NULL, NULL, true, 3),
  ('beste-smashburgers', 'Beste smashburgers', 'Krokante randjes, dubbel genieten',
   'Restaurants met een smashburger op hun eigen kaart, gerangschikt op wat gasten op Dishloopr van hun smashburger vinden.',
   'Beste smashburgers in Nederland | Dishloopr', 'De best beoordeelde smashburgers van Nederland, met prijzen van de kaart. Kies je stad.',
   NULL, ARRAY['smashburger', 'smash-burger'], ARRAY['%smash%'], NULL, NULL, true, 4),
  ('beste-sushi', 'Beste sushi', 'Van nigiri tot uramaki',
   'Restaurants met sushi op hun eigen kaart, gerangschikt op wat gasten op Dishloopr van hun sushi vinden.',
   'Beste sushi in Nederland | Dishloopr', 'De best beoordeelde sushirestaurants van Nederland, met prijzen van de kaart. Kies je stad.',
   NULL, ARRAY['sushi'], NULL, NULL, NULL, true, 5),
  ('beste-pizza', 'Beste pizza', 'Uit de oven, recht op tafel',
   'Restaurants met pizza op hun eigen kaart, gerangschikt op wat gasten op Dishloopr van hun pizza vinden.',
   'Beste pizza in Nederland | Dishloopr', 'De best beoordeelde pizzeria''s van Nederland, met prijzen van de kaart. Kies je stad.',
   NULL, ARRAY['pizza'], NULL, NULL, NULL, true, 6),
  ('beste-pasta', 'Beste pasta', 'Vers, romig of al dente',
   'Restaurants met pasta op hun eigen kaart, gerangschikt op wat gasten op Dishloopr van hun pasta vinden.',
   'Beste pasta in Nederland | Dishloopr', 'De best beoordeelde pastarestaurants van Nederland, met prijzen van de kaart. Kies je stad.',
   NULL, ARRAY['pasta'], NULL, NULL, NULL, true, 7),
  ('beste-tacos', 'Beste taco''s', 'Klein van formaat, groot van smaak',
   'Restaurants met taco''s op hun eigen kaart, gerangschikt op wat gasten op Dishloopr van hun taco''s vinden.',
   'Beste taco''s in Nederland | Dishloopr', 'De best beoordeelde tacoplekken van Nederland, met prijzen van de kaart. Kies je stad.',
   NULL, ARRAY['taco', 'tacos'], NULL, NULL, NULL, true, 8),
  ('beste-pho', 'Beste pho', 'Een kom bouillon die je opwarmt',
   'Restaurants met pho op hun eigen kaart, gerangschikt op wat gasten op Dishloopr van hun pho vinden.',
   'Beste pho in Nederland | Dishloopr', 'De best beoordeelde pho van Nederland, met prijzen van de kaart. Kies je stad.',
   NULL, ARRAY['pho'], ARRAY['pho', 'pho %', '% pho', '% pho %', '%phở%'], NULL, NULL, true, 9),
  ('beste-tiramisu', 'Beste tiramisu', 'Het toetje dat altijd past',
   'Restaurants met tiramisu op hun eigen kaart, gerangschikt op wat gasten op Dishloopr van hun tiramisu vinden.',
   'Beste tiramisu in Nederland | Dishloopr', 'Waar eet je de beste tiramisu? De best beoordeelde adressen van Nederland, met prijzen. Kies je stad.',
   NULL, ARRAY['tiramisu'], NULL, NULL, NULL, true, 10),
  ('beste-cheesecake', 'Beste cheesecake', 'Romig, fris of New York style',
   'Restaurants met cheesecake op hun eigen kaart, gerangschikt op wat gasten op Dishloopr van hun cheesecake vinden.',
   'Beste cheesecake in Nederland | Dishloopr', 'Waar eet je de beste cheesecake? De best beoordeelde adressen van Nederland, met prijzen. Kies je stad.',
   NULL, ARRAY['cheesecake'], NULL, NULL, NULL, true, 11),
  ('beste-french-toast', 'Beste French toast', 'Voor een brunch die blijft hangen',
   'Restaurants met French toast of wentelteefjes op hun eigen kaart, gerangschikt op wat gasten op Dishloopr van hun French toast vinden.',
   'Beste French toast in Nederland | Dishloopr', 'De best beoordeelde French toast en wentelteefjes van Nederland, met prijzen. Kies je stad.',
   NULL, ARRAY['wentelteefjes', 'french-toast'], ARRAY['%french toast%'], NULL, NULL, true, 12),
  ('halal-uit-eten', 'Halal uit eten', 'Met halal gerechten op de kaart',
   'Restaurants die volledig halal zijn of minstens 3 halal gerechten op de kaart hebben, waaronder een hoofdgerecht. Twijfel je, vraag het dan even na bij het restaurant.',
   'Halal uit eten in Nederland | Dishloopr', 'Restaurants met halal gerechten op de kaart, in heel Nederland en per stad.',
   NULL, NULL, NULL, 'halal', NULL, true, 13),
  ('glutenvrij-uit-eten', 'Glutenvrij uit eten', 'Met glutenvrije gerechten op de kaart',
   'Restaurants met minstens 3 glutenvrije gerechten op de kaart, waaronder een hoofdgerecht. Heb je coeliakie, meld dat dan altijd bij je reservering.',
   'Glutenvrij uit eten in Nederland | Dishloopr', 'Restaurants met glutenvrije gerechten op de kaart, in heel Nederland en per stad.',
   NULL, NULL, NULL, 'gluten-free', NULL, true, 14),
  ('all-you-can-eat', 'All you can eat', 'Onbeperkt eten, één prijs',
   'All you can eat restaurants, gerangschikt op wat gasten op Dishloopr van hun bezoek vinden.',
   'All you can eat restaurants in Nederland | Dishloopr', 'De best beoordeelde all you can eat restaurants van Nederland. Kies je stad.',
   NULL, NULL, NULL, NULL, ARRAY['All you can eat', 'Buffet'], true, 15),
  ('shared-dining', 'Shared dining', 'Samen bestellen, samen delen',
   'Restaurants waar je samen bestelt en deelt, gerangschikt op wat gasten op Dishloopr van hun bezoek vinden.',
   'Shared dining restaurants in Nederland | Dishloopr', 'De best beoordeelde shared dining restaurants van Nederland. Kies je stad.',
   NULL, NULL, NULL, NULL, ARRAY['Shared dining'], true, 16)
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title, subtitle = EXCLUDED.subtitle, description = EXCLUDED.description,
  seo_title = EXCLUDED.seo_title, seo_description = EXCLUDED.seo_description, city_id = NULL,
  match_dishes = EXCLUDED.match_dishes, match_dish_names = EXCLUDED.match_dish_names,
  match_dietary = EXCLUDED.match_dietary, match_concepts = EXCLUDED.match_concepts,
  is_active = true, sort_order = EXCLUDED.sort_order, updated_at = now();

-- The renamed ramen row drops its Amsterdam photo: national lists show the photo of their number 1.
UPDATE public.collections SET cover_image = NULL
 WHERE slug = 'beste-ramen' AND cover_image = '/collections/beste-ramen-amsterdam.jpg';

SET LOCAL statement_timeout = '20min';
SELECT public.refresh_collection_entries();

-- 6. Nightly refresh, after the landing pages (04:30 UTC) -----------------------------------------
CREATE EXTENSION IF NOT EXISTS pg_cron;
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'refresh-collection-entries';
SELECT cron.schedule('refresh-collection-entries', '50 4 * * *',
  $cron$ SET statement_timeout = '20min'; SELECT public.refresh_collection_entries(); $cron$);
