
ALTER TABLE public.featured_subscriptions ADD COLUMN IF NOT EXISTS review_request_sent_at TIMESTAMPTZ;
ALTER TABLE public.sponsored_purchases ADD COLUMN IF NOT EXISTS review_request_sent_at TIMESTAMPTZ;
ALTER TABLE public.newsletter_placements ADD COLUMN IF NOT EXISTS review_request_sent_at TIMESTAMPTZ;
ALTER TABLE public.owner_pro_subscriptions ADD COLUMN IF NOT EXISTS review_request_sent_at TIMESTAMPTZ;
