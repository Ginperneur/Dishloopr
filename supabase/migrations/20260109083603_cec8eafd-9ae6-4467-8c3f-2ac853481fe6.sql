-- Add English name to dishes table
ALTER TABLE public.dishes 
ADD COLUMN IF NOT EXISTS name_en text;

-- Create enum for dish status
DO $$ BEGIN
  CREATE TYPE public.dish_status AS ENUM ('suggested', 'approved_by_admin', 'verified_by_owner', 'rejected');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create enum for dish source
DO $$ BEGIN
  CREATE TYPE public.dish_source AS ENUM ('cuisine_rules', 'website_hints', 'user_review', 'admin', 'owner');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Extend restaurant_dishes table with status workflow
ALTER TABLE public.restaurant_dishes 
ADD COLUMN IF NOT EXISTS status text DEFAULT 'suggested',
ADD COLUMN IF NOT EXISTS source text DEFAULT 'admin',
ADD COLUMN IF NOT EXISTS created_by uuid,
ADD COLUMN IF NOT EXISTS approved_by uuid,
ADD COLUMN IF NOT EXISTS approved_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS verified_by uuid,
ADD COLUMN IF NOT EXISTS verified_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS rejected_reason text,
ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();

-- Update existing records to be approved (they were manually added)
UPDATE public.restaurant_dishes 
SET status = 'approved_by_admin', 
    source = 'admin',
    approved_at = created_at
WHERE status = 'suggested' OR status IS NULL;

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_restaurant_dishes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS update_restaurant_dishes_updated_at ON public.restaurant_dishes;
CREATE TRIGGER update_restaurant_dishes_updated_at
BEFORE UPDATE ON public.restaurant_dishes
FOR EACH ROW
EXECUTE FUNCTION public.update_restaurant_dishes_updated_at();

-- Drop existing policies and recreate with status-based visibility
DROP POLICY IF EXISTS "Anyone can view restaurant dishes" ON public.restaurant_dishes;
DROP POLICY IF EXISTS "Admins can manage restaurant dishes" ON public.restaurant_dishes;

-- Public can only see approved/verified dishes
CREATE POLICY "Public can view approved dishes" 
ON public.restaurant_dishes 
FOR SELECT 
USING (status IN ('approved_by_admin', 'verified_by_owner'));

-- Admins can do everything
CREATE POLICY "Admins can manage all dishes" 
ON public.restaurant_dishes 
FOR ALL 
USING (has_role(auth.uid(), 'admin'));

-- Verified owners can manage their restaurant's dishes
CREATE POLICY "Owners can view their dishes" 
ON public.restaurant_dishes 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.restaurants r
    WHERE r.id = restaurant_dishes.restaurant_id
    AND r.claimed_by_owner_id = auth.uid()
    AND r.claim_status = 'verified_owner'
  )
);

CREATE POLICY "Owners can insert dishes for their restaurant" 
ON public.restaurant_dishes 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.restaurants r
    WHERE r.id = restaurant_dishes.restaurant_id
    AND r.claimed_by_owner_id = auth.uid()
    AND r.claim_status = 'verified_owner'
  )
);

CREATE POLICY "Owners can update their dishes" 
ON public.restaurant_dishes 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.restaurants r
    WHERE r.id = restaurant_dishes.restaurant_id
    AND r.claimed_by_owner_id = auth.uid()
    AND r.claim_status = 'verified_owner'
  )
);

-- Add index for faster status-based queries
CREATE INDEX IF NOT EXISTS idx_restaurant_dishes_status ON public.restaurant_dishes(status);
CREATE INDEX IF NOT EXISTS idx_restaurant_dishes_restaurant_status ON public.restaurant_dishes(restaurant_id, status);