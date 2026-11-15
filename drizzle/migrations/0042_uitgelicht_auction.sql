ALTER TABLE public.promo_bids ADD COLUMN IF NOT EXISTS page_slug text;
CREATE INDEX IF NOT EXISTS promo_bids_page ON public.promo_bids (page_slug, status) WHERE page_slug IS NOT NULL;
CREATE OR REPLACE FUNCTION public.uitgelicht_window_end() RETURNS timestamptz LANGUAGE sql IMMUTABLE AS $$ SELECT timestamptz '2027-01-05 23:59:59 Europe/Amsterdam' $$;
CREATE OR REPLACE FUNCTION public.uitgelicht_page(p_page_slug text) RETURNS TABLE (city_id uuid, dish_id uuid) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
 SELECT p.city_id, p.dish_id FROM public.seo_landing_pages p WHERE p.slug = p_page_slug AND p.city_id IS NOT NULL LIMIT 1
$$;
CREATE OR REPLACE FUNCTION public.uitgelicht_list_price(p_page_slug text) RETURNS int LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
 SELECT coalesce((SELECT public.promo_list_price('uitgelicht', g.city_id, g.dish_id) FROM public.uitgelicht_page(p_page_slug) g), 9900)
$$;
CREATE OR REPLACE FUNCTION public.uitgelicht_protected(p_created timestamptz, p_plan text, p_period_end timestamptz) RETURNS boolean LANGUAGE sql STABLE AS $$
 SELECT (p_created <= public.uitgelicht_window_end() AND current_date <= date '2027-12-31') OR (p_plan = 'year' AND coalesce(p_period_end, now()) > now())
