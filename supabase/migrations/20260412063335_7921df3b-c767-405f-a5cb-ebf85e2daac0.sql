
CREATE TABLE public.restaurant_tag_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  tag_category TEXT NOT NULL CHECK (tag_category IN ('cuisine', 'ambience', 'concept', 'experience')),
  tag_value TEXT NOT NULL,
  payment_type TEXT NOT NULL DEFAULT 'per_tag' CHECK (payment_type IN ('per_tag', 'owner_pro')),
  stripe_subscription_id TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(restaurant_id, tag_category, tag_value)
);

ALTER TABLE public.restaurant_tag_subscriptions ENABLE ROW LEVEL SECURITY;

-- Owners can view their own tag subscriptions
CREATE POLICY "Owners can view own tag subscriptions"
ON public.restaurant_tag_subscriptions
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
);

-- Owners can insert their own tag subscriptions
CREATE POLICY "Owners can insert own tag subscriptions"
ON public.restaurant_tag_subscriptions
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND public.has_restaurant_access(auth.uid(), restaurant_id, 'primary_owner')
);

-- Owners can update their own tag subscriptions
CREATE POLICY "Owners can update own tag subscriptions"
ON public.restaurant_tag_subscriptions
FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
);

-- Admins can delete
CREATE POLICY "Admins can delete tag subscriptions"
ON public.restaurant_tag_subscriptions
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Trigger for updated_at
CREATE TRIGGER update_tag_subscriptions_updated_at
BEFORE UPDATE ON public.restaurant_tag_subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
