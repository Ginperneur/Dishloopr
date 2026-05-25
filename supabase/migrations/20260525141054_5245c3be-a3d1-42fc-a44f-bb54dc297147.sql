REVOKE EXECUTE ON FUNCTION public.create_biweekly_newsletter_draft() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_biweekly_newsletter_draft() TO service_role;