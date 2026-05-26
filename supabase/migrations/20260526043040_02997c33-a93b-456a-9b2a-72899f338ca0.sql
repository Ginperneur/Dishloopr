
-- promo_codes
CREATE TABLE public.promo_codes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id uuid NOT NULL,
  code text NOT NULL,
  description text,
  discount_type text NOT NULL DEFAULT 'percentage',
  discount_value numeric NOT NULL DEFAULT 0,
  max_uses integer,
  use_count integer NOT NULL DEFAULT 0,
  valid_from timestamptz NOT NULL DEFAULT now(),
  valid_until timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (restaurant_id, code)
);
ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active promo codes" ON public.promo_codes
  FOR SELECT USING (is_active = true AND (valid_until IS NULL OR valid_until > now()));
CREATE POLICY "Owners manage own promo codes" ON public.promo_codes
  FOR ALL USING (EXISTS (SELECT 1 FROM restaurants r WHERE r.id = promo_codes.restaurant_id AND r.claimed_by_owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM restaurants r WHERE r.id = promo_codes.restaurant_id AND r.claimed_by_owner_id = auth.uid()));
CREATE POLICY "Admins manage all promo codes" ON public.promo_codes
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_promo_codes_restaurant ON public.promo_codes(restaurant_id);

-- promo_code_redemptions
CREATE TABLE public.promo_code_redemptions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  promo_code_id uuid NOT NULL REFERENCES public.promo_codes(id) ON DELETE CASCADE,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.promo_code_redemptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can redeem promo code" ON public.promo_code_redemptions
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Owners view own redemptions" ON public.promo_code_redemptions
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM promo_codes pc JOIN restaurants r ON r.id = pc.restaurant_id
    WHERE pc.id = promo_code_redemptions.promo_code_id AND r.claimed_by_owner_id = auth.uid()
  ));
CREATE POLICY "Users view own redemptions" ON public.promo_code_redemptions
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Admins manage all redemptions" ON public.promo_code_redemptions
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- loyalty_programs
CREATE TABLE public.loyalty_programs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id uuid NOT NULL UNIQUE,
  stamps_required integer NOT NULL DEFAULT 10,
  reward_description text NOT NULL DEFAULT 'Gratis gerecht',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.loyalty_programs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active loyalty programs" ON public.loyalty_programs
  FOR SELECT USING (is_active = true);
CREATE POLICY "Owners manage own loyalty program" ON public.loyalty_programs
  FOR ALL USING (EXISTS (SELECT 1 FROM restaurants r WHERE r.id = loyalty_programs.restaurant_id AND r.claimed_by_owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM restaurants r WHERE r.id = loyalty_programs.restaurant_id AND r.claimed_by_owner_id = auth.uid()));
CREATE POLICY "Admins manage all loyalty programs" ON public.loyalty_programs
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- loyalty_stamps
CREATE TABLE public.loyalty_stamps (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id uuid NOT NULL,
  user_id uuid NOT NULL,
  redeemed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.loyalty_stamps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own stamps" ON public.loyalty_stamps
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users create own stamps" ON public.loyalty_stamps
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Owners view restaurant stamps" ON public.loyalty_stamps
  FOR SELECT USING (EXISTS (SELECT 1 FROM restaurants r WHERE r.id = loyalty_stamps.restaurant_id AND r.claimed_by_owner_id = auth.uid()));
CREATE POLICY "Owners update restaurant stamps" ON public.loyalty_stamps
  FOR UPDATE USING (EXISTS (SELECT 1 FROM restaurants r WHERE r.id = loyalty_stamps.restaurant_id AND r.claimed_by_owner_id = auth.uid()));
CREATE POLICY "Admins manage all stamps" ON public.loyalty_stamps
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_loyalty_stamps_user_restaurant ON public.loyalty_stamps(user_id, restaurant_id);

-- updated_at triggers
CREATE TRIGGER update_promo_codes_updated_at BEFORE UPDATE ON public.promo_codes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_loyalty_programs_updated_at BEFORE UPDATE ON public.loyalty_programs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
