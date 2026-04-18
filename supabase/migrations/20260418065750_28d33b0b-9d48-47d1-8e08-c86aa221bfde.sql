
-- Update the function to allow execution by postgres role (during migrations) or admin users
CREATE OR REPLACE FUNCTION public.generate_city_grid(
  _city_id uuid,
  _city_name text,
  _center_lat numeric,
  _center_lng numeric,
  _rows integer,
  _cols integer,
  _spacing_km numeric DEFAULT 1.5,
  _radius_meters integer DEFAULT 1500
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inserted_count integer := 0;
  i integer;
  j integer;
  point_lat numeric;
  point_lng numeric;
  lat_step numeric;
  lng_step numeric;
  start_lat numeric;
  start_lng numeric;
BEGIN
  -- Allow if running as postgres (migration) or if user is admin
  IF auth.uid() IS NOT NULL AND NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Admin role required';
  END IF;

  lat_step := _spacing_km / 111.0;
  lng_step := _spacing_km / (111.0 * cos(radians(_center_lat)));

  start_lat := _center_lat - ((_rows - 1) / 2.0) * lat_step;
  start_lng := _center_lng - ((_cols - 1) / 2.0) * lng_step;

  FOR i IN 0..(_rows - 1) LOOP
    FOR j IN 0..(_cols - 1) LOOP
      point_lat := start_lat + i * lat_step;
      point_lng := start_lng + j * lng_step;

      INSERT INTO public.discovery_grid_points (
        city_id, name, type, lat, lng, radius_meters, search_terms, is_active
      ) VALUES (
        _city_id,
        _city_name || ' Grid ' || (i + 1) || '-' || (j + 1),
        'grid',
        point_lat,
        point_lng,
        _radius_meters,
        ARRAY[]::text[],
        true
      )
      ON CONFLICT DO NOTHING;

      inserted_count := inserted_count + 1;
    END LOOP;
  END LOOP;

  RETURN inserted_count;
END;
$$;

-- Generate grids
DO $$
DECLARE
  v_city_id uuid;
  v_count integer;
BEGIN
  SELECT id INTO v_city_id FROM public.cities WHERE slug = 'den-haag';
  SELECT COUNT(*) INTO v_count FROM public.discovery_grid_points WHERE city_id = v_city_id;
  IF v_city_id IS NOT NULL AND v_count = 0 THEN
    PERFORM public.generate_city_grid(v_city_id, 'Den Haag', 52.0705, 4.3007, 4, 6, 1.5, 1500);
  END IF;

  SELECT id INTO v_city_id FROM public.cities WHERE slug = 'rotterdam';
  SELECT COUNT(*) INTO v_count FROM public.discovery_grid_points WHERE city_id = v_city_id;
  IF v_city_id IS NOT NULL AND v_count = 0 THEN
    PERFORM public.generate_city_grid(v_city_id, 'Rotterdam', 51.9244, 4.4777, 5, 6, 1.5, 1500);
  END IF;

  SELECT id INTO v_city_id FROM public.cities WHERE slug = 'utrecht';
  SELECT COUNT(*) INTO v_count FROM public.discovery_grid_points WHERE city_id = v_city_id;
  IF v_city_id IS NOT NULL AND v_count = 0 THEN
    PERFORM public.generate_city_grid(v_city_id, 'Utrecht', 52.0907, 5.1214, 4, 5, 1.5, 1500);
  END IF;

  SELECT id INTO v_city_id FROM public.cities WHERE slug = 'eindhoven';
  SELECT COUNT(*) INTO v_count FROM public.discovery_grid_points WHERE city_id = v_city_id;
  IF v_city_id IS NOT NULL AND v_count = 0 THEN
    PERFORM public.generate_city_grid(v_city_id, 'Eindhoven', 51.4416, 5.4697, 4, 5, 1.5, 1500);
  END IF;

  SELECT id INTO v_city_id FROM public.cities WHERE slug = 'breda';
  SELECT COUNT(*) INTO v_count FROM public.discovery_grid_points WHERE city_id = v_city_id;
  IF v_city_id IS NOT NULL AND v_count = 0 THEN
    PERFORM public.generate_city_grid(v_city_id, 'Breda', 51.5719, 4.7683, 3, 4, 1.5, 1500);
  END IF;
END $$;
