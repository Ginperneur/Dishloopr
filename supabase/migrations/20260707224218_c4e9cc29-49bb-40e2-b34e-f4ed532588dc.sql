CREATE TABLE IF NOT EXISTS public._import_richtags_stg (id uuid PRIMARY KEY, ambiance text, meal text);
ALTER TABLE public._import_richtags_stg ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public._import_richtags_stg TO service_role;