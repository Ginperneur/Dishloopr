-- Fix security definer views by recreating with SECURITY INVOKER

-- Drop and recreate restaurant_dish_scores with SECURITY INVOKER
DROP VIEW IF EXISTS public.restaurant_dish_scores;
CREATE VIEW public.restaurant_dish_scores 
WITH (security_invoker = true)
AS
SELECT 
  rd.restaurant_id,
  rd.dish_id,
  d.name as dish_name,
  COUNT(dr.id) as review_count,
  COALESCE(
    SUM(
      dr.rating * 
      CASE 
        WHEN dr.created_at > NOW() - INTERVAL '30 days' THEN 2.0
        WHEN dr.created_at > NOW() - INTERVAL '90 days' THEN 1.5
        ELSE 1.0
      END *
      CASE WHEN r.is_verified THEN 1.5 ELSE 1.0 END
    ) / 
    NULLIF(SUM(
      CASE 
        WHEN dr.created_at > NOW() - INTERVAL '30 days' THEN 2.0
        WHEN dr.created_at > NOW() - INTERVAL '90 days' THEN 1.5
        ELSE 1.0
      END *
      CASE WHEN r.is_verified THEN 1.5 ELSE 1.0 END
    ), 0),
    0
  )::NUMERIC(3,2) as weighted_rating,
  COALESCE(AVG(dr.rating), 0)::NUMERIC(3,2) as simple_rating
FROM restaurant_dishes rd
JOIN dishes d ON d.id = rd.dish_id
LEFT JOIN dish_ratings dr ON dr.dish_id = rd.dish_id
LEFT JOIN reviews r ON r.id = dr.review_id AND r.restaurant_id = rd.restaurant_id AND r.status = 'published'
GROUP BY rd.restaurant_id, rd.dish_id, d.name;

-- Drop and recreate restaurant_tag_scores with SECURITY INVOKER
DROP VIEW IF EXISTS public.restaurant_tag_scores;
CREATE VIEW public.restaurant_tag_scores 
WITH (security_invoker = true)
AS
SELECT 
  restaurant_id,
  tag,
  tag_type,
  COUNT(*) FILTER (WHERE is_confirmed = true) as confirmations,
  COUNT(*) FILTER (WHERE is_confirmed = false) as disputes,
  COUNT(*) as total_votes,
  CASE 
    WHEN COUNT(*) = 0 THEN 0.5
    ELSE (COUNT(*) FILTER (WHERE is_confirmed = true))::NUMERIC / COUNT(*)
  END as confidence_score
FROM public.tag_confirmations
GROUP BY restaurant_id, tag, tag_type;