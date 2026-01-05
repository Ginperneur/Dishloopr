-- Add demand routing fields to restaurants table
ALTER TABLE public.restaurants 
ADD COLUMN IF NOT EXISTS accepts_routed_demand BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS routed_demand_dishes UUID[] DEFAULT '{}';

-- Create demand routing analytics table
CREATE TABLE public.demand_routing_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source_restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  target_restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  dish_id UUID REFERENCES public.dishes(id) ON DELETE SET NULL,
  routing_reason TEXT NOT NULL, -- 'closed', 'busy', 'fully_booked', 'low_availability'
  was_clicked BOOLEAN DEFAULT false,
  was_converted BOOLEAN DEFAULT false, -- user made a reservation or visit
  match_score NUMERIC DEFAULT 0, -- how well the alternative matched
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.demand_routing_events ENABLE ROW LEVEL SECURITY;

-- Policies for demand routing events
CREATE POLICY "Admins can view all routing events"
  ON public.demand_routing_events
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Owners can view routing events for their restaurants"
  ON public.demand_routing_events
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM restaurants 
      WHERE (restaurants.id = demand_routing_events.source_restaurant_id 
             OR restaurants.id = demand_routing_events.target_restaurant_id)
      AND restaurants.claimed_by_owner_id = auth.uid()
    )
  );

CREATE POLICY "Anyone can insert routing events"
  ON public.demand_routing_events
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "System can update routing events"
  ON public.demand_routing_events
  FOR UPDATE
  USING (true);

-- Indexes for performance
CREATE INDEX idx_demand_routing_source ON public.demand_routing_events(source_restaurant_id);
CREATE INDEX idx_demand_routing_target ON public.demand_routing_events(target_restaurant_id);
CREATE INDEX idx_demand_routing_dish ON public.demand_routing_events(dish_id);
CREATE INDEX idx_demand_routing_created ON public.demand_routing_events(created_at DESC);

-- Index for restaurants accepting routed demand
CREATE INDEX idx_restaurants_routed_demand ON public.restaurants(accepts_routed_demand) WHERE accepts_routed_demand = true;