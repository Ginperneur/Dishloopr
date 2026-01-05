-- Fix function search_path for calculate_reviewer_level
CREATE OR REPLACE FUNCTION public.calculate_reviewer_level(review_count integer, helpful_count integer)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path = public
AS $function$
BEGIN
  IF review_count >= 50 AND helpful_count >= 100 THEN
    RETURN 'platinum';
  ELSIF review_count >= 25 AND helpful_count >= 50 THEN
    RETURN 'gold';
  ELSIF review_count >= 10 AND helpful_count >= 20 THEN
    RETURN 'silver';
  ELSE
    RETURN 'bronze';
  END IF;
END;
$function$;