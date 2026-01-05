-- Fix SECURITY DEFINER view issue by recreating with SECURITY INVOKER
DROP VIEW IF EXISTS public.public_profiles;

-- Create a view that exposes only non-sensitive profile data with SECURITY INVOKER
CREATE VIEW public.public_profiles 
WITH (security_invoker = true)
AS
SELECT 
  id,
  name,
  avatar_url,
  bio,
  reviewer_level,
  total_reviews,
  helpful_votes,
  created_at
FROM public.profiles;

-- Grant access to the view
GRANT SELECT ON public.public_profiles TO anon, authenticated;

-- Add a comment explaining the security rationale
COMMENT ON VIEW public.public_profiles IS 'Public view of profiles excluding sensitive data like email. Use this for displaying reviewer info. Uses SECURITY INVOKER to enforce RLS of the querying user.';