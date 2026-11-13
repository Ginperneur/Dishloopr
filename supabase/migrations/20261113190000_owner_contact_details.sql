-- Verified owners set their restaurant's phone number and website themselves, straight away.
-- The checks run here too, so the dashboard form is not the only gate. An empty value clears
-- the field. Address changes are not covered: they go to Dishloopr as a contact message
-- (category 'gegevens'), because the map and search results depend on them.
-- Idempotent on purpose (Lovable may apply it under another number, or twice).
CREATE OR REPLACE FUNCTION public.set_restaurant_contact(p_restaurant_id uuid, p_phone text, p_website_url text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_phone text := NULLIF(btrim(coalesce(p_phone, '')), '');
  v_site text := NULLIF(btrim(coalesce(p_website_url, '')), '');
BEGIN
  IF auth.uid() IS NULL OR NOT (public.has_role(auth.uid(), 'admin') OR public.is_verified_owner(auth.uid(), p_restaurant_id)) THEN
    RAISE EXCEPTION 'Alleen de geverifieerde eigenaar kan contactgegevens wijzigen' USING ERRCODE = '42501';
  END IF;
  IF v_phone IS NOT NULL AND (v_phone !~ '^\+?[0-9 ()-]{6,20}$' OR length(regexp_replace(v_phone, '[^0-9]', '', 'g')) < 6) THEN
    RAISE EXCEPTION 'Ongeldig telefoonnummer: gebruik bijvoorbeeld 020 123 45 67' USING ERRCODE = '22023';
  END IF;
  IF v_site IS NOT NULL AND v_site !~* '^https?://' THEN
    v_site := 'https://' || v_site;
  END IF;
  IF v_site IS NOT NULL AND (v_site !~* '^https?://[a-z0-9-]+(\.[a-z0-9-]+)+(:[0-9]+)?(/[^[:space:]]*)?$' OR length(v_site) > 300) THEN
    RAISE EXCEPTION 'Ongeldige website: gebruik bijvoorbeeld https://jouwrestaurant.nl' USING ERRCODE = '22023';
  END IF;
  UPDATE public.restaurants SET phone = v_phone, website_url = v_site, updated_at = now() WHERE id = p_restaurant_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Restaurant niet gevonden' USING ERRCODE = 'P0002'; END IF;
  RETURN jsonb_build_object('phone', v_phone, 'website_url', v_site);
END $$;
REVOKE ALL ON FUNCTION public.set_restaurant_contact(uuid, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.set_restaurant_contact(uuid, text, text) TO authenticated;
