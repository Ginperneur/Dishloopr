ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS owner_pro_override boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.restaurants.owner_pro_override IS 'Admin-granted complimentary restaurant Pro access; independent of Stripe subscriptions.';

CREATE OR REPLACE FUNCTION public.protect_restaurant_owner_tier()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF coalesce(auth.jwt()->>'role', '') IN ('authenticated','anon')
     AND NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    NEW.owner_pro_override := OLD.owner_pro_override;
    NEW.owner_tier := OLD.owner_tier;
  END IF;
  IF NEW.owner_pro_override THEN
    NEW.owner_tier := 'pro';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_owner_pro_restaurants(_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_is_pro boolean;
BEGIN
  v_is_pro := public.is_owner_pro(_user_id);
  UPDATE public.restaurants r
  SET owner_tier = CASE WHEN r.owner_pro_override OR v_is_pro THEN 'pro' ELSE 'basic' END
  WHERE r.id IN (
    SELECT rm.restaurant_id FROM public.restaurant_managers rm
    WHERE rm.user_id = _user_id AND rm.accepted_at IS NOT NULL
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_restaurant_owner_pro(p_restaurant_id uuid, p_enabled boolean)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_tier text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;
  IF p_enabled IS NULL THEN
    RAISE EXCEPTION 'Enabled is required' USING ERRCODE = '22023';
  END IF;
  UPDATE public.restaurants r
  SET owner_pro_override = p_enabled,
      owner_tier = CASE WHEN p_enabled OR EXISTS (
        SELECT 1 FROM public.restaurant_managers rm
        WHERE rm.restaurant_id = r.id AND rm.accepted_at IS NOT NULL
          AND public.is_owner_pro(rm.user_id)
      ) OR public.is_owner_pro(r.claimed_by_owner_id) THEN 'pro' ELSE 'basic' END
  WHERE r.id = p_restaurant_id
  RETURNING r.owner_tier INTO v_tier;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Restaurant not found' USING ERRCODE = 'P0002';
  END IF;
  RETURN v_tier;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_set_restaurant_owner_pro(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_restaurant_owner_pro(uuid, boolean) TO authenticated;
