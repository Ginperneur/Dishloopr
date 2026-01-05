-- Fix search_path for get_available_slots function
CREATE OR REPLACE FUNCTION public.get_available_slots(p_product_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
SET search_path = public
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

-- Fix search_path for calculate_sponsored_price function
CREATE OR REPLACE FUNCTION public.calculate_sponsored_price(
  p_dish_id UUID,
  p_city_id UUID,
  p_duration_days INTEGER DEFAULT 30
)
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
SET search_path = public
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