-- Required for fuzzy name matching
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Seed default discovery duplicate rules
INSERT INTO public.app_settings (key, value, description)
VALUES (
  'discovery_duplicate_rules',
  '{"match_by_place_id":true,"match_by_name":true,"name_min_similarity":0.85,"same_city_required":true,"radius_meters":150}',
  'Regels voor het automatisch markeren van discovery_results als duplicate'
)
ON CONFLICT (key) DO NOTHING;

-- Ensure key uniqueness (safe if already exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'app_settings_key_unique_idx'
  ) THEN
    CREATE UNIQUE INDEX app_settings_key_unique_idx ON public.app_settings(key);
  END IF;
END $$;

-- ============================================================
-- cleanup_discovery_duplicates: deletes all status='duplicate'
-- ============================================================
CREATE OR REPLACE FUNCTION public.cleanup_discovery_duplicates(p_rules jsonb DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_started timestamptz := clock_timestamp();
  v_deleted integer := 0;
  v_took_ms integer;
BEGIN
  IF v_user IS NULL OR NOT has_role(v_user, 'admin'::app_role) THEN
    RAISE EXCEPTION 'Admin role required';
  END IF;

  DELETE FROM public.discovery_results WHERE status = 'duplicate';
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  v_took_ms := EXTRACT(MILLISECONDS FROM (clock_timestamp() - v_started))::int;

  INSERT INTO public.admin_activity_logs (user_id, action_type, entity_type, details)
  VALUES (
    v_user,
    'discovery_cleanup_duplicates',
    'discovery_results',
    jsonb_build_object(
      'deleted_count', v_deleted,
      'took_ms', v_took_ms,
      'rules', COALESCE(p_rules, '{}'::jsonb)
    )
  );

  RETURN jsonb_build_object('deleted_count', v_deleted, 'took_ms', v_took_ms);
END;
$$;

-- ============================================================
-- rescan_discovery_duplicates: re-evaluate pending rows
-- ============================================================
CREATE OR REPLACE FUNCTION public.rescan_discovery_duplicates(p_rules jsonb DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_started timestamptz := clock_timestamp();
  v_rules jsonb;
  v_match_place bool;
  v_match_name bool;
  v_min_sim numeric;
  v_same_city bool;
  v_radius integer;
  v_checked integer := 0;
  v_marked integer := 0;
  v_took_ms integer;
  r RECORD;
  v_match_id uuid;
BEGIN
  IF v_user IS NULL OR NOT has_role(v_user, 'admin'::app_role) THEN
    RAISE EXCEPTION 'Admin role required';
  END IF;

  -- Load rules: argument > app_settings > defaults
  IF p_rules IS NOT NULL THEN
    v_rules := p_rules;
  ELSE
    SELECT value::jsonb INTO v_rules
      FROM public.app_settings
      WHERE key = 'discovery_duplicate_rules'
      LIMIT 1;
  END IF;
  v_rules := COALESCE(v_rules, '{}'::jsonb);

  v_match_place := COALESCE((v_rules->>'match_by_place_id')::bool, true);
  v_match_name  := COALESCE((v_rules->>'match_by_name')::bool, true);
  v_min_sim     := COALESCE((v_rules->>'name_min_similarity')::numeric, 0.85);
  v_same_city   := COALESCE((v_rules->>'same_city_required')::bool, true);
  v_radius      := COALESCE((v_rules->>'radius_meters')::int, 150);

  FOR r IN
    SELECT id, place_id, name, city_id, lat, lng
    FROM public.discovery_results
    WHERE status = 'pending'
  LOOP
    v_checked := v_checked + 1;
    v_match_id := NULL;

    -- 1. place_id exact match
    IF v_match_place THEN
      SELECT id INTO v_match_id
        FROM public.restaurants
        WHERE google_place_id = r.place_id
        LIMIT 1;
    END IF;

    -- 2. fuzzy name match (optionally same city + within radius)
    IF v_match_id IS NULL AND v_match_name THEN
      SELECT res.id INTO v_match_id
      FROM public.restaurants res
      WHERE (NOT v_same_city OR res.city_id = r.city_id)
        AND similarity(lower(res.name), lower(r.name)) >= v_min_sim
        AND (
          r.lat IS NULL OR r.lng IS NULL
          OR res.geo_lat IS NULL OR res.geo_lng IS NULL
          OR (
            -- Haversine in meters
            2 * 6371000 * asin(sqrt(
              power(sin(radians((res.geo_lat - r.lat) / 2)), 2)
              + cos(radians(r.lat)) * cos(radians(res.geo_lat))
              * power(sin(radians((res.geo_lng - r.lng) / 2)), 2)
            )) <= v_radius
          )
        )
      ORDER BY similarity(lower(res.name), lower(r.name)) DESC
      LIMIT 1;
    END IF;

    IF v_match_id IS NOT NULL THEN
      UPDATE public.discovery_results
      SET status = 'duplicate',
          matched_restaurant_id = v_match_id,
          reviewed_at = now()
      WHERE id = r.id;
      v_marked := v_marked + 1;
    END IF;
  END LOOP;

  v_took_ms := EXTRACT(MILLISECONDS FROM (clock_timestamp() - v_started))::int;

  INSERT INTO public.admin_activity_logs (user_id, action_type, entity_type, details)
  VALUES (
    v_user,
    'discovery_rescan_duplicates',
    'discovery_results',
    jsonb_build_object(
      'checked', v_checked,
      'marked', v_marked,
      'took_ms', v_took_ms,
      'rules', v_rules
    )
  );

  RETURN jsonb_build_object('checked', v_checked, 'marked', v_marked, 'took_ms', v_took_ms);
END;
$$;