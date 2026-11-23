DROP POLICY IF EXISTS "Anyone can read promo markets" ON public.promo_markets;
REVOKE SELECT ON public.promo_markets FROM anon;
GRANT SELECT ON public.promo_markets TO authenticated;
GRANT ALL ON public.promo_markets TO service_role;
CREATE POLICY "Admins and participants read promo markets" ON public.promo_markets
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (SELECT 1 FROM public.promo_slots s WHERE s.market_id = promo_markets.id)
  OR EXISTS (SELECT 1 FROM public.promo_bids b WHERE b.market_id = promo_markets.id)
);