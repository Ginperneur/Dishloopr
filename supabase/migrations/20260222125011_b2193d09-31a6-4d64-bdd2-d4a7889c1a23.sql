
-- Add course_type to restaurant_dishes for grouping by voorgerecht/hoofdgerecht/dessert
ALTER TABLE public.restaurant_dishes
ADD COLUMN course_type TEXT DEFAULT 'hoofdgerecht';

-- Add a comment for documentation
COMMENT ON COLUMN public.restaurant_dishes.course_type IS 'Course type: voorgerecht, hoofdgerecht, dessert, bijgerecht, drank';
