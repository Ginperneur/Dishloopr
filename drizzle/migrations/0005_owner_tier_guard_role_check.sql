CREATE OR REPLACE FUNCTION public.protect_restaurant_owner_tier()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.owner_tier IS DISTINCT FROM OLD.owner_tier
     AND coalesce(auth.jwt()->>'role', '') IN ('authenticated','anon')
     AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    NEW.owner_tier := OLD.owner_tier;
  END IF;
  RETURN NEW;
END;
$$;