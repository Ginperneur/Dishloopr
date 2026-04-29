ALTER TABLE public.discovery_results 
ADD COLUMN IF NOT EXISTS venue_category text NOT NULL DEFAULT 'restaurant';

CREATE INDEX IF NOT EXISTS idx_discovery_results_venue_category 
ON public.discovery_results(venue_category);