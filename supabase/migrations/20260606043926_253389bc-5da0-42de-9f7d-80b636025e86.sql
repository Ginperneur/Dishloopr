CREATE OR REPLACE FUNCTION public.admin_apply_restaurant_categorization(_data jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _count integer;
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NOT NULL AND NOT public.has_role(_uid, 'admin') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  WITH src AS (
    SELECT
      (e->>'id')::uuid AS id,
      CASE WHEN e ? 'cuisines'      THEN ARRAY(SELECT jsonb_array_elements_text(e->'cuisines'))      END AS cuisines,
      CASE WHEN e ? 'ambience_tags' THEN ARRAY(SELECT jsonb_array_elements_text(e->'ambience_tags')) END AS ambience_tags,
      CASE WHEN e ? 'concepts'      THEN ARRAY(SELECT jsonb_array_elements_text(e->'concepts'))      END AS concepts,
      CASE WHEN e ? 'experiences'   THEN ARRAY(SELECT jsonb_array_elements_text(e->'experiences'))   END AS experiences,
      CASE WHEN e ? 'meal_types'    THEN ARRAY(SELECT jsonb_array_elements_text(e->'meal_types'))    END AS meal_types
    FROM jsonb_array_elements(_data) AS e
  ), upd AS (
    UPDATE public.restaurants r SET
      cuisines      = COALESCE(s.cuisines, r.cuisines),
      ambience_tags = COALESCE(s.ambience_tags, r.ambience_tags),
      concepts      = COALESCE(s.concepts, r.concepts),
      experiences   = COALESCE(s.experiences, r.experiences),
      meal_types    = COALESCE(s.meal_types, r.meal_types),
      updated_at    = now()
    FROM src s
    WHERE r.id = s.id
    RETURNING 1
  )
  SELECT count(*) INTO _count FROM upd;
  RETURN _count;
END;
$$;