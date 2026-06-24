
-- 1. Backup snapshot (skip if already exists)
CREATE TABLE IF NOT EXISTS public.restaurants_backup_20260624 AS
  TABLE public.restaurants;

-- 2. Additive columns (safe to rerun)
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS review_status        text,
  ADD COLUMN IF NOT EXISTS needs_manual_review  boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS cuisine_primary      text,
  ADD COLUMN IF NOT EXISTS ambience_clean       text,
  ADD COLUMN IF NOT EXISTS meal_types_clean     text,
  ADD COLUMN IF NOT EXISTS concept_clean        text,
  ADD COLUMN IF NOT EXISTS google_status        text,
  ADD COLUMN IF NOT EXISTS google_primary_type  text,
  ADD COLUMN IF NOT EXISTS google_dine_in       boolean,
  ADD COLUMN IF NOT EXISTS google_rating        numeric,
  ADD COLUMN IF NOT EXISTS google_review_count  integer,
  ADD COLUMN IF NOT EXISTS verified_at          date;
