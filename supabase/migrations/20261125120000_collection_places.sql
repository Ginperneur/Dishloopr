-- Paid places in collections, next to the free list (decided 25 November 2026).
-- A third kind of paid place, 'collectie', on the same rails as Uitgelicht and Topplek
-- (pp_hold, pp_reserve, bids, the daily run and the quarterly auction):
--   * a "page" is one collection in one city, or the collection across the Netherlands:
--     page_slug 'collectie--<collection slug>--<city slug>' or 'collectie--<collection slug>--nederland';
--   * 3 places per page; 49 euro a month in a city, 149 euro nationally (Founding Partner, bought by
--     5 January 2027 with a term of 6 months or more: 29 and 89 euro); full means bidding;
--   * only collections with match rules sell places ("Getest door Dishloopr" never does), and a city
--     only from 10 matching restaurants;
--   * a restaurant may buy when it matches the collection (the dish on its own menu, or the dietary
--     or concept rule) and has a photo; the free list below never changes because of payment.
-- Orders are package_orders rows with package 'collectieplek'. Requires 20261119100000_paid_visibility.sql,
-- 20261120110000_payment_integrity.sql, 20261125090000_founding_minimum_term.sql and
-- 20261125100000_dish_collections.sql. Idempotent on purpose.

-- 1. Package and product --------------------------------------------------------------------------
ALTER TABLE public.package_orders DROP CONSTRAINT IF EXISTS package_orders_package_check;
ALTER TABLE public.package_orders ADD CONSTRAINT package_orders_package_check
  CHECK (package IN ('founding_partner', 'menu_service', 'topplek', 'groei', 'dominant', 'collectieplek'));
ALTER TABLE public.promo_markets DROP CONSTRAINT IF EXISTS promo_markets_product_check;
ALTER TABLE public.promo_markets ADD CONSTRAINT promo_markets_product_check
  CHECK (product IN ('routing', 'uitgelicht', 'topplek', 'collectie'));
