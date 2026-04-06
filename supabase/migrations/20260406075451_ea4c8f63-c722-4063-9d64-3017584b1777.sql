
CREATE TABLE public.reservation_intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  clicked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  follow_up_sent_at TIMESTAMPTZ,
  review_submitted BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX idx_reservation_intents_user ON public.reservation_intents(user_id);
CREATE INDEX idx_reservation_intents_follow_up ON public.reservation_intents(clicked_at, follow_up_sent_at) WHERE follow_up_sent_at IS NULL AND review_submitted = false;

ALTER TABLE public.reservation_intents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own intents"
ON public.reservation_intents
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can view own intents"
ON public.reservation_intents
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Admins can manage all intents"
ON public.reservation_intents
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
