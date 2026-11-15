-- Simulations ("what if") for owners, on real data, with 3 free per restaurant and then 1.99 euro each.
--  * add_dish:     where would I rank on that dish in my city, how many people search for it, and
--                  roughly how many extra visitors per month at that position;
--  * change_price: how many searches in my city filter on price, and how many I would win or lose;
--  * remove_tag:   how many searches in my city filter on that tag (what I would stop matching).
-- Owner Pro: unlimited. Others: 3 free per restaurant, then one purchased credit per simulation
-- (create-simulation-checkout, credited by stripe-webhook through grant_simulation_credits).
-- Idempotent on purpose (Lovable may apply it under another number, or twice).

CREATE TABLE IF NOT EXISTS public.owner_simulations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  user_id uuid,
  kind text NOT NULL CHECK (kind IN ('add_dish', 'change_price', 'remove_tag')),
  params jsonb NOT NULL DEFAULT '{}'::jsonb,
  result jsonb NOT NULL DEFAULT '{}'::jsonb,
  charge text NOT NULL DEFAULT 'free' CHECK (charge IN ('free', 'credit', 'pro')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS owner_simulations_restaurant ON public.owner_simulations (restaurant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.owner_simulation_credits (
  restaurant_id uuid PRIMARY KEY REFERENCES public.restaurants(id) ON DELETE CASCADE,
  credits int NOT NULL DEFAULT 0 CHECK (credits >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.owner_simulation_purchases (
  stripe_session_id text PRIMARY KEY,
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  user_id uuid,
  quantity int NOT NULL CHECK (quantity > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.owner_simulations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.owner_simulation_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.owner_simulation_purchases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owners read own simulations" ON public.owner_simulations;
CREATE POLICY "Owners read own simulations" ON public.owner_simulations FOR SELECT
  USING (public.is_verified_owner(auth.uid(), restaurant_id) OR public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "Owners read own simulation credits" ON public.owner_simulation_credits;
CREATE POLICY "Owners read own simulation credits" ON public.owner_simulation_credits FOR SELECT
  USING (public.is_verified_owner(auth.uid(), restaurant_id) OR public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.simulation_free_limit()
RETURNS int LANGUAGE sql IMMUTABLE AS $$ SELECT 3 $$;

CREATE OR REPLACE FUNCTION public.owner_simulation_quota(p_restaurant uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT (public.has_role(auth.uid(), 'admin') OR public.is_verified_owner(auth.uid(), p_restaurant)) THEN
    RAISE EXCEPTION 'Alleen de geverifieerde eigenaar' USING ERRCODE = '42501';
  END IF;
  RETURN jsonb_build_object(
    'unlimited', coalesce((SELECT owner_tier = 'pro' FROM public.restaurants WHERE id = p_restaurant), false),
    'free_left', greatest(0, public.simulation_free_limit()
                  - (SELECT count(*) FROM public.owner_simulations WHERE restaurant_id = p_restaurant AND charge = 'free')::int),
    'credits', coalesce((SELECT credits FROM public.owner_simulation_credits WHERE restaurant_id = p_restaurant), 0),
    'price_cents', 199
  );
END $$;

-- Share of a position in clicks (rough industry curve for ranked lists).
CREATE OR REPLACE FUNCTION public.simulation_ctr(p_position int)
RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN p_position <= 1 THEN 0.30 WHEN p_position = 2 THEN 0.15 WHEN p_position = 3 THEN 0.10
              WHEN p_position <= 5 THEN 0.06 WHEN p_position <= 10 THEN 0.03 ELSE 0.01 END
$$;

-- Does a logged filter value (array or single value) contain v?
CREATE OR REPLACE FUNCTION public.simulation_filter_has(p_filter jsonb, p_value text)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE jsonb_typeof(p_filter)
    WHEN 'array' THEN EXISTS (SELECT 1 FROM jsonb_array_elements_text(p_filter) x WHERE lower(x) = lower(p_value))
    WHEN 'string' THEN lower(p_filter #>> '{}') = lower(p_value)
    WHEN 'number' THEN p_filter #>> '{}' = p_value
    ELSE false END
$$;

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

  -- Who pays: Pro unlimited, then free ones, then a credit.
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
    v_searches := round((SELECT count(*) FROM public.search_logs s WHERE s.created_at > now() - interval '90 days'
                          AND lower(coalesce(s.city, '')) = v_city AND s.query_norm LIKE '%' || lower(d.name) || '%')::numeric / 3, 1);
    v_result := jsonb_build_object('kind', 'add_dish', 'dish', d.name, 'position', v_pos, 'total', v_total + 1,
      'searches_per_month', v_searches, 'extra_visitors_per_month', round(v_searches * public.simulation_ctr(v_pos)),
      'data_points', round(v_searches * 3));

  ELSIF p_kind = 'change_price' THEN
    IF p_price_level IS NULL OR p_price_level NOT BETWEEN 1 AND 4 THEN RAISE EXCEPTION 'Kies een prijsklasse' USING ERRCODE = '22023'; END IF;
    SELECT count(*) FILTER (WHERE s.filters ? 'prijs'),
           count(*) FILTER (WHERE s.filters ? 'prijs' AND public.simulation_filter_has(s.filters -> 'prijs', coalesce(r.price_level, 0)::text)
                             AND NOT public.simulation_filter_has(s.filters -> 'prijs', p_price_level::text)),
           count(*) FILTER (WHERE s.filters ? 'prijs' AND public.simulation_filter_has(s.filters -> 'prijs', p_price_level::text)
                             AND NOT public.simulation_filter_has(s.filters -> 'prijs', coalesce(r.price_level, 0)::text))
      INTO v_with_filter, v_lose, v_gain
      FROM public.search_logs s WHERE s.created_at > now() - interval '90 days' AND lower(coalesce(s.city, '')) = v_city;
    v_result := jsonb_build_object('kind', 'change_price', 'from', r.price_level, 'to', p_price_level,
      'price_filter_searches_per_month', round(v_with_filter::numeric / 3, 1),
      'gain_per_month', round(v_gain::numeric / 3, 1), 'lose_per_month', round(v_lose::numeric / 3, 1),
      'data_points', v_with_filter);

  ELSIF p_kind = 'remove_tag' THEN
    IF coalesce(trim(p_tag), '') = '' THEN RAISE EXCEPTION 'Kies een tag' USING ERRCODE = '22023'; END IF;
    SELECT count(*) INTO v_matches FROM public.search_logs s
     WHERE s.created_at > now() - interval '90 days' AND lower(coalesce(s.city, '')) = v_city
       AND (public.simulation_filter_has(s.filters -> 'sfeer', p_tag) OR public.simulation_filter_has(s.filters -> 'keuken', p_tag)
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

-- Stripe webhook (service role): add purchased simulations once per checkout session.
CREATE OR REPLACE FUNCTION public.grant_simulation_credits(p_session text, p_restaurant uuid, p_user uuid, p_quantity int)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.owner_simulation_purchases (stripe_session_id, restaurant_id, user_id, quantity)
    VALUES (p_session, p_restaurant, p_user, p_quantity) ON CONFLICT (stripe_session_id) DO NOTHING;
  IF NOT FOUND THEN RETURN false; END IF;
  INSERT INTO public.owner_simulation_credits (restaurant_id, credits) VALUES (p_restaurant, p_quantity)
    ON CONFLICT (restaurant_id) DO UPDATE SET credits = owner_simulation_credits.credits + EXCLUDED.credits, updated_at = now();
  RETURN true;
END $$;

REVOKE ALL ON FUNCTION public.grant_simulation_credits(text, uuid, uuid, int) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.run_owner_simulation(uuid, text, uuid, text, int) FROM public, anon;
REVOKE ALL ON FUNCTION public.owner_simulation_quota(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.run_owner_simulation(uuid, text, uuid, text, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.owner_simulation_quota(uuid) TO authenticated;
