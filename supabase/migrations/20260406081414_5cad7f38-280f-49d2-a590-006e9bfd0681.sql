
CREATE OR REPLACE FUNCTION public.audit_and_fix_dish_classifications()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  fixes_applied integer := 0;
  fix_details jsonb := '[]'::jsonb;
  r RECORD;
BEGIN
  -- Step 1: Find dishes classified as 'drank' that are clearly food
  FOR r IN
    SELECT rd.id, rd.course_type as old_type, d.name as dish_name, res.name as restaurant_name, res.id as restaurant_id
    FROM restaurant_dishes rd
    JOIN dishes d ON rd.dish_id = d.id
    JOIN restaurants res ON rd.restaurant_id = res.id
    WHERE rd.course_type = 'drank'
    AND lower(d.name) ~ '(steak|frites|friet|burger|pizza|pasta|noodle|rijst|rice|sushi|salade|salad|soep|soup|kip|chicken|beef|rund|vis|fish|garnaal|shrimp|zalm|salmon|tonijn|tuna|lam|lamb|eend|duck|pulled|shoarma|kebab|gyros|spare.?rib|rib.?eye|entrecote|biefstuk|gehakt|tartaar|carpaccio|rendang|saté|sate|satay|curry|wok|bowl|wrap|sandwich|broodje|panini|tosti|croissant|burrito|quesadilla|enchilada|dim.?sum|dumpling|ramen|pho|pad thai|nasi|bami|tempura|croquetten|bitterballen|kaassoufflé|falafel|halloumi|gnocchi|risotto|lasagne|ravioli|penne|spaghetti|tagliatelle|linguine|fusilli|tortellini|schnitzel|cordon bleu|ossenhaas|tournedos|couscous|tagine|paella|ceviche)'
  LOOP
    -- Determine correct type
    UPDATE restaurant_dishes SET course_type = 'hoofdgerecht', updated_at = now() WHERE id = r.id;
    fixes_applied := fixes_applied + 1;
    fix_details := fix_details || jsonb_build_object('dish', r.dish_name, 'restaurant', r.restaurant_name, 'from', r.old_type, 'to', 'hoofdgerecht');
  END LOOP;

  -- Step 2: Find food items classified as 'drank' that match dessert patterns
  FOR r IN
    SELECT rd.id, rd.course_type as old_type, d.name as dish_name, res.name as restaurant_name
    FROM restaurant_dishes rd
    JOIN dishes d ON rd.dish_id = d.id
    JOIN restaurants res ON rd.restaurant_id = res.id
    WHERE rd.course_type = 'drank'
    AND lower(d.name) ~ '(ijs|ice.?cream|gelato|sorbet|cake|taart|brownie|tiramisu|cheesecake|mousse|crème brûlée|panna cotta|pudding|baklava|churros|wafel|donut|mochi|profiterole|crêpe|macaron|cookie|dame blanche|appeltaart|beignet|eclair|flan)'
  LOOP
    UPDATE restaurant_dishes SET course_type = 'dessert', updated_at = now() WHERE id = r.id;
    fixes_applied := fixes_applied + 1;
    fix_details := fix_details || jsonb_build_object('dish', r.dish_name, 'restaurant', r.restaurant_name, 'from', r.old_type, 'to', 'dessert');
  END LOOP;

  -- Step 3: Find food items classified as 'drank' that match voorgerecht patterns
  FOR r IN
    SELECT rd.id, rd.course_type as old_type, d.name as dish_name, res.name as restaurant_name
    FROM restaurant_dishes rd
    JOIN dishes d ON rd.dish_id = d.id
    JOIN restaurants res ON rd.restaurant_id = res.id
    WHERE rd.course_type = 'drank'
    AND lower(d.name) ~ '(bruschetta|edamame|gyoza|loempia|spring.?roll|summer.?roll|bitterballen|croquetten|garlic.?bread|antipast|mezze|hummus|tzatziki|dim.?sum|samosa|pakora|arancini|calamari|nacho|pâté|tataki|ceviche|vitello tonnato|carpaccio)'
  LOOP
    UPDATE restaurant_dishes SET course_type = 'voorgerecht', updated_at = now() WHERE id = r.id;
    fixes_applied := fixes_applied + 1;
    fix_details := fix_details || jsonb_build_object('dish', r.dish_name, 'restaurant', r.restaurant_name, 'from', r.old_type, 'to', 'voorgerecht');
  END LOOP;

  -- Step 4: Find drinks classified as food courses
  FOR r IN
    SELECT rd.id, rd.course_type as old_type, d.name as dish_name, res.name as restaurant_name
    FROM restaurant_dishes rd
    JOIN dishes d ON rd.dish_id = d.id
    JOIN restaurants res ON rd.restaurant_id = res.id
    WHERE rd.course_type IN ('hoofdgerecht', 'voorgerecht', 'dessert', 'bijgerecht')
    AND lower(d.name) ~ '^(cola|pepsi|fanta|sprite|7.?up|ice.?tea|bier|beer|pils|pilsner|ipa|ale|stout|wijn|wine|rode wijn|witte wijn|rosé|prosecco|champagne|cava|cocktail|mocktail|smoothie|milkshake|thee|tea|koffie|coffee|espresso|cappuccino|latte|americano|flat white|macchiato|juice|jus|sap|sinaasappelsap|appelsap|limonade|lemonade|frisdrank|spa|water|tonic|bitter.?lemon|ginger.?ale|ginger.?beer|sangria|aperol|spritz|gin.?tonic|mojito|margarita|daiquiri|whiskey|rum|vodka|cognac|jenever|sake|lassi|chai|matcha|kombucha|ayran|glühwein|irish coffee|hot chocolate|warme chocolademelk)$'
  LOOP
    UPDATE restaurant_dishes SET course_type = 'drank', updated_at = now() WHERE id = r.id;
    fixes_applied := fixes_applied + 1;
    fix_details := fix_details || jsonb_build_object('dish', r.dish_name, 'restaurant', r.restaurant_name, 'from', r.old_type, 'to', 'drank');
  END LOOP;

  -- Step 5: Find clear bijgerechten classified as hoofdgerecht
  FOR r IN
    SELECT rd.id, rd.course_type as old_type, d.name as dish_name, res.name as restaurant_name
    FROM restaurant_dishes rd
    JOIN dishes d ON rd.dish_id = d.id
    JOIN restaurants res ON rd.restaurant_id = res.id
    WHERE rd.course_type = 'hoofdgerecht'
    AND lower(d.name) ~ '^(frites|friet|patat|fries|extra\s|portie\s|side\s|bijgerecht|sausje|dipsaus|aioli|mayo|ketchup|sriracha|sambal|chutney|raita|guacamole|tzatziki|olijven|brood|stokbrood|naanbrood|rijst\s*$|witte rijst|bruine rijst|basmati|jasmine rice|coleslaw|kimchi|pickles)$'
  LOOP
    UPDATE restaurant_dishes SET course_type = 'bijgerecht', updated_at = now() WHERE id = r.id;
    fixes_applied := fixes_applied + 1;
    fix_details := fix_details || jsonb_build_object('dish', r.dish_name, 'restaurant', r.restaurant_name, 'from', r.old_type, 'to', 'bijgerecht');
  END LOOP;

  RETURN jsonb_build_object(
    'total_fixes', fixes_applied,
    'fixes', fix_details
  );
END;
$function$;
