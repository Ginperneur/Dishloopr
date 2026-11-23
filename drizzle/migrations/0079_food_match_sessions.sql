CREATE TABLE public.food_match_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  share_code text NOT NULL UNIQUE DEFAULT substr(md5(random()::text || clock_timestamp()::text), 1, 8),
  city_id uuid,
  host_name text,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.food_match_sessions TO service_role;
ALTER TABLE public.food_match_sessions ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.food_match_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.food_match_sessions(id) ON DELETE CASCADE,
  participant_token text NOT NULL,
  participant_name text NOT NULL,
  ambiences text[] NOT NULL DEFAULT '{}',
  dishes text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, participant_token)
);
GRANT ALL ON public.food_match_answers TO service_role;
ALTER TABLE public.food_match_answers ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.food_match_create(p_city_id uuid, p_host_name text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_code text;
BEGIN
  INSERT INTO food_match_sessions(city_id, host_name) VALUES (p_city_id, left(coalesce(p_host_name,''),40))
  RETURNING share_code INTO v_code;
  RETURN v_code;
END $$;

CREATE OR REPLACE FUNCTION public.food_match_submit(p_code text, p_token text, p_name text, p_ambiences text[], p_dishes text[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  SELECT id INTO v_id FROM food_match_sessions WHERE share_code = p_code AND created_at > now() - interval '7 days';
  IF v_id IS NULL THEN RAISE EXCEPTION 'session_not_found'; END IF;
  IF length(p_token) < 8 OR length(p_token) > 64 THEN RAISE EXCEPTION 'bad_token'; END IF;
  INSERT INTO food_match_answers(session_id, participant_token, participant_name, ambiences, dishes)
  VALUES (v_id, p_token, left(coalesce(nullif(trim(p_name),''),'Gast'),40), p_ambiences[1:10], p_dishes[1:20])
  ON CONFLICT (session_id, participant_token) DO UPDATE
    SET participant_name = EXCLUDED.participant_name, ambiences = EXCLUDED.ambiences, dishes = EXCLUDED.dishes;
END $$;

CREATE OR REPLACE FUNCTION public.food_match_get(p_code text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'city_id', s.city_id, 'host_name', s.host_name,
    'answers', coalesce((SELECT jsonb_agg(jsonb_build_object('name', a.participant_name, 'ambiences', a.ambiences, 'dishes', a.dishes) ORDER BY a.created_at)
      FROM food_match_answers a WHERE a.session_id = s.id), '[]'::jsonb))
  FROM food_match_sessions s WHERE s.share_code = p_code AND s.created_at > now() - interval '7 days';
$$;

REVOKE ALL ON FUNCTION public.food_match_create(uuid,text), public.food_match_submit(text,text,text,text[],text[]), public.food_match_get(text) FROM public;
GRANT EXECUTE ON FUNCTION public.food_match_create(uuid,text), public.food_match_submit(text,text,text,text[],text[]), public.food_match_get(text) TO anon, authenticated;