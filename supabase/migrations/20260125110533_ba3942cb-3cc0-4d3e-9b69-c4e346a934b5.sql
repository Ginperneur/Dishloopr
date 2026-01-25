-- =============================================
-- UITGELICHTE PLEKKEN SYSTEEM - DATABASE STRUCTURE
-- =============================================

-- Enum voor subscription status
CREATE TYPE public.featured_subscription_status AS ENUM (
  'active',
  'pending_payment',
  'cooling_off',
  'expired',
  'cancelled'
);

-- =============================================
-- 1. FEATURED SLOTS - Definieert beschikbare plekken per stad + keuken
-- =============================================
CREATE TABLE public.featured_slots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  city_id UUID NOT NULL REFERENCES public.cities(id) ON DELETE CASCADE,
  cuisine TEXT NOT NULL,
  max_slots INTEGER NOT NULL DEFAULT 15,
  base_price NUMERIC NOT NULL DEFAULT 99.00,
  demand_multiplier NUMERIC NOT NULL DEFAULT 1.0,
  last_price_update TIMESTAMP WITH TIME ZONE DEFAULT now(),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(city_id, cuisine)
);

-- =============================================
-- 2. FEATURED SUBSCRIPTIONS - Actieve premium plekken
-- =============================================
CREATE TABLE public.featured_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slot_id UUID NOT NULL REFERENCES public.featured_slots(id) ON DELETE CASCADE,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  
  -- Pricing
  monthly_price NUMERIC NOT NULL,
  ambiance_addon_price NUMERIC NOT NULL DEFAULT 0,
  total_monthly_price NUMERIC NOT NULL,
  
  -- Ambiance selections (1 inbegrepen, rest is extra)
  included_ambiance TEXT,
  extra_ambiances TEXT[] DEFAULT '{}',
  
  -- Timing & Rotation
  starts_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  max_duration_months INTEGER NOT NULL DEFAULT 3,
  consecutive_months INTEGER NOT NULL DEFAULT 1,
  
  -- Status
  status featured_subscription_status NOT NULL DEFAULT 'pending_payment',
  
  -- Stripe
  stripe_subscription_id TEXT,
  stripe_customer_id TEXT,
  
  -- Performance tracking (for ranking)
  total_views INTEGER NOT NULL DEFAULT 0,
  total_clicks INTEGER NOT NULL DEFAULT 0,
  
  -- Cooling off tracking
  cooling_off_until TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Restaurant kan maar 1 actieve subscription per slot hebben
  UNIQUE(slot_id, restaurant_id, status) 
);

-- =============================================
-- 3. FEATURED WAITLIST - Wachtlijst wanneer vol
-- =============================================
CREATE TABLE public.featured_waitlist (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slot_id UUID NOT NULL REFERENCES public.featured_slots(id) ON DELETE CASCADE,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  price_at_registration NUMERIC NOT NULL,
  selected_ambiances TEXT[] DEFAULT '{}',
  notified_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE, -- 48 uur om te reageren
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  UNIQUE(slot_id, restaurant_id)
);

