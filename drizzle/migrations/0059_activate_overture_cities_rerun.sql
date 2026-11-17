UPDATE public.cities c SET is_active = true
 WHERE NOT c.is_active
   AND EXISTS (SELECT 1 FROM public.restaurants r
               WHERE r.city_id = c.id AND r.is_active AND r.overture_id IS NOT NULL);