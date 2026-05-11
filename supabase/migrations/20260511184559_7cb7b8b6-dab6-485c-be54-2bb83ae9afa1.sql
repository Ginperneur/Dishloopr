
DROP VIEW IF EXISTS public.featured_subscriptions_public CASCADE;
DROP VIEW IF EXISTS public.sponsored_purchases_public CASCADE;

DROP POLICY IF EXISTS "Anyone can view active subscriptions public" ON public.featured_subscriptions;
DROP POLICY IF EXISTS "Anyone can view active purchases" ON public.sponsored_purchases;

CREATE VIEW public.featured_subscriptions_public AS
SELECT
  id, restaurant_id, slot_id, status,
  starts_at, expires_at, monthly_price, consecutive_months,
  included_ambiance, extra_ambiances, total_views, total_clicks, created_at
FROM public.featured_subscriptions
WHERE status = 'active' AND expires_at > now();
GRANT SELECT ON public.featured_subscriptions_public TO anon, authenticated;

CREATE VIEW public.sponsored_purchases_public AS
SELECT
  id, restaurant_id, product_id, is_active, expires_at, starts_at, created_at
FROM public.sponsored_purchases
WHERE is_active = true AND expires_at > now();
GRANT SELECT ON public.sponsored_purchases_public TO anon, authenticated;

DROP POLICY IF EXISTS "Users can view own subscription" ON public.newsletter_subscribers;
CREATE POLICY "Users can view own subscription"
ON public.newsletter_subscribers FOR SELECT TO authenticated
USING (
  (user_id IS NOT NULL AND user_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

DROP POLICY IF EXISTS "Users view own support conversations" ON public.support_conversations;
CREATE POLICY "Users view own support conversations"
ON public.support_conversations FOR SELECT
USING (
  (auth.uid() IS NOT NULL AND auth.uid() = user_id)
  OR (auth.uid() IS NULL AND user_id IS NULL AND session_id IS NOT NULL AND length(session_id) >= 32)
);

DROP POLICY IF EXISTS "Users update own support conversations" ON public.support_conversations;
CREATE POLICY "Users update own support conversations"
ON public.support_conversations FOR UPDATE
USING (
  (auth.uid() = user_id)
  OR (user_id IS NULL AND session_id IS NOT NULL AND length(session_id) >= 32)
);

DROP POLICY IF EXISTS "Anyone can create support conversations" ON public.support_conversations;
CREATE POLICY "Anyone can create support conversations"
ON public.support_conversations FOR INSERT
WITH CHECK (
  (auth.uid() IS NOT NULL AND auth.uid() = user_id)
  OR (auth.uid() IS NULL AND user_id IS NULL AND session_id IS NOT NULL AND length(session_id) >= 32)
);

DROP POLICY IF EXISTS "Users view own support messages" ON public.support_messages;
CREATE POLICY "Users view own support messages"
ON public.support_messages FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.support_conversations c
    WHERE c.id = support_messages.conversation_id
      AND (
        c.user_id = auth.uid()
        OR (c.user_id IS NULL AND c.session_id IS NOT NULL AND length(c.session_id) >= 32 AND auth.uid() IS NULL)
      )
  )
);

DROP POLICY IF EXISTS "Anyone can insert messages in own conversation" ON public.support_messages;
CREATE POLICY "Anyone can insert messages in own conversation"
ON public.support_messages FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.support_conversations c
    WHERE c.id = support_messages.conversation_id
      AND (
        (auth.uid() IS NOT NULL AND c.user_id = auth.uid())
        OR (auth.uid() IS NULL AND c.user_id IS NULL AND c.session_id IS NOT NULL AND length(c.session_id) >= 32)
      )
  )
);

CREATE OR REPLACE FUNCTION public.clear_phone_code_on_verify()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF (NEW.phone_verified = true AND COALESCE(OLD.phone_verified, false) = false)
     OR (NEW.verification_completed_at IS NOT NULL AND OLD.verification_completed_at IS NULL)
  THEN
    NEW.phone_verification_code := NULL;
    NEW.phone_code_expires_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_clear_phone_code_on_verify ON public.restaurant_claims;
CREATE TRIGGER trg_clear_phone_code_on_verify
BEFORE UPDATE ON public.restaurant_claims
FOR EACH ROW EXECUTE FUNCTION public.clear_phone_code_on_verify();

UPDATE public.restaurant_claims
SET phone_verification_code = NULL, phone_code_expires_at = NULL
WHERE phone_verification_code IS NOT NULL
  AND (
    phone_verified = true
    OR verification_completed_at IS NOT NULL
    OR (phone_code_expires_at IS NOT NULL AND phone_code_expires_at < now())
  );

DROP POLICY IF EXISTS "Anyone can view avatars" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view food photos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view review photos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view restaurant images" ON storage.objects;
DROP POLICY IF EXISTS "Collection covers are publicly accessible" ON storage.objects;

CREATE POLICY "Admins can list public buckets"
ON storage.objects FOR SELECT
USING (
  bucket_id IN ('avatars','food-photos','review-photos','restaurant-images','collection-covers')
  AND public.has_role(auth.uid(), 'admin'::app_role)
);

REVOKE EXECUTE ON FUNCTION public.audit_and_fix_dish_classifications() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.auto_enrich_dish_dietary_labels() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.deduplicate_dishes() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.deduplicate_restaurant_dishes() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.generate_amsterdam_grid() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.generate_city_grid(uuid, text, numeric, numeric, integer, integer, numeric, integer) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.clear_expired_verification_codes() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.update_user_badges(uuid) FROM anon, authenticated, public;
