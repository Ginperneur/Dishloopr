CREATE OR REPLACE FUNCTION public.simulation_search_visits(p_city text)
RETURNS TABLE (visitor text, dag date, query_norm text, filters jsonb)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH logs AS (
    SELECT coalesce(s.session_id, 'row-' || s.id) AS visitor, (s.created_at AT TIME ZONE 'Europe/Amsterdam')::date AS dag,
           lower(coalesce(s.query_norm, '')) AS query_norm, coalesce(s.filters, '{}'::jsonb) AS filters
      FROM public.search_logs s
     WHERE s.created_at > now() - interval '90 days' AND lower(coalesce(s.city, '')) = p_city
  ), heavy AS (
    SELECT l.visitor, l.dag FROM logs l GROUP BY l.visitor, l.dag HAVING count(*) > 60
  )
  SELECT l.visitor, l.dag, l.query_norm, l.filters FROM logs l
   WHERE NOT EXISTS (SELECT 1 FROM heavy h WHERE h.visitor = l.visitor AND h.dag = l.dag)
$$;
REVOKE ALL ON FUNCTION public.simulation_search_visits(text) FROM public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.run_owner_simulation(p_restaurant uuid, p_kind text, p_dish uuid DEFAULT NULL,
                                                       p_tag text DEFAULT NULL, p_price_level int DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r record; v_city text; v_charge text; v_free int; v_result jsonb;
  d record; v_hub boolean; v_canon text; v_better int; v_total int; v_searches numeric; v_pos int;
  v_with_filter int; v_lose int; v_gain int; v_matches int;
BEGIN
  IF auth.uid() IS NULL OR NOT (public.has_role(auth.uid(), 'admin') OR public.is_verified_owner(auth.uid(), p_restaurant)) THEN
    RAISE EXCEPTION 'Alleen de geverifieerde eigenaar' USING ERRCODE = '42501';
  END IF;
  SELECT id, city_id, coalesce(is_featured, false) f, coalesce(is_top_listing, false) t, coalesce(rating, 0) rt,
         price_level, owner_tier INTO r FROM public.restaurants WHERE id = p_restaurant;
  SELECT lower(name) INTO v_city FROM public.cities WHERE id = r.city_id;

  IF r.owner_tier = 'pro' THEN v_charge := 'pro';
  ELSE
    SELECT count(*) INTO v_free FROM public.owner_simulations WHERE restaurant_id = p_restaurant AND charge = 'free';
    IF v_free < public.simulation_free_limit() THEN v_charge := 'free';
    ELSIF EXISTS (SELECT 1 FROM public.owner_simulation_credits WHERE restaurant_id = p_restaurant AND credits > 0) THEN v_charge := 'credit';
    ELSE
      RAISE EXCEPTION 'Je gratis simulaties zijn op. Een simulatie kost 1,99 euro.' USING ERRCODE = 'P0001', HINT = 'payment_required';
    END IF;
  END IF;

  IF p_kind = 'add_dish' THEN
    SELECT cd.id, cd.name, cd.slug, cd.canonical_slug, cd.dish_group INTO d FROM public.dishes x
      JOIN public.dishes cd ON cd.slug = coalesce(x.canonical_slug, x.slug) WHERE x.id = p_dish;
    IF d.id IS NULL THEN RAISE EXCEPTION 'Kies een gerecht' USING ERRCODE = '22023'; END IF;
    v_canon := coalesce(d.canonical_slug, d.slug);
    v_hub := coalesce(v_canon = d.dish_group, false);
    WITH comp AS (
      SELECT DISTINCT rs.id, coalesce(rs.is_featured, false) f, coalesce(rs.is_top_listing, false) t, coalesce(rs.rating, 0) rt
        FROM public.restaurant_dishes rd JOIN public.dishes dd ON dd.id = rd.dish_id
        JOIN public.restaurants rs ON rs.id = rd.restaurant_id AND rs.city_id = r.city_id AND rs.is_active
       WHERE rd.status IN ('approved_by_admin', 'verified_by_owner') AND rs.id <> p_restaurant
         AND ((v_hub AND dd.dish_group = v_canon) OR (NOT v_hub AND dd.canonical_slug = v_canon)))
    SELECT count(*) FILTER (WHERE (NOT r.f AND c.f) OR (c.f = r.f AND NOT r.t AND c.t)
             OR (c.f = r.f AND c.t = r.t AND (c.rt > r.rt OR (c.rt = r.rt AND c.id < r.id)))), count(*)
      INTO v_better, v_total FROM comp c;
    v_pos := v_better + 1;
    v_searches := round((SELECT count(DISTINCT (s.visitor, s.dag)) FROM public.simulation_search_visits(v_city) s
                          WHERE ' ' || s.query_norm || ' ' LIKE '% ' || lower(d.name) || ' %')::numeric / 3, 1);
    v_result := jsonb_build_object('kind', 'add_dish', 'dish', d.name, 'position', v_pos, 'total', v_total + 1,
      'searches_per_month', v_searches, 'extra_visitors_per_month', round(v_searches * public.simulation_ctr(v_pos)),
      'data_points', round(v_searches * 3));

  ELSIF p_kind = 'change_price' THEN
    IF p_price_level IS NULL OR p_price_level NOT BETWEEN 1 AND 4 THEN RAISE EXCEPTION 'Kies een prijsklasse' USING ERRCODE = '22023'; END IF;
    SELECT count(DISTINCT (s.visitor, s.dag)) FILTER (WHERE s.filters ? 'prijs'),
           count(DISTINCT (s.visitor, s.dag)) FILTER (WHERE s.filters ? 'prijs' AND public.simulation_filter_has(s.filters -> 'prijs', coalesce(r.price_level, 0)::text)
                             AND NOT public.simulation_filter_has(s.filters -> 'prijs', p_price_level::text)),
           count(DISTINCT (s.visitor, s.dag)) FILTER (WHERE s.filters ? 'prijs' AND public.simulation_filter_has(s.filters -> 'prijs', p_price_level::text)
                             AND NOT public.simulation_filter_has(s.filters -> 'prijs', coalesce(r.price_level, 0)::text))
      INTO v_with_filter, v_lose, v_gain
      FROM public.simulation_search_visits(v_city) s;
    v_result := jsonb_build_object('kind', 'change_price', 'from', r.price_level, 'to', p_price_level,
      'price_filter_searches_per_month', round(v_with_filter::numeric / 3, 1),
      'gain_per_month', round(v_gain::numeric / 3, 1), 'lose_per_month', round(v_lose::numeric / 3, 1),
      'data_points', v_with_filter);

  ELSIF p_kind = 'remove_tag' THEN
    IF coalesce(trim(p_tag), '') = '' THEN RAISE EXCEPTION 'Kies een tag' USING ERRCODE = '22023'; END IF;
    SELECT count(DISTINCT (s.visitor, s.dag)) INTO v_matches FROM public.simulation_search_visits(v_city) s
     WHERE (public.simulation_filter_has(s.filters -> 'sfeer', p_tag) OR public.simulation_filter_has(s.filters -> 'keuken', p_tag)
         OR public.simulation_filter_has(s.filters -> 'concept', p_tag) OR public.simulation_filter_has(s.filters -> 'ervaring', p_tag));
    v_result := jsonb_build_object('kind', 'remove_tag', 'tag', p_tag,
      'filter_searches_per_month', round(v_matches::numeric / 3, 1), 'data_points', v_matches);
  ELSE
    RAISE EXCEPTION 'Onbekende simulatie' USING ERRCODE = '22023';
  END IF;

  IF v_charge = 'credit' THEN
    UPDATE public.owner_simulation_credits SET credits = credits - 1, updated_at = now() WHERE restaurant_id = p_restaurant;
  END IF;
  INSERT INTO public.owner_simulations (restaurant_id, user_id, kind, params, result, charge)
    VALUES (p_restaurant, auth.uid(), p_kind,
            jsonb_build_object('dish_id', p_dish, 'tag', p_tag, 'price_level', p_price_level), v_result, v_charge);
  RETURN v_result || jsonb_build_object('quota', public.owner_simulation_quota(p_restaurant));
END $$;