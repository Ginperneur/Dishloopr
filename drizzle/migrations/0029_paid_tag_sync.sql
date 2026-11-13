-- Paid extra tags: the Stripe webhook records them in restaurant_tag_subscriptions, but nothing
-- put the tag on the restaurant, so owners paid and the tag never showed. This trigger keeps the
-- restaurant's tag arrays in sync: an active subscription appends its tag after the free one,
-- an inactive or deleted one removes it again (never the free first tag).
CREATE OR REPLACE FUNCTION public.sync_paid_restaurant_tag()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r record;
  v_cur text[];
  v_new text[];
BEGIN
  r := CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  SELECT CASE r.tag_category
           WHEN 'cuisine' THEN cuisines WHEN 'ambience' THEN ambience_tags
           WHEN 'concept' THEN concepts ELSE experiences END
    INTO v_cur FROM public.restaurants WHERE id = r.restaurant_id;
  v_cur := coalesce(v_cur, '{}'::text[]);

  IF TG_OP <> 'DELETE' AND NEW.is_active THEN
    IF r.tag_value = ANY (v_cur) THEN RETURN NULL; END IF;
    v_new := v_cur || r.tag_value;
  ELSE
    -- Keep the free tag (first position) even if it happens to match.
    IF cardinality(v_cur) = 0 THEN RETURN NULL; END IF;
    v_new := v_cur[1:1] || array_remove(v_cur[2:], r.tag_value);
    IF v_new = v_cur THEN RETURN NULL; END IF;
  END IF;

  UPDATE public.restaurants SET
    cuisines      = CASE WHEN r.tag_category = 'cuisine' THEN v_new ELSE cuisines END,
    ambience_tags = CASE WHEN r.tag_category = 'ambience' THEN v_new ELSE ambience_tags END,
    concepts      = CASE WHEN r.tag_category = 'concept' THEN v_new ELSE concepts END,
    experiences   = CASE WHEN r.tag_category = 'experience' THEN v_new ELSE experiences END,
    updated_at    = now()
  WHERE id = r.restaurant_id;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS sync_paid_restaurant_tag ON public.restaurant_tag_subscriptions;
CREATE TRIGGER sync_paid_restaurant_tag
  AFTER INSERT OR UPDATE OF is_active, tag_value OR DELETE ON public.restaurant_tag_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.sync_paid_restaurant_tag();

-- Backfill tags that were already paid for.
UPDATE public.restaurant_tag_subscriptions SET is_active = is_active WHERE is_active;
