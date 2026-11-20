-- Payment integrity (audit 19-11-2026). Idempotent: Lovable may renumber and re-run it.
--
-- 1. One Stripe customer per user, so lookups by email can no longer pick a fresh customer
--    without the Pro subscription (which switched paying owners' Pro off).
-- 2. Every Stripe event is processed once (redeliveries no longer re-run imports, re-send mails
--    or reactivate cancelled places).
-- 3. Uitgelicht and Topplek are held while the owner pays, like Stadsspotlight and Vraag
--    doorsturen already were, so a page can no longer be oversold.
-- 4. The newsletter limit (4 per edition) and the one free Dominant placement per month are
--    checked under a lock, so parallel checkouts cannot both get the last place.
-- 5. Reservations outlive the 30-minute Stripe session by 5 minutes, so a payment in the last
--    seconds never lands on a place that was already given away; a week that already started can
--    no longer be booked for Stadsspotlight.

-- 1. Stripe customers --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.stripe_customers (
  user_id uuid PRIMARY KEY,
  stripe_customer_id text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.stripe_customers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.stripe_customers FROM anon, authenticated;
GRANT ALL ON public.stripe_customers TO service_role;

-- 2. Processed Stripe events -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.stripe_processed_events (
  event_id text PRIMARY KEY,
  event_type text,
  received_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.stripe_processed_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.stripe_processed_events FROM anon, authenticated;
GRANT ALL ON public.stripe_processed_events TO service_role;

-- 3. Holds for Uitgelicht and Topplek ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.package_checkout_holds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL,
  page_slug text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('uitgelicht', 'topplek')),
  bid_id uuid,
  user_id uuid,
  stripe_session_id text,
  reserved_until timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS package_checkout_holds_page ON public.package_checkout_holds (page_slug, kind, reserved_until);
CREATE INDEX IF NOT EXISTS package_checkout_holds_session ON public.package_checkout_holds (stripe_session_id);
ALTER TABLE public.package_checkout_holds ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.package_checkout_holds FROM anon, authenticated;
GRANT ALL ON public.package_checkout_holds TO service_role;

-- A place on a page is taken by a live order, a won bid that may still be paid, or a running
-- checkout of someone else (holds for a won bid are already counted through the bid).
CREATE OR REPLACE FUNCTION public.pp_taken(p_kind text, p_page_slug text)
RETURNS int LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT (SELECT count(*) FROM public.package_orders WHERE package = ANY (public.pp_packages(p_kind)) AND page_slug = p_page_slug
            AND public.founding_partner_live(status))::int
       + (SELECT count(*) FROM public.pp_bids(p_kind, p_page_slug) b WHERE b.status = 'won' AND b.pay_by > now())::int
       + (SELECT count(*) FROM public.package_checkout_holds h
           WHERE h.page_slug = p_page_slug AND h.kind = p_kind AND h.bid_id IS NULL AND h.reserved_until > now())::int
$$;

-- Holds a place for one checkout. Under a lock per page and kind: the restaurant's own earlier
-- hold on this page is replaced (its Stripe session ids are returned so the caller can expire
-- them), then the normal rules decide (pp_reserve, or the Founding Partner places).
CREATE OR REPLACE FUNCTION public.pp_hold(p_kind text, p_page_slug text, p_restaurant uuid, p_user uuid, p_founding boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_old text[]; v_res jsonb; v_hold uuid; v_bid uuid;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('pp_hold:' || p_kind || ':' || p_page_slug));
  WITH gone AS (
    DELETE FROM public.package_checkout_holds
     WHERE restaurant_id = p_restaurant AND page_slug = p_page_slug
     RETURNING stripe_session_id)
  SELECT coalesce(array_agg(stripe_session_id) FILTER (WHERE stripe_session_id IS NOT NULL), ARRAY[]::text[]) INTO v_old FROM gone;
  IF p_founding THEN
    IF EXISTS (SELECT 1 FROM public.package_orders o WHERE o.page_slug = p_page_slug AND o.restaurant_id = p_restaurant
                AND o.package <> 'menu_service' AND public.founding_partner_live(o.status)) THEN
      RAISE EXCEPTION 'Je hebt al een betaalde plek op deze pagina' USING ERRCODE = 'P0001';
    END IF;
    IF public.pp_taken(p_kind, p_page_slug) >= public.pp_slots(p_kind) THEN
      RAISE EXCEPTION 'Alle plekken op deze pagina zijn vergeven' USING ERRCODE = 'P0001';
    END IF;
    v_res := jsonb_build_object('price_cents', NULL, 'bid_id', NULL);
  ELSE
    v_res := public.pp_reserve(p_kind, p_page_slug, p_restaurant);
  END IF;
  v_bid := nullif(v_res->>'bid_id', '')::uuid;
  INSERT INTO public.package_checkout_holds (restaurant_id, page_slug, kind, bid_id, user_id, reserved_until)
    VALUES (p_restaurant, p_page_slug, p_kind, v_bid, p_user, now() + interval '35 minutes')
    RETURNING id INTO v_hold;
  RETURN v_res || jsonb_build_object('hold_id', v_hold, 'replaced_sessions', to_jsonb(v_old));
END $$;
REVOKE ALL ON FUNCTION public.pp_hold(text, text, uuid, uuid, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pp_hold(text, text, uuid, uuid, boolean) TO service_role;

-- Old holds are only noise once expired.
CREATE OR REPLACE FUNCTION public.purge_expired_checkout_holds()
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  DELETE FROM public.package_checkout_holds WHERE reserved_until < now() - interval '1 day'
$$;
REVOKE ALL ON FUNCTION public.purge_expired_checkout_holds() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_expired_checkout_holds() TO service_role;

-- 4. Newsletter: limit and Dominant credit under a lock ----------------------------------------
-- A pending placement holds its place for 35 minutes (the Stripe session lasts 30).
CREATE OR REPLACE FUNCTION public.newsletter_city_taken(p_city uuid, p_date date)
RETURNS int LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT count(*)::int FROM public.newsletter_placements
   WHERE target_city_id = p_city AND edition_date = p_date
     AND (status IN ('paid', 'approved', 'published') OR (status = 'pending_payment' AND created_at > now() - interval '35 minutes'))
$$;

CREATE OR REPLACE FUNCTION public.guard_newsletter_placement()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_month date;
BEGIN
  IF NEW.target_city_id IS NULL OR NEW.edition_date IS NULL OR NEW.status NOT IN ('pending_payment', 'paid') THEN
    RETURN NEW;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('newsletter:' || NEW.target_city_id::text || ':' || NEW.edition_date::text));
  IF public.newsletter_city_taken(NEW.target_city_id, NEW.edition_date) >= 4 THEN
    RAISE EXCEPTION 'Deze editie is vol, kies een andere week' USING ERRCODE = 'P0001';
  END IF;
  -- The free Dominant placement: one per restaurant per calendar month of the edition.
  IF coalesce(NEW.price_paid, 0) = 0 AND NEW.status = 'paid' THEN
    v_month := date_trunc('month', NEW.edition_date)::date;
    PERFORM pg_advisory_xact_lock(hashtext('newsletter_credit:' || NEW.restaurant_id::text));
    IF EXISTS (SELECT 1 FROM public.newsletter_placements p
                WHERE p.restaurant_id = NEW.restaurant_id AND coalesce(p.price_paid, 0) = 0
                  AND p.status IN ('paid', 'approved', 'published')
                  AND p.edition_date >= v_month AND p.edition_date < (v_month + interval '1 month')::date) THEN
      RAISE EXCEPTION 'De gratis plaatsing van deze maand is al gebruikt' USING ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS guard_newsletter_placement ON public.newsletter_placements;
CREATE TRIGGER guard_newsletter_placement BEFORE INSERT ON public.newsletter_placements
  FOR EACH ROW EXECUTE FUNCTION public.guard_newsletter_placement();

-- 5. Stadsspotlight: no week that already started; the reservation outlives the session --------
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
    -- A week can be booked up to and including its first day (Monday), not once it is running.
    IF v_week <> public.spotlight_week_start(v_week) OR v_week < current_date
       OR v_week > public.spotlight_first_bookable_week() + 49 THEN
      RAISE EXCEPTION 'Deze week kun je niet boeken' USING ERRCODE = 'P0001';
    END IF;
    -- The restaurant's own earlier, unpaid checkout for this week is replaced (before counting,
    -- so it does not block its own retry); paying that old session no longer activates anything.
    UPDATE public.spotlight_bookings SET status = 'cancelled', updated_at = now()
     WHERE restaurant_id = p_restaurant AND week_start = v_week AND status = 'pending_payment';
    IF public.spotlight_taken(v_city, v_week) >= public.spotlight_slots() THEN
      RAISE EXCEPTION 'De week van % is vol', to_char(v_week, 'DD-MM') USING ERRCODE = 'P0001';
    END IF;
    INSERT INTO public.spotlight_bookings (restaurant_id, user_id, city_id, week_start, headline, body, reserved_until, amount_cents)
      VALUES (p_restaurant, p_user, v_city, v_week, left(trim(p_headline), 40), left(trim(p_body), 160), now() + interval '35 minutes',
              public.spotlight_price_cents())
      RETURNING id INTO v_id;
    v_ids := v_ids || v_id;
  END LOOP;
  RETURN v_ids;
END $$;
REVOKE ALL ON FUNCTION public.spotlight_reserve(uuid, uuid, date[], text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.spotlight_reserve(uuid, uuid, date[], text, text) TO service_role;

-- The weeks an owner can choose: from the first week that has not started yet (a Monday today
-- still counts), 8 weeks ahead.
CREATE OR REPLACE FUNCTION public.spotlight_first_bookable_week()
RETURNS date LANGUAGE sql STABLE AS $$
  SELECT CASE WHEN public.spotlight_week_start(current_date) < current_date
              THEN public.spotlight_week_start(current_date) + 7 ELSE current_date END
$$;
CREATE OR REPLACE FUNCTION public.spotlight_weeks(p_city uuid, p_restaurant uuid DEFAULT NULL)
RETURNS TABLE (week_start date, places_left int, mine boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT w::date, greatest(0, public.spotlight_slots() - public.spotlight_taken(p_city, w::date)),
         EXISTS (SELECT 1 FROM public.spotlight_bookings b WHERE b.restaurant_id = p_restaurant AND b.week_start = w::date
                   AND (b.status = 'active' OR (b.status = 'pending_payment' AND b.reserved_until > now())))
    FROM generate_series(public.spotlight_first_bookable_week(), public.spotlight_first_bookable_week() + 49, interval '7 days') w
$$;
GRANT EXECUTE ON FUNCTION public.spotlight_weeks(uuid, uuid) TO authenticated;

-- 6. Extra tags included with Owner Pro switch on and off with Pro -----------------------------
-- create-tag-checkout gives Pro restaurants extra tags without payment (payment_type 'owner_pro');
-- they follow the restaurant's Pro state, whichever way it changes (subscription, bundle, gift).
CREATE OR REPLACE FUNCTION public.sync_pro_included_tags()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_pro boolean := coalesce(NEW.owner_tier, '') = 'pro' OR coalesce(NEW.owner_pro_override, false);
BEGIN
  UPDATE public.restaurant_tag_subscriptions SET is_active = v_pro
   WHERE restaurant_id = NEW.id AND payment_type = 'owner_pro' AND is_active IS DISTINCT FROM v_pro;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS sync_pro_included_tags ON public.restaurants;
CREATE TRIGGER sync_pro_included_tags AFTER UPDATE OF owner_tier, owner_pro_override ON public.restaurants
  FOR EACH ROW WHEN (OLD.owner_tier IS DISTINCT FROM NEW.owner_tier OR OLD.owner_pro_override IS DISTINCT FROM NEW.owner_pro_override)
  EXECUTE FUNCTION public.sync_pro_included_tags();


-- 7. Vraag doorsturen: the reservation outlives its Stripe session (31 minutes) as well -------------
CREATE OR REPLACE FUNCTION public.promo_reserve_slot(p_product text, p_city uuid, p_dish uuid, p_restaurant uuid, p_user uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_market uuid; v_slots int; v_bid public.promo_bids; v_price int; v_slot uuid;
BEGIN
  v_market := public.promo_market_id(p_product, p_city, p_dish);
  SELECT slots INTO v_slots FROM public.promo_markets WHERE id = v_market FOR UPDATE;
  IF EXISTS (SELECT 1 FROM public.promo_slots WHERE market_id = v_market AND restaurant_id = p_restaurant
              AND status IN ('active', 'ending')) THEN
    RAISE EXCEPTION 'Je hebt deze plek al' USING ERRCODE = '23505';
  END IF;
  -- An abandoned checkout of the same restaurant is replaced.
  UPDATE public.promo_slots SET status = 'ended', updated_at = now()
    WHERE market_id = v_market AND restaurant_id = p_restaurant AND status = 'pending_payment';
  SELECT * INTO v_bid FROM public.promo_bids WHERE market_id = v_market AND restaurant_id = p_restaurant
    AND status = 'won' AND pay_by > now();
  IF v_bid.id IS NOT NULL THEN
    v_price := v_bid.clearing_cents;
  ELSIF public.promo_taken(v_market) < v_slots THEN
    -- Free slots go to the waiting list first.
    IF EXISTS (SELECT 1 FROM public.promo_bids WHERE market_id = v_market AND status IN ('open', 'won')
                AND restaurant_id <> p_restaurant) THEN
      RAISE EXCEPTION 'Er staan bieders op de wachtlijst: plaats een bod' USING ERRCODE = 'P0001';
    END IF;
    v_price := public.promo_list_price(p_product, p_city, p_dish);
  ELSE
    RAISE EXCEPTION 'Alle plekken zijn bezet: plaats een bod' USING ERRCODE = 'P0001';
  END IF;
  INSERT INTO public.promo_slots (market_id, restaurant_id, user_id, price_cents, bid_id, reserved_until, term_end)
    VALUES (v_market, p_restaurant, p_user, v_price, v_bid.id, now() + interval '35 minutes', public.promo_quarter_end(current_date))
    RETURNING id INTO v_slot;
  RETURN jsonb_build_object('slot_id', v_slot, 'price_cents', v_price, 'bid_id', v_bid.id);
END $$;
REVOKE ALL ON FUNCTION public.promo_reserve_slot(text, uuid, uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.promo_reserve_slot(text, uuid, uuid, uuid, uuid) TO service_role;
