ALTER TABLE public.discovery_results
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'google',
  ADD COLUMN IF NOT EXISTS external_id text,
  ADD COLUMN IF NOT EXISTS postcode text,
  ADD COLUMN IF NOT EXISTS website text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS confidence real,
  ADD COLUMN IF NOT EXISTS triage text,
  ADD COLUMN IF NOT EXISTS triage_reason text,
  ADD COLUMN IF NOT EXISTS licenses text[];

ALTER TABLE public.discovery_results ALTER COLUMN place_id DROP NOT NULL;

ALTER TABLE public.discovery_results DROP CONSTRAINT IF EXISTS discovery_results_source_check;
ALTER TABLE public.discovery_results
  ADD CONSTRAINT discovery_results_source_check CHECK (source IN ('google', 'overture'));

ALTER TABLE public.discovery_results DROP CONSTRAINT IF EXISTS discovery_results_triage_check;
ALTER TABLE public.discovery_results
  ADD CONSTRAINT discovery_results_triage_check CHECK (triage IS NULL OR triage IN ('verified', 'approve', 'review'));

ALTER TABLE public.discovery_results DROP CONSTRAINT IF EXISTS discovery_results_external_id_check;
ALTER TABLE public.discovery_results
  ADD CONSTRAINT discovery_results_external_id_check CHECK (source = 'google' OR external_id IS NOT NULL);

CREATE UNIQUE INDEX IF NOT EXISTS discovery_results_source_external_id_key
  ON public.discovery_results (source, external_id);

CREATE INDEX IF NOT EXISTS idx_discovery_results_triage
  ON public.discovery_results (triage) WHERE status = 'pending';

ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS overture_id text;
CREATE UNIQUE INDEX IF NOT EXISTS restaurants_overture_id_key
  ON public.restaurants (overture_id) WHERE overture_id IS NOT NULL;