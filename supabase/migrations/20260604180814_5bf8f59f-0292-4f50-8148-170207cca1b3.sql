
-- 1) Server-only secret table for verification codes
CREATE TABLE IF NOT EXISTS public.claim_verification_secrets (
  claim_id UUID PRIMARY KEY REFERENCES public.restaurant_claims(id) ON DELETE CASCADE,
  method TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  email TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT ALL ON public.claim_verification_secrets TO service_role;
-- No grants to authenticated/anon: only edge functions (service role) may touch this.

ALTER TABLE public.claim_verification_secrets ENABLE ROW LEVEL SECURITY;
-- Deliberately no policies => deny all for non-service-role.

-- 2) Tighten user-update policy: forbid self-promotion to verified/superseded
DROP POLICY IF EXISTS "Users can update own pending claims" ON public.restaurant_claims;

CREATE POLICY "Users can update own pending claims"
ON public.restaurant_claims
FOR UPDATE
USING (
  user_id = auth.uid()
  AND status = ANY (ARRAY['pending'::text, 'email_verified'::text, 'phone_verified'::text])
)
WITH CHECK (
  user_id = auth.uid()
  AND status = ANY (ARRAY['pending'::text, 'email_verified'::text, 'phone_verified'::text])
);
