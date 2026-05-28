
-- 1. opening_hours_exceptions
CREATE TABLE public.opening_hours_exceptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  exception_date date NOT NULL,
  is_closed boolean NOT NULL DEFAULT true,
  open_time text,
  close_time text,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (restaurant_id, exception_date)
);
GRANT SELECT ON public.opening_hours_exceptions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.opening_hours_exceptions TO authenticated;
GRANT ALL ON public.opening_hours_exceptions TO service_role;
ALTER TABLE public.opening_hours_exceptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view exceptions" ON public.opening_hours_exceptions
  FOR SELECT USING (true);
CREATE POLICY "Owners manage own exceptions" ON public.opening_hours_exceptions
  FOR ALL USING (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = restaurant_id AND r.claimed_by_owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = restaurant_id AND r.claimed_by_owner_id = auth.uid()));
CREATE POLICY "Admins manage exceptions" ON public.opening_hours_exceptions
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE INDEX idx_exceptions_restaurant_date ON public.opening_hours_exceptions(restaurant_id, exception_date);

-- 2. cross_promotions
CREATE TABLE public.cross_promotions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  initiator_restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  partner_restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'pending',
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (initiator_restaurant_id <> partner_restaurant_id),
  CHECK (status IN ('pending','accepted','rejected','expired','cancelled'))
);
GRANT SELECT ON public.cross_promotions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cross_promotions TO authenticated;
GRANT ALL ON public.cross_promotions TO service_role;
ALTER TABLE public.cross_promotions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view accepted cross-promotions" ON public.cross_promotions
  FOR SELECT USING (status = 'accepted');
CREATE POLICY "Owners view own cross-promotions" ON public.cross_promotions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id IN (initiator_restaurant_id, partner_restaurant_id) AND r.claimed_by_owner_id = auth.uid())
  );
CREATE POLICY "Owners insert as initiator" ON public.cross_promotions
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = initiator_restaurant_id AND r.claimed_by_owner_id = auth.uid())
  );
CREATE POLICY "Owners update involving" ON public.cross_promotions
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id IN (initiator_restaurant_id, partner_restaurant_id) AND r.claimed_by_owner_id = auth.uid())
  );
CREATE POLICY "Owners delete own initiated" ON public.cross_promotions
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = initiator_restaurant_id AND r.claimed_by_owner_id = auth.uid())
  );
CREATE POLICY "Admins manage cross-promotions" ON public.cross_promotions
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE INDEX idx_xpromo_initiator ON public.cross_promotions(initiator_restaurant_id);
CREATE INDEX idx_xpromo_partner ON public.cross_promotions(partner_restaurant_id);

-- 3. restaurant_translations
CREATE TABLE public.restaurant_translations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  language_code text NOT NULL,
  name text,
  tagline text,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (restaurant_id, language_code),
  CHECK (language_code IN ('nl','en','de','fr','es'))
);
GRANT SELECT ON public.restaurant_translations TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.restaurant_translations TO authenticated;
GRANT ALL ON public.restaurant_translations TO service_role;
ALTER TABLE public.restaurant_translations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view translations" ON public.restaurant_translations
  FOR SELECT USING (true);
CREATE POLICY "Owners manage own translations" ON public.restaurant_translations
  FOR ALL USING (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = restaurant_id AND r.claimed_by_owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = restaurant_id AND r.claimed_by_owner_id = auth.uid()));
CREATE POLICY "Admins manage translations" ON public.restaurant_translations
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE INDEX idx_translations_restaurant ON public.restaurant_translations(restaurant_id);

-- updated_at triggers
CREATE TRIGGER update_opening_exceptions_updated_at BEFORE UPDATE ON public.opening_hours_exceptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_cross_promotions_updated_at BEFORE UPDATE ON public.cross_promotions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_translations_updated_at BEFORE UPDATE ON public.restaurant_translations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
