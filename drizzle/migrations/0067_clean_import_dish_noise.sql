-- Clean import noise from the Overture menus (19-11-2026, kaartlezer and Python imports, source
-- 'menu_scraper_v5'). Rows are rejected rather than deleted, so each change can be undone, and
-- restaurants that are already live stay live. Idempotent: Lovable may renumber or re-run it.

-- 1. Loose extras and condiments are not dishes ("Extra rijst", "Wasabi mayo" at 0.50).
--    Drinks are left alone: a cheap drink is still a drink.
UPDATE public.restaurant_dishes rd
   SET status = 'rejected'
  FROM public.dishes d
 WHERE d.id = rd.dish_id
   AND rd.source = 'menu_scraper_v5'
   AND rd.status = 'approved_by_admin'
   AND rd.course_type IS DISTINCT FROM 'drank'
   AND (d.name ~* '^(extra|supplement|toeslag|meerprijs)\M'
        OR (rd.price IS NOT NULL AND rd.price < 1));

-- 2. The local screening dropped the closing parenthesis ("Borrelplank (2 personen").
UPDATE public.dishes d
   SET name = rtrim(d.name, ' ,;:-') || ')'
 WHERE length(d.name) - length(replace(d.name, '(', '')) > length(d.name) - length(replace(d.name, ')', ''))
   AND EXISTS (SELECT 1 FROM public.restaurant_dishes rd WHERE rd.dish_id = d.id AND rd.source = 'menu_scraper_v5');

-- 3. Names copied in capitals ("INDISCHE RIJSTTAFEL") become sentence case.
UPDATE public.dishes d
   SET name = upper(left(lower(d.name), 1)) || substr(lower(d.name), 2)
 WHERE d.name = upper(d.name)
   AND length(regexp_replace(d.name, '[^A-Z]', '', 'g')) >= 4
   AND length(d.name) > 6
   AND EXISTS (SELECT 1 FROM public.restaurant_dishes rd WHERE rd.dish_id = d.id AND rd.source = 'menu_scraper_v5');
