
-- Table to track €1 verification credits
CREATE TABLE public.verification_credits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id),
  claim_id UUID NOT NULL REFERENCES public.restaurant_claims(id),
  amount NUMERIC NOT NULL DEFAULT 1.00,
  stripe_payment_intent TEXT,
  is_redeemed BOOLEAN NOT NULL DEFAULT false,
  redeemed_at TIMESTAMPTZ,
  redeemed_on_checkout TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.verification_credits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own credits"
  ON public.verification_credits FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage credits"
  ON public.verification_credits FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE INDEX idx_verification_credits_user ON public.verification_credits(user_id, is_redeemed);
