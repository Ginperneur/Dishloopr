
CREATE OR REPLACE FUNCTION public.set_signature_dish(_restaurant_id uuid, _rd_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_allowed boolean := false;
  v_valid boolean := false;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Admin bypass
  IF public.has_role(v_uid, 'admin'::app_role) THEN
    v_allowed := true;
  END IF;

  -- Claim owner via restaurants.claimed_by_owner_id
  IF NOT v_allowed AND EXISTS (
    SELECT 1 FROM public.restaurants r
    WHERE r.id = _restaurant_id
      AND r.claimed_by_owner_id = v_uid
  ) THEN
    v_allowed := true;
  END IF;

  -- Accepted manager with editor+ role
  IF NOT v_allowed AND EXISTS (
    SELECT 1 FROM public.restaurant_managers rm
    WHERE rm.restaurant_id = _restaurant_id
      AND rm.user_id = v_uid
      AND rm.accepted_at IS NOT NULL
      AND rm.role IN ('editor'::manager_role, 'primary_owner'::manager_role)
  ) THEN
    v_allowed := true;
  END IF;

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'Not authorized to set signature dish for this restaurant';
  END IF;

  -- Verify the target restaurant_dish exists for this restaurant AND is approved
  SELECT EXISTS (
    SELECT 1 FROM public.restaurant_dishes
    WHERE id = _rd_id
      AND restaurant_id = _restaurant_id
      AND status = 'approved_by_admin'
  ) INTO v_valid;

  IF NOT v_valid THEN
    RAISE EXCEPTION 'Target dish is not an approved dish for this restaurant';
  END IF;

  -- Atomic: clear existing + set new in a single statement so only one signature remains
  UPDATE public.restaurant_dishes
  SET is_signature = (id = _rd_id),
      updated_at   = now()
  WHERE restaurant_id = _restaurant_id
    AND (is_signature = true OR id = _rd_id);
END;
$function$;

REVOKE ALL ON FUNCTION public.set_signature_dish(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_signature_dish(uuid, uuid) TO authenticated;

-- Companion: clear all signature flags for a restaurant (owner/admin)
CREATE OR REPLACE FUNCTION public.clear_signature_dish(_restaurant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_allowed boolean := false;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF public.has_role(v_uid, 'admin'::app_role)
     OR EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = _restaurant_id AND r.claimed_by_owner_id = v_uid)
     OR EXISTS (SELECT 1 FROM public.restaurant_managers rm
                WHERE rm.restaurant_id = _restaurant_id AND rm.user_id = v_uid
                  AND rm.accepted_at IS NOT NULL
                  AND rm.role IN ('editor'::manager_role, 'primary_owner'::manager_role))
  THEN
    v_allowed := true;
  END IF;

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE public.restaurant_dishes
  SET is_signature = false, updated_at = now()
  WHERE restaurant_id = _restaurant_id AND is_signature = true;
END;
$function$;

REVOKE ALL ON FUNCTION public.clear_signature_dish(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.clear_signature_dish(uuid) TO authenticated;
