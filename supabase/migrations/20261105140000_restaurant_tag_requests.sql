-- Lets a restaurant owner request a cuisine/ambience/concept tag that isn't
-- in the system yet, for admin review/approval — rather than owners having
-- no way to flag a gap themselves (e.g. "we're a steakhouse" / "we have a
-- terrace bar vibe") besides emailing support.

CREATE TABLE public.restaurant_tag_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tag_type TEXT NOT NULL CHECK (tag_type IN ('cuisine', 'ambience', 'concept')),
  tag_value TEXT NOT NULL,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_notes TEXT,
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.restaurant_tag_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners view own tag requests"
  ON public.restaurant_tag_requests FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.restaurants r
      WHERE r.id = restaurant_id AND r.claimed_by_owner_id = auth.uid()
    )
  );

CREATE POLICY "Owners create own tag requests"
  ON public.restaurant_tag_requests FOR INSERT
  WITH CHECK (
    requested_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.restaurants r
      WHERE r.id = restaurant_id AND r.claimed_by_owner_id = auth.uid()
    )
  );

CREATE POLICY "Admins manage all tag requests"
  ON public.restaurant_tag_requests FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_restaurant_tag_requests_restaurant ON public.restaurant_tag_requests(restaurant_id);
CREATE INDEX idx_restaurant_tag_requests_status ON public.restaurant_tag_requests(status);
