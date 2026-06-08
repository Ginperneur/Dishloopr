ALTER TABLE public.collections
  ADD COLUMN IF NOT EXISTS title_i18n jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS subtitle_i18n jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS description_i18n jsonb NOT NULL DEFAULT '{}'::jsonb;

UPDATE public.collections
SET title_i18n = COALESCE(title_i18n, '{}'::jsonb) || jsonb_build_object('nl', title)
WHERE title IS NOT NULL AND NOT (title_i18n ? 'nl');

UPDATE public.collections
SET subtitle_i18n = COALESCE(subtitle_i18n, '{}'::jsonb) || jsonb_build_object('nl', subtitle)
WHERE subtitle IS NOT NULL AND NOT (subtitle_i18n ? 'nl');

UPDATE public.collections
SET description_i18n = COALESCE(description_i18n, '{}'::jsonb) || jsonb_build_object('nl', description)
WHERE description IS NOT NULL AND NOT (description_i18n ? 'nl');