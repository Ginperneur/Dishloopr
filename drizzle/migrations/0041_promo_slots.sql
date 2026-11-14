CREATE TABLE IF NOT EXISTS public.promo_markets (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), product text NOT NULL CHECK (product IN ('routing', 'uitgelicht')),
 city_id uuid NOT NULL REFERENCES public.cities(id) ON DELETE CASCADE,
 dish_id uuid NOT NULL REFERENCES public.dishes(id) ON DELETE CASCADE,
 slots int NOT NULL DEFAULT 3 CHECK (slots BETWEEN 1 AND 10), created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (product, city_id, dish_id)
);
GRANT SELECT ON public.promo_markets TO anon, authenticated;
GRANT ALL ON public.promo_markets TO service_role;
ALTER TABLE public.promo_markets ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS public.promo_slots (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), market_id uuid NOT NULL REFERENCES public.promo_markets(id) ON DELETE CASCADE,
 restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE, user_id uuid NOT NULL,
 status text NOT NULL DEFAULT 'pending_payment' CHECK (status IN ('pending_payment', 'active', 'ending', 'ended')),
 price_cents int NOT NULL CHECK (price_cents > 0), stripe_subscription_id text UNIQUE, bid_id uuid, term_end date,
 reserved_until timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.promo_slots TO authenticated;
GRANT ALL ON public.promo_slots TO service_role;
ALTER TABLE public.promo_slots ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX IF NOT EXISTS promo_slots_one_live ON public.promo_slots (market_id, restaurant_id) WHERE status IN ('pending_payment', 'active', 'ending');
CREATE INDEX IF NOT EXISTS promo_slots_market ON public.promo_slots (market_id, status);
CREATE TABLE IF NOT EXISTS public.promo_bids (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), market_id uuid NOT NULL REFERENCES public.promo_markets(id) ON DELETE CASCADE,
 restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE, user_id uuid NOT NULL,
 amount_cents int NOT NULL CHECK (amount_cents > 0), status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'won', 'lost', 'withdrawn', 'converted', 'expired')),
 clearing_cents int, pay_by timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.promo_bids TO authenticated;
