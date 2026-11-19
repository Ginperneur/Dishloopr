-- Paid visibility, agreed with the owner on 18 and 19 November 2026.
--  * Every page sells 4 paid places: 1 Topplek (twice the Uitgelicht price, from 199 euro) and
--    3 Uitgelicht (from 99 euro). Founding Partners already holding a 4th or 5th place keep it.
--  * Places are sold only on pages with at least 10 restaurants, and only to a restaurant that is
--    on the page (the dish on its approved menu, the cuisine on its menu, a label it did not buy).
--  * Pages: dish x city (existing), cuisine x city and Romantisch x city (new, generated nightly).
--  * One source for every surface: page_paid_placements, search_paid_placements,
--    restaurant_paid_badges and city_toppleks. The organic order never depends on payment.
--  * Bundles: Groei (Uitgelicht + Pro + 1 event) and Dominant (Topplek + Pro + 1 event +
--    1 newsletter placement a month + Vraag doorsturen for that dish).
--  * Stadsspotlight (3 per city per week), the city newsletter (max 4 per edition), counters per
--    surface for the monthly report, and test visit requests for "Getest door Dishloopr".
-- Idempotent on purpose (Lovable may apply it under another number, or twice).

-- ---------------------------------------------------------------------------------------------
-- 1. Page kinds and membership
-- ---------------------------------------------------------------------------------------------
ALTER TABLE public.seo_landing_pages ADD COLUMN IF NOT EXISTS page_kind text NOT NULL DEFAULT 'dish';
ALTER TABLE public.seo_landing_pages ADD COLUMN IF NOT EXISTS cuisine text;
ALTER TABLE public.seo_landing_pages ADD COLUMN IF NOT EXISTS ambience text;
DO $$ BEGIN
  ALTER TABLE public.seo_landing_pages ADD CONSTRAINT seo_landing_pages_kind_check CHECK (page_kind IN ('dish', 'cuisine', 'ambience'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS seo_landing_pages_city_kind ON public.seo_landing_pages (city_id, page_kind) WHERE is_active;

-- Which dishes make a cuisine. A restaurant has a cuisine when at least 3 of its approved dishes
-- belong to it (by canonical slug or dish group), or when the cuisine is filled in on the
-- restaurant and was not bought as a paid tag. Admins can extend this list.
CREATE TABLE IF NOT EXISTS public.cuisine_dishes (
  cuisine text NOT NULL,
  dish_slug text NOT NULL,
  PRIMARY KEY (cuisine, dish_slug)
);
ALTER TABLE public.cuisine_dishes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read cuisine dishes" ON public.cuisine_dishes;
CREATE POLICY "Anyone can read cuisine dishes" ON public.cuisine_dishes FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins manage cuisine dishes" ON public.cuisine_dishes;
CREATE POLICY "Admins manage cuisine dishes" ON public.cuisine_dishes FOR ALL
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
GRANT SELECT ON public.cuisine_dishes TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.cuisine_dishes TO authenticated;

INSERT INTO public.cuisine_dishes (cuisine, dish_slug)
SELECT c, unnest(s) FROM (VALUES
  ('Italiaans', ARRAY['pizza','pasta','lasagne','risotto','carbonara','spaghetti','penne','tagliatelle','ravioli','gnocchi',
    'calzone','bruschetta','carpaccio','vitello-tonnato','tiramisu','panna-cotta','minestrone','focaccia','arancini','ossobuco','saltimbocca','antipasti']),
  ('Japans', ARRAY['sushi','ramen','sashimi','tempura','gyoza','yakitori','udon','miso-soep','teriyaki','maki','nigiri','donburi','katsu','okonomiyaki','takoyaki','edamame']),
  ('Chinees', ARRAY['dumplings','peking-eend','dim-sum','babi-pangang','foe-yong-hai','tjap-tjoy','koe-loe-yuk','chow-mein','kung-pao-kip','wonton','char-siu','mapo-tofu']),
  ('Indonesisch', ARRAY['nasi-goreng','bami-goreng','rendang','satay','sate','gado-gado','nasi-rames','rijsttafel','babi-ketjap','ayam-goreng','soto-ayam','opor-ayam','nasi-padang']),
  ('Indiaas', ARRAY['butter-chicken','tikka-masala','biryani','naan','samosa','tandoori-chicken','dal','korma','vindaloo','palak-paneer','chana-masala','pakora','masala-dosa','rogan-josh']),
  ('Thais', ARRAY['pad-thai','tom-yum','groene-curry','green-curry','rode-curry','red-curry','massaman-curry','tom-kha-kai','som-tam','pad-krapow','panang-curry','khao-pad']),
  ('Vietnamees', ARRAY['pho','banh-mi','bun-bo','goi-cuon','bun-cha']),
  ('Koreaans', ARRAY['bibimbap','korean-fried-chicken','bulgogi','kimchi','tteokbokki','japchae','kimbap','galbi']),
  ('Mexicaans', ARRAY['taco','tacos','burrito','quesadilla','nachos','enchilada','fajita','guacamole','chili-con-carne','tostada']),
  ('Grieks', ARRAY['gyros','souvlaki','moussaka','tzatziki','spanakopita','dolmades','saganaki','kleftiko','stifado']),
  ('Turks', ARRAY['doner','kebab','lahmacun','pide','kofte','adana-kebab','iskender','borek','manti','baklava']),
  ('Midden-Oosters', ARRAY['falafel','hummus','shawarma','shoarma','tabouleh','mezze','baba-ganoush','shakshuka','fattoush','kibbeh']),
  ('Surinaams', ARRAY['roti','pom','bara','saoto-soep','moksi-meti','bakkeljauw','telo','petjil','tjauw-min']),
  ('Spaans', ARRAY['tapas','paella','patatas-bravas','gambas','tortilla','croquetas','pimientos-de-padron','gazpacho','albondigas','pulpo']),
  ('Frans', ARRAY['steak-tartaar','bouillabaisse','coq-au-vin','boeuf-bourguignon','ratatouille','creme-brulee','escargots','quiche','croque-monsieur','confit-de-canard','entrecote']),
  ('Nederlands', ARRAY['stamppot','bitterballen','kroket','erwtensoep','hutspot','pannenkoek','poffertjes','uitsmijter','kibbeling','haring','hachee','appeltaart']),
  ('Amerikaans', ARRAY['hamburger','spare-ribs','fried-chicken','hotdog','mac-and-cheese','pulled-pork','brisket','chicken-wings','cheeseburger'])
) AS t(c, s)
ON CONFLICT DO NOTHING;

-- Ambience pages: the slug part and the labels that count (only labels that were not bought).
CREATE OR REPLACE FUNCTION public.ambience_labels(p_ambience text)
RETURNS text[] LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_ambience WHEN 'romantisch' THEN ARRAY['Romantisch', 'Intiem'] ELSE ARRAY[]::text[] END
$$;

CREATE OR REPLACE FUNCTION public.restaurant_paid_tag(p_restaurant uuid, p_category text, p_value text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.restaurant_tag_subscriptions s
                  WHERE s.restaurant_id = p_restaurant AND s.is_active AND s.tag_category = p_category AND s.tag_value = p_value)
$$;

CREATE OR REPLACE FUNCTION public.restaurant_has_cuisine(p_restaurant uuid, p_cuisines text[], p_cuisine text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT (p_cuisine = ANY (coalesce(p_cuisines, ARRAY[]::text[])) AND NOT public.restaurant_paid_tag(p_restaurant, 'cuisine', p_cuisine))
      OR (SELECT count(DISTINCT rd.dish_id) FROM public.restaurant_dishes rd
            JOIN public.dishes dd ON dd.id = rd.dish_id
           WHERE rd.restaurant_id = p_restaurant AND rd.status IN ('approved_by_admin', 'verified_by_owner')
             AND EXISTS (SELECT 1 FROM public.cuisine_dishes cd WHERE cd.cuisine = p_cuisine
                          AND cd.dish_slug IN (coalesce(dd.canonical_slug, dd.slug), dd.dish_group))) >= 3
$$;

-- Restaurants on a page, the same way the page itself selects them.
CREATE OR REPLACE FUNCTION public.page_restaurant_ids(p_page_slug text)
RETURNS TABLE (restaurant_id uuid) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH pg AS (
    SELECT p.page_kind, p.city_id, p.cuisine, p.ambience,
           coalesce(d.canonical_slug, d.slug) AS canon,
           coalesce(coalesce(d.canonical_slug, d.slug) = d.dish_group, false) AS is_hub
      FROM public.seo_landing_pages p LEFT JOIN public.dishes d ON d.id = p.dish_id
     WHERE p.slug = p_page_slug AND p.city_id IS NOT NULL LIMIT 1)
  SELECT DISTINCT rs.id
    FROM pg JOIN public.restaurants rs ON rs.city_id = pg.city_id AND rs.is_active
   WHERE (pg.page_kind = 'dish' AND EXISTS (
            SELECT 1 FROM public.restaurant_dishes rd JOIN public.dishes dd ON dd.id = rd.dish_id
             WHERE rd.restaurant_id = rs.id AND rd.status IN ('approved_by_admin', 'verified_by_owner')
               AND ((pg.is_hub AND dd.dish_group = pg.canon) OR (NOT pg.is_hub AND dd.canonical_slug = pg.canon))))
      OR (pg.page_kind = 'cuisine' AND public.restaurant_has_cuisine(rs.id, rs.cuisines, pg.cuisine))
      OR (pg.page_kind = 'ambience' AND EXISTS (
            SELECT 1 FROM unnest(coalesce(rs.ambience_tags, ARRAY[]::text[])) t
             WHERE t = ANY (public.ambience_labels(pg.ambience)) AND NOT public.restaurant_paid_tag(rs.id, 'ambience', t)))
$$;
GRANT EXECUTE ON FUNCTION public.page_restaurant_ids(text) TO anon, authenticated, service_role;

-- Restaurant counts per page, refreshed nightly; a live count when the page has no row yet.
CREATE TABLE IF NOT EXISTS public.landing_page_counts (
  page_slug text PRIMARY KEY,
  restaurant_count int NOT NULL,
  refreshed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.landing_page_counts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read landing page counts" ON public.landing_page_counts;
CREATE POLICY "Anyone can read landing page counts" ON public.landing_page_counts FOR SELECT USING (true);
GRANT SELECT ON public.landing_page_counts TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.landing_page_restaurant_count(p_page_slug text)
RETURNS int LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce((SELECT c.restaurant_count FROM public.landing_page_counts c WHERE c.page_slug = p_page_slug),
                  (SELECT count(*)::int FROM public.page_restaurant_ids(p_page_slug)))
$$;
GRANT EXECUTE ON FUNCTION public.landing_page_restaurant_count(text) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.uitgelicht_min_restaurants()
RETURNS int LANGUAGE sql IMMUTABLE AS $$ SELECT 10 $$;

-- Nightly: new cuisine and Romantisch pages for every city (from 6 restaurants, the same bar as the
-- other pages Google may index), then fresh counts for every page.
CREATE OR REPLACE FUNCTION public.refresh_landing_pages()
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_city record; v_cuisine text; v_n int; v_slug text; v_added int := 0;
BEGIN
  FOR v_city IN SELECT DISTINCT c.id, c.name, c.slug FROM public.cities c
                  JOIN public.seo_landing_pages p ON p.city_id = c.id AND p.is_active AND p.page_kind = 'dish'
                 WHERE c.is_active LOOP
    FOR v_cuisine IN SELECT DISTINCT cuisine FROM public.cuisine_dishes LOOP
      v_slug := lower(replace(v_cuisine, ' ', '-')) || '-' || v_city.slug;
      CONTINUE WHEN EXISTS (SELECT 1 FROM public.seo_landing_pages WHERE slug = v_slug);
      SELECT count(*) INTO v_n FROM public.restaurants rs
       WHERE rs.city_id = v_city.id AND rs.is_active AND public.restaurant_has_cuisine(rs.id, rs.cuisines, v_cuisine);
      CONTINUE WHEN v_n < 6;
      INSERT INTO public.seo_landing_pages (slug, city_id, page_kind, cuisine, meta_title, meta_description, h1_title, keywords)
      VALUES (v_slug, v_city.id, 'cuisine', v_cuisine,
              v_cuisine || ' eten in ' || v_city.name || ' | Dishloopr',
              'Restaurants met ' || lower(v_cuisine) || 'e gerechten op de kaart in ' || v_city.name || ', met prijzen per gerecht en beoordelingen.',
              v_cuisine || ' eten in ' || v_city.name,
              ARRAY[lower(v_cuisine) || ' ' || lower(v_city.name), lower(v_cuisine) || ' restaurant ' || lower(v_city.name)])
      ON CONFLICT (slug) DO NOTHING;
      v_added := v_added + 1;
    END LOOP;
    v_slug := 'romantisch-uit-eten-' || v_city.slug;
    IF NOT EXISTS (SELECT 1 FROM public.seo_landing_pages WHERE slug = v_slug) THEN
      SELECT count(*) INTO v_n FROM public.restaurants rs
       WHERE rs.city_id = v_city.id AND rs.is_active
         AND EXISTS (SELECT 1 FROM unnest(coalesce(rs.ambience_tags, ARRAY[]::text[])) t
                      WHERE t = ANY (public.ambience_labels('romantisch')) AND NOT public.restaurant_paid_tag(rs.id, 'ambience', t));
      IF v_n >= 6 THEN
        INSERT INTO public.seo_landing_pages (slug, city_id, page_kind, ambience, meta_title, meta_description, h1_title, keywords)
        VALUES (v_slug, v_city.id, 'ambience', 'romantisch',
                'Romantisch uit eten in ' || v_city.name || ' | Dishloopr',
                'Romantische restaurants in ' || v_city.name || ', met de gerechten en prijzen van hun kaart.',
                'Romantisch uit eten in ' || v_city.name,
                ARRAY['romantisch uit eten ' || lower(v_city.name), 'romantisch restaurant ' || lower(v_city.name)])
        ON CONFLICT (slug) DO NOTHING;
        v_added := v_added + 1;
      END IF;
    END IF;
  END LOOP;

  INSERT INTO public.landing_page_counts (page_slug, restaurant_count, refreshed_at)
  SELECT p.slug, (SELECT count(*)::int FROM public.page_restaurant_ids(p.slug)), now()
    FROM public.seo_landing_pages p WHERE p.is_active AND p.city_id IS NOT NULL
  ON CONFLICT (page_slug) DO UPDATE SET restaurant_count = EXCLUDED.restaurant_count, refreshed_at = EXCLUDED.refreshed_at;
  RETURN v_added;
END $$;
REVOKE ALL ON FUNCTION public.refresh_landing_pages() FROM public, anon, authenticated;

-- Paid places only on pages Dishloopr chose: a dish page needs its dish on the Uitgelicht list;
-- cuisine and Romantisch pages qualify as they are. Every page needs at least 10 restaurants.
CREATE OR REPLACE FUNCTION public.uitgelicht_page_eligible(p_page_slug text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.seo_landing_pages p LEFT JOIN public.dishes d ON d.id = p.dish_id
     WHERE p.slug = p_page_slug AND coalesce(p.is_active, true) AND p.city_id IS NOT NULL
       AND (p.page_kind <> 'dish' OR EXISTS (SELECT 1 FROM public.uitgelicht_dishes u
                                              WHERE u.dish_slug = coalesce(d.canonical_slug, d.slug) AND u.enabled)))
  AND public.landing_page_restaurant_count(p_page_slug) >= public.uitgelicht_min_restaurants()
$$;
GRANT EXECUTE ON FUNCTION public.uitgelicht_page_eligible(text) TO anon, authenticated, service_role;

-- Human name of a page's subject ("pizza", "Italiaans eten", "romantisch uit eten") and its city.
CREATE OR REPLACE FUNCTION public.page_subject(p_page_slug text)
RETURNS TABLE (subject text, city_name text, city_id uuid, page_kind text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE p.page_kind WHEN 'cuisine' THEN p.cuisine || ' eten' WHEN 'ambience' THEN 'romantisch uit eten' ELSE lower(d.name) END,
         c.name, c.id, p.page_kind
    FROM public.seo_landing_pages p JOIN public.cities c ON c.id = p.city_id LEFT JOIN public.dishes d ON d.id = p.dish_id
   WHERE p.slug = p_page_slug LIMIT 1
$$;
GRANT EXECUTE ON FUNCTION public.page_subject(text) TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------------------------------
-- 2. Topplek next to Uitgelicht, both per page
-- ---------------------------------------------------------------------------------------------
ALTER TABLE public.promo_markets DROP CONSTRAINT IF EXISTS promo_markets_product_check;
ALTER TABLE public.promo_markets ADD CONSTRAINT promo_markets_product_check CHECK (product IN ('routing', 'uitgelicht', 'topplek'));
ALTER TABLE public.promo_markets ALTER COLUMN dish_id DROP NOT NULL;
ALTER TABLE public.promo_markets ADD COLUMN IF NOT EXISTS page_slug text;
CREATE UNIQUE INDEX IF NOT EXISTS promo_markets_page ON public.promo_markets (product, page_slug) WHERE page_slug IS NOT NULL;

ALTER TABLE public.package_orders DROP CONSTRAINT IF EXISTS package_orders_package_check;
ALTER TABLE public.package_orders ADD CONSTRAINT package_orders_package_check
  CHECK (package IN ('founding_partner', 'menu_service', 'topplek', 'groei', 'dominant'));
ALTER TABLE public.package_orders DROP CONSTRAINT IF EXISTS package_orders_founding_page_check;
ALTER TABLE public.package_orders ADD CONSTRAINT package_orders_founding_page_check
  CHECK (package = 'menu_service' OR page_slug IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_package_orders_page_all ON public.package_orders (page_slug, package) WHERE page_slug IS NOT NULL;

-- Which orders hold which kind of place. Groei contains Uitgelicht, Dominant contains Topplek.
CREATE OR REPLACE FUNCTION public.pp_packages(p_kind text)
RETURNS text[] LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_kind WHEN 'topplek' THEN ARRAY['topplek', 'dominant'] ELSE ARRAY['founding_partner', 'groei'] END
$$;
CREATE OR REPLACE FUNCTION public.pp_slots(p_kind text)
RETURNS int LANGUAGE sql IMMUTABLE AS $$ SELECT CASE p_kind WHEN 'topplek' THEN 1 ELSE 3 END $$;

-- Uitgelicht list price per page: the demand-based price for dish pages, 99 euro otherwise.
-- Topplek costs twice that, at least 199 euro.
CREATE OR REPLACE FUNCTION public.pp_list_price(p_kind text, p_page_slug text)
RETURNS int LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH u AS (
    SELECT coalesce((SELECT public.promo_list_price('uitgelicht', p.city_id, p.dish_id)
                       FROM public.seo_landing_pages p WHERE p.slug = p_page_slug AND p.dish_id IS NOT NULL AND p.city_id IS NOT NULL LIMIT 1), 9900) AS cents)
  SELECT CASE p_kind WHEN 'topplek' THEN greatest(19900, 2 * u.cents) ELSE u.cents END FROM u
$$;
GRANT EXECUTE ON FUNCTION public.pp_list_price(text, text) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.uitgelicht_list_price(p_page_slug text)
RETURNS int LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.pp_list_price('uitgelicht', p_page_slug)
$$;
GRANT EXECUTE ON FUNCTION public.uitgelicht_list_price(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.pp_market_id(p_kind text, p_page_slug text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid; v_city uuid; v_dish uuid;
BEGIN
  SELECT p.city_id, p.dish_id INTO v_city, v_dish FROM public.seo_landing_pages p WHERE p.slug = p_page_slug LIMIT 1;
  IF v_city IS NULL THEN RETURN NULL; END IF;
  SELECT id INTO v_id FROM public.promo_markets WHERE product = p_kind AND page_slug = p_page_slug;
  IF v_id IS NULL AND v_dish IS NOT NULL THEN
    -- Uitgelicht bids from before this migration live in the city x dish market.
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

-- Bids of one kind on one page.
CREATE OR REPLACE FUNCTION public.pp_bids(p_kind text, p_page_slug text)
RETURNS SETOF public.promo_bids LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT b.* FROM public.promo_bids b JOIN public.promo_markets m ON m.id = b.market_id
   WHERE b.page_slug = p_page_slug AND m.product = p_kind
$$;
REVOKE ALL ON FUNCTION public.pp_bids(text, text) FROM public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.pp_taken(p_kind text, p_page_slug text)
RETURNS int LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT (SELECT count(*) FROM public.package_orders WHERE package = ANY (public.pp_packages(p_kind)) AND page_slug = p_page_slug
            AND public.founding_partner_live(status))::int
       + (SELECT count(*) FROM public.pp_bids(p_kind, p_page_slug) b WHERE b.status = 'won' AND b.pay_by > now())::int
$$;

CREATE OR REPLACE FUNCTION public.uitgelicht_taken(p_page_slug text)
RETURNS int LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.pp_taken('uitgelicht', p_page_slug)
$$;

CREATE OR REPLACE FUNCTION public.uitgelicht_on_page(p_restaurant uuid, p_page_slug text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.page_restaurant_ids(p_page_slug) x WHERE x.restaurant_id = p_restaurant)
$$;
GRANT EXECUTE ON FUNCTION public.uitgelicht_on_page(uuid, text) TO service_role;

CREATE OR REPLACE FUNCTION public.founding_places_left(p_page_slug text)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT greatest(0, public.pp_slots('uitgelicht') - public.pp_taken('uitgelicht', p_page_slug))
$$;
CREATE OR REPLACE FUNCTION public.topplek_places_left(p_page_slug text)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT greatest(0, public.pp_slots('topplek') - public.pp_taken('topplek', p_page_slug))
$$;
GRANT EXECUTE ON FUNCTION public.founding_places_left(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.topplek_places_left(text) TO anon, authenticated;

-- Founding Partners (and Groei bought in the window) keep their price through 2027; year plans
-- until their paid year ends. Topplek has no promised price.
CREATE OR REPLACE FUNCTION public.pp_protected(p_kind text, p_created timestamptz, p_plan text, p_period_end timestamptz)
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT (p_kind = 'uitgelicht' AND p_created <= public.uitgelicht_window_end() AND current_date <= date '2027-12-31')
      OR (p_plan = 'year' AND coalesce(p_period_end, now()) > now())
$$;

CREATE OR REPLACE FUNCTION public.pp_page_status(p_kind text, p_page_slug text, p_restaurant uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_open int; v_high int;
BEGIN
  IF NOT public.promo_can_manage(p_restaurant) THEN
    RAISE EXCEPTION 'Alleen de geverifieerde eigenaar' USING ERRCODE = '42501';
  END IF;
  SELECT count(*), max(b.amount_cents) INTO v_open, v_high FROM public.pp_bids(p_kind, p_page_slug) b WHERE b.status = 'open';
  RETURN jsonb_build_object(
    'kind', p_kind,
    'list_price_cents', public.pp_list_price(p_kind, p_page_slug),
    'slots', public.pp_slots(p_kind),
    'taken', public.pp_taken(p_kind, p_page_slug),
    'open_bids', coalesce(v_open, 0),
    'highest_bid_cents', v_high,
    'window_open', now() <= public.uitgelicht_window_end(),
    'next_auction', (public.promo_quarter_end(current_date) + 1),
    'my_bid', (SELECT to_jsonb(b) - 'user_id' FROM public.pp_bids(p_kind, p_page_slug) b
                WHERE b.restaurant_id = p_restaurant AND b.status IN ('open', 'won') LIMIT 1)
  );
END $$;
CREATE OR REPLACE FUNCTION public.uitgelicht_page_status(p_page_slug text, p_restaurant uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.pp_page_status('uitgelicht', p_page_slug, p_restaurant)
$$;
CREATE OR REPLACE FUNCTION public.topplek_page_status(p_page_slug text, p_restaurant uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.pp_page_status('topplek', p_page_slug, p_restaurant)
$$;

CREATE OR REPLACE FUNCTION public.pp_place_bid(p_kind text, p_page_slug text, p_restaurant uuid, p_amount_cents int)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_market uuid; v_list int; v_id uuid;
BEGIN
  IF p_kind NOT IN ('uitgelicht', 'topplek') THEN RAISE EXCEPTION 'Onbekende plek' USING ERRCODE = '22023'; END IF;
  IF NOT public.promo_can_manage(p_restaurant) THEN
    RAISE EXCEPTION 'Alleen de geverifieerde eigenaar kan bieden' USING ERRCODE = '42501';
  END IF;
  IF NOT public.uitgelicht_page_eligible(p_page_slug) THEN
    RAISE EXCEPTION 'Op deze pagina zijn geen betaalde plekken te koop' USING ERRCODE = '22023';
  END IF;
  IF NOT public.uitgelicht_on_page(p_restaurant, p_page_slug) THEN
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
CREATE OR REPLACE FUNCTION public.place_uitgelicht_bid(p_page_slug text, p_restaurant uuid, p_amount_cents int)
RETURNS uuid LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT public.pp_place_bid('uitgelicht', p_page_slug, p_restaurant, p_amount_cents)
$$;
CREATE OR REPLACE FUNCTION public.place_topplek_bid(p_page_slug text, p_restaurant uuid, p_amount_cents int)
RETURNS uuid LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT public.pp_place_bid('topplek', p_page_slug, p_restaurant, p_amount_cents)
$$;

-- Price for a checkout (service role): a won bid at its clearing price, or a free place at the list
-- price when nobody else is waiting. One restaurant holds at most one paid place per page.
CREATE OR REPLACE FUNCTION public.pp_reserve(p_kind text, p_page_slug text, p_restaurant uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_bid public.promo_bids;
BEGIN
  IF EXISTS (SELECT 1 FROM public.package_orders o WHERE o.page_slug = p_page_slug AND o.restaurant_id = p_restaurant
              AND o.package <> 'menu_service' AND public.founding_partner_live(o.status)) THEN
    RAISE EXCEPTION 'Je hebt al een betaalde plek op deze pagina' USING ERRCODE = 'P0001';
  END IF;
  SELECT * INTO v_bid FROM public.pp_bids(p_kind, p_page_slug) b
   WHERE b.restaurant_id = p_restaurant AND b.status = 'won' AND b.pay_by > now() LIMIT 1;
  IF v_bid.id IS NOT NULL THEN
    RETURN jsonb_build_object('price_cents', v_bid.clearing_cents, 'bid_id', v_bid.id);
  END IF;
  IF public.pp_taken(p_kind, p_page_slug) >= public.pp_slots(p_kind) THEN
    RAISE EXCEPTION 'Deze plek is bezet: plaats een bod' USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (SELECT 1 FROM public.pp_bids(p_kind, p_page_slug) b WHERE b.status = 'open' AND b.restaurant_id <> p_restaurant) THEN
    RAISE EXCEPTION 'Er staan bieders op de wachtlijst: plaats een bod' USING ERRCODE = 'P0001';
  END IF;
  RETURN jsonb_build_object('price_cents', public.pp_list_price(p_kind, p_page_slug), 'bid_id', NULL);
END $$;
CREATE OR REPLACE FUNCTION public.uitgelicht_reserve(p_page_slug text, p_restaurant uuid)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT public.pp_reserve('uitgelicht', p_page_slug, p_restaurant)
$$;

-- Daily (service role): expire unpaid wins and give free places to the highest bids.
CREATE OR REPLACE FUNCTION public.pp_daily(p_kind text)
RETURNS TABLE (action text, slot_id uuid, bid_id uuid, restaurant_id uuid, user_id uuid, price_cents int, stripe_subscription_id text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_page text; v_free int; v_list int; v_clear int;
BEGIN
  UPDATE public.promo_bids b SET status = 'expired', updated_at = now()
    FROM public.promo_markets m
   WHERE m.id = b.market_id AND m.product = p_kind AND b.page_slug IS NOT NULL AND b.status = 'won' AND b.pay_by < now();
  FOR v_page IN SELECT DISTINCT b.page_slug FROM public.promo_bids b JOIN public.promo_markets m ON m.id = b.market_id
                 WHERE m.product = p_kind AND b.page_slug IS NOT NULL AND b.status = 'open' LOOP
    v_free := public.pp_slots(p_kind) - public.pp_taken(p_kind, v_page);
    CONTINUE WHEN v_free <= 0;
    v_list := public.pp_list_price(p_kind, v_page);
    SELECT greatest(v_list, coalesce((SELECT x.amount_cents FROM public.pp_bids(p_kind, v_page) x WHERE x.status = 'open'
             ORDER BY x.amount_cents DESC, x.created_at OFFSET v_free LIMIT 1), v_list)) INTO v_clear;
    RETURN QUERY
    WITH w AS (
      UPDATE public.promo_bids b SET status = 'won', clearing_cents = v_clear, pay_by = now() + interval '7 days', updated_at = now()
       WHERE b.id IN (SELECT x.id FROM public.pp_bids(p_kind, v_page) x WHERE x.status = 'open'
                       ORDER BY x.amount_cents DESC, x.created_at LIMIT v_free)
      RETURNING b.id, b.restaurant_id, b.user_id, b.clearing_cents)
    SELECT 'won'::text, NULL::uuid, w.id, w.restaurant_id, w.user_id, w.clearing_cents, NULL::text FROM w;
  END LOOP;
END $$;
CREATE OR REPLACE FUNCTION public.uitgelicht_daily()
RETURNS TABLE (action text, slot_id uuid, bid_id uuid, restaurant_id uuid, user_id uuid, price_cents int, stripe_subscription_id text)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$ SELECT * FROM public.pp_daily('uitgelicht') $$;
CREATE OR REPLACE FUNCTION public.topplek_daily()
RETURNS TABLE (action text, slot_id uuid, bid_id uuid, restaurant_id uuid, user_id uuid, price_cents int, stripe_subscription_id text)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$ SELECT * FROM public.pp_daily('topplek') $$;

-- Quarterly (service role). Only unprotected monthly places take part; all winners pay the
-- highest amount that did not win, at least the list price.
CREATE OR REPLACE FUNCTION public.pp_settle(p_kind text)
RETURNS TABLE (action text, slot_id uuid, bid_id uuid, restaurant_id uuid, user_id uuid, price_cents int, stripe_subscription_id text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_page text; v_list int; v_avail int; v_clear int; v_pk text[] := public.pp_packages(p_kind);
BEGIN
  FOR v_page IN
    SELECT DISTINCT o.page_slug FROM public.package_orders o
     WHERE o.package = ANY (v_pk) AND public.founding_partner_live(o.status)
    UNION
    SELECT DISTINCT b.page_slug FROM public.promo_bids b JOIN public.promo_markets m ON m.id = b.market_id
     WHERE m.product = p_kind AND b.page_slug IS NOT NULL AND b.status = 'open'
  LOOP
    v_list := public.pp_list_price(p_kind, v_page);
    CREATE TEMP TABLE IF NOT EXISTS pp_rank (order_id uuid, bid_id uuid, restaurant_id uuid, user_id uuid, amount int,
      holder boolean, created timestamptz, sub text) ON COMMIT DROP;
    DELETE FROM pp_rank;
    INSERT INTO pp_rank
      SELECT o.id, b.id, o.restaurant_id, o.user_id, greatest(v_list, coalesce(b.amount_cents, 0)), true, o.created_at, o.stripe_subscription_id
        FROM public.package_orders o
        LEFT JOIN public.pp_bids(p_kind, v_page) b ON b.restaurant_id = o.restaurant_id AND b.status = 'open'
       WHERE o.package = ANY (v_pk) AND o.page_slug = v_page AND public.founding_partner_live(o.status)
         AND o.plan = 'month' AND NOT public.pp_protected(p_kind, o.created_at, o.plan, o.current_period_end);
    v_avail := public.pp_slots(p_kind) - (SELECT count(*) FROM public.package_orders o
                     WHERE o.package = ANY (v_pk) AND o.page_slug = v_page AND public.founding_partner_live(o.status)
                       AND (o.plan <> 'month' OR public.pp_protected(p_kind, o.created_at, o.plan, o.current_period_end)))::int;

    IF NOT EXISTS (SELECT 1 FROM public.pp_bids(p_kind, v_page) b WHERE b.status = 'open') THEN
      -- No competition: unprotected holders renew at the list price.
      RETURN QUERY
      WITH u AS (
        UPDATE public.package_orders o SET amount_cents = v_list, updated_at = now()
         WHERE o.id IN (SELECT r.order_id FROM pp_rank r) AND o.amount_cents <> v_list AND o.package IN ('founding_partner', 'topplek')
        RETURNING o.id, o.restaurant_id, o.user_id, o.amount_cents, o.stripe_subscription_id)
      SELECT 'reprice'::text, u.id, NULL::uuid, u.restaurant_id, u.user_id, u.amount_cents, u.stripe_subscription_id FROM u;
      CONTINUE;
    END IF;

    INSERT INTO pp_rank
      SELECT NULL, b.id, b.restaurant_id, b.user_id, b.amount_cents, false, b.created_at, NULL
        FROM public.pp_bids(p_kind, v_page) b
       WHERE b.status = 'open'
         AND NOT EXISTS (SELECT 1 FROM pp_rank r WHERE r.restaurant_id = b.restaurant_id)
         AND NOT EXISTS (SELECT 1 FROM public.package_orders o WHERE o.page_slug = v_page AND o.restaurant_id = b.restaurant_id
                          AND o.package = ANY (v_pk) AND public.founding_partner_live(o.status));

    SELECT greatest(v_list, coalesce((SELECT r.amount FROM pp_rank r ORDER BY r.amount DESC, r.holder DESC, r.created
             OFFSET greatest(v_avail, 0) LIMIT 1), v_list)) INTO v_clear;
    CREATE TEMP TABLE IF NOT EXISTS pp_win (restaurant_id uuid) ON COMMIT DROP;
    DELETE FROM pp_win;
    INSERT INTO pp_win SELECT r.restaurant_id FROM pp_rank r ORDER BY r.amount DESC, r.holder DESC, r.created LIMIT greatest(v_avail, 0);

    -- Bundles keep their own price (the bundle surcharge on top); only single places are repriced.
    RETURN QUERY
    WITH u AS (
      UPDATE public.package_orders o SET amount_cents = v_clear, updated_at = now()
       WHERE o.id IN (SELECT r.order_id FROM pp_rank r WHERE r.holder AND r.restaurant_id IN (SELECT w.restaurant_id FROM pp_win w))
         AND o.package IN ('founding_partner', 'topplek')
      RETURNING o.id, o.restaurant_id, o.user_id, o.amount_cents, o.stripe_subscription_id)
    SELECT 'reprice'::text, u.id, NULL::uuid, u.restaurant_id, u.user_id, u.amount_cents, u.stripe_subscription_id FROM u;
    UPDATE public.promo_bids b SET status = 'converted', updated_at = now()
     WHERE b.id IN (SELECT x.id FROM public.pp_bids(p_kind, v_page) x WHERE x.status = 'open')
       AND b.restaurant_id IN (SELECT r.restaurant_id FROM pp_rank r WHERE r.holder)
       AND b.restaurant_id IN (SELECT w.restaurant_id FROM pp_win w);
    RETURN QUERY
    SELECT 'cancel'::text, r.order_id, NULL::uuid, r.restaurant_id, r.user_id, v_clear, r.sub
      FROM pp_rank r WHERE r.holder AND r.restaurant_id NOT IN (SELECT w.restaurant_id FROM pp_win w);
    RETURN QUERY
    WITH w AS (
      UPDATE public.promo_bids b SET status = 'won', clearing_cents = v_clear, pay_by = now() + interval '7 days', updated_at = now()
       WHERE b.id IN (SELECT x.id FROM public.pp_bids(p_kind, v_page) x WHERE x.status = 'open')
         AND b.restaurant_id IN (SELECT x.restaurant_id FROM pp_win x)
         AND b.restaurant_id NOT IN (SELECT r.restaurant_id FROM pp_rank r WHERE r.holder)
      RETURNING b.id, b.restaurant_id, b.user_id, b.clearing_cents)
    SELECT 'won'::text, NULL::uuid, w.id, w.restaurant_id, w.user_id, w.clearing_cents, NULL::text FROM w;
  END LOOP;
END $$;
CREATE OR REPLACE FUNCTION public.uitgelicht_settle()
RETURNS TABLE (action text, slot_id uuid, bid_id uuid, restaurant_id uuid, user_id uuid, price_cents int, stripe_subscription_id text)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$ SELECT * FROM public.pp_settle('uitgelicht') $$;
CREATE OR REPLACE FUNCTION public.topplek_settle()
RETURNS TABLE (action text, slot_id uuid, bid_id uuid, restaurant_id uuid, user_id uuid, price_cents int, stripe_subscription_id text)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$ SELECT * FROM public.pp_settle('topplek') $$;

-- Offers (packages page, dashboard, outreach): every page where the restaurant is listed and
-- paid places are for sale, with its organic position on dish pages.
DROP FUNCTION IF EXISTS public.uitgelicht_page_offers(text);
CREATE OR REPLACE FUNCTION public.uitgelicht_page_offers(p_slug text)
RETURNS TABLE (page_slug text, dish_name text, "position" int, total int, searches_per_month numeric,
               places_left int, list_price_cents int, page_kind text, topplek_left int, topplek_price_cents int)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH r AS (SELECT id, city_id FROM public.restaurants WHERE slug = p_slug AND is_active LIMIT 1),
  pages AS (
    SELECT p.slug, p.page_kind, s.subject
      FROM public.seo_landing_pages p, r, LATERAL public.page_subject(p.slug) s
     WHERE p.city_id = r.city_id AND p.is_active AND p.slug NOT LIKE 'gerecht-%'
       AND public.uitgelicht_page_eligible(p.slug)
       AND EXISTS (SELECT 1 FROM public.page_restaurant_ids(p.slug) x WHERE x.restaurant_id = r.id))
  SELECT pg.slug, initcap(pg.subject), pos."position", coalesce(pos.total, public.landing_page_restaurant_count(pg.slug)),
         coalesce((SELECT d.searches_per_month FROM public.uitgelicht_page(pg.slug) g, public.promo_demand(g.city_id, g.dish_id) d
                    WHERE g.dish_id IS NOT NULL), 0),
         public.founding_places_left(pg.slug), public.pp_list_price('uitgelicht', pg.slug), pg.page_kind,
         public.topplek_places_left(pg.slug), public.pp_list_price('topplek', pg.slug)
    FROM pages pg
    LEFT JOIN public.restaurant_positions(p_slug) pos ON pos.page_slug = pg.slug
   ORDER BY pg.page_kind = 'dish' DESC, pos."position" NULLS LAST, 1
$$;
REVOKE ALL ON FUNCTION public.uitgelicht_page_offers(text) FROM public;
GRANT EXECUTE ON FUNCTION public.uitgelicht_page_offers(text) TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------------------------------
-- 3. One public source for every surface
-- ---------------------------------------------------------------------------------------------
-- Paid places on a page: Topplek first, then Uitgelicht in an order that changes every day, so
-- each holder gets the same exposure over a month.
CREATE OR REPLACE FUNCTION public.page_paid_placements(p_page_slug text)
RETURNS TABLE (restaurant_id uuid, kind text, is_founding boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT h.restaurant_id, h.kind, h.is_founding FROM (
    SELECT o.restaurant_id,
           CASE WHEN bool_or(o.package IN ('topplek', 'dominant')) THEN 'topplek' ELSE 'uitgelicht' END AS kind,
           bool_or(o.package IN ('founding_partner', 'groei') AND o.created_at <= public.uitgelicht_window_end()) AS is_founding
      FROM public.package_orders o JOIN public.restaurants r ON r.id = o.restaurant_id AND r.is_active
     WHERE o.page_slug = p_page_slug AND o.package IN ('founding_partner', 'groei', 'topplek', 'dominant')
       AND public.founding_partner_live(o.status)
     GROUP BY o.restaurant_id) h
   ORDER BY h.kind = 'uitgelicht', md5(h.restaurant_id::text || current_date::text)
$$;
GRANT EXECUTE ON FUNCTION public.page_paid_placements(text) TO anon, authenticated, service_role;

-- Kept for older clients: every paid holder on a page.
CREATE OR REPLACE FUNCTION public.founding_partners_for_page(p_page_slug text)
RETURNS TABLE (restaurant_id uuid) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT x.restaurant_id FROM public.page_paid_placements(p_page_slug) x
$$;
GRANT EXECUTE ON FUNCTION public.founding_partners_for_page(text) TO anon, authenticated;

-- Search for a dish (or cuisine) in a city: the paid places of the matching pages. The client shows
-- at most 1 Topplek and 2 Uitgelicht above the results.
CREATE OR REPLACE FUNCTION public.search_paid_placements(p_city uuid, p_dish_ids uuid[] DEFAULT NULL, p_cuisine text DEFAULT NULL)
RETURNS TABLE (restaurant_id uuid, kind text, page_slug text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH wanted AS (
    SELECT DISTINCT coalesce(d.canonical_slug, d.slug) AS canon, d.dish_group FROM public.dishes d WHERE d.id = ANY (coalesce(p_dish_ids, ARRAY[]::uuid[]))
  ), pages AS (
    SELECT p.slug FROM public.seo_landing_pages p LEFT JOIN public.dishes d ON d.id = p.dish_id
     WHERE p.city_id = p_city AND p.is_active AND p.slug NOT LIKE 'gerecht-%'
       AND ((p.page_kind = 'dish' AND EXISTS (SELECT 1 FROM wanted w
               WHERE coalesce(d.canonical_slug, d.slug) IN (w.canon, w.dish_group)))
         OR (p.page_kind = 'cuisine' AND p_cuisine IS NOT NULL AND lower(p.cuisine) = lower(p_cuisine)))
  )
  SELECT DISTINCT ON (x.restaurant_id) x.restaurant_id, x.kind, pg.slug
    FROM pages pg, LATERAL public.page_paid_placements(pg.slug) x
   ORDER BY x.restaurant_id, x.kind = 'uitgelicht'
$$;
GRANT EXECUTE ON FUNCTION public.search_paid_placements(uuid, uuid[], text) TO anon, authenticated, service_role;

-- Badges on a restaurant page and its cards: every page where it holds a paid place.
CREATE OR REPLACE FUNCTION public.restaurant_paid_badges(p_restaurant uuid)
RETURNS TABLE (page_slug text, kind text, subject text, city_name text, is_founding boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT h.page_slug, h.kind, h.subject, h.city_name, h.is_founding FROM (
    SELECT o.page_slug,
           CASE WHEN bool_or(o.package IN ('topplek', 'dominant')) THEN 'topplek' ELSE 'uitgelicht' END AS kind,
           min(s.subject) AS subject, min(s.city_name) AS city_name,
           bool_or(o.package IN ('founding_partner', 'groei') AND o.created_at <= public.uitgelicht_window_end()) AS is_founding
      FROM public.package_orders o, LATERAL public.page_subject(o.page_slug) s
     WHERE o.restaurant_id = p_restaurant AND o.package IN ('founding_partner', 'groei', 'topplek', 'dominant')
       AND public.founding_partner_live(o.status)
     GROUP BY o.page_slug) h
   ORDER BY h.kind = 'uitgelicht', h.page_slug
$$;
GRANT EXECUTE ON FUNCTION public.restaurant_paid_badges(uuid) TO anon, authenticated, service_role;

-- Pages of a city with their restaurant counts (homepage "Populair", city page, search hints).
CREATE OR REPLACE FUNCTION public.city_landing_pages(p_city uuid)
RETURNS TABLE (page_slug text, page_kind text, subject text, restaurant_count int)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.slug, p.page_kind,
         CASE p.page_kind WHEN 'cuisine' THEN p.cuisine WHEN 'ambience' THEN 'Romantisch' ELSE d.name END,
         c.restaurant_count
    FROM public.seo_landing_pages p
    JOIN public.landing_page_counts c ON c.page_slug = p.slug
    LEFT JOIN public.dishes d ON d.id = p.dish_id
   WHERE p.city_id = p_city AND p.is_active AND p.slug NOT LIKE 'gerecht-%' AND c.restaurant_count >= 3
     AND (p.page_kind <> 'dish' OR d.canonical_slug IS NULL OR d.canonical_slug = d.slug)
   ORDER BY c.restaurant_count DESC, 1
$$;
GRANT EXECUTE ON FUNCTION public.city_landing_pages(uuid) TO anon, authenticated, service_role;

-- Homepage "Topplekken in <city>": the Topplek holder of each page in the city.
CREATE OR REPLACE FUNCTION public.city_toppleks(p_city uuid)
RETURNS TABLE (page_slug text, page_kind text, subject text, restaurant_count int, restaurant_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT cp.page_slug, cp.page_kind, cp.subject, cp.restaurant_count, x.restaurant_id
    FROM public.city_landing_pages(p_city) cp, LATERAL public.page_paid_placements(cp.page_slug) x
   WHERE x.kind = 'topplek'
   ORDER BY cp.restaurant_count DESC
$$;
GRANT EXECUTE ON FUNCTION public.city_toppleks(uuid) TO anon, authenticated, service_role;

-- Dominant includes Vraag doorsturen for its dish: holders count as routing sponsors there.
CREATE OR REPLACE FUNCTION public.routing_sponsors(p_city uuid, p_dish_ids uuid[])
RETURNS TABLE (restaurant_id uuid, dish_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT DISTINCT s.restaurant_id, m.dish_id
    FROM public.promo_slots s JOIN public.promo_markets m ON m.id = s.market_id
   WHERE m.product = 'routing' AND m.city_id = p_city AND m.dish_id = ANY (p_dish_ids)
     AND s.status IN ('active', 'ending')
  UNION
  SELECT DISTINCT o.restaurant_id, p.dish_id
    FROM public.package_orders o JOIN public.seo_landing_pages p ON p.slug = o.page_slug
   WHERE o.package = 'dominant' AND public.founding_partner_live(o.status)
     AND p.city_id = p_city AND p.dish_id = ANY (p_dish_ids)
$$;
GRANT EXECUTE ON FUNCTION public.routing_sponsors(uuid, uuid[]) TO anon, authenticated;

-- The organic order no longer knows the old featured flags (nobody holds them any more).
CREATE OR REPLACE FUNCTION public.restaurant_positions(p_slug text)
RETURNS TABLE(page_slug text, dish_name text, "position" integer, total integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
WITH r AS (
  SELECT id, city_id, coalesce(rating, 0) rt FROM restaurants WHERE slug = p_slug AND is_active = true LIMIT 1
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
  WHERE p.is_active = true AND p.page_kind = 'dish' AND p.slug NOT LIKE 'gerecht-%'
    AND (d.canonical_slug IS NULL OR d.canonical_slug = d.slug)
), mine AS (
  SELECT pg.* FROM pages pg
  WHERE (pg.is_hub AND EXISTS (SELECT 1 FROM own o WHERE o.dish_group = pg.canon))
     OR (NOT pg.is_hub AND EXISTS (SELECT 1 FROM own o WHERE o.canon = pg.canon))
), comp AS (
  SELECT pg.page_slug, pg.dish_name, x.id, x.rt
  FROM mine pg
  JOIN LATERAL (
    SELECT DISTINCT rs.id, coalesce(rs.rating, 0) rt
    FROM restaurant_dishes rd
    JOIN dishes dd ON dd.id = rd.dish_id
    JOIN restaurants rs ON rs.id = rd.restaurant_id AND rs.city_id = pg.city_id AND rs.is_active = true
    WHERE rd.status IN ('approved_by_admin', 'verified_by_owner')
      AND ((pg.is_hub AND dd.dish_group = pg.canon) OR (NOT pg.is_hub AND dd.canonical_slug = pg.canon))
  ) x ON true
)
SELECT c.page_slug, min(c.dish_name),
  (count(*) FILTER (WHERE c.rt > r.rt OR (c.rt = r.rt AND c.id < r.id)) + 1)::int,
  count(*)::int
FROM comp c, r
GROUP BY c.page_slug
HAVING bool_or(c.id = r.id)
ORDER BY 3, 4 DESC, 1
LIMIT 50;
$$;
REVOKE ALL ON FUNCTION public.restaurant_positions(text) FROM public;
GRANT EXECUTE ON FUNCTION public.restaurant_positions(text) TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------------------------------
-- 4. Counters per surface for the monthly report
-- ---------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.paid_stats_daily (
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  page_slug text NOT NULL,
  surface text NOT NULL CHECK (surface IN ('gerechtpagina', 'zoeken', 'kaart', 'homepage', 'badge', 'spotlight')),
  dag date NOT NULL DEFAULT ((now() AT TIME ZONE 'Europe/Amsterdam')::date),
  metric text NOT NULL CHECK (metric IN ('impressie', 'klik')),
  n integer NOT NULL DEFAULT 0,
  PRIMARY KEY (restaurant_id, page_slug, surface, dag, metric)
);
ALTER TABLE public.paid_stats_daily ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.paid_stats_daily FROM anon, authenticated;
GRANT ALL ON public.paid_stats_daily TO service_role;

-- Anonymous batched counters, no browser identifiers. Only real paid places are counted.
CREATE OR REPLACE FUNCTION public.track_paid_metrics(p_items jsonb)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count integer;
BEGIN
  IF jsonb_typeof(p_items) IS DISTINCT FROM 'array' OR jsonb_array_length(p_items) > 60 THEN RETURN 0; END IF;
  WITH items AS (
    SELECT (i->>'r')::uuid AS restaurant_id, left(i->>'p', 200) AS page_slug, i->>'s' AS surface, i->>'m' AS metric
      FROM jsonb_array_elements(p_items) i
     WHERE jsonb_typeof(i) = 'object'
       AND i->>'r' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       AND i->>'m' IN ('impressie', 'klik')
       AND i->>'s' IN ('gerechtpagina', 'zoeken', 'kaart', 'homepage', 'badge', 'spotlight')
  ), agg AS (
    SELECT it.restaurant_id, it.page_slug, it.surface, it.metric, count(*)::int AS n
      FROM items it
     WHERE (it.surface <> 'spotlight' AND EXISTS (SELECT 1 FROM public.package_orders o
              WHERE o.restaurant_id = it.restaurant_id AND o.page_slug = it.page_slug
                AND o.package IN ('founding_partner', 'groei', 'topplek', 'dominant') AND public.founding_partner_live(o.status)))
        OR (it.surface = 'spotlight' AND it.page_slug = 'spotlight' AND EXISTS (SELECT 1 FROM public.spotlight_bookings sb
              WHERE sb.restaurant_id = it.restaurant_id AND sb.status = 'active' AND sb.week_start = public.spotlight_week_start(current_date)))
     GROUP BY 1, 2, 3, 4
  ), ins AS (
    INSERT INTO public.paid_stats_daily AS s (restaurant_id, page_slug, surface, dag, metric, n)
    SELECT restaurant_id, page_slug, surface, (now() AT TIME ZONE 'Europe/Amsterdam')::date, metric, n FROM agg
    ON CONFLICT (restaurant_id, page_slug, surface, dag, metric) DO UPDATE SET n = s.n + EXCLUDED.n
    RETURNING 1
  )
  SELECT count(*) INTO v_count FROM ins;
  RETURN v_count;
END $$;

-- Totals per surface for the owner (dashboard report) and admins.
CREATE OR REPLACE FUNCTION public.owner_paid_stats(p_restaurant_id uuid, p_from date DEFAULT NULL, p_to date DEFAULT NULL)
RETURNS TABLE(page_slug text, surface text, metric text, totaal bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT (public.has_role(auth.uid(), 'admin') OR public.is_verified_owner(auth.uid(), p_restaurant_id)) THEN
    RAISE EXCEPTION 'Not authorized to view these statistics' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT s.page_slug, s.surface, s.metric, sum(s.n)::bigint FROM public.paid_stats_daily s
     WHERE s.restaurant_id = p_restaurant_id AND (p_from IS NULL OR s.dag >= p_from) AND (p_to IS NULL OR s.dag <= p_to)
     GROUP BY 1, 2, 3
    UNION ALL
    SELECT f.page_slug, 'gerechtpagina', f.metric, sum(f.n)::bigint FROM public.founding_stats_daily f
     WHERE f.restaurant_id = p_restaurant_id AND (p_from IS NULL OR f.dag >= p_from) AND (p_to IS NULL OR f.dag <= p_to)
     GROUP BY 1, 3;
END $$;
REVOKE ALL ON FUNCTION public.owner_paid_stats(uuid, date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owner_paid_stats(uuid, date, date) TO authenticated;

-- The existing monthly Founding Partner mail reads this one: now all surfaces together.
CREATE OR REPLACE FUNCTION public.owner_founding_stats(p_restaurant_id uuid, p_from date DEFAULT NULL, p_to date DEFAULT NULL)
RETURNS TABLE(page_slug text, metric text, totaal bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT (public.has_role(auth.uid(), 'admin') OR public.is_verified_owner(auth.uid(), p_restaurant_id)) THEN
    RAISE EXCEPTION 'Not authorized to view Founding Partner statistics' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT u.page_slug, u.metric, sum(u.n)::bigint FROM (
      SELECT s.page_slug, s.metric, s.n FROM public.paid_stats_daily s
       WHERE s.restaurant_id = p_restaurant_id AND s.surface <> 'spotlight'
         AND (p_from IS NULL OR s.dag >= p_from) AND (p_to IS NULL OR s.dag <= p_to)
      UNION ALL
      SELECT f.page_slug, f.metric, f.n FROM public.founding_stats_daily f
       WHERE f.restaurant_id = p_restaurant_id AND (p_from IS NULL OR f.dag >= p_from) AND (p_to IS NULL OR f.dag <= p_to)) u
    GROUP BY 1, 2;
END $$;

-- ---------------------------------------------------------------------------------------------
-- 5. Stadsspotlight: 3 restaurants per city per week, 39 euro a week
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.spotlight_week_start(p_day date)
RETURNS date LANGUAGE sql IMMUTABLE AS $$ SELECT (p_day - ((extract(isodow FROM p_day)::int) - 1))::date $$;
CREATE OR REPLACE FUNCTION public.spotlight_price_cents() RETURNS int LANGUAGE sql IMMUTABLE AS $$ SELECT 3900 $$;
CREATE OR REPLACE FUNCTION public.spotlight_slots() RETURNS int LANGUAGE sql IMMUTABLE AS $$ SELECT 3 $$;

CREATE TABLE IF NOT EXISTS public.spotlight_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  user_id uuid,
  city_id uuid NOT NULL REFERENCES public.cities(id) ON DELETE CASCADE,
  week_start date NOT NULL,
  headline text NOT NULL CHECK (char_length(headline) BETWEEN 2 AND 40),
  body text NOT NULL CHECK (char_length(body) BETWEEN 2 AND 160),
  status text NOT NULL DEFAULT 'pending_payment' CHECK (status IN ('pending_payment', 'active', 'cancelled')),
  reserved_until timestamptz,
  amount_cents int NOT NULL DEFAULT 3900,
  stripe_session_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS spotlight_one_per_week ON public.spotlight_bookings (restaurant_id, week_start)
  WHERE status IN ('pending_payment', 'active');
CREATE INDEX IF NOT EXISTS spotlight_city_week ON public.spotlight_bookings (city_id, week_start, status);
ALTER TABLE public.spotlight_bookings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owners view their spotlight bookings" ON public.spotlight_bookings;
CREATE POLICY "Owners view their spotlight bookings" ON public.spotlight_bookings FOR SELECT
  USING (auth.uid() IS NOT NULL AND public.is_verified_owner(auth.uid(), restaurant_id));
DROP POLICY IF EXISTS "Admins manage spotlight bookings" ON public.spotlight_bookings;
CREATE POLICY "Admins manage spotlight bookings" ON public.spotlight_bookings FOR ALL
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
GRANT SELECT ON public.spotlight_bookings TO authenticated;

CREATE OR REPLACE FUNCTION public.spotlight_taken(p_city uuid, p_week date)
RETURNS int LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT count(*)::int FROM public.spotlight_bookings
   WHERE city_id = p_city AND week_start = p_week
     AND (status = 'active' OR (status = 'pending_payment' AND reserved_until > now()))
$$;

-- The coming 8 weeks (this week included) with places left, for the owner's booking calendar.
CREATE OR REPLACE FUNCTION public.spotlight_weeks(p_city uuid, p_restaurant uuid DEFAULT NULL)
RETURNS TABLE (week_start date, places_left int, mine boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT w::date, greatest(0, public.spotlight_slots() - public.spotlight_taken(p_city, w::date)),
         EXISTS (SELECT 1 FROM public.spotlight_bookings b WHERE b.restaurant_id = p_restaurant AND b.week_start = w::date
                  AND (b.status = 'active' OR (b.status = 'pending_payment' AND b.reserved_until > now())))
    FROM generate_series(public.spotlight_week_start(current_date), public.spotlight_week_start(current_date) + 49, interval '7 days') w
$$;
GRANT EXECUTE ON FUNCTION public.spotlight_weeks(uuid, uuid) TO authenticated;

-- Holds the weeks for 30 minutes while the owner pays (service role, from the checkout function).
CREATE OR REPLACE FUNCTION public.spotlight_reserve(p_restaurant uuid, p_user uuid, p_weeks date[], p_headline text, p_body text)
RETURNS uuid[] LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_city uuid; v_week date; v_ids uuid[] := ARRAY[]::uuid[]; v_id uuid;
BEGIN
  SELECT city_id INTO v_city FROM public.restaurants WHERE id = p_restaurant AND is_active;
  IF v_city IS NULL THEN RAISE EXCEPTION 'Restaurant niet gevonden' USING ERRCODE = 'P0001'; END IF;
  IF coalesce(array_length(p_weeks, 1), 0) = 0 OR array_length(p_weeks, 1) > 8 THEN
    RAISE EXCEPTION 'Kies 1 tot 8 weken' USING ERRCODE = 'P0001';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('spotlight:' || v_city::text));
  FOREACH v_week IN ARRAY p_weeks LOOP
    IF v_week <> public.spotlight_week_start(v_week) OR v_week < public.spotlight_week_start(current_date)
       OR v_week > public.spotlight_week_start(current_date) + 49 THEN
      RAISE EXCEPTION 'Deze week kun je niet boeken' USING ERRCODE = 'P0001';
    END IF;
    IF public.spotlight_taken(v_city, v_week) >= public.spotlight_slots() THEN
      RAISE EXCEPTION 'De week van % is vol', to_char(v_week, 'DD-MM') USING ERRCODE = 'P0001';
    END IF;
    UPDATE public.spotlight_bookings SET status = 'cancelled', updated_at = now()
     WHERE restaurant_id = p_restaurant AND week_start = v_week AND status = 'pending_payment' AND reserved_until <= now();
    INSERT INTO public.spotlight_bookings (restaurant_id, user_id, city_id, week_start, headline, body, reserved_until, amount_cents)
      VALUES (p_restaurant, p_user, v_city, v_week, left(trim(p_headline), 40), left(trim(p_body), 160), now() + interval '30 minutes',
              public.spotlight_price_cents())
      RETURNING id INTO v_id;
    v_ids := v_ids || v_id;
  END LOOP;
  RETURN v_ids;
END $$;
REVOKE ALL ON FUNCTION public.spotlight_reserve(uuid, uuid, date[], text, text) FROM public, anon, authenticated;

-- Public: this week's spotlight of a city, in a daily changing order.
CREATE OR REPLACE FUNCTION public.city_spotlight(p_city uuid)
RETURNS TABLE (restaurant_id uuid, headline text, body text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT b.restaurant_id, b.headline, b.body FROM public.spotlight_bookings b
    JOIN public.restaurants r ON r.id = b.restaurant_id AND r.is_active
   WHERE b.city_id = p_city AND b.status = 'active' AND b.week_start = public.spotlight_week_start(current_date)
   ORDER BY md5(b.id::text || current_date::text)
   LIMIT 3
$$;
GRANT EXECUTE ON FUNCTION public.city_spotlight(uuid) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.track_paid_metrics(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.track_paid_metrics(jsonb) TO anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- 6. City newsletter: one edition per city per Tuesday, at most 4 restaurants, 30 euro per 1.000
-- ---------------------------------------------------------------------------------------------
ALTER TABLE public.newsletter_placements ADD COLUMN IF NOT EXISTS edition_date date;
ALTER TABLE public.newsletter_editions ADD COLUMN IF NOT EXISTS city_id uuid REFERENCES public.cities(id) ON DELETE SET NULL;
ALTER TABLE public.newsletter_editions ADD COLUMN IF NOT EXISTS edition_date date;
CREATE INDEX IF NOT EXISTS newsletter_placements_city_date ON public.newsletter_placements (target_city_id, edition_date);

CREATE OR REPLACE FUNCTION public.newsletter_city_readers(p_city uuid)
RETURNS int LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT count(*)::int FROM public.newsletter_subscribers WHERE city_id = p_city AND is_active
$$;
CREATE OR REPLACE FUNCTION public.newsletter_city_price_cents(p_city uuid)
RETURNS int LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT greatest(2000, ceil(public.newsletter_city_readers(p_city) * 3000 / 1000.0)::int)
$$;
CREATE OR REPLACE FUNCTION public.newsletter_city_taken(p_city uuid, p_date date)
RETURNS int LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT count(*)::int FROM public.newsletter_placements
   WHERE target_city_id = p_city AND edition_date = p_date
     AND (status IN ('paid', 'approved', 'published') OR (status = 'pending_payment' AND created_at > now() - interval '30 minutes'))
$$;
-- The next 6 Tuesdays (from 2 days ahead, so there is time to check the placement).
CREATE OR REPLACE FUNCTION public.newsletter_city_editions(p_city uuid)
RETURNS TABLE (edition_date date, places_left int, readers int, price_cents int)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH nxt AS (SELECT (current_date + 2 + ((2 - extract(isodow FROM current_date + 2)::int + 7) % 7))::date AS d)
  SELECT (nxt.d + 7 * g)::date, greatest(0, 4 - public.newsletter_city_taken(p_city, (nxt.d + 7 * g)::date)),
         public.newsletter_city_readers(p_city), public.newsletter_city_price_cents(p_city)
    FROM nxt, generate_series(0, 5) g
$$;
GRANT EXECUTE ON FUNCTION public.newsletter_city_editions(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.newsletter_city_price_cents(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.newsletter_city_taken(uuid, date) TO service_role;

-- ---------------------------------------------------------------------------------------------
-- 7. Bundles: Pro comes with Groei and Dominant
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_owner_pro(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.owner_pro_subscriptions
     WHERE user_id = _user_id AND status = 'active' AND (current_period_end IS NULL OR current_period_end > now()))
  OR EXISTS (
    SELECT 1 FROM public.package_orders o
     WHERE o.user_id = _user_id AND o.package IN ('groei', 'dominant') AND public.founding_partner_live(o.status));
$$;

-- One event or special per month is part of Groei and Dominant: the owner releases it here.
CREATE OR REPLACE FUNCTION public.release_bundle_event(p_event uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_restaurant uuid;
BEGIN
  SELECT restaurant_id INTO v_restaurant FROM public.restaurant_events WHERE id = p_event;
  IF v_restaurant IS NULL OR NOT public.promo_can_manage(v_restaurant) THEN
    RAISE EXCEPTION 'Alleen de geverifieerde eigenaar' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.package_orders o WHERE o.restaurant_id = v_restaurant
                  AND o.package IN ('groei', 'dominant') AND public.founding_partner_live(o.status)) THEN
    RAISE EXCEPTION 'Dit hoort bij Groei en Dominant' USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (SELECT 1 FROM public.restaurant_events e WHERE e.restaurant_id = v_restaurant AND e.id <> p_event
              AND e.promotion_status = 'comped' AND e.released_by IS NULL
              AND coalesce(e.paid_until, now()) > now()) THEN
    RAISE EXCEPTION 'Je evenement van deze maand loopt al. Zet het eerst stop of koop een extra evenement.' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.restaurant_events SET promotion_status = 'comped', released_at = coalesce(released_at, now()),
         released_by = NULL, paid_until = (date_trunc('month', now()) + interval '1 month')
   WHERE id = p_event;
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.release_bundle_event(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.release_bundle_event(uuid) TO authenticated;

-- ---------------------------------------------------------------------------------------------
-- 8. Test visits and "Getest door Dishloopr"
-- ---------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.test_visit_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  user_id uuid,
  status text NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'planned', 'visited', 'approved', 'rejected', 'withdrawn')),
  owner_note text CHECK (owner_note IS NULL OR char_length(owner_note) <= 500),
  feedback text,
  admin_note text,
  visited_on date,
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS test_visit_requests_restaurant ON public.test_visit_requests (restaurant_id, created_at DESC);
ALTER TABLE public.test_visit_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owners view their test visits" ON public.test_visit_requests;
CREATE POLICY "Owners view their test visits" ON public.test_visit_requests FOR SELECT
  USING (auth.uid() IS NOT NULL AND public.is_verified_owner(auth.uid(), restaurant_id));
DROP POLICY IF EXISTS "Admins manage test visits" ON public.test_visit_requests;
CREATE POLICY "Admins manage test visits" ON public.test_visit_requests FOR ALL
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
GRANT SELECT ON public.test_visit_requests TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.test_visit_requests TO authenticated;

-- A claimed restaurant may ask twice in 12 months, and not within 6 months after a rejection.
-- The owner never sees admin_note; the feedback field is what we tell them.
CREATE OR REPLACE FUNCTION public.request_test_visit(p_restaurant uuid, p_note text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_verified_owner(auth.uid(), p_restaurant) THEN
    RAISE EXCEPTION 'Claim eerst je restaurant' USING ERRCODE = '42501';
  END IF;
  IF EXISTS (SELECT 1 FROM public.test_visit_requests WHERE restaurant_id = p_restaurant AND status IN ('requested', 'planned', 'visited')) THEN
    RAISE EXCEPTION 'Je aanvraag loopt nog' USING ERRCODE = 'P0001';
  END IF;
  IF (SELECT count(*) FROM public.test_visit_requests WHERE restaurant_id = p_restaurant AND status <> 'withdrawn'
        AND created_at > now() - interval '12 months') >= 2 THEN
    RAISE EXCEPTION 'Je kunt twee keer per jaar een testbezoek aanvragen' USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (SELECT 1 FROM public.test_visit_requests WHERE restaurant_id = p_restaurant AND status = 'rejected'
              AND coalesce(decided_at, created_at) > now() - interval '6 months') THEN
    RAISE EXCEPTION 'Na een afwijzing kun je na 6 maanden opnieuw een aanvraag doen' USING ERRCODE = 'P0001';
  END IF;
  INSERT INTO public.test_visit_requests (restaurant_id, user_id, owner_note)
    VALUES (p_restaurant, auth.uid(), nullif(left(trim(coalesce(p_note, '')), 500), '')) RETURNING id INTO v_id;
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.request_test_visit(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.request_test_visit(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.my_test_visits(p_restaurant uuid)
RETURNS TABLE (id uuid, status text, feedback text, visited_on date, created_at timestamptz, decided_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT t.id, t.status, t.feedback, t.visited_on, t.created_at, t.decided_at FROM public.test_visit_requests t
   WHERE t.restaurant_id = p_restaurant AND auth.uid() IS NOT NULL AND public.is_verified_owner(auth.uid(), p_restaurant)
   ORDER BY t.created_at DESC LIMIT 10
$$;
GRANT EXECUTE ON FUNCTION public.my_test_visits(uuid) TO authenticated;

ALTER TABLE public.collection_restaurants ADD COLUMN IF NOT EXISTS tested_at date;

-- Public: tested restaurants of a city (homepage "Getest door Dishloopr", shown from 3).
CREATE OR REPLACE FUNCTION public.city_tested_restaurants(p_city uuid)
RETURNS TABLE (restaurant_id uuid, tested_at date, reason text, collection_slug text, collection_title text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT DISTINCT ON (cr.restaurant_id) cr.restaurant_id, cr.tested_at, cr.featured_reason, c.slug, c.title
    FROM public.collection_restaurants cr
    JOIN public.collections c ON c.id = cr.collection_id AND c.is_active
    JOIN public.restaurants r ON r.id = cr.restaurant_id AND r.is_active
   WHERE cr.tested_at IS NOT NULL AND r.city_id = p_city
   ORDER BY cr.restaurant_id, cr.tested_at DESC
$$;
GRANT EXECUTE ON FUNCTION public.city_tested_restaurants(uuid) TO anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- 9. Nightly refresh of pages and counts (04:30 UTC)
-- ---------------------------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pg_cron;
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'refresh-landing-pages';
SELECT cron.schedule('refresh-landing-pages', '30 4 * * *',
  $cron$ SET statement_timeout = '20min'; SELECT public.refresh_landing_pages(); $cron$);

REVOKE ALL ON FUNCTION public.pp_reserve(text, text, uuid) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.uitgelicht_reserve(text, uuid) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.pp_daily(text) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.pp_settle(text) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.uitgelicht_daily() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.uitgelicht_settle() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.topplek_daily() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.topplek_settle() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.pp_place_bid(text, text, uuid, int) FROM public, anon;
REVOKE ALL ON FUNCTION public.place_uitgelicht_bid(text, uuid, int) FROM public, anon;
REVOKE ALL ON FUNCTION public.place_topplek_bid(text, uuid, int) FROM public, anon;
REVOKE ALL ON FUNCTION public.pp_page_status(text, text, uuid) FROM public, anon;
REVOKE ALL ON FUNCTION public.uitgelicht_page_status(text, uuid) FROM public, anon;
REVOKE ALL ON FUNCTION public.topplek_page_status(text, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.place_uitgelicht_bid(text, uuid, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.place_topplek_bid(text, uuid, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.uitgelicht_page_status(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.topplek_page_status(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pp_reserve(text, text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.spotlight_reserve(uuid, uuid, date[], text, text) TO service_role;
