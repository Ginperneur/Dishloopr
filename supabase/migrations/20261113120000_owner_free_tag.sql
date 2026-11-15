-- Owners pick their own free tag per category (the first element of the array); paid
-- extra tags after it stay untouched. A SECURITY DEFINER function instead of a direct
-- update, so an owner can only set one tag from the fixed lists for their own restaurant
-- (a direct update would let them add any number of cuisines and show up everywhere).
-- The lists mirror src/components/owner/TagManager.tsx; keep both in sync.
CREATE OR REPLACE FUNCTION public.set_free_restaurant_tag(p_restaurant_id uuid, p_category text, p_value text)
RETURNS text[] LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_allowed text[];
  v_cur text[];
  v_new text[];
BEGIN
  IF auth.uid() IS NULL OR NOT (public.has_role(auth.uid(), 'admin') OR public.is_verified_owner(auth.uid(), p_restaurant_id)) THEN
    RAISE EXCEPTION 'Alleen de geverifieerde eigenaar kan tags kiezen' USING ERRCODE = '42501';
  END IF;
  v_allowed := CASE p_category
    WHEN 'cuisine' THEN ARRAY['Italiaans', 'Japans', 'Chinees', 'Indiaas', 'Mexicaans', 'Thais', 'Grieks', 'Spaans', 'Koreaans', 'Vietnamees', 'Amerikaans', 'Frans', 'Turks', 'Marokkaans', 'Surinaams', 'Indonesisch', 'Aziatisch', 'Mediterraans', 'Nederlands', 'Internationaal', 'Fusion', 'Midden-Oosters', 'Ethiopisch', 'Braziliaans', 'Peruaans', 'Argentijns', 'Caribisch', 'Afghaans', 'Libanees', 'Steakhouse', 'Sushi', 'Vis & Zeevruchten', 'Vegetarisch', 'Veganistisch', 'Pizza', 'Burger', 'BBQ', 'Ramen', 'Dim Sum', 'Tapas', 'Bistro', 'Brasserie', 'Gastropub']
    WHEN 'ambience' THEN ARRAY['Gezellig', 'Romantisch', 'Modern', 'Trendy', 'Klassiek', 'Casual', 'Fine Dining', 'Kindvriendelijk', 'Zakelijk', 'Levendig', 'Intiem', 'Industrieel', 'Traditioneel', 'Luxe', 'Bohemian', 'Minimalistisch', 'Warm', 'Bruisend']
    WHEN 'concept' THEN ARRAY['All you can eat', 'Shared dining', 'Teppanyaki', 'Omakase', 'Farm to table', 'Street food', 'Food hall', 'Pop-up', 'Buffet', 'À la carte', 'Tasting menu', 'Brunch spot', 'Lunchroom', 'Grand café', 'Eetcafé', 'Foodtruck', 'Dark kitchen', 'Open keuken', 'Chef''s table', 'Terras restaurant']
    WHEN 'experience' THEN ARRAY['Quick bite', 'Comfort food', 'Healthy', 'Luxe avond uit', 'Date night', 'Zakendiner', 'Familiefeest', 'Groepsdiner', 'Solo dining', 'Late night']
  END;
  IF v_allowed IS NULL OR NOT (p_value = ANY (v_allowed)) THEN
    RAISE EXCEPTION 'Onbekende tag' USING ERRCODE = '22023';
  END IF;

  SELECT CASE p_category
           WHEN 'cuisine' THEN cuisines
           WHEN 'ambience' THEN ambience_tags
           WHEN 'concept' THEN concepts
           ELSE experiences
         END
    INTO v_cur FROM public.restaurants WHERE id = p_restaurant_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Restaurant niet gevonden' USING ERRCODE = 'P0002'; END IF;

  -- Replace the free slot, keep the paid extras, never list a tag twice.
  v_new := ARRAY[p_value] || array_remove(coalesce(v_cur[2:], '{}'::text[]), p_value);

  UPDATE public.restaurants SET
    cuisines      = CASE WHEN p_category = 'cuisine' THEN v_new ELSE cuisines END,
    ambience_tags = CASE WHEN p_category = 'ambience' THEN v_new ELSE ambience_tags END,
    concepts      = CASE WHEN p_category = 'concept' THEN v_new ELSE concepts END,
    experiences   = CASE WHEN p_category = 'experience' THEN v_new ELSE experiences END,
    updated_at    = now()
  WHERE id = p_restaurant_id;
  RETURN v_new;
END $$;
REVOKE ALL ON FUNCTION public.set_free_restaurant_tag(uuid, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.set_free_restaurant_tag(uuid, text, text) TO authenticated;
