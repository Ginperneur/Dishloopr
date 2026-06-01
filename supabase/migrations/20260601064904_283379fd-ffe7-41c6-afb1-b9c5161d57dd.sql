
REVOKE EXECUTE ON FUNCTION public.is_owner_pro(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.sync_owner_pro_restaurants(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_owner_pro(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sync_owner_pro_restaurants(uuid) TO service_role;
