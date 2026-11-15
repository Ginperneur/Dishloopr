CREATE TABLE IF NOT EXISTS public.uitgelicht_dishes (
  dish_slug text PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.uitgelicht_dishes TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.uitgelicht_dishes TO authenticated;
GRANT ALL ON public.uitgelicht_dishes TO service_role;
ALTER TABLE public.uitgelicht_dishes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read the Uitgelicht list" ON public.uitgelicht_dishes;
CREATE POLICY "Anyone can read the Uitgelicht list" ON public.uitgelicht_dishes FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins manage the Uitgelicht list" ON public.uitgelicht_dishes;
CREATE POLICY "Admins manage the Uitgelicht list" ON public.uitgelicht_dishes FOR ALL
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.uitgelicht_min_restaurants()
RETURNS int LANGUAGE sql IMMUTABLE AS $$ SELECT 6 $$;

CREATE OR REPLACE FUNCTION public.landing_page_restaurant_count(p_page_slug text)
RETURNS int LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH pg AS (
    SELECT p.city_id, coalesce(d.canonical_slug, d.slug) AS canon,
           coalesce(coalesce(d.canonical_slug, d.slug) = d.dish_group, false) AS is_hub
      FROM public.seo_landing_pages p JOIN public.dishes d ON d.id = p.dish_id
     WHERE p.slug = p_page_slug LIMIT 1)
  SELECT count(DISTINCT rs.id)::int
    FROM pg
    JOIN public.restaurants rs ON rs.city_id = pg.city_id AND rs.is_active
    JOIN public.restaurant_dishes rd ON rd.restaurant_id = rs.id AND rd.status IN ('approved_by_admin', 'verified_by_owner')
    JOIN public.dishes dd ON dd.id = rd.dish_id
   WHERE (pg.is_hub AND dd.dish_group = pg.canon) OR (NOT pg.is_hub AND dd.canonical_slug = pg.canon)
$$;

CREATE OR REPLACE FUNCTION public.uitgelicht_page_eligible(p_page_slug text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.seo_landing_pages p JOIN public.dishes d ON d.id = p.dish_id
      JOIN public.uitgelicht_dishes u ON u.dish_slug = coalesce(d.canonical_slug, d.slug) AND u.enabled
     WHERE p.slug = p_page_slug AND coalesce(p.is_active, true))
  AND public.landing_page_restaurant_count(p_page_slug) >= public.uitgelicht_min_restaurants()
$$;
GRANT EXECUTE ON FUNCTION public.uitgelicht_page_eligible(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.landing_page_restaurant_count(text) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.uitgelicht_page_offers(p_slug text)
RETURNS TABLE (page_slug text, dish_name text, "position" int, total int, searches_per_month numeric,
               places_left int, list_price_cents int)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.page_slug, p.dish_name, p."position", p.total,
         coalesce((SELECT d.searches_per_month FROM public.uitgelicht_page(p.page_slug) g, public.promo_demand(g.city_id, g.dish_id) d), 0),
         greatest(0, 5 - public.uitgelicht_taken(p.page_slug)),
         public.uitgelicht_list_price(p.page_slug)
    FROM public.restaurant_positions(p_slug) p
   WHERE p.total >= public.uitgelicht_min_restaurants() AND public.uitgelicht_page_eligible(p.page_slug)
$$;
REVOKE ALL ON FUNCTION public.uitgelicht_page_offers(text) FROM public;
GRANT EXECUTE ON FUNCTION public.uitgelicht_page_offers(text) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.place_uitgelicht_bid(p_page_slug text, p_restaurant uuid, p_amount_cents int)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_g record; v_market uuid; v_list int; v_id uuid;
BEGIN
  IF NOT public.promo_can_manage(p_restaurant) THEN
    RAISE EXCEPTION 'Alleen de geverifieerde eigenaar kan bieden' USING ERRCODE = '42501';
  END IF;
  IF NOT public.uitgelicht_page_eligible(p_page_slug) THEN
    RAISE EXCEPTION 'Op deze gerechtpagina is Uitgelicht niet beschikbaar' USING ERRCODE = '22023';
  END IF;
  IF NOT public.uitgelicht_on_page(p_restaurant, p_page_slug) THEN
    RAISE EXCEPTION 'Je restaurant staat niet op deze gerechtpagina' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_g FROM public.uitgelicht_page(p_page_slug);
  IF v_g.city_id IS NULL THEN RAISE EXCEPTION 'Onbekende gerechtpagina' USING ERRCODE = '22023'; END IF;
  v_list := public.uitgelicht_list_price(p_page_slug);
  IF p_amount_cents IS NULL OR p_amount_cents < v_list THEN
    RAISE EXCEPTION 'Bied minimaal de lijstprijs van % euro', v_list / 100 USING ERRCODE = '22023';
  END IF;
  IF p_amount_cents > 9900 * 20 THEN RAISE EXCEPTION 'Dat bod is hoger dan het maximum' USING ERRCODE = '22023'; END IF;
  v_market := public.promo_market_id('uitgelicht', v_g.city_id, v_g.dish_id);
  UPDATE public.promo_bids SET amount_cents = p_amount_cents, updated_at = now()
   WHERE page_slug = p_page_slug AND restaurant_id = p_restaurant AND status = 'open' RETURNING id INTO v_id;
  IF v_id IS NULL THEN
    INSERT INTO public.promo_bids (market_id, restaurant_id, user_id, amount_cents, page_slug)
      VALUES (v_market, p_restaurant, auth.uid(), p_amount_cents, p_page_slug) RETURNING id INTO v_id;
  END IF;
  RETURN v_id;
END $$;