$$;
CREATE OR REPLACE FUNCTION public.uitgelicht_on_page(p_restaurant uuid, p_page_slug text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
 SELECT EXISTS (SELECT 1 FROM public.restaurant_positions((SELECT slug FROM public.restaurants WHERE id = p_restaurant)) x WHERE x.page_slug = p_page_slug)
$$;
CREATE OR REPLACE FUNCTION public.uitgelicht_taken(p_page_slug text) RETURNS int LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
 SELECT (SELECT count(*) FROM public.package_orders WHERE package = 'founding_partner' AND page_slug = p_page_slug AND public.founding_partner_live(status))::int + (SELECT count(*) FROM public.promo_bids WHERE page_slug = p_page_slug AND status = 'won' AND pay_by > now())::int
$$;
CREATE OR REPLACE FUNCTION public.uitgelicht_page_status(p_page_slug text, p_restaurant uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_open int; v_high int;
BEGIN
 IF NOT public.promo_can_manage(p_restaurant) THEN RAISE EXCEPTION 'Alleen de geverifieerde eigenaar' USING ERRCODE = '42501'; END IF;
 SELECT count(*), max(amount_cents) INTO v_open, v_high FROM public.promo_bids WHERE page_slug = p_page_slug AND status = 'open';
 RETURN jsonb_build_object('list_price_cents', public.uitgelicht_list_price(p_page_slug), 'slots', 5, 'taken', public.uitgelicht_taken(p_page_slug), 'open_bids', coalesce(v_open, 0), 'highest_bid_cents', v_high, 'window_open', now() <= public.uitgelicht_window_end(), 'next_auction', (public.promo_quarter_end(current_date) + 1), 'my_bid', (SELECT to_jsonb(b) - 'user_id' FROM public.promo_bids b WHERE b.page_slug = p_page_slug AND b.restaurant_id = p_restaurant AND b.status IN ('open', 'won') LIMIT 1));
END $$;
CREATE OR REPLACE FUNCTION public.place_uitgelicht_bid(p_page_slug text, p_restaurant uuid, p_amount_cents int) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_g record; v_market uuid; v_list int; v_id uuid;
BEGIN
 IF NOT public.promo_can_manage(p_restaurant) THEN RAISE EXCEPTION 'Alleen de geverifieerde eigenaar kan bieden' USING ERRCODE = '42501'; END IF;
 IF NOT public.uitgelicht_on_page(p_restaurant, p_page_slug) THEN RAISE EXCEPTION 'Je restaurant staat niet op deze gerechtpagina' USING ERRCODE = '22023'; END IF;
 SELECT * INTO v_g FROM public.uitgelicht_page(p_page_slug);
 IF v_g.city_id IS NULL THEN RAISE EXCEPTION 'Onbekende gerechtpagina' USING ERRCODE = '22023'; END IF;
 v_list := public.uitgelicht_list_price(p_page_slug);
 IF p_amount_cents IS NULL OR p_amount_cents < v_list THEN RAISE EXCEPTION 'Bied minimaal de lijstprijs van % euro', v_list / 100 USING ERRCODE = '22023'; END IF;
 IF p_amount_cents > 9900 * 20 THEN RAISE EXCEPTION 'Dat bod is hoger dan het maximum' USING ERRCODE = '22023'; END IF;
 v_market := public.promo_market_id('uitgelicht', v_g.city_id, v_g.dish_id);
 UPDATE public.promo_bids SET amount_cents = p_amount_cents, updated_at = now() WHERE page_slug = p_page_slug AND restaurant_id = p_restaurant AND status = 'open' RETURNING id INTO v_id;
 IF v_id IS NULL THEN INSERT INTO public.promo_bids (market_id, restaurant_id, user_id, amount_cents, page_slug) VALUES (v_market, p_restaurant, auth.uid(), p_amount_cents, p_page_slug) RETURNING id INTO v_id; END IF;
 RETURN v_id;
END $$;
CREATE OR REPLACE FUNCTION public.uitgelicht_reserve(p_page_slug text, p_restaurant uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_bid public.promo_bids;
BEGIN
 SELECT * INTO v_bid FROM public.promo_bids WHERE page_slug = p_page_slug AND restaurant_id = p_restaurant AND status = 'won' AND pay_by > now();
 IF v_bid.id IS NOT NULL THEN RETURN jsonb_build_object('price_cents', v_bid.clearing_cents, 'bid_id', v_bid.id); END IF;
 IF public.uitgelicht_taken(p_page_slug) >= 5 THEN RAISE EXCEPTION 'Alle 5 plekken op deze pagina zijn bezet: plaats een bod' USING ERRCODE = 'P0001'; END IF;
 IF EXISTS (SELECT 1 FROM public.promo_bids WHERE page_slug = p_page_slug AND status = 'open' AND restaurant_id <> p_restaurant) THEN RAISE EXCEPTION 'Er staan bieders op de wachtlijst: plaats een bod' USING ERRCODE = 'P0001'; END IF;
 RETURN jsonb_build_object('price_cents', public.uitgelicht_list_price(p_page_slug), 'bid_id', NULL);
END $$;
CREATE OR REPLACE FUNCTION public.uitgelicht_daily()
RETURNS TABLE (action text, slot_id uuid, bid_id uuid, restaurant_id uuid, user_id uuid, price_cents int, stripe_subscription_id text) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_page text; v_free int; v_list int; v_clear int;
BEGIN
 UPDATE public.promo_bids SET status = 'expired', updated_at = now() WHERE page_slug IS NOT NULL AND status = 'won' AND pay_by < now();
 FOR v_page IN SELECT DISTINCT b.page_slug FROM public.promo_bids b WHERE b.page_slug IS NOT NULL AND b.status = 'open' LOOP
 v_free := 5 - public.uitgelicht_taken(v_page);
 CONTINUE WHEN v_free <= 0;
 v_list := public.uitgelicht_list_price(v_page);
 SELECT greatest(v_list, coalesce((SELECT b.amount_cents FROM public.promo_bids b WHERE b.page_slug = v_page AND b.status = 'open' ORDER BY b.amount_cents DESC, b.created_at OFFSET v_free LIMIT 1), v_list)) INTO v_clear;
 RETURN QUERY WITH w AS (UPDATE public.promo_bids b SET status = 'won', clearing_cents = v_clear, pay_by = now() + interval '7 days', updated_at = now() WHERE b.id IN (SELECT x.id FROM public.promo_bids x WHERE x.page_slug = v_page AND x.status = 'open' ORDER BY x.amount_cents DESC, x.created_at LIMIT v_free) RETURNING b.id, b.restaurant_id, b.user_id, b.clearing_cents)
 SELECT 'won'::text, NULL::uuid, w.id, w.restaurant_id, w.user_id, w.clearing_cents, NULL::text FROM w;
 END LOOP;
END $$;
CREATE OR REPLACE FUNCTION public.uitgelicht_settle()
RETURNS TABLE (action text, slot_id uuid, bid_id uuid, restaurant_id uuid, user_id uuid, price_cents int, stripe_subscription_id text) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_page text; v_list int; v_avail int; v_clear int;
BEGIN
 FOR v_page IN SELECT DISTINCT o.page_slug FROM public.package_orders o WHERE o.package = 'founding_partner' AND public.founding_partner_live(o.status)
 UNION SELECT DISTINCT b.page_slug FROM public.promo_bids b WHERE b.page_slug IS NOT NULL AND b.status = 'open' LOOP
 v_list := public.uitgelicht_list_price(v_page);
 CREATE TEMP TABLE IF NOT EXISTS uit_rank (order_id uuid, bid_id uuid, restaurant_id uuid, user_id uuid, amount int, holder boolean, created timestamptz, sub text) ON COMMIT DROP;
 DELETE FROM uit_rank;
 INSERT INTO uit_rank SELECT o.id, b.id, o.restaurant_id, o.user_id, greatest(v_list, coalesce(b.amount_cents, 0)), true, o.created_at, o.stripe_subscription_id
 FROM public.package_orders o LEFT JOIN public.promo_bids b ON b.page_slug = o.page_slug AND b.restaurant_id = o.restaurant_id AND b.status = 'open'
 WHERE o.package = 'founding_partner' AND o.page_slug = v_page AND public.founding_partner_live(o.status) AND o.plan = 'month' AND NOT public.uitgelicht_protected(o.created_at, o.plan, o.current_period_end);
 v_avail := 5 - (SELECT count(*) FROM public.package_orders o WHERE o.package = 'founding_partner' AND o.page_slug = v_page AND public.founding_partner_live(o.status) AND (o.plan <> 'month' OR public.uitgelicht_protected(o.created_at, o.plan, o.current_period_end)))::int;
 IF NOT EXISTS (SELECT 1 FROM public.promo_bids b WHERE b.page_slug = v_page AND b.status = 'open') THEN
 RETURN QUERY WITH u AS (UPDATE public.package_orders o SET amount_cents = v_list, updated_at = now() WHERE o.id IN (SELECT r.order_id FROM uit_rank r) AND o.amount_cents <> v_list RETURNING o.id, o.restaurant_id, o.user_id, o.amount_cents, o.stripe_subscription_id)
 SELECT 'reprice'::text, u.id, NULL::uuid, u.restaurant_id, u.user_id, u.amount_cents, u.stripe_subscription_id FROM u;
 CONTINUE;
 END IF;
 INSERT INTO uit_rank SELECT NULL, b.id, b.restaurant_id, b.user_id, b.amount_cents, false, b.created_at, NULL FROM public.promo_bids b
 WHERE b.page_slug = v_page AND b.status = 'open' AND NOT EXISTS (SELECT 1 FROM uit_rank r WHERE r.restaurant_id = b.restaurant_id)
 AND NOT EXISTS (SELECT 1 FROM public.package_orders o WHERE o.page_slug = v_page AND o.restaurant_id = b.restaurant_id AND o.package = 'founding_partner' AND public.founding_partner_live(o.status));
 SELECT greatest(v_list, coalesce((SELECT amount FROM uit_rank ORDER BY amount DESC, holder DESC, created OFFSET greatest(v_avail, 0) LIMIT 1), v_list)) INTO v_clear;
 CREATE TEMP TABLE IF NOT EXISTS uit_win (restaurant_id uuid) ON COMMIT DROP;
 DELETE FROM uit_win;
 INSERT INTO uit_win SELECT r.restaurant_id FROM uit_rank r ORDER BY amount DESC, holder DESC, created LIMIT greatest(v_avail, 0);
 RETURN QUERY WITH u AS (UPDATE public.package_orders o SET amount_cents = v_clear, updated_at = now() WHERE o.id IN (SELECT r.order_id FROM uit_rank r WHERE r.holder AND r.restaurant_id IN (SELECT w.restaurant_id FROM uit_win w)) RETURNING o.id, o.restaurant_id, o.user_id, o.amount_cents, o.stripe_subscription_id)
 SELECT 'reprice'::text, u.id, NULL::uuid, u.restaurant_id, u.user_id, u.amount_cents, u.stripe_subscription_id FROM u;
 UPDATE public.promo_bids b SET status = 'converted', updated_at = now() WHERE b.page_slug = v_page AND b.status = 'open' AND b.restaurant_id IN (SELECT r.restaurant_id FROM uit_rank r WHERE r.holder) AND b.restaurant_id IN (SELECT w.restaurant_id FROM uit_win w);
 RETURN QUERY SELECT 'cancel'::text, r.order_id, NULL::uuid, r.restaurant_id, r.user_id, v_clear, r.sub FROM uit_rank r WHERE r.holder AND r.restaurant_id NOT IN (SELECT w.restaurant_id FROM uit_win w);
 RETURN QUERY WITH w AS (UPDATE public.promo_bids b SET status = 'won', clearing_cents = v_clear, pay_by = now() + interval '7 days', updated_at = now() WHERE b.page_slug = v_page AND b.status = 'open' AND b.restaurant_id IN (SELECT x.restaurant_id FROM uit_win x) AND b.restaurant_id NOT IN (SELECT r.restaurant_id FROM uit_rank r WHERE r.holder) RETURNING b.id, b.restaurant_id, b.user_id, b.clearing_cents)
 SELECT 'won'::text, NULL::uuid, w.id, w.restaurant_id, w.user_id, w.clearing_cents, NULL::text FROM w;
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.uitgelicht_reserve(text, uuid) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.uitgelicht_daily() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.uitgelicht_settle() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.place_uitgelicht_bid(text, uuid, int) FROM public, anon;
REVOKE ALL ON FUNCTION public.uitgelicht_page_status(text, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.place_uitgelicht_bid(text, uuid, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.uitgelicht_page_status(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.uitgelicht_list_price(text) TO anon, authenticated;