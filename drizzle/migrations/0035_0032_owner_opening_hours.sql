-- Owners set their opening hours directly, without admin review, as long as every day is in the
-- required format: a time range (up to 3 blocks, e.g. "12:00 - 14:30, 17:00 - 22:00") or
-- "gesloten". The check runs here as well, so the browser form is not the only gate. Name and
-- description changes still go through restaurant_pending_edits.
CREATE OR REPLACE FUNCTION public.set_restaurant_opening_hours(p_restaurant_id uuid, p_hours jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  d text;
  v text;
BEGIN
  IF auth.uid() IS NULL OR NOT (public.has_role(auth.uid(), 'admin') OR public.is_verified_owner(auth.uid(), p_restaurant_id)) THEN
    RAISE EXCEPTION 'Alleen de geverifieerde eigenaar kan openingstijden wijzigen' USING ERRCODE = '42501';
  END IF;
  IF p_hours IS NULL OR jsonb_typeof(p_hours) <> 'object'
     OR (SELECT count(*) FROM jsonb_object_keys(p_hours)) <> 7 THEN
    RAISE EXCEPTION 'Vul alle 7 dagen in' USING ERRCODE = '22023';
  END IF;
  FOREACH d IN ARRAY ARRAY['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] LOOP
    v := p_hours ->> d;
    IF v IS NULL OR v !~ '^(gesloten|([01][0-9]|2[0-3]):[0-5][0-9] - (([01][0-9]|2[0-3]):[0-5][0-9]|24:00)(, ([01][0-9]|2[0-3]):[0-5][0-9] - (([01][0-9]|2[0-3]):[0-5][0-9]|24:00)){0,2})$' THEN
      RAISE EXCEPTION 'Ongeldige openingstijden voor %: gebruik bijvoorbeeld 11:00 - 22:00 of gesloten', d USING ERRCODE = '22023';
    END IF;
  END LOOP;
  UPDATE public.restaurants SET opening_hours = p_hours, updated_at = now() WHERE id = p_restaurant_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Restaurant niet gevonden' USING ERRCODE = 'P0002'; END IF;
  RETURN p_hours;
END $$;
REVOKE ALL ON FUNCTION public.set_restaurant_opening_hours(uuid, jsonb) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.set_restaurant_opening_hours(uuid, jsonb) TO authenticated;