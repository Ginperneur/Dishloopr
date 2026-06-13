
-- 1. Raise dish search RPC limit from 300 to 2000 so popular terms aren't truncated.
CREATE OR REPLACE FUNCTION public.search_dishes_by_term(search_term text)
 RETURNS SETOF dishes
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT d.*
  FROM public.dishes d
  WHERE d.is_active = true
    AND (
      d.name ILIKE '%' || search_term || '%'
      OR d.name_en ILIKE '%' || search_term || '%'
      OR EXISTS (
        SELECT 1
        FROM unnest(d.synonyms) AS syn
        WHERE syn ILIKE '%' || search_term || '%'
      )
    )
  LIMIT 2000;
END;
$function$;

-- 2. Helper to merge synonyms (preserves existing, adds new, deduped, lowercased trimmed)
CREATE OR REPLACE FUNCTION public._merge_dish_synonyms(p_slug text, p_new text[])
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.dishes
  SET synonyms = ARRAY(
    SELECT DISTINCT s
    FROM unnest(COALESCE(synonyms, '{}'::text[]) || p_new) AS s
    WHERE s IS NOT NULL AND length(trim(s)) > 0
  ),
  updated_at = now()
  WHERE slug = p_slug;
END;
$$;

-- 3. Expand synonyms for popular dishes (NL/EN plurals + variants)
SELECT public._merge_dish_synonyms('steak', ARRAY[
  'steaks','beefsteak','beef steak','beef','vlees','rundvlees','biefstuk','biefstukken',
  'ribeye','rib-eye','rib eye','entrecote','entrecôte','tomahawk','t-bone','tbone',
  'porterhouse','sirloin','tenderloin','ossenhaas','picanha','flank steak','rumpsteak',
  'striploin','new york strip','filet mignon','black angus','wagyu','grilled steak'
]);

SELECT public._merge_dish_synonyms('steaks', ARRAY[
  'steak','beef','beefsteak','biefstuk','biefstukken','vlees','rundvlees',
  'ribeye','rib-eye','entrecote','tomahawk'
]);

SELECT public._merge_dish_synonyms('biefstuk', ARRAY[
  'steak','steaks','beef','beefsteak','beef steak','rundvlees','vlees',
  'biefstukken','ribeye','rib-eye','entrecote','ossenhaas'
]);

SELECT public._merge_dish_synonyms('ribeye', ARRAY[
  'rib-eye','rib eye','steak','steaks','biefstuk','entrecote','beef','rundvlees'
]);

SELECT public._merge_dish_synonyms('rib-eye', ARRAY[
  'ribeye','rib eye','steak','steaks','biefstuk','entrecote','beef','rundvlees'
]);

SELECT public._merge_dish_synonyms('entrecote', ARRAY[
  'entrecôte','steak','steaks','biefstuk','ribeye','rib-eye','beef','rundvlees'
]);

SELECT public._merge_dish_synonyms('tomahawk', ARRAY[
  'steak','steaks','biefstuk','tomahawk steak','beef','rundvlees'
]);

-- Sushi family
SELECT public._merge_dish_synonyms('sushi', ARRAY[
  'sushis','sushi rolls','sushi roll','sushi-roll','sushi platter','sushi plate',
  'sushibox','sushi box','sushi set','sushi menu','sushi to go','sushi assortiment',
  'nigiri','maki','sashimi','uramaki','futomaki','hosomaki','temaki','california roll',
  'rainbow roll','dragon roll','spider roll','poke','japans','japanese','rauwe vis'
]);

SELECT public._merge_dish_synonyms('nigiri', ARRAY[
  'sushi','nigiri sushi','tuna nigiri','salmon nigiri','zalm nigiri','tonijn nigiri'
]);

SELECT public._merge_dish_synonyms('maki', ARRAY[
  'sushi','makis','maki rolls','maki roll','futomaki','hosomaki','uramaki'
]);

SELECT public._merge_dish_synonyms('sashimi', ARRAY[
  'sushi','rauwe vis','zalm sashimi','tonijn sashimi','sashimi mix'
]);

