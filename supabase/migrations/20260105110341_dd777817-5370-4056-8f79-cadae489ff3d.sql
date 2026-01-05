-- Create user_tag_preferences table
CREATE TABLE public.user_tag_preferences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tag TEXT NOT NULL,
  tag_type TEXT NOT NULL CHECK (tag_type IN ('cuisine', 'ambience', 'dietary')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, tag, tag_type)
);

-- Enable RLS
ALTER TABLE public.user_tag_preferences ENABLE ROW LEVEL SECURITY;

-- Users can view their own preferences
CREATE POLICY "Users can view own tag preferences"
ON public.user_tag_preferences
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own preferences
CREATE POLICY "Users can insert own tag preferences"
ON public.user_tag_preferences
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can delete their own preferences
CREATE POLICY "Users can delete own tag preferences"
ON public.user_tag_preferences
FOR DELETE
USING (auth.uid() = user_id);

-- Create notification_queue table for pending emails
CREATE TABLE public.notification_queue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL DEFAULT 'new_restaurant',
  sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notification_queue ENABLE ROW LEVEL SECURITY;

-- Only service role can manage notifications
CREATE POLICY "Service role can manage notifications"
ON public.notification_queue
FOR ALL
USING (true)
WITH CHECK (true);

-- Function to queue notifications when a new restaurant is created
CREATE OR REPLACE FUNCTION public.queue_new_restaurant_notifications()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Find users who have preferences matching the restaurant's cuisines or ambience
  INSERT INTO notification_queue (user_id, restaurant_id, notification_type)
  SELECT DISTINCT utp.user_id, NEW.id, 'new_restaurant'
  FROM user_tag_preferences utp
  JOIN profiles p ON p.id = utp.user_id
  WHERE p.email IS NOT NULL
    AND (
      (utp.tag_type = 'cuisine' AND utp.tag = ANY(NEW.cuisines))
      OR (utp.tag_type = 'ambience' AND utp.tag = ANY(NEW.ambience_tags))
    );
  
  RETURN NEW;
END;
$$;

-- Trigger for new restaurants
CREATE TRIGGER on_new_restaurant_queue_notifications
AFTER INSERT ON public.restaurants
FOR EACH ROW
EXECUTE FUNCTION public.queue_new_restaurant_notifications();