-- =============================================
-- 4. AMBIANCE PRICING - Prijzen voor extra ambiance tags
-- =============================================
CREATE TABLE public.ambiance_pricing (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ambiance_tag TEXT NOT NULL UNIQUE,
  monthly_price NUMERIC NOT NULL DEFAULT 25.00,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Insert default ambiance pricing
INSERT INTO public.ambiance_pricing (ambiance_tag, monthly_price, display_order) VALUES
  ('high-end', 35.00, 1),
  ('business', 25.00, 2),
  ('romantic', 30.00, 3),
  ('trendy', 25.00, 4),
  ('casual', 15.00, 5),
  ('family-friendly', 20.00, 6),
  ('cozy', 20.00, 7),
  ('modern', 25.00, 8);

-- =============================================
-- 5. PRICING HISTORY - Track prijswijzigingen
-- =============================================
CREATE TABLE public.featured_pricing_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slot_id UUID NOT NULL REFERENCES public.featured_slots(id) ON DELETE CASCADE,
  old_price NUMERIC NOT NULL,
  new_price NUMERIC NOT NULL,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =============================================
-- FUNCTIONS
-- =============================================

-- Function: Get active slots count for a featured_slot
CREATE OR REPLACE FUNCTION public.get_featured_active_count(p_slot_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT COUNT(*)::INTEGER
  FROM featured_subscriptions
  WHERE slot_id = p_slot_id
    AND status = 'active'
    AND expires_at > now();
$$;

-- Function: Calculate market price based on demand
CREATE OR REPLACE FUNCTION public.calculate_featured_market_price(
  p_city_id UUID,
  p_cuisine TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_slot featured_slots%ROWTYPE;
  v_active_count INTEGER;
  v_restaurant_count INTEGER;
  v_base_price NUMERIC;
  v_demand_multiplier NUMERIC;
  v_final_price NUMERIC;
  v_occupancy_rate NUMERIC;
  v_price_reason TEXT;
BEGIN
  -- Get or create slot config
  SELECT * INTO v_slot
  FROM featured_slots
  WHERE city_id = p_city_id AND cuisine = p_cuisine;
  
  IF v_slot IS NULL THEN
    -- Return default pricing for new slot
    RETURN jsonb_build_object(
      'base_price', 99.00,
      'final_price', 99.00,
      'demand_multiplier', 1.0,
      'active_count', 0,
      'max_slots', 15,
      'occupancy_rate', 0,
      'price_reason', 'Standaard marktprijs'
    );
  END IF;
  
  -- Get active subscription count
  v_active_count := get_featured_active_count(v_slot.id);
  
  -- Get restaurant count in this city with this cuisine
  SELECT COUNT(*) INTO v_restaurant_count
  FROM restaurants
  WHERE city_id = p_city_id 
    AND is_active = true
    AND p_cuisine = ANY(cuisines);
  
  v_base_price := v_slot.base_price;
  v_occupancy_rate := v_active_count::NUMERIC / v_slot.max_slots::NUMERIC;
  
  -- Calculate demand multiplier based on occupancy
  IF v_occupancy_rate >= 0.9 THEN
    v_demand_multiplier := 1.5;
    v_price_reason := 'Zeer hoge vraag - bijna alle plekken bezet';
  ELSIF v_occupancy_rate >= 0.7 THEN
    v_demand_multiplier := 1.25;
    v_price_reason := 'Hoge vraag in deze categorie';
  ELSIF v_occupancy_rate >= 0.5 THEN
    v_demand_multiplier := 1.1;
    v_price_reason := 'Gemiddelde marktdruk';
  ELSE
    v_demand_multiplier := 1.0;
    v_price_reason := 'Standaard marktprijs';
  END IF;
  
  -- Extra multiplier for cities with many restaurants
  IF v_restaurant_count > 100 THEN
    v_demand_multiplier := v_demand_multiplier * 1.2;
    v_price_reason := v_price_reason || ' • Veel concurrentie';
  ELSIF v_restaurant_count > 50 THEN
    v_demand_multiplier := v_demand_multiplier * 1.1;
  END IF;
  
  v_final_price := ROUND(v_base_price * v_demand_multiplier, 2);
  
  RETURN jsonb_build_object(
    'slot_id', v_slot.id,
    'base_price', v_base_price,
    'final_price', v_final_price,
    'demand_multiplier', v_demand_multiplier,
    'active_count', v_active_count,
    'max_slots', v_slot.max_slots,
    'occupancy_rate', ROUND(v_occupancy_rate * 100, 1),
    'restaurant_count', v_restaurant_count,
    'price_reason', v_price_reason
  );
END;
$$;

-- Function: Check if restaurant is in cooling off period
CREATE OR REPLACE FUNCTION public.is_in_cooling_off(p_restaurant_id UUID, p_slot_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM featured_subscriptions
    WHERE restaurant_id = p_restaurant_id
      AND slot_id = p_slot_id
      AND status = 'cooling_off'
      AND cooling_off_until > now()
  );
$$;

-- Function: Get waitlist position
CREATE OR REPLACE FUNCTION public.get_waitlist_position(p_restaurant_id UUID, p_slot_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT position
  FROM featured_waitlist
  WHERE restaurant_id = p_restaurant_id AND slot_id = p_slot_id;
$$;

-- =============================================
-- TRIGGERS
-- =============================================

-- Trigger: Update timestamps
CREATE TRIGGER update_featured_slots_updated_at
  BEFORE UPDATE ON public.featured_slots
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_featured_subscriptions_updated_at
  BEFORE UPDATE ON public.featured_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================

ALTER TABLE public.featured_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.featured_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.featured_waitlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ambiance_pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.featured_pricing_history ENABLE ROW LEVEL SECURITY;

-- Featured Slots policies
CREATE POLICY "Anyone can view active featured slots"
  ON public.featured_slots FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can manage featured slots"
  ON public.featured_slots FOR ALL
  USING (has_role(auth.uid(), 'admin'));

-- Featured Subscriptions policies
CREATE POLICY "Anyone can view active subscriptions"
  ON public.featured_subscriptions FOR SELECT
  USING (status = 'active');

CREATE POLICY "Owners can view their subscriptions"
  ON public.featured_subscriptions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM restaurants
    WHERE restaurants.id = featured_subscriptions.restaurant_id
      AND restaurants.claimed_by_owner_id = auth.uid()
  ));

CREATE POLICY "Owners can create subscriptions for their restaurants"
  ON public.featured_subscriptions FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM restaurants
    WHERE restaurants.id = featured_subscriptions.restaurant_id
      AND restaurants.claimed_by_owner_id = auth.uid()
  ));

CREATE POLICY "Admins can manage all subscriptions"
  ON public.featured_subscriptions FOR ALL
  USING (has_role(auth.uid(), 'admin'));

-- Waitlist policies
CREATE POLICY "Owners can view their waitlist entries"
  ON public.featured_waitlist FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM restaurants
    WHERE restaurants.id = featured_waitlist.restaurant_id
      AND restaurants.claimed_by_owner_id = auth.uid()
  ));

CREATE POLICY "Owners can join waitlist for their restaurants"
  ON public.featured_waitlist FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM restaurants
    WHERE restaurants.id = featured_waitlist.restaurant_id
      AND restaurants.claimed_by_owner_id = auth.uid()
  ));

CREATE POLICY "Admins can manage waitlist"
  ON public.featured_waitlist FOR ALL
  USING (has_role(auth.uid(), 'admin'));

-- Ambiance pricing policies
CREATE POLICY "Anyone can view ambiance pricing"
  ON public.ambiance_pricing FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can manage ambiance pricing"
  ON public.ambiance_pricing FOR ALL
  USING (has_role(auth.uid(), 'admin'));

-- Pricing history policies
CREATE POLICY "Admins can view pricing history"
  ON public.featured_pricing_history FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "System can insert pricing history"
  ON public.featured_pricing_history FOR INSERT
  WITH CHECK (true);

-- =============================================
-- INDEXES for performance
-- =============================================
CREATE INDEX idx_featured_slots_city_cuisine ON public.featured_slots(city_id, cuisine);
CREATE INDEX idx_featured_subscriptions_status ON public.featured_subscriptions(status, expires_at);
CREATE INDEX idx_featured_subscriptions_restaurant ON public.featured_subscriptions(restaurant_id);
CREATE INDEX idx_featured_waitlist_slot ON public.featured_waitlist(slot_id, position);