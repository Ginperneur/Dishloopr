-- Per dish page a restaurant appears on: its position, searches per month in that city, places
-- left for Uitgelicht and the price. Shown on the packages page, in the dashboard and in outreach
-- mails, so owners see scarcity and value before they buy. Public data only (positions and
-- places left were already public), so anon may call it.
-- Idempotent on purpose (Lovable may apply it under another number, or twice).
CREATE OR REPLACE FUNCTION public.uitgelicht_page_offers(p_slug text)
RETURNS TABLE (page_slug text, dish_name text, "position" int, total int, searches_per_month numeric,
               places_left int, list_price_cents int)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.page_slug, p.dish_name, p."position", p.total,
         coalesce((SELECT d.searches_per_month FROM public.uitgelicht_page(p.page_slug) g, public.promo_demand(g.city_id, g.dish_id) d), 0),
         greatest(0, 5 - public.uitgelicht_taken(p.page_slug)),
         public.uitgelicht_list_price(p.page_slug)
    FROM public.restaurant_positions(p_slug) p
$$;
REVOKE ALL ON FUNCTION public.uitgelicht_page_offers(text) FROM public;
GRANT EXECUTE ON FUNCTION public.uitgelicht_page_offers(text) TO anon, authenticated, service_role;