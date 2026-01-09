-- Create restaurant_chains table
CREATE TABLE public.restaurant_chains (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  logo_url TEXT,
  description TEXT,
  website_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add chain_id to restaurants table
ALTER TABLE public.restaurants 
ADD COLUMN chain_id UUID REFERENCES public.restaurant_chains(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX idx_restaurants_chain_id ON public.restaurants(chain_id);

-- Enable RLS
ALTER TABLE public.restaurant_chains ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Anyone can view active chains"
ON public.restaurant_chains
FOR SELECT
USING (is_active = true);

CREATE POLICY "Admins can manage chains"
ON public.restaurant_chains
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Update trigger for updated_at
CREATE TRIGGER update_restaurant_chains_updated_at
BEFORE UPDATE ON public.restaurant_chains
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();