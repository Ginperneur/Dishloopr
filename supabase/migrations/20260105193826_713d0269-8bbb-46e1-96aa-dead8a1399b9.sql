-- Fix security issues identified in scan

-- 1. PROFILES: Add explicit authentication requirement to existing policies
-- Drop and recreate with explicit auth check

DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;

-- Recreate with explicit authentication check
CREATE POLICY "Admins can view all profiles" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() IS NOT NULL AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view own profile" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() IS NOT NULL AND auth.uid() = id);

-- 2. ANALYTICS EVENTS: Require authentication for inserts (prevent data poisoning)
DROP POLICY IF EXISTS "Anyone can insert events" ON public.analytics_events;

CREATE POLICY "Authenticated users can insert events" 
ON public.analytics_events 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

-- 3. DEMAND ROUTING EVENTS: Remove overly permissive update policy
-- Updates should only happen via service role (edge functions)
DROP POLICY IF EXISTS "System can update routing events" ON public.demand_routing_events;

-- Only admins can update routing events directly, service role bypasses RLS
CREATE POLICY "Admins can update routing events" 
ON public.demand_routing_events 
FOR UPDATE 
USING (has_role(auth.uid(), 'admin'::app_role));

-- 4. NOTIFICATION QUEUE: Remove overly permissive policy
-- This table should only be managed by service role (edge functions/triggers)
DROP POLICY IF EXISTS "Service role can manage notifications" ON public.notification_queue;

-- Only admins can view/manage notifications directly
CREATE POLICY "Admins can manage notifications" 
ON public.notification_queue 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add comment explaining the security model
COMMENT ON TABLE public.notification_queue IS 'Notification queue managed by database triggers and edge functions using service role. Direct access restricted to admins.';
COMMENT ON TABLE public.demand_routing_events IS 'Routing events updated by edge functions using service role. Direct updates restricted to admins.';