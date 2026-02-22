
-- Email campaigns table for tracking bulk sends
CREATE TABLE public.email_campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  subject TEXT NOT NULL,
  html_content TEXT NOT NULL,
  segment TEXT NOT NULL DEFAULT 'subscribers',
  -- segments: 'subscribers', 'owners_verified', 'owners_all', 'all_users', 'custom'
  custom_filter JSONB,
  status TEXT NOT NULL DEFAULT 'draft',
  -- statuses: 'draft', 'sending', 'paused', 'completed', 'failed'
  total_recipients INTEGER DEFAULT 0,
  sent_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  last_cursor TEXT,
  -- cursor for pagination during sending
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.email_campaigns ENABLE ROW LEVEL SECURITY;

-- Only admins can manage campaigns
CREATE POLICY "Admins can manage email campaigns"
  ON public.email_campaigns
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Add updated_at trigger
CREATE TRIGGER update_email_campaigns_updated_at
  BEFORE UPDATE ON public.email_campaigns
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
