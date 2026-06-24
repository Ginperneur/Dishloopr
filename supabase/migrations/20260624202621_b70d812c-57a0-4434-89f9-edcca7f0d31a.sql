CREATE TABLE IF NOT EXISTS public.restaurants_import_stage_20260624 (
  id uuid PRIMARY KEY,
  name text,
  city_name text,
  review_status text,
  review_reason text,
  is_active boolean,
  needs_manual_review boolean,
  cuisine_primary text,
  ambience_clean text,
  meal_types_clean text,
  concept_clean text,
  price_level integer,
  google_status text,
  google_primary_type text,
  google_dine_in boolean,
  google_rating numeric,
  google_review_count integer,
  verified_at date
);
GRANT ALL ON public.restaurants_import_stage_20260624 TO service_role;
ALTER TABLE public.restaurants_import_stage_20260624 ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin only" ON public.restaurants_import_stage_20260624 FOR ALL USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));