CREATE OR REPLACE FUNCTION public.search_dishes_by_term(search_term text)
RETURNS SETOF public.dishes
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT d.*
  FROM public.dishes d
  WHERE d.is_active = true
    AND (
      d.name ILIKE '%' || search_term || '%'
      OR d.name_en ILIKE '%' || search_term || '%'
      OR EXISTS (
        SELECT 1
        FROM unnest(d.synonyms) AS syn
        WHERE syn ILIKE '%' || search_term || '%'
      )
    )
  LIMIT 300;
END;
$$;