-- Shrimp/garnalen family
SELECT public._merge_dish_synonyms('shrimp', ARRAY[
  'shrimps','garnaal','garnalen','garnalengerecht','gamba','gambas','gamba''s',
  'prawn','prawns','scampi','scampis','tijgergarnaal','tijgergarnalen','black tiger',
  'crevette','crevettes','ebi','knoflookgarnalen','garlic shrimp','garlic prawns',
  'gamberi','jumbo shrimp','grote garnalen'
]);

SELECT public._merge_dish_synonyms('shrimps', ARRAY[
  'shrimp','garnaal','garnalen','garnalengerecht','gamba','gambas','prawn','prawns',
  'scampi','tijgergarnalen','black tiger','ebi','knoflookgarnalen','garlic shrimp',
  'jumbo shrimp','grote garnalen','gepelde garnalen','hollandse garnalen'
]);

SELECT public._merge_dish_synonyms('garnalen', ARRAY[
  'shrimps','garnaal','gamba','gambas','gamba''s','prawn','prawns','scampi','scampis',
  'tijgergarnaal','tijgergarnalen','black tiger','crevette','crevettes','ebi',
  'knoflookgarnalen','garlic shrimp','jumbo shrimp','hollandse garnalen','grote garnalen',
  'gepelde garnalen'
]);

SELECT public._merge_dish_synonyms('garnaal', ARRAY[
  'garnalen','shrimp','shrimps','gamba','gambas','prawn','prawns','scampi','ebi'
]);

SELECT public._merge_dish_synonyms('gamba', ARRAY[
  'gambas','gamba''s','garnaal','garnalen','shrimp','shrimps','prawn','prawns',
  'scampi','tijgergarnalen','ebi'
]);

SELECT public._merge_dish_synonyms('gambas', ARRAY[
  'gamba','gamba''s','garnalen','shrimp','shrimps','prawn','prawns','scampi','ebi'
]);

SELECT public._merge_dish_synonyms('prawns', ARRAY[
  'prawn','shrimp','shrimps','garnaal','garnalen','gamba','gambas','scampi','ebi',
  'king prawn','king prawns','tiger prawn','tiger prawns'
]);

-- Pizza
SELECT public._merge_dish_synonyms('pizza', ARRAY[
  'pizzas','pizza''s','margherita','funghi','quattro stagioni','quattro formaggi',
  'pepperoni','prosciutto','salami','hawaii','tonno','calzone','focaccia','pinsa',
  'house pizza','signature pizza'
]);

SELECT public._merge_dish_synonyms('pizzas', ARRAY[
  'pizza','pizza''s','margherita','pepperoni','calzone'
]);

-- Burger
SELECT public._merge_dish_synonyms('burger', ARRAY[
  'burgers','hamburger','hamburgers','cheeseburger','cheeseburgers','smash burger',
  'smashburger','bacon burger','beef burger','beefburger','wagyu burger','double burger',
  'classic burger','veggie burger','vega burger','vegan burger','vegan-burger',
  'kipburger','chicken burger','plant burger','american burger','dutch burger',
  'angus burger','signature burger'
]);

SELECT public._merge_dish_synonyms('burgers', ARRAY[
  'burger','hamburger','hamburgers','cheeseburger','smash burger','smashburger',
  'beef burger','wagyu burger','classic burger','veggie burger','chicken burger'
]);

-- Pasta / Noodles
SELECT public._merge_dish_synonyms('pasta', ARRAY[
  'pastas','pasta''s','pastagerechten','spaghetti','tagliatelle','penne','rigatoni',
  'linguine','fusilli','ravioli','tortellini','gnocchi','lasagne','lasagna','cannelloni',
  'carbonara','bolognese','arrabbiata','alfredo','pesto pasta','huisgemaakte pasta'
]);

SELECT public._merge_dish_synonyms('noodles', ARRAY[
  'noodle','noedels','noedel','noodle soup','ramen','udon','soba','rice noodles',
  'pad thai','lo mein','chow mein','mie','bami','mihoen','glass noodles'
]);

SELECT public._merge_dish_synonyms('noodle', ARRAY[
  'noodles','noedels','noedel','ramen','udon','soba','mie','bami','rice noodles',
  'pad thai','lo mein','chow mein'
]);

