ALTER TABLE public.collections ADD COLUMN IF NOT EXISTS listed_count integer;

CREATE OR REPLACE FUNCTION public.refresh_collection_entries()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_col record; v_total integer := 0; v_n integer;
BEGIN
  FOR v_col IN
    SELECT id FROM public.collections
     WHERE is_active AND (match_dishes IS NOT NULL OR match_dish_names IS NOT NULL
                          OR match_dietary IS NOT NULL OR match_concepts IS NOT NULL)
  LOOP
    DELETE FROM public.collection_entries WHERE collection_id = v_col.id;
    INSERT INTO public.collection_entries (collection_id, restaurant_id, city_id, dish_name, dish_price, score,
                                           eligible, review_count, review_avg)
    SELECT v_col.id, x.restaurant_id, x.city_id, x.dish_name, x.dish_price, x.score, x.eligible, x.review_count, x.review_avg
      FROM public.collection_candidates(v_col.id) x;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_total := v_total + v_n;
    UPDATE public.collections c SET auto_cover = (
      SELECT r.images[1] FROM public.collection_entries e JOIN public.restaurants r ON r.id = e.restaurant_id
       WHERE e.collection_id = v_col.id AND e.eligible AND coalesce(array_length(r.images, 1), 0) > 0
       ORDER BY e.score DESC, e.restaurant_id LIMIT 1)
     WHERE c.id = v_col.id;
    UPDATE public.collections c
       SET listed_count = (SELECT count(*)::int FROM public.collection_entries e WHERE e.collection_id = v_col.id AND e.eligible)
     WHERE c.id = v_col.id;
  END LOOP;
  RETURN v_total;
END $$;
REVOKE ALL ON FUNCTION public.refresh_collection_entries() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_collection_entries() TO service_role;

UPDATE public.collections SET title_i18n = '{}'::jsonb, subtitle_i18n = '{}'::jsonb, description_i18n = '{}'::jsonb
 WHERE slug = 'beste-ramen' AND (title_i18n ->> 'nl') IS DISTINCT FROM NULL;

UPDATE public.collections SET is_active = false, updated_at = now() WHERE slug = 'romantisch-italiaans-rotterdam';

SET LOCAL statement_timeout = '20min';
SELECT public.refresh_collection_entries();