-- A national collection page has no city.
ALTER TABLE public.promo_markets ALTER COLUMN city_id DROP NOT NULL;
DO $$ BEGIN
  ALTER TABLE public.package_checkout_holds DROP CONSTRAINT IF EXISTS package_checkout_holds_kind_check;
  ALTER TABLE public.package_checkout_holds ADD CONSTRAINT package_checkout_holds_kind_check CHECK (kind IN ('uitgelicht', 'topplek', 'collectie'));
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- 2. Collection pages ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.collection_page_slug(p_collection_slug text, p_city_slug text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT 'collectie--' || p_collection_slug || '--' || coalesce(nullif(p_city_slug, ''), 'nederland')
$$;
GRANT EXECUTE ON FUNCTION public.collection_page_slug(text, text) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.collection_page(p_page_slug text)
RETURNS TABLE (collection_id uuid, collection_slug text, title text, city_id uuid, city_name text, is_national boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.id, c.slug, c.title, ci.id, ci.name, split_part(p_page_slug, '--', 3) = 'nederland'
    FROM public.collections c
    LEFT JOIN public.cities ci ON ci.slug = split_part(p_page_slug, '--', 3)
   WHERE split_part(p_page_slug, '--', 1) = 'collectie'
     AND c.slug = split_part(p_page_slug, '--', 2) AND c.is_active
     AND (c.match_dishes IS NOT NULL OR c.match_dish_names IS NOT NULL OR c.match_dietary IS NOT NULL OR c.match_concepts IS NOT NULL)
     AND (split_part(p_page_slug, '--', 3) = 'nederland' OR ci.id IS NOT NULL)
   LIMIT 1
$$;
GRANT EXECUTE ON FUNCTION public.collection_page(text) TO anon, authenticated, service_role;

-- Places are sold from 10 matching restaurants on the page (in the city, or in the whole country).
CREATE OR REPLACE FUNCTION public.collection_page_eligible(p_page_slug text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce((SELECT count(*) >= 10 FROM public.collection_page(p_page_slug) cp
                     JOIN public.collection_entries e ON e.collection_id = cp.collection_id AND (cp.is_national OR e.city_id = cp.city_id)), false)
$$;
GRANT EXECUTE ON FUNCTION public.collection_page_eligible(text) TO anon, authenticated, service_role;

-- A restaurant may buy a place when it matches the collection there and has a photo.
CREATE OR REPLACE FUNCTION public.collection_page_member(p_restaurant uuid, p_page_slug text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.collection_page(p_page_slug) cp
      JOIN public.collection_entries e ON e.collection_id = cp.collection_id AND e.restaurant_id = p_restaurant
      JOIN public.restaurants r ON r.id = e.restaurant_id AND r.is_active
     WHERE (cp.is_national OR e.city_id = cp.city_id)
       AND coalesce(array_length(r.images, 1), 0) > 0 AND coalesce(r.images[1], '') <> '')
$$;
GRANT EXECUTE ON FUNCTION public.collection_page_member(uuid, text) TO service_role;

CREATE OR REPLACE FUNCTION public.collection_founding_price(p_page_slug text)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN (SELECT is_national FROM public.collection_page(p_page_slug)) THEN 8900 ELSE 2900 END
$$;
GRANT EXECUTE ON FUNCTION public.collection_founding_price(text) TO anon, authenticated, service_role;

-- 3. The generic place functions learn the third kind ----------------------------------------------
CREATE OR REPLACE FUNCTION public.pp_packages(p_kind text)
RETURNS text[] LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_kind WHEN 'topplek' THEN ARRAY['topplek', 'dominant'] WHEN 'collectie' THEN ARRAY['collectieplek']
                     ELSE ARRAY['founding_partner', 'groei'] END
$$;

CREATE OR REPLACE FUNCTION public.pp_list_price(p_kind text, p_page_slug text)
RETURNS int LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH u AS (
    SELECT coalesce((SELECT public.promo_list_price('uitgelicht', p.city_id, p.dish_id)
                       FROM public.seo_landing_pages p WHERE p.slug = p_page_slug AND p.dish_id IS NOT NULL AND p.city_id IS NOT NULL LIMIT 1), 9900) AS cents)
  SELECT CASE p_kind
           WHEN 'collectie' THEN CASE WHEN (SELECT is_national FROM public.collection_page(p_page_slug)) THEN 14900 ELSE 4900 END
           WHEN 'topplek' THEN greatest(19900, 2 * u.cents)
           ELSE u.cents END
    FROM u
$$;
GRANT EXECUTE ON FUNCTION public.pp_list_price(text, text) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.pp_page_eligible(p_kind text, p_page_slug text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN p_kind = 'collectie' THEN public.collection_page_eligible(p_page_slug)
              ELSE public.uitgelicht_page_eligible(p_page_slug) END
$$;
GRANT EXECUTE ON FUNCTION public.pp_page_eligible(text, text) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.pp_on_page(p_kind text, p_restaurant uuid, p_page_slug text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN p_kind = 'collectie' THEN public.collection_page_member(p_restaurant, p_page_slug)
              ELSE public.uitgelicht_on_page(p_restaurant, p_page_slug) END
$$;
GRANT EXECUTE ON FUNCTION public.pp_on_page(text, uuid, text) TO service_role;

CREATE OR REPLACE FUNCTION public.pp_market_id(p_kind text, p_page_slug text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid; v_city uuid; v_dish uuid; v_found boolean;
BEGIN
  IF p_kind = 'collectie' THEN
    SELECT cp.city_id, true INTO v_city, v_found FROM public.collection_page(p_page_slug) cp;
    IF v_found IS NULL THEN RETURN NULL; END IF;
    SELECT id INTO v_id FROM public.promo_markets WHERE product = p_kind AND page_slug = p_page_slug;
    IF v_id IS NULL THEN
      INSERT INTO public.promo_markets (product, city_id, dish_id, slots, page_slug)
        VALUES (p_kind, v_city, NULL, public.pp_slots(p_kind), p_page_slug)
        ON CONFLICT DO NOTHING RETURNING id INTO v_id;
      IF v_id IS NULL THEN SELECT id INTO v_id FROM public.promo_markets WHERE product = p_kind AND page_slug = p_page_slug; END IF;
    END IF;
    RETURN v_id;
  END IF;
  SELECT p.city_id, p.dish_id INTO v_city, v_dish FROM public.seo_landing_pages p WHERE p.slug = p_page_slug LIMIT 1;
  IF v_city IS NULL THEN RETURN NULL; END IF;
  SELECT id INTO v_id FROM public.promo_markets WHERE product = p_kind AND page_slug = p_page_slug;
  IF v_id IS NULL AND v_dish IS NOT NULL THEN
    -- Uitgelicht bids from before 20261119100000 live in the city x dish market.
    SELECT id INTO v_id FROM public.promo_markets WHERE product = p_kind AND city_id = v_city AND dish_id = v_dish;
    IF v_id IS NOT NULL THEN UPDATE public.promo_markets SET page_slug = p_page_slug WHERE id = v_id AND page_slug IS NULL; END IF;
  END IF;
  IF v_id IS NULL THEN
    INSERT INTO public.promo_markets (product, city_id, dish_id, slots, page_slug)
      VALUES (p_kind, v_city, v_dish, public.pp_slots(p_kind), p_page_slug)
      ON CONFLICT DO NOTHING RETURNING id INTO v_id;
    IF v_id IS NULL THEN
      SELECT id INTO v_id FROM public.promo_markets WHERE product = p_kind AND (page_slug = p_page_slug OR (city_id = v_city AND dish_id = v_dish));
    END IF;
  END IF;
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.pp_market_id(text, text) FROM public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.pp_place_bid(p_kind text, p_page_slug text, p_restaurant uuid, p_amount_cents int)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_market uuid; v_list int; v_id uuid;
BEGIN
  IF p_kind NOT IN ('uitgelicht', 'topplek', 'collectie') THEN RAISE EXCEPTION 'Onbekende plek' USING ERRCODE = '22023'; END IF;
  IF NOT public.promo_can_manage(p_restaurant) THEN
    RAISE EXCEPTION 'Alleen de geverifieerde eigenaar kan bieden' USING ERRCODE = '42501';
  END IF;
  IF NOT public.pp_page_eligible(p_kind, p_page_slug) THEN
    RAISE EXCEPTION 'Op deze pagina zijn geen betaalde plekken te koop' USING ERRCODE = '22023';
  END IF;
  IF NOT public.pp_on_page(p_kind, p_restaurant, p_page_slug) THEN
    RAISE EXCEPTION 'Je restaurant staat niet op deze pagina' USING ERRCODE = '22023';
  END IF;
  v_list := public.pp_list_price(p_kind, p_page_slug);
  IF p_amount_cents IS NULL OR p_amount_cents < v_list THEN
    RAISE EXCEPTION 'Bied minimaal de lijstprijs van % euro', v_list / 100 USING ERRCODE = '22023';
  END IF;
  IF p_amount_cents > v_list * 20 THEN RAISE EXCEPTION 'Dat bod is hoger dan het maximum' USING ERRCODE = '22023'; END IF;
  v_market := public.pp_market_id(p_kind, p_page_slug);
  UPDATE public.promo_bids SET amount_cents = p_amount_cents, updated_at = now()
   WHERE id = (SELECT b.id FROM public.pp_bids(p_kind, p_page_slug) b WHERE b.restaurant_id = p_restaurant AND b.status = 'open' LIMIT 1)
  RETURNING id INTO v_id;
  IF v_id IS NULL THEN
    INSERT INTO public.promo_bids (market_id, restaurant_id, user_id, amount_cents, page_slug)
      VALUES (v_market, p_restaurant, auth.uid(), p_amount_cents, p_page_slug) RETURNING id INTO v_id;
  END IF;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.place_collectie_bid(p_page_slug text, p_restaurant uuid, p_amount_cents int)
RETURNS uuid LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT public.pp_place_bid('collectie', p_page_slug, p_restaurant, p_amount_cents)
$$;
GRANT EXECUTE ON FUNCTION public.place_collectie_bid(text, uuid, int) TO authenticated;
CREATE OR REPLACE FUNCTION public.collectie_page_status(p_page_slug text, p_restaurant uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.pp_page_status('collectie', p_page_slug, p_restaurant)
$$;
GRANT EXECUTE ON FUNCTION public.collectie_page_status(text, uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.collectie_daily()
RETURNS TABLE (action text, slot_id uuid, bid_id uuid, restaurant_id uuid, user_id uuid, price_cents int, stripe_subscription_id text)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$ SELECT * FROM public.pp_daily('collectie') $$;
CREATE OR REPLACE FUNCTION public.collectie_settle()
RETURNS TABLE (action text, slot_id uuid, bid_id uuid, restaurant_id uuid, user_id uuid, price_cents int, stripe_subscription_id text)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$ SELECT * FROM public.pp_settle('collectie') $$;
REVOKE ALL ON FUNCTION public.collectie_daily() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.collectie_settle() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.collectie_daily() TO service_role;
GRANT EXECUTE ON FUNCTION public.collectie_settle() TO service_role;

-- Auction mails name the place.
CREATE OR REPLACE FUNCTION public.promo_item_label(p_product text, p_city uuid, p_dish uuid, p_page_slug text)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN p_product = 'collectie' THEN 'Collectieplek in '
         || coalesce((SELECT cp.title || CASE WHEN cp.is_national THEN ' in heel Nederland' ELSE ' in ' || cp.city_name END
                        FROM public.collection_page(p_page_slug) cp), p_page_slug)
    WHEN p_product IN ('uitgelicht', 'topplek')
    THEN (CASE p_product WHEN 'topplek' THEN 'Topplek' ELSE 'Uitgelicht' END) || ' op de pagina '
         || coalesce((SELECT s.subject || ' in ' || s.city_name FROM public.page_subject(p_page_slug) s), p_page_slug)
    ELSE 'Vraag doorsturen voor ' || coalesce((SELECT name FROM public.dishes WHERE id = p_dish), 'je gerecht')
           || ' in ' || coalesce((SELECT name FROM public.cities WHERE id = p_city), 'je stad')
  END
$$;

-- 4. Reads ----------------------------------------------------------------------------------------
-- The owner's offers: for each collection the restaurant matches, its city page and the national page.
CREATE OR REPLACE FUNCTION public.collection_place_offers(p_restaurant uuid)
RETURNS TABLE (collection_slug text, title text, page_slug text, is_national boolean, city_name text, for_sale boolean,
               can_buy boolean, list_price_cents integer, founding_price_cents integer, places_left integer, holds_place boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT (public.has_role(auth.uid(), 'admin') OR public.is_verified_owner(auth.uid(), p_restaurant)) THEN
    RAISE EXCEPTION 'Alleen de geverifieerde eigenaar' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  WITH mine AS (
    SELECT c.slug AS cslug, c.title AS ctitle, c.sort_order, ci.slug AS city_slug, ci.name AS cname
      FROM public.collection_entries e
      JOIN public.collections c ON c.id = e.collection_id AND c.is_active
      LEFT JOIN public.cities ci ON ci.id = e.city_id
     WHERE e.restaurant_id = p_restaurant
  ), pages AS (
    SELECT m.cslug, m.ctitle, m.sort_order, public.collection_page_slug(m.cslug, m.city_slug) AS ps, false AS nat, m.cname FROM mine m WHERE m.city_slug IS NOT NULL
    UNION ALL
    SELECT m.cslug, m.ctitle, m.sort_order, public.collection_page_slug(m.cslug, NULL), true, NULL FROM mine m
  )
  SELECT p.cslug, p.ctitle, p.ps, p.nat, p.cname,
         public.collection_page_eligible(p.ps),
         public.collection_page_member(p_restaurant, p.ps),
         public.pp_list_price('collectie', p.ps),
         public.collection_founding_price(p.ps),
         greatest(0, public.pp_slots('collectie') - public.pp_taken('collectie', p.ps)),
         EXISTS (SELECT 1 FROM public.package_orders o WHERE o.restaurant_id = p_restaurant AND o.page_slug = p.ps
                  AND o.package = 'collectieplek' AND public.founding_partner_live(o.status))
    FROM pages p
   ORDER BY p.sort_order, p.cslug, p.nat;
END $$;
REVOKE ALL ON FUNCTION public.collection_place_offers(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.collection_place_offers(uuid) TO authenticated, service_role;

-- Public: the paid places on a collection page, in an order that changes every day.
CREATE OR REPLACE FUNCTION public.collection_paid_placements(p_collection_slug text, p_city_slug text DEFAULT NULL)
RETURNS TABLE (restaurant_id uuid, name text, slug text, address text, city_name text, images text[],
               dish_name text, dish_price numeric, review_count integer, review_avg numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH pg AS (SELECT public.collection_page_slug(p_collection_slug, p_city_slug) AS ps),
  holders AS (
    SELECT DISTINCT o.restaurant_id FROM public.package_orders o, pg
     WHERE o.page_slug = pg.ps AND o.package = 'collectieplek' AND public.founding_partner_live(o.status)
  )
  SELECT r.id, r.name, r.slug, r.address, ci.name, r.images::text[], e.dish_name, e.dish_price,
         coalesce(e.review_count, 0), e.review_avg
    FROM holders h
    JOIN public.restaurants r ON r.id = h.restaurant_id AND r.is_active
    LEFT JOIN public.cities ci ON ci.id = r.city_id
    LEFT JOIN public.collections c ON c.slug = p_collection_slug
    LEFT JOIN public.collection_entries e ON e.collection_id = c.id AND e.restaurant_id = r.id
   ORDER BY md5(r.id::text || current_date::text)
   LIMIT 3
$$;
GRANT EXECUTE ON FUNCTION public.collection_paid_placements(text, text) TO anon, authenticated, service_role;

-- Auction mails (reprice, outbid) also reach holders of a collection place.
CREATE OR REPLACE FUNCTION public.promo_action_mail(p_product text, p_slot uuid, p_bid uuid)
RETURNS TABLE (email text, restaurant_name text, label text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.email, rs.name, x.label FROM (
    SELECT s.user_id, s.restaurant_id, public.promo_item_label('routing', m.city_id, m.dish_id, NULL) label
      FROM public.promo_slots s JOIN public.promo_markets m ON m.id = s.market_id
     WHERE p_product = 'routing' AND s.id = p_slot
    UNION ALL
    SELECT o.user_id, o.restaurant_id, public.promo_item_label(p_product, NULL, NULL, o.page_slug)
      FROM public.package_orders o WHERE p_product IN ('uitgelicht', 'topplek', 'collectie') AND o.id = p_slot
    UNION ALL
    SELECT b.user_id, b.restaurant_id, public.promo_item_label(m.product, m.city_id, m.dish_id, b.page_slug)
      FROM public.promo_bids b JOIN public.promo_markets m ON m.id = b.market_id WHERE b.id = p_bid
  ) x
  JOIN public.profiles p ON p.id = x.user_id
  JOIN public.restaurants rs ON rs.id = x.restaurant_id
  LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.promo_action_mail(text, uuid, uuid) FROM public, anon, authenticated;
