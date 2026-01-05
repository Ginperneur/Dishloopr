-- Create collections table for curated editorial content
CREATE TABLE public.collections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  subtitle TEXT,
  description TEXT,
  cover_image TEXT,
  city_id UUID REFERENCES public.cities(id),
  dish_id UUID REFERENCES public.dishes(id),
  cuisine TEXT,
  ambience_tag TEXT,
  is_featured BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  seo_title TEXT,
  seo_description TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create collection_restaurants junction table
CREATE TABLE public.collection_restaurants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  collection_id UUID NOT NULL REFERENCES public.collections(id) ON DELETE CASCADE,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  sort_order INTEGER DEFAULT 0,
  featured_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(collection_id, restaurant_id)
);

-- Enable RLS
ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collection_restaurants ENABLE ROW LEVEL SECURITY;

-- Collections are publicly readable
CREATE POLICY "Collections are publicly readable" 
ON public.collections 
FOR SELECT 
USING (is_active = true);

-- Admins can manage collections
CREATE POLICY "Admins can manage collections" 
ON public.collections 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Collection restaurants are publicly readable
CREATE POLICY "Collection restaurants are publicly readable" 
ON public.collection_restaurants 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM collections c 
  WHERE c.id = collection_id AND c.is_active = true
));

-- Admins can manage collection restaurants
CREATE POLICY "Admins can manage collection restaurants" 
ON public.collection_restaurants 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create indexes for performance
CREATE INDEX idx_collections_city ON public.collections(city_id);
CREATE INDEX idx_collections_dish ON public.collections(dish_id);
CREATE INDEX idx_collections_slug ON public.collections(slug);
CREATE INDEX idx_collections_featured ON public.collections(is_featured) WHERE is_featured = true;
CREATE INDEX idx_collection_restaurants_collection ON public.collection_restaurants(collection_id);
CREATE INDEX idx_collection_restaurants_restaurant ON public.collection_restaurants(restaurant_id);

-- Add trigger for updated_at
CREATE TRIGGER update_collections_updated_at
BEFORE UPDATE ON public.collections
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert some sample collections
INSERT INTO public.collections (slug, title, subtitle, description, is_featured, sort_order) VALUES
('beste-ramen-amsterdam', 'Beste Ramen in Amsterdam', 'Dampende kommen vol umami', 'Ontdek de beste ramen restaurants in Amsterdam, van authentieke Japanse tonkotsu tot moderne fusion ramen.', true, 1),
('romantisch-italiaans-rotterdam', 'Romantisch Italiaans in Rotterdam', 'Perfect voor een date', 'De meest romantische Italiaanse restaurants in Rotterdam voor een onvergetelijke avond.', true, 2),
('budget-lunch-spots', 'Beste Budget Lunch Spots', 'Lekker eten zonder de hoofdprijs', 'Betaalbare lunch opties die niet inleveren op smaak of kwaliteit.', true, 3),
('hidden-gems-nederland', 'Hidden Gems in Nederland', 'Ontdek verborgen parels', 'Onbekende restaurants die je absoluut moet proberen - slechts bij insiders bekend.', true, 4);