SELECT public._merge_dish_synonyms('noedels', ARRAY[
  'noodles','noodle','noedel','ramen','udon','soba','mie','bami','rice noodles',
  'pad thai','lo mein','chow mein','glasnoedels'
]);

-- Ramen / Soup
SELECT public._merge_dish_synonyms('ramen', ARRAY[
  'ramens','tonkotsu','shoyu','miso ramen','tonkotsu ramen','shio ramen','noodle soup',
  'noedelsoep','japanse soep','spicy ramen','vegan ramen','vegetarian ramen'
]);

SELECT public._merge_dish_synonyms('soep', ARRAY[
  'soup','soups','soepen','bisque','bouillon','consommé','crème','minestrone',
  'pho','ramen','tom yum','tom kha','miso soup','dagsoep','tomatensoep','kippensoep'
]);

SELECT public._merge_dish_synonyms('soup', ARRAY[
  'soep','soups','soepen','minestrone','pho','ramen','tom yum','tom kha','miso soup',
  'bisque','noodle soup','chicken soup','tomato soup'
]);

-- Salad
SELECT public._merge_dish_synonyms('salade', ARRAY[
  'salades','salade''s','salad','salads','caesar salad','caesarsalade','geitenkaas salade',
  'griekse salade','greek salad','quinoa salade','poke bowl','buddha bowl','maaltijdsalade'
]);

SELECT public._merge_dish_synonyms('salad', ARRAY[
  'salads','salade','salades','caesar salad','greek salad','quinoa salad',
  'buddha bowl','poke bowl'
]);

-- Poke
SELECT public._merge_dish_synonyms('poke', ARRAY[
  'poké','pokes','poke bowl','poké bowl','pokebowl','pokébowl','poke bowls',
  'hawaiian poke','tuna poke','salmon poke','zalm poke','tonijn poke','veggie poke'
]);

SELECT public._merge_dish_synonyms('pokebowl', ARRAY[
  'poke bowl','poké bowl','poke','poké','pokebowls','poke bowls','buddha bowl'
]);

SELECT public._merge_dish_synonyms('poke-bowl', ARRAY[
  'poke bowl','poké bowl','poke','poké','pokebowl','pokebowls','poke bowls'
]);

-- Tapas / Dim sum / Curry / Wraps
SELECT public._merge_dish_synonyms('tapas', ARRAY[
  'tapa','tapas plateau','tapasmenu','spaanse hapjes','sharing plates','small plates',
  'shared dining','borrelhapjes','borrelplank'
]);

SELECT public._merge_dish_synonyms('dim-sum', ARRAY[
  'dimsum','dimsums','dim sums','dumplings','gyoza','baozi','har gow','siu mai',
  'shumai','xiao long bao','xlb','steamed dumplings','fried dumplings','chinese hapjes'
]);

SELECT public._merge_dish_synonyms('dimsum', ARRAY[
  'dim sum','dim-sum','dimsums','dumplings','gyoza','har gow','siu mai','shumai'
]);

SELECT public._merge_dish_synonyms('curry', ARRAY[
  'curries','curry''s','currys','rode curry','groene curry','gele curry','red curry',
  'green curry','yellow curry','massaman','panang','vindaloo','tikka masala','korma',
  'rendang','japanese curry','katsu curry','thai curry'
]);

SELECT public._merge_dish_synonyms('curries', ARRAY[
  'curry','curry''s','red curry','green curry','yellow curry','massaman','panang',
  'tikka masala','korma','katsu curry'
]);

SELECT public._merge_dish_synonyms('wraps', ARRAY[
  'wrap','tortilla','tortilla wraps','burrito','shoarma wrap','kebab wrap',
  'chicken wrap','kip wrap','falafel wrap','veggie wrap'
]);

SELECT public._merge_dish_synonyms('wrap', ARRAY[
  'wraps','tortilla','burrito','chicken wrap','falafel wrap','veggie wrap'
]);

-- Cleanup helper
DROP FUNCTION public._merge_dish_synonyms(text, text[]);
