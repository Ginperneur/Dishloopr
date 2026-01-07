
-- Create enum for restaurant claim status
CREATE TYPE public.restaurant_claim_status AS ENUM (
  'unclaimed',
  'claimed_unverified', 
  'verified_owner',
  'disputed',
  'locked'
);

-- Create enum for verification methods
CREATE TYPE public.verification_method AS ENUM (
  'micro_payment',
  'dns_txt',
  'html_file',
  'google_business'
);

-- Create enum for manager roles
CREATE TYPE public.manager_role AS ENUM (
  'viewer',
  'editor',
  'finance',
  'primary_owner'
);

-- Add claim status to restaurants table
ALTER TABLE public.restaurants 
ADD COLUMN claim_status public.restaurant_claim_status NOT NULL DEFAULT 'unclaimed';

-- Create comprehensive claims table (replaces claim_requests for new flow)
CREATE TABLE public.restaurant_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  
  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'email_verified', 'phone_verified', 'verified', 'rejected', 'superseded')),
  is_primary BOOLEAN NOT NULL DEFAULT false,
  
  -- Verification
  email_verified BOOLEAN NOT NULL DEFAULT false,
  email_verified_at TIMESTAMPTZ,
  phone_number TEXT,
  phone_verified BOOLEAN NOT NULL DEFAULT false,
  phone_verified_at TIMESTAMPTZ,
  phone_verification_code TEXT,
  phone_code_expires_at TIMESTAMPTZ,
  
  -- Upgrade verification
  verification_method public.verification_method,
  verification_started_at TIMESTAMPTZ,
  verification_completed_at TIMESTAMPTZ,
  verification_proof JSONB DEFAULT '{}',
  
  -- Admin handling
  admin_notes TEXT,
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  
  -- Rate limiting
  claim_attempt_count INTEGER NOT NULL DEFAULT 1,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create restaurant managers table for multi-user access
CREATE TABLE public.restaurant_managers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role public.manager_role NOT NULL DEFAULT 'viewer',
  invited_by UUID,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(restaurant_id, user_id)
);

-- Create pending edits table for unverified claimants
CREATE TABLE public.restaurant_pending_edits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  submitted_by UUID NOT NULL,
  
  -- Proposed changes stored as JSON diff
  proposed_changes JSONB NOT NULL,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'auto_applied')),
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enhanced activity log with before/after data
CREATE TABLE public.claim_activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Actor info
  actor_id UUID NOT NULL,
  actor_role TEXT NOT NULL CHECK (actor_role IN ('user', 'owner', 'admin', 'system')),
  
  -- Target
  restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE SET NULL,
  claim_id UUID REFERENCES public.restaurant_claims(id) ON DELETE SET NULL,
  
  -- Action details
  action_type TEXT NOT NULL,
  action_category TEXT NOT NULL CHECK (action_category IN ('claim', 'verification', 'access', 'edit', 'payment', 'admin')),
  
  -- Audit trail
  before_data JSONB,
  after_data JSONB,
  metadata JSONB DEFAULT '{}',
  
  -- Context
  ip_address INET,
  user_agent TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User claim limits table for rate limiting
CREATE TABLE public.user_claim_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  active_unverified_claims INTEGER NOT NULL DEFAULT 0,
  total_claims_attempted INTEGER NOT NULL DEFAULT 0,
  last_claim_at TIMESTAMPTZ,
  is_blocked BOOLEAN NOT NULL DEFAULT false,
  blocked_reason TEXT,
  blocked_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX idx_restaurant_claims_restaurant ON public.restaurant_claims(restaurant_id);
CREATE INDEX idx_restaurant_claims_user ON public.restaurant_claims(user_id);
CREATE INDEX idx_restaurant_claims_status ON public.restaurant_claims(status);
CREATE INDEX idx_restaurant_managers_restaurant ON public.restaurant_managers(restaurant_id);
CREATE INDEX idx_restaurant_managers_user ON public.restaurant_managers(user_id);
CREATE INDEX idx_claim_activity_logs_restaurant ON public.claim_activity_logs(restaurant_id);
CREATE INDEX idx_claim_activity_logs_actor ON public.claim_activity_logs(actor_id);
CREATE INDEX idx_claim_activity_logs_created ON public.claim_activity_logs(created_at DESC);
CREATE INDEX idx_restaurants_claim_status ON public.restaurants(claim_status);

-- Enable RLS on all new tables
ALTER TABLE public.restaurant_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_managers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_pending_edits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.claim_activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_claim_limits ENABLE ROW LEVEL SECURITY;

-- RLS Policies for restaurant_claims
CREATE POLICY "Users can view own claims"
ON public.restaurant_claims FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can create claims"
ON public.restaurant_claims FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own pending claims"
ON public.restaurant_claims FOR UPDATE
USING (user_id = auth.uid() AND status IN ('pending', 'email_verified', 'phone_verified'));

