
-- ===== Batch 4 tables =====

-- Response templates (Basis tier)
CREATE TABLE public.response_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID NOT NULL,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  sentiment TEXT,
  use_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.response_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage own templates"
  ON public.response_templates FOR ALL
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = restaurant_id AND r.claimed_by_owner_id = auth.uid())
  )
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = restaurant_id AND r.claimed_by_owner_id = auth.uid())
  );

CREATE POLICY "Admins manage all templates"
  ON public.response_templates FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_response_templates_restaurant ON public.response_templates(restaurant_id);
CREATE TRIGGER update_response_templates_updated_at BEFORE UPDATE ON public.response_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Team members (Pro tier)
CREATE TABLE public.restaurant_team_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID NOT NULL,
  user_id UUID,
  invited_email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'staff',
  status TEXT NOT NULL DEFAULT 'pending',
  invited_by UUID NOT NULL,
  invited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (restaurant_id, invited_email)
);

ALTER TABLE public.restaurant_team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner manages team"
  ON public.restaurant_team_members FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = restaurant_id AND r.claimed_by_owner_id = auth.uid())
    OR user_id = auth.uid()
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = restaurant_id AND r.claimed_by_owner_id = auth.uid())
  );

CREATE POLICY "Admins manage all team members"
  ON public.restaurant_team_members FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_team_members_restaurant ON public.restaurant_team_members(restaurant_id);

-- Internal feedback (Pro tier) — collected via QR code in restaurant
CREATE TABLE public.internal_feedback (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID NOT NULL,
  rating INTEGER NOT NULL,
  comment TEXT,
  category TEXT,
  contact_email TEXT,
  is_resolved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

ALTER TABLE public.internal_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit internal feedback"
  ON public.internal_feedback FOR INSERT
  WITH CHECK (rating BETWEEN 1 AND 5);

CREATE POLICY "Owners view own internal feedback"
  ON public.internal_feedback FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = restaurant_id AND r.claimed_by_owner_id = auth.uid()));

CREATE POLICY "Owners update own internal feedback"
  ON public.internal_feedback FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = restaurant_id AND r.claimed_by_owner_id = auth.uid()));

CREATE POLICY "Admins manage all internal feedback"
  ON public.internal_feedback FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_internal_feedback_restaurant ON public.internal_feedback(restaurant_id);

-- ===== Batch 3 RPCs =====

-- Funnel: views -> profile clicks -> conversion (website/phone/reservation)
CREATE OR REPLACE FUNCTION public.get_owner_funnel(
  p_restaurant_id UUID,
  p_days INTEGER DEFAULT 30
)
RETURNS TABLE (
  views BIGINT,
  clicks BIGINT,
  conversions BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COUNT(*) FILTER (WHERE event_type IN ('view', 'restaurant_view')) AS views,
    COUNT(*) FILTER (WHERE event_type IN ('click', 'restaurant_click')) AS clicks,
    COUNT(*) FILTER (WHERE event_type IN ('website_click', 'phone_click', 'reservation_click', 'map_click')) AS conversions
  FROM public.analytics_events
  WHERE restaurant_id = p_restaurant_id
    AND created_at >= now() - (p_days || ' days')::interval;
$$;

-- Search term heatmap: which search terms led users to this restaurant
CREATE OR REPLACE FUNCTION public.get_search_term_heatmap(
  p_restaurant_id UUID,
  p_days INTEGER DEFAULT 30,
  p_limit INTEGER DEFAULT 15
)
RETURNS TABLE (
  search_term TEXT,
  hits BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    LOWER(TRIM(COALESCE(metadata->>'search_term', metadata->>'query', metadata->>'term'))) AS search_term,
    COUNT(*) AS hits
  FROM public.analytics_events
  WHERE restaurant_id = p_restaurant_id
    AND created_at >= now() - (p_days || ' days')::interval
    AND (metadata ? 'search_term' OR metadata ? 'query' OR metadata ? 'term')
  GROUP BY 1
  HAVING LOWER(TRIM(COALESCE(metadata->>'search_term', metadata->>'query', metadata->>'term'))) IS NOT NULL
  ORDER BY hits DESC
  LIMIT p_limit;
$$;
