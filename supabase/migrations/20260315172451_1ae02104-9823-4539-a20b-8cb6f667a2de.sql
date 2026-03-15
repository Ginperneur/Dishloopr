
-- Function to find and remove duplicate dishes (same name, case-insensitive)
-- Keeps the oldest dish (first created), merges restaurant_dishes references
CREATE OR REPLACE FUNCTION public.deduplicate_dishes()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  duplicate_group RECORD;
  keep_id uuid;
  remove_ids uuid[];
  total_merged integer := 0;
  total_removed integer := 0;
  duplicate_names text[] := '{}';
BEGIN
  -- Find duplicate dish names (case-insensitive)
  FOR duplicate_group IN
    SELECT lower(name) as lname, array_agg(id ORDER BY created_at ASC) as ids, count(*) as cnt
    FROM dishes
    GROUP BY lower(name)
    HAVING count(*) > 1
  LOOP
    keep_id := duplicate_group.ids[1];
    remove_ids := duplicate_group.ids[2:];
    duplicate_names := duplicate_names || duplicate_group.lname;
    
    -- Update restaurant_dishes to point to the kept dish
    UPDATE restaurant_dishes
    SET dish_id = keep_id
    WHERE dish_id = ANY(remove_ids)
    AND NOT EXISTS (
      -- Skip if this would create a duplicate restaurant+dish combo
      SELECT 1 FROM restaurant_dishes rd2
      WHERE rd2.restaurant_id = restaurant_dishes.restaurant_id
      AND rd2.dish_id = keep_id
    );
    
    GET DIAGNOSTICS total_merged = ROW_COUNT;
    
    -- Delete restaurant_dishes that would be duplicates
    DELETE FROM restaurant_dishes
    WHERE dish_id = ANY(remove_ids);
    
    -- Delete the duplicate dishes
    DELETE FROM dishes WHERE id = ANY(remove_ids);
    GET DIAGNOSTICS total_removed = ROW_COUNT;
  END LOOP;
  
  RETURN jsonb_build_object(
    'duplicates_found', array_length(duplicate_names, 1),
    'dishes_removed', total_removed,
    'duplicate_names', to_jsonb(duplicate_names)
  );
END;
$$;

-- Function to remove duplicate restaurant_dishes (same restaurant_id + dish_id)
-- Keeps the one with highest confidence or oldest
CREATE OR REPLACE FUNCTION public.deduplicate_restaurant_dishes()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  removed_count integer;
BEGIN
  -- Delete duplicates keeping the one with highest confidence_score, or oldest if tied
  WITH ranked AS (
    SELECT id,
      ROW_NUMBER() OVER (
        PARTITION BY restaurant_id, dish_id
        ORDER BY confidence_score DESC, created_at ASC
      ) as rn
    FROM restaurant_dishes
  )
  DELETE FROM restaurant_dishes
  WHERE id IN (SELECT id FROM ranked WHERE rn > 1);
  
  GET DIAGNOSTICS removed_count = ROW_COUNT;
  
  RETURN jsonb_build_object(
    'duplicates_removed', removed_count
  );
END;
$$;
