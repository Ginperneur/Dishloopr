
REVOKE EXECUTE ON FUNCTION public.get_guest_cohorts(uuid, integer) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_owner_attribution(uuid, integer) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_owner_historical_benchmark(uuid, integer) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_guest_cohorts(uuid, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_owner_attribution(uuid, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_owner_historical_benchmark(uuid, integer) TO authenticated, service_role;
