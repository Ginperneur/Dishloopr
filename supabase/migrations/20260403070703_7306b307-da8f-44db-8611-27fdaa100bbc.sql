
CREATE OR REPLACE FUNCTION public.auto_enrich_dish_dietary_labels()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  name_updated integer := 0;
  vegan_updated integer := 0;
  inherited integer := 0;
  course_updated integer := 0;
BEGIN
  -- Step 1: Name-based detection for vegetarian dishes
  -- ONLY match dishes that are EXPLICITLY vegetarian by name
  -- Removed broad terms like kaas/mozzarella/burrata that appear on meat dishes too
  UPDATE dishes
  SET is_vegetarian = true, updated_at = now()
  WHERE is_vegetarian = false
    AND (
      lower(name) ~ '(^|\s)(vega|veggie|vegetarisch|groente|plantaardig|caprese|margherita|funghi|quattro formaggi|paneer|dal(\s|$)|dhal|falafel|halloumi|gnocchi al pesto)'
      OR lower(name) ~ '(^|\s)(vegaburger|vegagehaktbal|groenteburger|vegetarische|plantaardige)'
      OR EXISTS (
        SELECT 1 FROM unnest(synonyms) s WHERE lower(s) ~ '(vega|veggie|vegetarisch|groente|plantaardig)'
      )
    )
    -- Exclude items that contain meat/fish/poultry keywords ANYWHERE in the name
    AND lower(name) !~ '(kip|chicken|beef|rund|varken|pork|vis|fish|garnaal|shrimp|zalm|salmon|tonijn|tuna|lam|lamb|eend|duck|krab|crab|kreeft|lobster|inktvis|squid|bacon|ham|worst|sausage|pulled|shoarma|kebab|doner|döner|gyros|spare.?rib|rib.?eye|entrecote|ossenhaas|biefstuk|steak|gehakt|mince|tartaar|carpaccio.*(rund|beef)|rendang|saté|sate|babi|paling|eel|haring|herring|makreel|mackerel|mossel|mussel|oester|oyster|ansjov|anchov|kalfsvlees|veal)';
  
  GET DIAGNOSTICS name_updated = ROW_COUNT;

  -- Step 2: Detect vegan keywords
  UPDATE dishes
  SET is_vegan = true, is_vegetarian = true, updated_at = now()
  WHERE is_vegan = false
    AND (
      lower(name) ~ '(^|\s)(vegan|veganistisch|plantbased|plant-based|plant based)'
      OR EXISTS (
        SELECT 1 FROM unnest(synonyms) s WHERE lower(s) ~ '(vegan|veganistisch)'
      )
    )
    AND lower(name) !~ '(kip|chicken|beef|rund|varken|pork|vis|fish|garnaal|shrimp|zalm|salmon|tonijn|tuna|lam|lamb|eend|duck|bacon|ham|worst|sausage|kaas|cheese|ei|egg|melk|milk|boter|butter|room|cream|honing|honey)';

  GET DIAGNOSTICS vegan_updated = ROW_COUNT;

  -- Step 3: Auto-classify course_type on restaurant_dishes based on dish name
  -- Desserts
  UPDATE restaurant_dishes rd
  SET course_type = 'dessert', updated_at = now()
  FROM dishes d
  WHERE rd.dish_id = d.id
    AND (rd.course_type IS NULL OR rd.course_type = 'hoofdgerecht')
    AND lower(d.name) ~ '(ijs|ice.?cream|gelato|sorbet|cake|taart|tart|pie|brownie|tiramisu|cheesecake|mousse|crème brûlée|creme brulee|panna cotta|pannacotta|pudding|baklava|churros|wafel|waffle|donut|mochi|profiterole|crêpe|crepe|macaron|cookie|koek|bonbon|chocolade.?fond|dame blanche|banana split|frozen yogurt|apple pie|appeltaart|beignet|eclair|flan|kulfi|gulab|knafeh|kunafa|bananensplit)';

  -- Voorgerechten
  UPDATE restaurant_dishes rd
  SET course_type = 'voorgerecht', updated_at = now()
  FROM dishes d
  WHERE rd.dish_id = d.id
    AND (rd.course_type IS NULL OR rd.course_type = 'hoofdgerecht')
    AND lower(d.name) ~ '(soep|soup|salade|salad|carpaccio|bruschetta|edamame|gyoza|loempia|spring.?roll|summer.?roll|tempura|bitterballen|croquetten|kroketten|garlic.?bread|bruschet|antipast|mezze|hummus|tzatziki|dim.?sum|won.?ton|wonton|samosa|pakora|arancini|calamari|taco|nacho|dip|pâté|paté|terrine|tataki|ceviche|vitello tonnato|gazpacho|minestrone|tom.?yum|tom.?kha|miso.?so|pho.?bo|laksa)';

  -- Bijgerechten
  UPDATE restaurant_dishes rd
  SET course_type = 'bijgerecht', updated_at = now()
  FROM dishes d
  WHERE rd.dish_id = d.id
    AND (rd.course_type IS NULL OR rd.course_type = 'hoofdgerecht')
    AND lower(d.name) ~ '^(frites|friet|patat|fries|frit|fry|rijst|rice|naan|brood|bread|coleslaw|kimchi|pickles|saus|sauce|dressing|aioli|mayo|ketchup|sriracha|sambal|chutney|raita|guacamole|tzatziki|olijven|olives|baba.?ganoush|tabbouleh|fattoush)$';

  -- Dranken
  UPDATE restaurant_dishes rd
  SET course_type = 'drank', updated_at = now()
  FROM dishes d
  WHERE rd.dish_id = d.id
    AND (rd.course_type IS NULL OR rd.course_type = 'hoofdgerecht')
    AND lower(d.name) ~ '(cola|pepsi|fanta|sprite|bier|beer|wijn|wine|cocktail|mocktail|smoothie|milkshake|shake|thee|tea|koffie|coffee|espresso|cappuccino|latte|juice|sap|limonade|lemonade|frisdrank|water|prosecco|champagne|sangria|aperol|spritz|gin.?tonic|mojito|margarita|daiquiri|whiskey|rum|vodka|cognac|jenever|sake|lassi|chai|matcha|kombucha|ayran|doogh)';

  -- Count total course updates
  SELECT count(*) INTO course_updated
  FROM restaurant_dishes rd
  JOIN dishes d ON rd.dish_id = d.id
  WHERE rd.course_type != 'hoofdgerecht' AND rd.updated_at > now() - interval '5 seconds';

  -- Step 4: Inherit dietary labels from dishes to restaurant_dishes
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
    'dishes_vegan_detected', vegan_updated,
    'restaurant_dishes_inherited', inherited,
    'course_types_classified', course_updated
  );
END;
$$;
