
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS photos_fetched_at TIMESTAMPTZ NULL;

CREATE INDEX IF NOT EXISTS idx_restaurants_photos_fetched_at
  ON public.restaurants(photos_fetched_at);

CREATE TABLE IF NOT EXISTS public.restaurant_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT,
  city TEXT,
  website TEXT,
  phone TEXT,
  cuisine TEXT,
  notes TEXT,
  suggested_by UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  suggester_email TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  admin_notes TEXT,
  reviewed_by UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT restaurant_suggestions_status_check CHECK (status IN ('pending','approved','rejected'))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.restaurant_suggestions TO authenticated;
GRANT INSERT ON public.restaurant_suggestions TO anon;
GRANT ALL ON public.restaurant_suggestions TO service_role;

ALTER TABLE public.restaurant_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit suggestions"
  ON public.restaurant_suggestions FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Admins manage suggestions"
  ON public.restaurant_suggestions FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update suggestions"
  ON public.restaurant_suggestions FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete suggestions"
  ON public.restaurant_suggestions FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_restaurant_suggestions_updated_at
  BEFORE UPDATE ON public.restaurant_suggestions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_restaurant_suggestions_status
  ON public.restaurant_suggestions(status, created_at DESC);
