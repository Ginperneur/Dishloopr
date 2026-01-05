-- Sponsored Products: Dish × City products with slots
CREATE TABLE public.sponsored_products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  dish_id UUID NOT NULL REFERENCES public.dishes(id) ON DELETE CASCADE,
  city_id UUID NOT NULL REFERENCES public.cities(id) ON DELETE CASCADE,
  base_price NUMERIC NOT NULL DEFAULT 49.00,
  min_duration_days INTEGER NOT NULL DEFAULT 14,
  max_duration_days INTEGER NOT NULL DEFAULT 60,
  default_duration_days INTEGER NOT NULL DEFAULT 30,
  max_slots INTEGER NOT NULL DEFAULT 5,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(dish_id, city_id)
);

-- Sponsored Purchases: Restaurant slot purchases
CREATE TABLE public.sponsored_purchases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.sponsored_products(id) ON DELETE CASCADE,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  purchased_by UUID NOT NULL,
  price_paid NUMERIC NOT NULL,
  duration_days INTEGER NOT NULL DEFAULT 30,
  starts_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  stripe_payment_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sponsored_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sponsored_purchases ENABLE ROW LEVEL SECURITY;

-- RLS Policies for sponsored_products
CREATE POLICY "Anyone can view active products"
  ON public.sponsored_products FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can manage products"
  ON public.sponsored_products FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for sponsored_purchases
CREATE POLICY "Anyone can view active purchases"
  ON public.sponsored_purchases FOR SELECT
  USING (is_active = true AND expires_at > now());

CREATE POLICY "Admins can manage all purchases"
  ON public.sponsored_purchases FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Owners can view their purchases"
  ON public.sponsored_purchases FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM restaurants
    WHERE restaurants.id = sponsored_purchases.restaurant_id
    AND restaurants.claimed_by_owner_id = auth.uid()
  ));

CREATE POLICY "Owners can create purchases for their restaurants"
  ON public.sponsored_purchases FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM restaurants
    WHERE restaurants.id = sponsored_purchases.restaurant_id
    AND restaurants.claimed_by_owner_id = auth.uid()
  ));

-- Function to get available slots for a product
CREATE OR REPLACE FUNCTION public.get_available_slots(p_product_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    (SELECT max_slots FROM sponsored_products WHERE id = p_product_id), 0
  ) - COALESCE(
    (SELECT COUNT(*) FROM sponsored_purchases 
     WHERE product_id = p_product_id 
     AND is_active = true 
     AND expires_at > now()
    )::INTEGER, 0
  );
$$;

-- Function to calculate price based on popularity
CREATE OR REPLACE FUNCTION public.calculate_sponsored_price(
  p_dish_id UUID,
  p_city_id UUID,
  p_duration_days INTEGER DEFAULT 30
)
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  base_price NUMERIC;
  dish_popularity INTEGER;
  city_restaurant_count INTEGER;
  popularity_multiplier NUMERIC;
  duration_multiplier NUMERIC;
  final_price NUMERIC;
BEGIN
  -- Get base price from product or default
  SELECT COALESCE(sp.base_price, 49.00) INTO base_price
  FROM sponsored_products sp
  WHERE sp.dish_id = p_dish_id AND sp.city_id = p_city_id;
  
  IF base_price IS NULL THEN
    base_price := 49.00;
  END IF;

  -- Get dish search popularity
  SELECT COALESCE(search_count, 0) INTO dish_popularity
  FROM dishes WHERE id = p_dish_id;

  -- Get number of restaurants in city
  SELECT COUNT(*) INTO city_restaurant_count
  FROM restaurants WHERE city_id = p_city_id AND is_active = true;

  -- Calculate popularity multiplier (1.0 - 3.0 based on popularity)
  popularity_multiplier := LEAST(3.0, GREATEST(1.0, 
    1.0 + (dish_popularity::NUMERIC / 100.0) + (city_restaurant_count::NUMERIC / 50.0)
  ));

  -- Calculate duration multiplier (14 days = 0.5x, 30 days = 1x, 60 days = 1.8x)
  duration_multiplier := 0.5 + (p_duration_days - 14)::NUMERIC / 30.0;

  -- Final price calculation
  final_price := ROUND(base_price * popularity_multiplier * duration_multiplier, 2);

  RETURN GREATEST(final_price, 25.00); -- Minimum €25
END;
$$;

-- Trigger for updated_at
CREATE TRIGGER update_sponsored_products_updated_at
  BEFORE UPDATE ON public.sponsored_products
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_sponsored_purchases_updated_at
  BEFORE UPDATE ON public.sponsored_purchases
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Index for efficient queries
CREATE INDEX idx_sponsored_purchases_active ON public.sponsored_purchases(product_id, is_active, expires_at);
CREATE INDEX idx_sponsored_purchases_restaurant ON public.sponsored_purchases(restaurant_id);
CREATE INDEX idx_sponsored_products_dish_city ON public.sponsored_products(dish_id, city_id);