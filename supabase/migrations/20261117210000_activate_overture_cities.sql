-- New cities from the Overture import start inactive (no empty city pages). Restaurants created in
-- bulk go live through unhide_restaurant_when_menu_complete(), which only switched the restaurant
-- on, so their city stayed invisible. The trigger now also switches on the city of an Overture
-- restaurant; cities without Overture restaurants are left as the admin set them.
-- Idempotent: Lovable may renumber or re-run this migration.
CREATE OR REPLACE FUNCTION public.unhide_restaurant_when_menu_complete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status NOT IN ('approved_by_admin', 'verified_by_owner') THEN RETURN NULL; END IF;
  IF NOT public.hidden_for_menu(NEW.restaurant_id) THEN RETURN NULL; END IF;
  IF public.menu_dish_count(NEW.restaurant_id) >= public.visibility_menu_minimum() THEN
    UPDATE public.restaurants SET is_active = true, updated_at = now() WHERE id = NEW.restaurant_id;
    DELETE FROM public.restaurants_verborgen WHERE id = NEW.restaurant_id;
    UPDATE public.cities c SET is_active = true
      FROM public.restaurants r
     WHERE r.id = NEW.restaurant_id AND r.overture_id IS NOT NULL
       AND c.id = r.city_id AND NOT c.is_active;
  END IF;
  RETURN NULL;
END $$;

-- Cities whose Overture restaurants already went live before this fix.
UPDATE public.cities c SET is_active = true
 WHERE NOT c.is_active
   AND EXISTS (SELECT 1 FROM public.restaurants r
               WHERE r.city_id = c.id AND r.is_active AND r.overture_id IS NOT NULL);