CREATE POLICY "Admins can manage all claims"
ON public.restaurant_claims FOR ALL
USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for restaurant_managers
CREATE POLICY "Managers can view their assignments"
ON public.restaurant_managers FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Primary owners can manage managers"
ON public.restaurant_managers FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.restaurant_managers rm
    WHERE rm.restaurant_id = restaurant_managers.restaurant_id
    AND rm.user_id = auth.uid()
    AND rm.role = 'primary_owner'
  )
);

CREATE POLICY "Admins can manage all managers"
ON public.restaurant_managers FOR ALL
USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for restaurant_pending_edits
CREATE POLICY "Users can view own pending edits"
ON public.restaurant_pending_edits FOR SELECT
USING (submitted_by = auth.uid());

CREATE POLICY "Users can create pending edits"
ON public.restaurant_pending_edits FOR INSERT
WITH CHECK (submitted_by = auth.uid());

CREATE POLICY "Verified owners can view pending edits for their restaurant"
ON public.restaurant_pending_edits FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.restaurant_managers rm
    WHERE rm.restaurant_id = restaurant_pending_edits.restaurant_id
    AND rm.user_id = auth.uid()
    AND rm.role IN ('primary_owner', 'editor')
  )
);

CREATE POLICY "Admins can manage all pending edits"
ON public.restaurant_pending_edits FOR ALL
USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for claim_activity_logs (read-only for relevant parties)
CREATE POLICY "Users can view logs for own claims"
ON public.claim_activity_logs FOR SELECT
USING (actor_id = auth.uid());

CREATE POLICY "Verified owners can view logs for their restaurant"
ON public.claim_activity_logs FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.restaurant_managers rm
    WHERE rm.restaurant_id = claim_activity_logs.restaurant_id
    AND rm.user_id = auth.uid()
  )
);

CREATE POLICY "Admins can view all logs"
ON public.claim_activity_logs FOR SELECT
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "System can insert logs"
ON public.claim_activity_logs FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- RLS Policies for user_claim_limits
CREATE POLICY "Users can view own limits"
ON public.user_claim_limits FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Admins can manage all limits"
ON public.user_claim_limits FOR ALL
USING (has_role(auth.uid(), 'admin'));

-- Function to check if user is verified owner of a restaurant
CREATE OR REPLACE FUNCTION public.is_verified_owner(_user_id UUID, _restaurant_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.restaurant_managers
    WHERE restaurant_id = _restaurant_id
    AND user_id = _user_id
    AND role = 'primary_owner'
  )
  AND EXISTS (
    SELECT 1 FROM public.restaurants
    WHERE id = _restaurant_id
    AND claim_status = 'verified_owner'
  );
$$;

-- Function to check if user has any manager access
CREATE OR REPLACE FUNCTION public.has_restaurant_access(_user_id UUID, _restaurant_id UUID, _min_role manager_role DEFAULT 'viewer')
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.restaurant_managers
    WHERE restaurant_id = _restaurant_id
    AND user_id = _user_id
    AND CASE 
      WHEN _min_role = 'viewer' THEN role IN ('viewer', 'editor', 'finance', 'primary_owner')
      WHEN _min_role = 'editor' THEN role IN ('editor', 'primary_owner')
      WHEN _min_role = 'finance' THEN role IN ('finance', 'primary_owner')
      WHEN _min_role = 'primary_owner' THEN role = 'primary_owner'
      ELSE false
    END
  );
$$;

-- Function to check claim limits before allowing new claim
CREATE OR REPLACE FUNCTION public.can_create_claim(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _limit_record user_claim_limits%ROWTYPE;
  _max_unverified_claims INTEGER := 2;
BEGIN
  SELECT * INTO _limit_record FROM public.user_claim_limits WHERE user_id = _user_id;
  
  -- No record means first claim, allowed
  IF NOT FOUND THEN
    RETURN true;
  END IF;
  
  -- Check if blocked
  IF _limit_record.is_blocked AND (_limit_record.blocked_until IS NULL OR _limit_record.blocked_until > now()) THEN
    RETURN false;
  END IF;
  
  -- Check unverified claims limit
  IF _limit_record.active_unverified_claims >= _max_unverified_claims THEN
    RETURN false;
  END IF;
  
  RETURN true;
END;
$$;

-- Trigger to update timestamps
CREATE OR REPLACE FUNCTION public.update_claim_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_restaurant_claims_updated_at
BEFORE UPDATE ON public.restaurant_claims
FOR EACH ROW EXECUTE FUNCTION public.update_claim_updated_at();

CREATE TRIGGER update_restaurant_managers_updated_at
BEFORE UPDATE ON public.restaurant_managers
FOR EACH ROW EXECUTE FUNCTION public.update_claim_updated_at();

CREATE TRIGGER update_restaurant_pending_edits_updated_at
BEFORE UPDATE ON public.restaurant_pending_edits
FOR EACH ROW EXECUTE FUNCTION public.update_claim_updated_at();

CREATE TRIGGER update_user_claim_limits_updated_at
BEFORE UPDATE ON public.user_claim_limits
FOR EACH ROW EXECUTE FUNCTION public.update_claim_updated_at();
