-- Stricter RLS policies for profiles table
-- Only admins and users themselves can see email addresses

-- Step 1: Drop the overly permissive SELECT policy
DROP POLICY IF EXISTS "Anyone can view public profile info" ON public.profiles;

-- Step 2: Create policy for admins to see all profiles (including email)
CREATE POLICY "Admins can view all profiles" 
ON public.profiles 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Step 3: Create policy for users to see their own profile (including email)
CREATE POLICY "Users can view own profile" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = id);

-- Step 4: Create policy for authenticated users to see other profiles WITHOUT email
-- This uses the public_profiles view approach - users query the view for other profiles
-- But we need a basic policy to allow the view to work with SECURITY INVOKER

-- For the public_profiles view to work, we need a SELECT policy
-- The view already excludes email, so we can allow SELECT on profiles for the view to read
-- But this creates a loophole - direct queries would expose email

-- Better approach: Keep profiles restricted, grant direct access to public_profiles view
-- The view already has SECURITY INVOKER and grants for anon/authenticated

-- Add a comment explaining the security model
COMMENT ON TABLE public.profiles IS 'User profiles with sensitive data (email). Direct access restricted to admins and profile owners. Use public_profiles view for public profile info.';

-- Ensure the public_profiles view is accessible
GRANT SELECT ON public.public_profiles TO anon, authenticated;