-- Who should hear about an upcoming auction (14 and 3 days before the 1st of a quarter), and the
-- details for mails after one. Used by promo-auctions with the service role only.
--  * holders of a place (Vraag doorsturen slot, or an unprotected monthly Uitgelicht place) where
--    others have bid: "your place is auctioned on <date>, raise your bid to keep it";
--  * everyone with an open bid: "your bid takes part on <date>, adjust it if you want".
-- Idempotent on purpose (Lovable may apply it under another number, or twice).

CREATE OR REPLACE FUNCTION public.promo_item_label(p_product text, p_city uuid, p_dish uuid, p_page_slug text)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN p_product = 'uitgelicht'
    THEN 'Uitgelicht op de pagina ' || coalesce((SELECT d.name || ' in ' || c.name FROM public.seo_landing_pages p
           JOIN public.dishes d ON d.id = p.dish_id JOIN public.cities c ON c.id = p.city_id WHERE p.slug = p_page_slug LIMIT 1), p_page_slug)
    ELSE 'Vraag doorsturen voor ' || coalesce((SELECT name FROM public.dishes WHERE id = p_dish), 'je gerecht')
           || ' in ' || coalesce((SELECT name FROM public.cities WHERE id = p_city), 'je stad')
  END
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
    SELECT b.page_slug, count(*)::int n, max(b.amount_cents) hi FROM public.promo_bids b
     WHERE b.status = 'open' AND b.page_slug IS NOT NULL GROUP BY b.page_slug),
  rows AS (
    -- Vraag doorsturen holders where someone (else) bid
    SELECT s.user_id, s.restaurant_id, 'routing'::text product,
           public.promo_item_label('routing', m.city_id, m.dish_id, NULL) label, 'holder'::text role,
           s.price_cents my_cents, rb.hi, rb.n
      FROM public.promo_slots s JOIN public.promo_markets m ON m.id = s.market_id
      JOIN routing_bids rb ON rb.market_id = s.market_id
     WHERE s.status = 'active'
       AND EXISTS (SELECT 1 FROM public.promo_bids b WHERE b.market_id = s.market_id AND b.status = 'open' AND b.restaurant_id <> s.restaurant_id)
    UNION ALL
    -- Uitgelicht holders that take part (monthly, not protected) where someone else bid
    SELECT o.user_id, o.restaurant_id, 'uitgelicht', public.promo_item_label('uitgelicht', NULL, NULL, o.page_slug), 'holder',
           o.amount_cents, pb.hi, pb.n
      FROM public.package_orders o JOIN page_bids pb ON pb.page_slug = o.page_slug
     WHERE o.package = 'founding_partner' AND public.founding_partner_live(o.status) AND o.plan = 'month'
       AND NOT public.uitgelicht_protected(o.created_at, o.plan, o.current_period_end)
       AND EXISTS (SELECT 1 FROM public.promo_bids b WHERE b.page_slug = o.page_slug AND b.status = 'open' AND b.restaurant_id <> o.restaurant_id)
    UNION ALL
    -- Everyone with an open bid
    SELECT b.user_id, b.restaurant_id, m.product,
           public.promo_item_label(m.product, m.city_id, m.dish_id, b.page_slug), 'bidder',
           b.amount_cents, coalesce(rb.hi, pb.hi), coalesce(rb.n, pb.n)
      FROM public.promo_bids b JOIN public.promo_markets m ON m.id = b.market_id
      LEFT JOIN routing_bids rb ON rb.market_id = b.market_id AND b.page_slug IS NULL
      LEFT JOIN page_bids pb ON pb.page_slug = b.page_slug
     WHERE b.status = 'open'
  )
  SELECT r.user_id, p.email, rs.name, r.product, r.label, r.role, r.my_cents, r.hi, r.n, d.auction_date
    FROM rows r CROSS JOIN d
    JOIN public.profiles p ON p.id = r.user_id
    JOIN public.restaurants rs ON rs.id = r.restaurant_id
   WHERE p.email IS NOT NULL
$$;

-- Mail details for an action of promo_settle / promo_daily / uitgelicht_* (won, outbid, new price).
CREATE OR REPLACE FUNCTION public.promo_action_mail(p_product text, p_slot uuid, p_bid uuid)
RETURNS TABLE (email text, restaurant_name text, label text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.email, rs.name, x.label FROM (
    SELECT s.user_id, s.restaurant_id, public.promo_item_label('routing', m.city_id, m.dish_id, NULL) label
      FROM public.promo_slots s JOIN public.promo_markets m ON m.id = s.market_id
     WHERE p_product = 'routing' AND s.id = p_slot
    UNION ALL
    SELECT o.user_id, o.restaurant_id, public.promo_item_label('uitgelicht', NULL, NULL, o.page_slug)
      FROM public.package_orders o WHERE p_product = 'uitgelicht' AND o.id = p_slot
    UNION ALL
    SELECT b.user_id, b.restaurant_id, public.promo_item_label(m.product, m.city_id, m.dish_id, b.page_slug)
      FROM public.promo_bids b JOIN public.promo_markets m ON m.id = b.market_id WHERE b.id = p_bid
  ) x
  JOIN public.profiles p ON p.id = x.user_id
  JOIN public.restaurants rs ON rs.id = x.restaurant_id
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.promo_item_label(text, uuid, uuid, text) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.promo_auction_reminders() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.promo_action_mail(text, uuid, uuid) FROM public, anon, authenticated;
