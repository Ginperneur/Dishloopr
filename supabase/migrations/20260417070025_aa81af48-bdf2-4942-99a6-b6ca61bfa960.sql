-- Add Google Place ID to restaurants for deduplication
ALTER TABLE public.restaurants 
ADD COLUMN IF NOT EXISTS google_place_id text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_restaurants_google_place_id 
ON public.restaurants(google_place_id) 
WHERE google_place_id IS NOT NULL;

-- Discovery grid points (configurable scan locations)
CREATE TABLE public.discovery_grid_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id uuid NOT NULL REFERENCES public.cities(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL DEFAULT 'grid' CHECK (type IN ('grid', 'hotspot')),
  lat numeric NOT NULL,
  lng numeric NOT NULL,
  radius_meters integer NOT NULL DEFAULT 1500,
  search_terms text[] DEFAULT '{}'::text[],
  last_scanned_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_discovery_grid_points_city ON public.discovery_grid_points(city_id);
CREATE INDEX idx_discovery_grid_points_active ON public.discovery_grid_points(is_active) WHERE is_active = true;

-- Discovery results (review queue)
CREATE TABLE public.discovery_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id text NOT NULL UNIQUE,
  name text NOT NULL,
  address text,
  lat numeric,
  lng numeric,
  rating numeric,
  user_ratings_total integer,
  price_level integer,
  types text[] DEFAULT '{}'::text[],
  photo_reference text,
  city_id uuid REFERENCES public.cities(id) ON DELETE SET NULL,
  source_grid_point_id uuid REFERENCES public.discovery_grid_points(id) ON DELETE SET NULL,
  source_search_term text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'duplicate')),
  matched_restaurant_id uuid REFERENCES public.restaurants(id) ON DELETE SET NULL,
  reject_reason text,
  raw_data jsonb DEFAULT '{}'::jsonb,
  discovered_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid
);

CREATE INDEX idx_discovery_results_status ON public.discovery_results(status);
CREATE INDEX idx_discovery_results_city ON public.discovery_results(city_id);
CREATE INDEX idx_discovery_results_grid_point ON public.discovery_results(source_grid_point_id);
CREATE INDEX idx_discovery_results_discovered ON public.discovery_results(discovered_at DESC);

-- Discovery runs (audit log)
CREATE TABLE public.discovery_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grid_point_id uuid REFERENCES public.discovery_grid_points(id) ON DELETE SET NULL,
  city_id uuid REFERENCES public.cities(id) ON DELETE SET NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  results_found integer NOT NULL DEFAULT 0,
  new_results integer NOT NULL DEFAULT 0,
  duplicates integer NOT NULL DEFAULT 0,
  api_calls_used integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
  error_message text,
  triggered_by uuid
);

CREATE INDEX idx_discovery_runs_grid_point ON public.discovery_runs(grid_point_id);
CREATE INDEX idx_discovery_runs_started ON public.discovery_runs(started_at DESC);

-- Enable RLS
ALTER TABLE public.discovery_grid_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discovery_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discovery_runs ENABLE ROW LEVEL SECURITY;

-- RLS: Admin only for all discovery tables
CREATE POLICY "Admins can manage grid points"
ON public.discovery_grid_points FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage discovery results"
ON public.discovery_results FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage discovery runs"
ON public.discovery_runs FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Updated_at triggers
CREATE TRIGGER update_discovery_grid_points_updated_at
BEFORE UPDATE ON public.discovery_grid_points
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Helper function: generate Amsterdam grid (5x8 = 40 points covering the city)
CREATE OR REPLACE FUNCTION public.generate_amsterdam_grid()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_city_id uuid;
  v_count integer := 0;
  v_lat numeric;
  v_lng numeric;
  i integer;
  j integer;
  -- Amsterdam bbox roughly: 52.32 - 52.43 lat, 4.78 - 4.99 lng
  v_lat_start numeric := 52.32;
  v_lat_end numeric := 52.43;
  v_lng_start numeric := 4.78;
  v_lng_end numeric := 4.99;
  v_rows integer := 5;
  v_cols integer := 8;
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only admins can generate grid';
  END IF;

  SELECT id INTO v_city_id FROM cities WHERE slug = 'amsterdam' LIMIT 1;
  IF v_city_id IS NULL THEN
    RAISE EXCEPTION 'Amsterdam city not found';
  END IF;

  FOR i IN 0..v_rows-1 LOOP
    FOR j IN 0..v_cols-1 LOOP
      v_lat := v_lat_start + (v_lat_end - v_lat_start) * i / (v_rows - 1);
      v_lng := v_lng_start + (v_lng_end - v_lng_start) * j / (v_cols - 1);
      
      INSERT INTO discovery_grid_points (city_id, name, type, lat, lng, radius_meters)
      VALUES (
        v_city_id,
        'Amsterdam Grid ' || (i * v_cols + j + 1),
        'grid',
        v_lat,
        v_lng,
        1500
      )
      ON CONFLICT DO NOTHING;
      
      v_count := v_count + 1;
    END LOOP;
  END LOOP;

  RETURN v_count;
END;
$$;