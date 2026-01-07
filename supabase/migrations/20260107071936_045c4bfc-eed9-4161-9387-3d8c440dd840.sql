
-- Fix overly permissive INSERT policy on demand_routing_events
-- Currently allows anyone (including unauthenticated users) to insert
-- Should require authentication

DROP POLICY IF EXISTS "Anyone can insert routing events" ON public.demand_routing_events;

CREATE POLICY "Authenticated users can insert routing events"
ON public.demand_routing_events FOR INSERT
TO authenticated
WITH CHECK (true);
