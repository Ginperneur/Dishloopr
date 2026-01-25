-- Fix security warnings: Replace permissive INSERT policy with proper check

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "System can insert pricing history" ON public.featured_pricing_history;

-- Create proper policy that only allows admins to insert
CREATE POLICY "Admins can insert pricing history"
  ON public.featured_pricing_history FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'));