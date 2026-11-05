-- ===========================================
-- NEWSLETTER: optional city scope
-- ===========================================
-- Lets a subscriber opt into alerts for one city instead of all of NL.
-- NULL city_id (the default) keeps the existing "whole of NL" behavior.

ALTER TABLE public.newsletter_subscribers
  ADD COLUMN IF NOT EXISTS city_id UUID REFERENCES public.cities(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_newsletter_subscribers_city ON public.newsletter_subscribers(city_id);