GRANT ALL ON public.promo_bids TO service_role;
ALTER TABLE public.promo_bids ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX IF NOT EXISTS promo_bids_one_live ON public.promo_bids (market_id, restaurant_id) WHERE status IN ('open', 'won');
DROP POLICY IF EXISTS "Anyone can read promo markets" ON public.promo_markets;
CREATE POLICY "Anyone can read promo markets" ON public.promo_markets FOR SELECT USING (true);
DROP POLICY IF EXISTS "Owners read own promo slots" ON public.promo_slots;
CREATE POLICY "Owners read own promo slots" ON public.promo_slots FOR SELECT USING (user_id = auth.uid() OR public.is_verified_owner(auth.uid(), restaurant_id) OR public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "Owners read own promo bids" ON public.promo_bids;
CREATE POLICY "Owners read own promo bids" ON public.promo_bids FOR SELECT USING (user_id = auth.uid() OR public.is_verified_owner(auth.uid(), restaurant_id) OR public.has_role(auth.uid(), 'admin'));
CREATE OR REPLACE FUNCTION public.promo_quarter_end(d date) RETURNS date LANGUAGE sql IMMUTABLE AS $$
 SELECT (date_trunc('quarter', d) + interval '3 months' - interval '1 day')::date
$$;
CREATE OR REPLACE FUNCTION public.promo_base_cents(p_product text) RETURNS int LANGUAGE sql IMMUTABLE AS $$
 SELECT CASE p_product WHEN 'uitgelicht' THEN 9900 ELSE 1500 END
$$;
CREATE OR REPLACE FUNCTION public.promo_demand(p_city uuid, p_dish uuid)
RETURNS TABLE (searches_per_month numeric, suppliers int) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
 WITH c AS (SELECT lower(name) AS name FROM public.cities WHERE id = p_city), d AS (SELECT lower(name) AS name FROM public.dishes WHERE id = p_dish)
 SELECT round((SELECT count(*) FROM public.search_logs s, c, d WHERE s.created_at > now() - interval '90 days' AND lower(coalesce(s.city, '')) = c.name AND s.query_norm LIKE '%' || d.name || '%')::numeric / 3, 1),
 (SELECT count(DISTINCT rd.restaurant_id)::int FROM public.restaurant_dishes rd JOIN public.restaurants r ON r.id = rd.restaurant_id WHERE rd.dish_id = p_dish AND r.city_id = p_city AND r.is_active AND rd.status IN ('verified_by_owner', 'approved_by_admin'))
$$;
CREATE OR REPLACE FUNCTION public.promo_list_price(p_product text, p_city uuid, p_dish uuid)
RETURNS int LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_base int := public.promo_base_cents(p_product); v_s numeric; v_n int; v_raw numeric;
BEGIN
 SELECT searches_per_month, suppliers INTO v_s, v_n FROM public.promo_demand(p_city, p_dish);
 v_raw := v_base * (1 + 0.5 * ln(1 + coalesce(v_s, 0) / 50.0)) * (1 + 0.03 * least(coalesce(v_n, 0), 10));
 RETURN least(v_base * 5, v_base + greatest(0, (round((v_raw - v_base) / 500.0) * 500)::int));
END $$;
CREATE OR REPLACE FUNCTION public.promo_market_id(p_product text, p_city uuid, p_dish uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
 INSERT INTO public.promo_markets (product, city_id, dish_id, slots) VALUES (p_product, p_city, p_dish, CASE p_product WHEN 'uitgelicht' THEN 5 ELSE 3 END) ON CONFLICT (product, city_id, dish_id) DO NOTHING;
 SELECT id INTO v_id FROM public.promo_markets WHERE product = p_product AND city_id = p_city AND dish_id = p_dish;
 RETURN v_id;
END $$;
CREATE OR REPLACE FUNCTION public.promo_taken(p_market uuid) RETURNS int LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
 SELECT count(*)::int FROM public.promo_slots WHERE market_id = p_market AND (status IN ('active', 'ending') OR (status = 'pending_payment' AND reserved_until > now()))
$$;
CREATE OR REPLACE FUNCTION public.promo_can_manage(p_restaurant uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
 SELECT auth.uid() IS NOT NULL AND (public.has_role(auth.uid(), 'admin') OR public.is_verified_owner(auth.uid(), p_restaurant))
$$;
CREATE OR REPLACE FUNCTION public.promo_market_status(p_product text, p_city uuid, p_dish uuid, p_restaurant uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_m public.promo_markets; v_s numeric; v_n int; v_open int; v_highest int;
BEGIN
 IF NOT public.promo_can_manage(p_restaurant) THEN RAISE EXCEPTION 'Alleen de geverifieerde eigenaar' USING ERRCODE = '42501'; END IF;
 SELECT * INTO v_m FROM public.promo_markets WHERE product = p_product AND city_id = p_city AND dish_id = p_dish;
 SELECT searches_per_month, suppliers INTO v_s, v_n FROM public.promo_demand(p_city, p_dish);
 SELECT count(*), max(amount_cents) INTO v_open, v_highest FROM public.promo_bids WHERE market_id = v_m.id AND status = 'open';
 RETURN jsonb_build_object('list_price_cents', public.promo_list_price(p_product, p_city, p_dish), 'slots', coalesce(v_m.slots, CASE p_product WHEN 'uitgelicht' THEN 5 ELSE 3 END), 'taken', CASE WHEN v_m.id IS NULL THEN 0 ELSE public.promo_taken(v_m.id) END,
 'open_bids', coalesce(v_open, 0), 'highest_bid_cents', v_highest, 'searches_per_month', v_s, 'suppliers', v_n, 'next_auction', (public.promo_quarter_end(current_date) + 1),
 'my_slot', (SELECT to_jsonb(s) - 'user_id' FROM public.promo_slots s WHERE s.market_id = v_m.id AND s.restaurant_id = p_restaurant AND s.status IN ('active', 'ending', 'pending_payment') ORDER BY created_at DESC LIMIT 1),
 'my_bid', (SELECT to_jsonb(b) - 'user_id' FROM public.promo_bids b WHERE b.market_id = v_m.id AND b.restaurant_id = p_restaurant AND b.status IN ('open', 'won') LIMIT 1));
END $$;
CREATE OR REPLACE FUNCTION public.promo_dish_on_menu(p_restaurant uuid, p_dish uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
 SELECT EXISTS (SELECT 1 FROM public.restaurant_dishes WHERE restaurant_id = p_restaurant AND dish_id = p_dish AND status IN ('verified_by_owner', 'approved_by_admin'))
$$;
CREATE OR REPLACE FUNCTION public.place_promo_bid(p_product text, p_city uuid, p_dish uuid, p_restaurant uuid, p_amount_cents int)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_market uuid; v_list int; v_id uuid;
BEGIN
 IF NOT public.promo_can_manage(p_restaurant) THEN RAISE EXCEPTION 'Alleen de geverifieerde eigenaar kan bieden' USING ERRCODE = '42501'; END IF;
 IF p_product = 'routing' AND NOT public.promo_dish_on_menu(p_restaurant, p_dish) THEN RAISE EXCEPTION 'Dit gerecht staat niet op je menu' USING ERRCODE = '22023'; END IF;
 v_list := public.promo_list_price(p_product, p_city, p_dish);
 IF p_amount_cents IS NULL OR p_amount_cents < v_list THEN RAISE EXCEPTION 'Bied minimaal de lijstprijs van % euro', v_list / 100 USING ERRCODE = '22023'; END IF;
 IF p_amount_cents > public.promo_base_cents(p_product) * 20 THEN RAISE EXCEPTION 'Dat bod is hoger dan het maximum' USING ERRCODE = '22023'; END IF;
 v_market := public.promo_market_id(p_product, p_city, p_dish);
 UPDATE public.promo_bids SET amount_cents = p_amount_cents, updated_at = now() WHERE market_id = v_market AND restaurant_id = p_restaurant AND status = 'open' RETURNING id INTO v_id;
 IF v_id IS NULL THEN INSERT INTO public.promo_bids (market_id, restaurant_id, user_id, amount_cents) VALUES (v_market, p_restaurant, auth.uid(), p_amount_cents) RETURNING id INTO v_id; END IF;
 RETURN v_id;
END $$;
CREATE OR REPLACE FUNCTION public.withdraw_promo_bid(p_bid uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_r uuid;
BEGIN
 SELECT restaurant_id INTO v_r FROM public.promo_bids WHERE id = p_bid AND status IN ('open', 'won');
 IF v_r IS NULL OR NOT public.promo_can_manage(v_r) THEN RAISE EXCEPTION 'Bod niet gevonden' USING ERRCODE = '42501'; END IF;
 UPDATE public.promo_bids SET status = 'withdrawn', updated_at = now() WHERE id = p_bid;
END $$;
CREATE OR REPLACE FUNCTION public.promo_reserve_slot(p_product text, p_city uuid, p_dish uuid, p_restaurant uuid, p_user uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_market uuid; v_slots int; v_bid public.promo_bids; v_price int; v_slot uuid;
BEGIN
 v_market := public.promo_market_id(p_product, p_city, p_dish);
 SELECT slots INTO v_slots FROM public.promo_markets WHERE id = v_market FOR UPDATE;
 IF EXISTS (SELECT 1 FROM public.promo_slots WHERE market_id = v_market AND restaurant_id = p_restaurant AND status IN ('active', 'ending')) THEN RAISE EXCEPTION 'Je hebt deze plek al' USING ERRCODE = '23505'; END IF;
 UPDATE public.promo_slots SET status = 'ended', updated_at = now() WHERE market_id = v_market AND restaurant_id = p_restaurant AND status = 'pending_payment';
 SELECT * INTO v_bid FROM public.promo_bids WHERE market_id = v_market AND restaurant_id = p_restaurant AND status = 'won' AND pay_by > now();
 IF v_bid.id IS NOT NULL THEN v_price := v_bid.clearing_cents;
 ELSIF public.promo_taken(v_market) < v_slots THEN
 IF EXISTS (SELECT 1 FROM public.promo_bids WHERE market_id = v_market AND status IN ('open', 'won') AND restaurant_id <> p_restaurant) THEN RAISE EXCEPTION 'Er staan bieders op de wachtlijst: plaats een bod' USING ERRCODE = 'P0001'; END IF;
 v_price := public.promo_list_price(p_product, p_city, p_dish);
 ELSE RAISE EXCEPTION 'Alle plekken zijn bezet: plaats een bod' USING ERRCODE = 'P0001'; END IF;
 INSERT INTO public.promo_slots (market_id, restaurant_id, user_id, price_cents, bid_id, reserved_until, term_end) VALUES (v_market, p_restaurant, p_user, v_price, v_bid.id, now() + interval '30 minutes', public.promo_quarter_end(current_date)) RETURNING id INTO v_slot;
 RETURN jsonb_build_object('slot_id', v_slot, 'price_cents', v_price, 'bid_id', v_bid.id);
END $$;
CREATE OR REPLACE FUNCTION public.promo_fill_free_slots(p_market uuid)
RETURNS TABLE (bid_id uuid, restaurant_id uuid, user_id uuid, clearing_cents int) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_m public.promo_markets; v_free int; v_list int; v_clear int;
BEGIN
 SELECT * INTO v_m FROM public.promo_markets WHERE id = p_market FOR UPDATE;
 v_free := v_m.slots - public.promo_taken(p_market) - (SELECT count(*) FROM public.promo_bids b WHERE b.market_id = p_market AND b.status = 'won' AND b.pay_by > now());
 IF v_free <= 0 THEN RETURN; END IF;
 v_list := public.promo_list_price(v_m.product, v_m.city_id, v_m.dish_id);
 SELECT greatest(v_list, coalesce((SELECT b.amount_cents FROM public.promo_bids b WHERE b.market_id = p_market AND b.status = 'open' ORDER BY b.amount_cents DESC, b.created_at OFFSET v_free LIMIT 1), v_list)) INTO v_clear;
 RETURN QUERY UPDATE public.promo_bids b SET status = 'won', clearing_cents = v_clear, pay_by = now() + interval '7 days', updated_at = now()
 WHERE b.id IN (SELECT x.id FROM public.promo_bids x WHERE x.market_id = p_market AND x.status = 'open' ORDER BY x.amount_cents DESC, x.created_at LIMIT v_free)
 RETURNING b.id, b.restaurant_id, b.user_id, b.clearing_cents;
END $$;
CREATE OR REPLACE FUNCTION public.promo_daily()
RETURNS TABLE (action text, slot_id uuid, bid_id uuid, restaurant_id uuid, user_id uuid, price_cents int, stripe_subscription_id text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_market uuid;
BEGIN
 UPDATE public.promo_slots SET status = 'ended', updated_at = now() WHERE status = 'pending_payment' AND reserved_until < now();
 UPDATE public.promo_bids SET status = 'expired', updated_at = now() WHERE status = 'won' AND pay_by < now();
 FOR v_market IN SELECT DISTINCT b.market_id FROM public.promo_bids b JOIN public.promo_markets m ON m.id = b.market_id WHERE b.status = 'open' AND m.product = 'routing' LOOP
 RETURN QUERY SELECT 'won'::text, NULL::uuid, f.bid_id, f.restaurant_id, f.user_id, f.clearing_cents, NULL::text FROM public.promo_fill_free_slots(v_market) f;
 END LOOP;
END $$;
CREATE OR REPLACE FUNCTION public.promo_settle()
RETURNS TABLE (action text, slot_id uuid, bid_id uuid, restaurant_id uuid, user_id uuid, price_cents int, stripe_subscription_id text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_m public.promo_markets; v_list int; v_clear int; v_term date := public.promo_quarter_end(current_date);
BEGIN
 FOR v_m IN SELECT * FROM public.promo_markets WHERE product = 'routing' LOOP
 v_list := public.promo_list_price(v_m.product, v_m.city_id, v_m.dish_id);
 IF NOT EXISTS (SELECT 1 FROM public.promo_bids b WHERE b.market_id = v_m.id AND b.status = 'open') THEN
 RETURN QUERY UPDATE public.promo_slots s SET price_cents = v_list, term_end = v_term, updated_at = now() WHERE s.market_id = v_m.id AND s.status = 'active' AND s.price_cents <> v_list RETURNING 'reprice'::text, s.id, NULL::uuid, s.restaurant_id, s.user_id, s.price_cents, s.stripe_subscription_id;
 UPDATE public.promo_slots s SET term_end = v_term WHERE s.market_id = v_m.id AND s.status = 'active';
 CONTINUE;
 END IF;
 CREATE TEMP TABLE IF NOT EXISTS promo_rank (kind text, slot_id uuid, bid_id uuid, restaurant_id uuid, user_id uuid, amount int, holder boolean, created timestamptz, sub text) ON COMMIT DROP;
 DELETE FROM promo_rank;
 INSERT INTO promo_rank SELECT 'holder', s.id, b.id, s.restaurant_id, s.user_id, greatest(v_list, coalesce(b.amount_cents, 0)), true, s.created_at, s.stripe_subscription_id FROM public.promo_slots s LEFT JOIN public.promo_bids b ON b.market_id = s.market_id AND b.restaurant_id = s.restaurant_id AND b.status = 'open' WHERE s.market_id = v_m.id AND s.status = 'active';
 INSERT INTO promo_rank SELECT 'bid', NULL, b.id, b.restaurant_id, b.user_id, b.amount_cents, false, b.created_at, NULL FROM public.promo_bids b WHERE b.market_id = v_m.id AND b.status = 'open' AND NOT EXISTS (SELECT 1 FROM promo_rank r WHERE r.restaurant_id = b.restaurant_id);
 SELECT greatest(v_list, coalesce((SELECT amount FROM promo_rank ORDER BY amount DESC, holder DESC, created OFFSET v_m.slots LIMIT 1), v_list)) INTO v_clear;
 CREATE TEMP TABLE IF NOT EXISTS promo_win (restaurant_id uuid) ON COMMIT DROP;
 DELETE FROM promo_win;
 INSERT INTO promo_win SELECT r.restaurant_id FROM promo_rank r ORDER BY amount DESC, holder DESC, created LIMIT v_m.slots;
 RETURN QUERY UPDATE public.promo_slots s SET price_cents = v_clear, term_end = v_term, updated_at = now() WHERE s.market_id = v_m.id AND s.status = 'active' AND s.restaurant_id IN (SELECT w.restaurant_id FROM promo_win w) RETURNING 'reprice'::text, s.id, NULL::uuid, s.restaurant_id, s.user_id, s.price_cents, s.stripe_subscription_id;
 UPDATE public.promo_bids b SET status = 'converted', updated_at = now() WHERE b.market_id = v_m.id AND b.status = 'open' AND b.restaurant_id IN (SELECT r.restaurant_id FROM promo_rank r WHERE r.holder) AND b.restaurant_id IN (SELECT w.restaurant_id FROM promo_win w);
 RETURN QUERY UPDATE public.promo_slots s SET status = 'ending', updated_at = now() WHERE s.market_id = v_m.id AND s.status = 'active' AND s.restaurant_id NOT IN (SELECT w.restaurant_id FROM promo_win w) RETURNING 'cancel'::text, s.id, NULL::uuid, s.restaurant_id, s.user_id, s.price_cents, s.stripe_subscription_id;
 RETURN QUERY UPDATE public.promo_bids b SET status = 'won', clearing_cents = v_clear, pay_by = now() + interval '7 days', updated_at = now() WHERE b.market_id = v_m.id AND b.status = 'open' AND b.restaurant_id IN (SELECT w.restaurant_id FROM promo_win w) AND b.restaurant_id NOT IN (SELECT r.restaurant_id FROM promo_rank r WHERE r.holder) RETURNING 'won'::text, NULL::uuid, b.id, b.restaurant_id, b.user_id, b.clearing_cents, NULL::text;
 END LOOP;
END $$;
CREATE OR REPLACE FUNCTION public.routing_sponsors(p_city uuid, p_dish_ids uuid[]) RETURNS TABLE (restaurant_id uuid, dish_id uuid) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
 SELECT DISTINCT s.restaurant_id, m.dish_id FROM public.promo_slots s JOIN public.promo_markets m ON m.id = s.market_id WHERE m.product = 'routing' AND m.city_id = p_city AND m.dish_id = ANY (p_dish_ids) AND s.status IN ('active', 'ending')
$$;
REVOKE ALL ON FUNCTION public.promo_demand(uuid, uuid) FROM public, anon;
REVOKE ALL ON FUNCTION public.promo_market_id(text, uuid, uuid) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.promo_reserve_slot(text, uuid, uuid, uuid, uuid) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.promo_fill_free_slots(uuid) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.promo_daily() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.promo_settle() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.place_promo_bid(text, uuid, uuid, uuid, int) FROM public, anon;
REVOKE ALL ON FUNCTION public.withdraw_promo_bid(uuid) FROM public, anon;
REVOKE ALL ON FUNCTION public.promo_market_status(text, uuid, uuid, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.promo_demand(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.place_promo_bid(text, uuid, uuid, uuid, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.withdraw_promo_bid(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.promo_market_status(text, uuid, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.routing_sponsors(uuid, uuid[]) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.promo_list_price(text, uuid, uuid) TO anon, authenticated;
DO $do$
BEGIN
 IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
 PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'promo-auctions';
 PERFORM cron.schedule('promo-auctions', '0 3 * * *', $cron$
 SELECT net.http_post(url := 'https://uktafmxojymsojqewzuy.supabase.co/functions/v1/promo-auctions', headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', (SELECT secret FROM public.internal_job_secrets WHERE name = 'cron')), body := '{}'::jsonb);
 $cron$);
 END IF;
END $do$;