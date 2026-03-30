
CREATE OR REPLACE FUNCTION public.auto_enrich_dish_dietary_labels()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  name_updated integer := 0;
  inherited integer := 0;
BEGIN
  -- Step 1: Name-based detection for vegetarian keywords on dishes table
  UPDATE dishes
  SET is_vegetarian = true, updated_at = now()
  WHERE is_vegetarian = false
    AND (
      lower(name) ~ '(^|\s)(vega|veggie|vegetarisch|groente|plantaardig|kaas|caprese|margherita|funghi|quattro formaggi|paneer|dal|dhal|falafel|halloumi|mozzarella|burrata|gnocchi al pesto)'
      OR EXISTS (
        SELECT 1 FROM unnest(synonyms) s WHERE lower(s) ~ '(vega|veggie|vegetarisch|groente|plantaardig)'
      )
    )
    -- Exclude items that are clearly not vegetarian
    AND lower(name) !~ '(kip|chicken|beef|rund|varken|pork|vis|fish|garnaal|shrimp|zalm|salmon|tonijn|tuna|lam|lamb|eend|duck|krab|crab|kreeft|lobster|inktvis|squid|bacon|ham|worst|sausage)';
  
  GET DIAGNOSTICS name_updated = ROW_COUNT;

  -- Also detect vegan keywords
  UPDATE dishes
  SET is_vegan = true, is_vegetarian = true, updated_at = now()
  WHERE is_vegan = false
    AND (
      lower(name) ~ '(^|\s)(vegan|veganistisch|plantbased|plant-based|plant based)'
      OR EXISTS (
        SELECT 1 FROM unnest(synonyms) s WHERE lower(s) ~ '(vegan|veganistisch)'
      )
    );

  -- Step 2: Inherit dietary labels from dishes to restaurant_dishes where not already set
  UPDATE restaurant_dishes rd
  SET 
    is_vegetarian = CASE WHEN NOT rd.is_vegetarian AND d.is_vegetarian THEN true ELSE rd.is_vegetarian END,
    is_vegan = CASE WHEN NOT rd.is_vegan AND d.is_vegan THEN true ELSE rd.is_vegan END,
    is_halal = CASE WHEN NOT rd.is_halal AND d.is_halal THEN true ELSE rd.is_halal END,
    is_gluten_free = CASE WHEN NOT rd.is_gluten_free AND d.is_gluten_free THEN true ELSE rd.is_gluten_free END,
    updated_at = now()
  FROM dishes d
  WHERE rd.dish_id = d.id
    AND (
      (NOT rd.is_vegetarian AND d.is_vegetarian)
      OR (NOT rd.is_vegan AND d.is_vegan)
      OR (NOT rd.is_halal AND d.is_halal)
      OR (NOT rd.is_gluten_free AND d.is_gluten_free)
    );

  GET DIAGNOSTICS inherited = ROW_COUNT;

  RETURN jsonb_build_object(
    'dishes_name_detected', name_updated,
    'restaurant_dishes_inherited', inherited
  );
END;
$$;
