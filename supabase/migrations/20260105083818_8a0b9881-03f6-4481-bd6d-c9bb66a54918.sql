
-- Add sustainability score and busy level to restaurants
ALTER TABLE public.restaurants 
ADD COLUMN IF NOT EXISTS sustainability_score integer DEFAULT NULL,
ADD COLUMN IF NOT EXISTS current_busy_level text DEFAULT NULL;

-- Create menu_items table with prices and allergens
CREATE TABLE public.menu_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(10,2) NOT NULL,
  category TEXT NOT NULL,
  allergens TEXT[] DEFAULT '{}',
  is_vegetarian BOOLEAN DEFAULT false,
  is_vegan BOOLEAN DEFAULT false,
  is_gluten_free BOOLEAN DEFAULT false,
  image_url TEXT,
  is_available BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create restaurant_events table
CREATE TABLE public.restaurant_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  event_type TEXT NOT NULL,
  event_date TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE,
  price NUMERIC(10,2),
  max_participants INTEGER,
  current_participants INTEGER DEFAULT 0,
  image_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add seasonal tags to dishes
ALTER TABLE public.dishes 
ADD COLUMN IF NOT EXISTS seasonal_tags TEXT[] DEFAULT '{}';

-- Enable RLS on new tables
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_events ENABLE ROW LEVEL SECURITY;

-- RLS policies for menu_items
CREATE POLICY "Anyone can view menu items" 
ON public.menu_items 
FOR SELECT 
USING (is_available = true);

CREATE POLICY "Admins can manage menu items" 
ON public.menu_items 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Owners can manage their menu items" 
ON public.menu_items 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM restaurants 
  WHERE restaurants.id = menu_items.restaurant_id 
  AND restaurants.claimed_by_owner_id = auth.uid()
));

-- RLS policies for restaurant_events
CREATE POLICY "Anyone can view active events" 
ON public.restaurant_events 
FOR SELECT 
USING (is_active = true AND event_date >= now());

CREATE POLICY "Admins can manage events" 
ON public.restaurant_events 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Owners can manage their events" 
ON public.restaurant_events 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM restaurants 
  WHERE restaurants.id = restaurant_events.restaurant_id 
  AND restaurants.claimed_by_owner_id = auth.uid()
));

-- Triggers for updated_at
CREATE TRIGGER update_menu_items_updated_at
BEFORE UPDATE ON public.menu_items
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_restaurant_events_updated_at
BEFORE UPDATE ON public.restaurant_events
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
