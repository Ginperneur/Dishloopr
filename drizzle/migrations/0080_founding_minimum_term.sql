-- Founding Partner only with a minimum term of 6 months.
-- Owners now pick the term (1, 3, 6 or 12 months, or a year paid up front) before they pay.
-- From 6 months on, Uitgelicht and Groei bought before the end of the window (5 January 2027) get the
-- Founding Partner price and status; a shorter term pays the normal price for the page and does not
-- become a Founding Partner. Until now that status followed from the purchase date alone, so it is
-- stored per order: package_orders.is_founding, written by stripe-webhook from the checkout metadata.
-- NULL (orders from before this change) keeps the old rule: a place bought in the window.
-- The functions below are the ones of 20261119100000_paid_visibility.sql with only that rule swapped.
-- Idempotent on purpose (Lovable may apply it under another number, or twice).

ALTER TABLE public.package_orders ADD COLUMN IF NOT EXISTS is_founding boolean;
ALTER TABLE public.package_orders ADD COLUMN IF NOT EXISTS commitment_months integer;
-- A collection place included in a Groei or Dominant bundle points at that bundle order
-- (20261125120000_collection_places.sql); such a place never takes part in the auction.
ALTER TABLE public.package_orders ADD COLUMN IF NOT EXISTS bundle_order_id uuid REFERENCES public.package_orders(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.pp_order_founding(p_package text, p_created timestamptz, p_is_founding boolean)
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT coalesce(p_is_founding, p_package IN ('founding_partner', 'groei', 'collectieplek') AND p_created <= public.uitgelicht_window_end())
$$;

-- Founding Partners (Uitgelicht, Groei, collection places) keep their price through 2027; year plans until their paid year ends.
CREATE OR REPLACE FUNCTION public.pp_order_protected(p_kind text, p_package text, p_created timestamptz, p_is_founding boolean,
                                                     p_plan text, p_period_end timestamptz)
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT (p_kind IN ('uitgelicht', 'collectie') AND public.pp_order_founding(p_package, p_created, p_is_founding) AND current_date <= date '2027-12-31')
      OR (p_plan = 'year' AND coalesce(p_period_end, now()) > now())
$$;

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
         AND o.plan = 'month' AND o.bundle_order_id IS NULL
         AND NOT public.pp_order_protected(p_kind, o.package, o.created_at, o.is_founding, o.plan, o.current_period_end);
    v_avail := public.pp_slots(p_kind) - (SELECT count(*) FROM public.package_orders o
                     WHERE o.package = ANY (v_pk) AND o.page_slug = v_page AND public.founding_partner_live(o.status)
                       AND (o.plan <> 'month' OR o.bundle_order_id IS NOT NULL
                            OR public.pp_order_protected(p_kind, o.package, o.created_at, o.is_founding, o.plan, o.current_period_end)))::int;

    IF NOT EXISTS (SELECT 1 FROM public.pp_bids(p_kind, v_page) b WHERE b.status = 'open') THEN
      -- No competition: unprotected holders renew at the list price.
      RETURN QUERY
      WITH u AS (
        UPDATE public.package_orders o SET amount_cents = v_list, updated_at = now()
         WHERE o.id IN (SELECT r.order_id FROM pp_rank r) AND o.amount_cents <> v_list AND o.package IN ('founding_partner', 'topplek', 'collectieplek')
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
         AND o.package IN ('founding_partner', 'topplek', 'collectieplek')
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

CREATE OR REPLACE FUNCTION public.page_paid_placements(p_page_slug text)
RETURNS TABLE (restaurant_id uuid, kind text, is_founding boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT h.restaurant_id, h.kind, h.is_founding FROM (
    SELECT o.restaurant_id,
           CASE WHEN bool_or(o.package IN ('topplek', 'dominant')) THEN 'topplek' ELSE 'uitgelicht' END AS kind,
           bool_or(public.pp_order_founding(o.package, o.created_at, o.is_founding)) AS is_founding
      FROM public.package_orders o JOIN public.restaurants r ON r.id = o.restaurant_id AND r.is_active
     WHERE o.page_slug = p_page_slug AND o.package IN ('founding_partner', 'groei', 'topplek', 'dominant')
       AND public.founding_partner_live(o.status)
     GROUP BY o.restaurant_id) h
   ORDER BY h.kind = 'uitgelicht', md5(h.restaurant_id::text || current_date::text)
$$;

CREATE OR REPLACE FUNCTION public.restaurant_paid_badges(p_restaurant uuid)
RETURNS TABLE (page_slug text, kind text, subject text, city_name text, is_founding boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT h.page_slug, h.kind, h.subject, h.city_name, h.is_founding FROM (
    SELECT o.page_slug,
           CASE WHEN bool_or(o.package IN ('topplek', 'dominant')) THEN 'topplek' ELSE 'uitgelicht' END AS kind,
           min(s.subject) AS subject, min(s.city_name) AS city_name,
           bool_or(public.pp_order_founding(o.package, o.created_at, o.is_founding)) AS is_founding
      FROM public.package_orders o, LATERAL public.page_subject(o.page_slug) s
     WHERE o.restaurant_id = p_restaurant AND o.package IN ('founding_partner', 'groei', 'topplek', 'dominant')
       AND public.founding_partner_live(o.status)
     GROUP BY o.page_slug) h
   ORDER BY h.kind = 'uitgelicht', h.page_slug
$$;

CREATE OR REPLACE FUNCTION public.promo_auction_reminders()
RETURNS TABLE (user_id uuid, email text, restaurant_name text, product text, label text, role text,
               my_cents int, highest_bid_cents int, open_bids int, auction_date date)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH d AS (SELECT public.promo_quarter_end(current_date) + 1 AS auction_date),
  routing_bids AS (
    SELECT b.market_id, count(*)::int n, max(b.amount_cents) hi FROM public.promo_bids b
     JOIN public.promo_markets m ON m.id = b.market_id AND m.product = 'routing'
     WHERE b.status = 'open' GROUP BY b.market_id),
  page_bids AS (
    SELECT m.product, b.page_slug, count(*)::int n, max(b.amount_cents) hi FROM public.promo_bids b
     JOIN public.promo_markets m ON m.id = b.market_id
     WHERE b.status = 'open' AND b.page_slug IS NOT NULL GROUP BY m.product, b.page_slug),
  rows AS (
    SELECT s.user_id, s.restaurant_id, 'routing'::text product,
           public.promo_item_label('routing', m.city_id, m.dish_id, NULL) label, 'holder'::text role,
           s.price_cents my_cents, rb.hi, rb.n
      FROM public.promo_slots s JOIN public.promo_markets m ON m.id = s.market_id
      JOIN routing_bids rb ON rb.market_id = s.market_id
     WHERE s.status = 'active'
       AND EXISTS (SELECT 1 FROM public.promo_bids b WHERE b.market_id = s.market_id AND b.status = 'open' AND b.restaurant_id <> s.restaurant_id)
    UNION ALL
    -- Holders of a page place that takes part (monthly, not protected) where someone else bid
    SELECT o.user_id, o.restaurant_id, k.kind, public.promo_item_label(k.kind, NULL, NULL, o.page_slug), 'holder',
           o.amount_cents, pb.hi, pb.n
      FROM public.package_orders o
      CROSS JOIN LATERAL (SELECT CASE WHEN o.package IN ('topplek', 'dominant') THEN 'topplek' WHEN o.package = 'collectieplek' THEN 'collectie' ELSE 'uitgelicht' END AS kind) k
      JOIN page_bids pb ON pb.page_slug = o.page_slug AND pb.product = k.kind
     WHERE o.package IN ('founding_partner', 'groei', 'topplek', 'dominant', 'collectieplek') AND public.founding_partner_live(o.status) AND o.plan = 'month'
       AND o.bundle_order_id IS NULL
       AND NOT public.pp_order_protected(k.kind, o.package, o.created_at, o.is_founding, o.plan, o.current_period_end)
       AND EXISTS (SELECT 1 FROM public.pp_bids(k.kind, o.page_slug) b WHERE b.status = 'open' AND b.restaurant_id <> o.restaurant_id)
    UNION ALL
    SELECT b.user_id, b.restaurant_id, m.product,
           public.promo_item_label(m.product, m.city_id, m.dish_id, b.page_slug), 'bidder',
           b.amount_cents, coalesce(rb.hi, pb.hi), coalesce(rb.n, pb.n)
      FROM public.promo_bids b JOIN public.promo_markets m ON m.id = b.market_id
      LEFT JOIN routing_bids rb ON rb.market_id = b.market_id AND b.page_slug IS NULL
      LEFT JOIN page_bids pb ON pb.page_slug = b.page_slug AND pb.product = m.product
     WHERE b.status = 'open'
  )
  SELECT r.user_id, p.email, rs.name, r.product, r.label, r.role, r.my_cents, r.hi, r.n, d.auction_date
    FROM rows r CROSS JOIN d
    JOIN public.profiles p ON p.id = r.user_id
    JOIN public.restaurants rs ON rs.id = r.restaurant_id
   WHERE p.email IS NOT NULL
$$;