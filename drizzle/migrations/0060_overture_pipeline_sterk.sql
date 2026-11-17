-- "Sterk, extra controle" gets its own switch next to the pipeline switch (user, 17-11-2026):
-- the tick only creates sterk restaurants while include_sterk is on. Idempotent.
ALTER TABLE public.overture_pipeline ADD COLUMN IF NOT EXISTS include_sterk boolean NOT NULL DEFAULT false;
