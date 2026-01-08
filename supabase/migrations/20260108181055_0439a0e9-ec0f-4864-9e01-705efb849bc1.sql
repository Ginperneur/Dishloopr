-- Create SEO landing pages table for city×dish combinations
CREATE TABLE public.seo_landing_pages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  dish_id UUID REFERENCES public.dishes(id) ON DELETE CASCADE,
  city_id UUID REFERENCES public.cities(id) ON DELETE CASCADE,
  
  -- SEO Meta
  meta_title TEXT NOT NULL,
  meta_description TEXT NOT NULL,
  
  -- Page Content
  h1_title TEXT NOT NULL,
  intro_text TEXT,
  extended_description TEXT,
  
  -- FAQ Content (JSON array of {question, answer} objects)
  faq_content JSONB DEFAULT '[]'::jsonb,
  
  -- Additional SEO
  keywords TEXT[],
  canonical_url TEXT,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  is_auto_generated BOOLEAN DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID,
  
  -- Ensure unique city×dish combinations
  CONSTRAINT unique_city_dish UNIQUE (city_id, dish_id)
);

-- Enable RLS
ALTER TABLE public.seo_landing_pages ENABLE ROW LEVEL SECURITY;

-- Public can view active pages
CREATE POLICY "Anyone can view active SEO pages"
  ON public.seo_landing_pages
  FOR SELECT
  USING (is_active = true);

-- Admins can manage all pages
CREATE POLICY "Admins can manage SEO pages"
  ON public.seo_landing_pages
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Create index for slug lookups
CREATE INDEX idx_seo_landing_pages_slug ON public.seo_landing_pages(slug);

-- Create index for city/dish lookups
CREATE INDEX idx_seo_landing_pages_city_dish ON public.seo_landing_pages(city_id, dish_id);

-- Create updated_at trigger
CREATE TRIGGER update_seo_landing_pages_updated_at
  BEFORE UPDATE ON public.seo_landing_pages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert placeholder SEO pages for existing city×dish combinations
INSERT INTO public.seo_landing_pages (
  slug,
  dish_id,
  city_id,
  meta_title,
  meta_description,
  h1_title,
  intro_text,
  extended_description,
  faq_content,
  keywords,
  is_auto_generated
)
SELECT 
  LOWER(d.slug || '-' || c.slug) as slug,
  d.id as dish_id,
  c.id as city_id,
  d.name || ' in ' || c.name || ' | Beste Restaurants | Dishloopr' as meta_title,
  'Ontdek de beste ' || LOWER(d.name) || ' restaurants in ' || c.name || '. Bekijk reviews, vergelijk prijzen en vind jouw perfecte ' || LOWER(d.name) || ' spot.' as meta_description,
  'Beste ' || d.name || ' in ' || c.name as h1_title,
  'Op zoek naar de lekkerste ' || LOWER(d.name) || ' in ' || c.name || '? Wij hebben de beste restaurants voor je verzameld waar je kunt genieten van authentieke ' || LOWER(d.name) || '. Van gezellige tentjes tot high-end restaurants.' as intro_text,
  'Of je nu een snelle hap zoekt of een uitgebreid diner wilt, in ' || c.name || ' vind je ' || LOWER(d.name) || ' voor elke gelegenheid. Onze selectie is gebaseerd op reviews, sfeer en kwaliteit. Filter op prijs, locatie en ambiance om jouw perfecte restaurant te vinden.' as extended_description,
  jsonb_build_array(
    jsonb_build_object(
      'question', 'Waar kan ik de beste ' || LOWER(d.name) || ' eten in ' || c.name || '?',
      'answer', 'De beste ' || LOWER(d.name) || ' restaurants in ' || c.name || ' vind je op Dishloopr. Wij verzamelen reviews en ratings zodat je gemakkelijk kunt vergelijken.'
    ),
    jsonb_build_object(
      'question', 'Hoeveel kost ' || LOWER(d.name) || ' gemiddeld in ' || c.name || '?',
      'answer', 'De prijzen variëren van budget-friendly (€) tot fine dining (€€€€). Gebruik onze filters om restaurants te vinden die bij jouw budget passen.'
    ),
    jsonb_build_object(
      'question', 'Kan ik reserveren bij ' || LOWER(d.name) || ' restaurants?',
      'answer', 'Veel restaurants bieden online reserveringen aan. Klik op een restaurant voor meer details en directe reserveringslinks.'
    )
  ) as faq_content,
  ARRAY[LOWER(d.name), c.name, 'restaurant', 'eten', 'uit eten', 'beste', 'reviews'] as keywords,
  true as is_auto_generated
FROM public.dishes d
CROSS JOIN public.cities c
WHERE d.is_active = true AND c.is_active = true
ON CONFLICT (slug) DO NOTHING;