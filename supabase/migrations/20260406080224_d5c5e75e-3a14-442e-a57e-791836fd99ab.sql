
-- Restaurant deals/aanbiedingen table
CREATE TABLE public.restaurant_deals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  deal_type text NOT NULL DEFAULT 'discount',
  discount_percentage integer,
  valid_from timestamp with time zone NOT NULL DEFAULT now(),
  valid_until timestamp with time zone NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  conditions text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.restaurant_deals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active deals" ON public.restaurant_deals
  FOR SELECT USING (is_active = true AND valid_until > now());

CREATE POLICY "Owners can manage their deals" ON public.restaurant_deals
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.restaurants r
      WHERE r.id = restaurant_deals.restaurant_id
      AND r.claimed_by_owner_id = auth.uid()
      AND r.claim_status = 'verified_owner'
    )
  );

CREATE POLICY "Admins can manage all deals" ON public.restaurant_deals
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Shared lists for group decisions
CREATE TABLE public.shared_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  share_code text NOT NULL UNIQUE DEFAULT substr(md5(random()::text), 1, 8),
  title text NOT NULL DEFAULT 'Waar gaan we eten?',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + interval '7 days'),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.shared_list_restaurants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id uuid NOT NULL REFERENCES public.shared_lists(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  added_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(list_id, restaurant_id)
);

CREATE TABLE public.shared_list_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id uuid NOT NULL REFERENCES public.shared_lists(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  voter_name text NOT NULL,
  voter_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(list_id, restaurant_id, voter_name)
);

ALTER TABLE public.shared_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_list_restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_list_votes ENABLE ROW LEVEL SECURITY;

-- Shared lists are accessible by anyone with the link (public read)
CREATE POLICY "Anyone can view shared lists" ON public.shared_lists
  FOR SELECT USING (expires_at > now());

CREATE POLICY "Authenticated users can create lists" ON public.shared_lists
  FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());

CREATE POLICY "Anyone can view list restaurants" ON public.shared_list_restaurants
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.shared_lists sl WHERE sl.id = list_id AND sl.expires_at > now())
  );

CREATE POLICY "Authenticated users can add restaurants" ON public.shared_list_restaurants
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.shared_lists sl WHERE sl.id = list_id AND sl.expires_at > now())
  );

CREATE POLICY "Anyone can view votes" ON public.shared_list_votes
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.shared_lists sl WHERE sl.id = list_id AND sl.expires_at > now())
  );

CREATE POLICY "Anyone can vote" ON public.shared_list_votes
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.shared_lists sl WHERE sl.id = list_id AND sl.expires_at > now())
  );
