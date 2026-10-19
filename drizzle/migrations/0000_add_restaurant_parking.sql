ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS parking_info jsonb;
COMMENT ON COLUMN public.restaurants.parking_info IS 'Parking details supplied by restaurant owners or admins; null means unknown.';
CREATE OR REPLACE FUNCTION public.save_restaurant_parking(p_restaurant_id uuid, p_own_parking boolean, p_street_parking boolean, p_garage_name text, p_garage_address text, p_notes text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT (public.has_role(auth.uid(), 'admin') OR public.is_verified_owner(auth.uid(), p_restaurant_id)) THEN
    RAISE EXCEPTION 'Not authorized to edit parking information' USING ERRCODE = '42501';
  END IF;
  IF length(coalesce(p_garage_name, '')) > 200 OR length(coalesce(p_garage_address, '')) > 300 OR length(coalesce(p_notes, '')) > 2000 THEN
    RAISE EXCEPTION 'Parking information exceeds maximum length' USING ERRCODE = '22023';
  END IF;
  IF nullif(trim(p_garage_address), '') IS NOT NULL AND nullif(trim(p_garage_name), '') IS NULL THEN
    RAISE EXCEPTION 'Garage name is required with an address' USING ERRCODE = '22023';
  END IF;
  UPDATE public.restaurants SET parking_info = jsonb_build_object(
    'own_parking', p_own_parking, 'street_parking', p_street_parking,
    'garage_name', coalesce(trim(p_garage_name), ''), 'garage_address', coalesce(trim(p_garage_address), ''), 'notes', coalesce(trim(p_notes), '')
  ) WHERE id = p_restaurant_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Restaurant not found' USING ERRCODE = '22023'; END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.save_restaurant_parking(uuid, boolean, boolean, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_restaurant_parking(uuid, boolean, boolean, text, text, text) TO authenticated;
