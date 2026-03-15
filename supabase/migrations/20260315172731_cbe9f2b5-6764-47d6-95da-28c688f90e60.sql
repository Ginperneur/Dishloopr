
-- Fix: deduplicate_dishes should NOT merge dishes by name globally
-- Dishes like "Steak" should exist once in the dishes table (it's a taxonomy)
-- Only remove exact duplicates in restaurant_dishes (same restaurant + same dish)
-- Drop the overly aggressive function
DROP FUNCTION IF EXISTS public.deduplicate_dishes();

-- Replace with a function that only removes duplicate entries in the dishes table
-- where the EXACT same name appears multiple times (true duplicates in taxonomy)
-- but preserves all restaurant_dishes links by remapping them
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
  total_removed integer := 0;
  group_removed integer;
  duplicate_names text[] := '{}';
BEGIN
  -- Find duplicate dish names (case-insensitive, same slug)
  FOR duplicate_group IN
    SELECT lower(trim(name)) as lname, 
           array_agg(id ORDER BY created_at ASC) as ids, 
           count(*) as cnt
    FROM dishes
    GROUP BY lower(trim(name))
    HAVING count(*) > 1
  LOOP
    keep_id := duplicate_group.ids[1];
    remove_ids := duplicate_group.ids[2:];
    duplicate_names := duplicate_names || duplicate_group.lname;
    
    -- Remap restaurant_dishes to the kept dish, but only if it won't create a duplicate combo
    UPDATE restaurant_dishes
    SET dish_id = keep_id
    WHERE dish_id = ANY(remove_ids)
    AND NOT EXISTS (
      SELECT 1 FROM restaurant_dishes rd2
      WHERE rd2.restaurant_id = restaurant_dishes.restaurant_id
      AND rd2.dish_id = keep_id
      AND rd2.id != restaurant_dishes.id
    );
    
    -- Delete remaining restaurant_dishes that would be true duplicates
    DELETE FROM restaurant_dishes
    WHERE dish_id = ANY(remove_ids);
    
    -- Delete the duplicate dish entries from taxonomy
    DELETE FROM dishes WHERE id = ANY(remove_ids);
    GET DIAGNOSTICS group_removed = ROW_COUNT;
    total_removed := total_removed + group_removed;
  END LOOP;
  
  RETURN jsonb_build_object(
    'duplicates_found', COALESCE(array_length(duplicate_names, 1), 0),
    'dishes_removed', total_removed,
    'duplicate_names', COALESCE(to_jsonb(duplicate_names), '[]'::jsonb)
  );
END;
$$;
