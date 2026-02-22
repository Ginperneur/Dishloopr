
-- Newsletter subscribers (anyone can sign up with email)
CREATE TABLE public.newsletter_subscribers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  subscribed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  unsubscribed_at TIMESTAMP WITH TIME ZONE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;

-- Anyone can subscribe (insert)
CREATE POLICY "Anyone can subscribe to newsletter"
  ON public.newsletter_subscribers FOR INSERT
  WITH CHECK (true);

-- Users can see their own subscription
CREATE POLICY "Users can view own subscription"
  ON public.newsletter_subscribers FOR SELECT
  USING (true);

-- Users can update their own subscription (unsubscribe)
CREATE POLICY "Users can update own subscription"
  ON public.newsletter_subscribers FOR UPDATE
  USING (email = email);

-- Newsletter editions (admin creates these)
CREATE TABLE public.newsletter_editions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  intro_text TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sent')),
  scheduled_for TIMESTAMP WITH TIME ZONE,
  sent_at TIMESTAMP WITH TIME ZONE,
  recipient_count INTEGER DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.newsletter_editions ENABLE ROW LEVEL SECURITY;

-- Only admins can manage editions
CREATE POLICY "Admins can manage newsletter editions"
  ON public.newsletter_editions FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Everyone can view sent editions  
CREATE POLICY "Anyone can view sent editions"
  ON public.newsletter_editions FOR SELECT
  USING (status = 'sent' OR status = 'scheduled');

-- Newsletter placements (restaurants pay €15 to be in a newsletter)
CREATE TABLE public.newsletter_placements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  edition_id UUID REFERENCES public.newsletter_editions(id) ON DELETE CASCADE,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  title TEXT NOT NULL,
  description TEXT,
  promo_type TEXT NOT NULL DEFAULT 'actie' CHECK (promo_type IN ('actie', 'event', 'nieuw_gerecht', 'aanbieding', 'overig')),
  status TEXT NOT NULL DEFAULT 'pending_payment' CHECK (status IN ('pending_payment', 'paid', 'approved', 'rejected', 'published')),
  price_paid NUMERIC(10,2) NOT NULL DEFAULT 15.00,
  stripe_payment_id TEXT,
  admin_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.newsletter_placements ENABLE ROW LEVEL SECURITY;

-- Owners can view/create their own placements
CREATE POLICY "Owners can view own placements"
  ON public.newsletter_placements FOR SELECT
  USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "Owners can create placements"
  ON public.newsletter_placements FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Owners can update own placements"
  ON public.newsletter_placements FOR UPDATE
  USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- Admins can delete placements
CREATE POLICY "Admins can delete placements"
  ON public.newsletter_placements FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));
