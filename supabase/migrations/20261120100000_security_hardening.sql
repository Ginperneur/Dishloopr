-- Security hardening of write access that RLS alone left too wide (owner/user INSERT and UPDATE
-- policies without column limits). Idempotent on purpose: Lovable renumbers and re-runs migrations.
--
-- How callers are told apart: the guards below only restrict the Supabase client roles `authenticated`
-- and `anon` (current_user). Edge functions run as `service_role` and SECURITY DEFINER RPCs run as their
-- owner, so both pass untouched. The JWT role is NOT used for this: inside a SECURITY DEFINER RPC the
-- JWT still says `authenticated`, which would block legitimate RPCs such as set_restaurant_contact,
-- set_restaurant_opening_hours, save_restaurant_parking, apply_pending_edit and sync_owner_pro_restaurants.
-- The guard functions must therefore stay SECURITY INVOKER.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
-- True for a direct client call of a non-admin user. False for service_role, definer RPCs and admins.
CREATE OR REPLACE FUNCTION public.guard_is_restricted()
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT current_user IN ('authenticated', 'anon')
    AND NOT coalesce(public.has_role(auth.uid(), 'admin'::public.app_role), false)
$$;

-- Same, but moderators are trusted too (reviews, dishes and claims have a moderator queue).
CREATE OR REPLACE FUNCTION public.guard_is_restricted_mod()
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT current_user IN ('authenticated', 'anon')
    AND NOT coalesce(public.is_moderator_or_admin(auth.uid()), false)
$$;

-- Supabase Auth confirmed the email of the calling user (own id only).
CREATE OR REPLACE FUNCTION public.guard_email_confirmed(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth AS $$
  SELECT _uid IS NOT NULL AND _uid = auth.uid()
    AND EXISTS (SELECT 1 FROM auth.users u WHERE u.id = _uid AND u.email_confirmed_at IS NOT NULL)
$$;
REVOKE ALL ON FUNCTION public.guard_email_confirmed(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.guard_email_confirmed(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 1. restaurants: owners may only change their own profile fields
-- ---------------------------------------------------------------------------
-- Allow-list (fails closed for new columns). It is what the owner dashboard really writes directly:
-- the toggles in OwnerDashboard (halal/vegetarian/vegan, terrace, delivery, takeaway, accepts_reservations),
-- ReservationLinkManager (reservation_url), SocialLinksManager (instagram/tiktok), plus the contact,
-- opening hours, images, description and parking fields that also have their own RPCs. Everything else
-- (paid status, ranking, ratings, moderation, ownership, chain, slug, name, address, geo, cuisines/tags
-- which go through set_free_restaurant_tag) is admin or service only.
CREATE OR REPLACE FUNCTION public.guard_restaurant_owner_update()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  o jsonb := to_jsonb(OLD);
  n jsonb := to_jsonb(NEW);
  k text;
  allowed text[] := ARRAY[
    'description', 'phone', 'website_url', 'instagram_url', 'tiktok_url', 'facebook_url', 'reservation_url', 'menu_url',
    'accepts_reservations', 'opening_hours', 'images', 'parking_info',
    'has_terrace', 'has_delivery', 'has_takeaway', 'is_fully_halal', 'is_fully_vegetarian', 'is_fully_vegan',
    'updated_at'];
BEGIN
  -- Links must be real web links, whoever writes them (not a table CHECK: old rows may violate it).
  FOR k IN
    SELECT e.key FROM jsonb_each_text(n) e
    WHERE e.key ~ '_url$'
      AND e.value IS DISTINCT FROM o ->> e.key
      AND nullif(btrim(e.value), '') IS NOT NULL
      AND e.value !~* '^https?://'
  LOOP
    RAISE EXCEPTION 'Ongeldige link in %: een link moet beginnen met http:// of https://', k USING ERRCODE = '22023';
  END LOOP;

  IF public.guard_is_restricted() THEN
    FOR k IN
      SELECT x.key FROM jsonb_object_keys(n) AS x(key)
      WHERE n -> x.key IS DISTINCT FROM o -> x.key AND x.key <> ALL (allowed)
    LOOP
      RAISE EXCEPTION 'Je kunt het veld % niet zelf wijzigen. Neem contact op met Dishloopr.', k USING ERRCODE = '42501';
    END LOOP;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS guard_restaurant_owner_update ON public.restaurants;
CREATE TRIGGER guard_restaurant_owner_update BEFORE UPDATE ON public.restaurants
  FOR EACH ROW EXECUTE FUNCTION public.guard_restaurant_owner_update();

DROP POLICY IF EXISTS "Owners can update their restaurants" ON public.restaurants;
CREATE POLICY "Owners can update their restaurants" ON public.restaurants
  FOR UPDATE USING (claimed_by_owner_id = auth.uid())
  WITH CHECK (claimed_by_owner_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 2. Paid purchases are written by the Stripe webhook (service role) only
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Owners can create subscriptions for their restaurants" ON public.featured_subscriptions;
DROP POLICY IF EXISTS "Owners can create purchases for their restaurants" ON public.sponsored_purchases;

-- ---------------------------------------------------------------------------
-- 3. reviews
-- ---------------------------------------------------------------------------
-- Today the browser calls moderate-review and then inserts status 'published' or 'flagged' itself
-- (useReviews.ts), so the insert status cannot be forced server-side without breaking that flow: all
-- three values stay allowed. What is pinned: verified flag and owner response (insert), and for updates
-- the author may only change content, an owner (not the author) only the response.
CREATE OR REPLACE FUNCTION public.guard_review_write()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v public.reviews;
BEGIN
  IF NOT public.guard_is_restricted_mod() THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.is_verified := false;
    NEW.owner_response := NULL;
    NEW.owner_response_at := NULL;
    RETURN NEW;
  END IF;
  v := OLD;
  IF auth.uid() IS NOT NULL AND auth.uid() = OLD.user_id THEN
    -- Author: content fields only.
    v.rating := NEW.rating; v.title := NEW.title; v.body := NEW.body; v.photos := NEW.photos;
    v.tag_votes := NEW.tag_votes; v.suggested_tags := NEW.suggested_tags; v.dishes_eaten := NEW.dishes_eaten;
  ELSE
    -- Restaurant owner: the response only.
    v.owner_response := NEW.owner_response; v.owner_response_at := NEW.owner_response_at;
  END IF;
  v.updated_at := NEW.updated_at;
  RETURN v;
END $$;

DROP TRIGGER IF EXISTS guard_review_write ON public.reviews;
CREATE TRIGGER guard_review_write BEFORE INSERT OR UPDATE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.guard_review_write();

-- ---------------------------------------------------------------------------
-- 4. restaurant_claims and claim_requests: no self-verification
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_restaurant_claim_write()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NOT public.guard_is_restricted_mod() THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.status := 'pending';
    NEW.is_primary := false;
    NEW.phone_verified := false;
    NEW.phone_verified_at := NULL;
    NEW.phone_verification_code := NULL;
    NEW.phone_code_expires_at := NULL;
    NEW.verification_completed_at := NULL;
    NEW.verification_proof := '{}'::jsonb;
    NEW.admin_notes := NULL;
    NEW.reviewed_by := NULL;
    NEW.reviewed_at := NULL;
    -- useRestaurantClaims.createClaim sends email_verified = true: keep that only when Auth confirmed it.
    IF NEW.email_verified AND NOT public.guard_email_confirmed(auth.uid()) THEN
      NEW.email_verified := false;
    END IF;
    IF NOT NEW.email_verified THEN NEW.email_verified_at := NULL; END IF;
  ELSE
    -- Users only start a verification method; everything that proves ownership is written server side.
    NEW.status := OLD.status;
    NEW.is_primary := OLD.is_primary;
    NEW.user_id := OLD.user_id;
    NEW.restaurant_id := OLD.restaurant_id;
    NEW.email_verified := OLD.email_verified;
    NEW.email_verified_at := OLD.email_verified_at;
    NEW.phone_verified := OLD.phone_verified;
    NEW.phone_verified_at := OLD.phone_verified_at;
    NEW.phone_verification_code := OLD.phone_verification_code;
    NEW.phone_code_expires_at := OLD.phone_code_expires_at;
    NEW.verification_completed_at := OLD.verification_completed_at;
    NEW.verification_proof := OLD.verification_proof;
    NEW.admin_notes := OLD.admin_notes;
    NEW.reviewed_by := OLD.reviewed_by;
    NEW.reviewed_at := OLD.reviewed_at;
    NEW.claim_attempt_count := OLD.claim_attempt_count;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS guard_restaurant_claim_write ON public.restaurant_claims;
CREATE TRIGGER guard_restaurant_claim_write BEFORE INSERT OR UPDATE ON public.restaurant_claims
  FOR EACH ROW EXECUTE FUNCTION public.guard_restaurant_claim_write();

CREATE OR REPLACE FUNCTION public.guard_claim_request_write()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NOT public.guard_is_restricted_mod() THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.status := 'pending';
    NEW.admin_notes := NULL;
    NEW.reviewed_by := NULL;
    NEW.reviewed_at := NULL;
  ELSE
    NEW.status := OLD.status;
    NEW.user_id := OLD.user_id;
    NEW.restaurant_id := OLD.restaurant_id;
    NEW.admin_notes := OLD.admin_notes;
    NEW.reviewed_by := OLD.reviewed_by;
    NEW.reviewed_at := OLD.reviewed_at;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS guard_claim_request_write ON public.claim_requests;
CREATE TRIGGER guard_claim_request_write BEFORE INSERT OR UPDATE ON public.claim_requests
  FOR EACH ROW EXECUTE FUNCTION public.guard_claim_request_write();

-- ---------------------------------------------------------------------------
-- 5. loyalty_stamps: only the restaurant's owner (or admin) issues stamps
-- ---------------------------------------------------------------------------
-- No frontend or edge function inserts stamps yet (LoyaltyProgramManager only reads them), so no
-- user flow breaks. A customer can no longer mint their own stamps.
DROP POLICY IF EXISTS "Users create own stamps" ON public.loyalty_stamps;
DROP POLICY IF EXISTS "Owners issue restaurant stamps" ON public.loyalty_stamps;
CREATE POLICY "Owners issue restaurant stamps" ON public.loyalty_stamps
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = loyalty_stamps.restaurant_id AND r.claimed_by_owner_id = auth.uid()));
DROP POLICY IF EXISTS "Owners update restaurant stamps" ON public.loyalty_stamps;
CREATE POLICY "Owners update restaurant stamps" ON public.loyalty_stamps
  FOR UPDATE USING (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = loyalty_stamps.restaurant_id AND r.claimed_by_owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = loyalty_stamps.restaurant_id AND r.claimed_by_owner_id = auth.uid()));

-- ---------------------------------------------------------------------------
-- 6. claim_activity_logs: own log lines only, no admin/system/payment entries
-- ---------------------------------------------------------------------------
-- The claim hooks do insert here (useRestaurantClaims.logClaimActivity, useClaimVerification) as
-- actor_role 'user', so the insert stays open but is pinned.
DROP POLICY IF EXISTS "System can insert logs" ON public.claim_activity_logs;
DROP POLICY IF EXISTS "Authenticated users can insert own activity logs" ON public.claim_activity_logs;
DROP POLICY IF EXISTS "Users insert own claim activity logs" ON public.claim_activity_logs;
CREATE POLICY "Users insert own claim activity logs" ON public.claim_activity_logs
  FOR INSERT TO authenticated
  WITH CHECK (
    actor_id = auth.uid()
    AND (
      public.is_moderator_or_admin(auth.uid())
      OR (
        actor_role IN ('user', 'owner')
        AND action_category IN ('claim', 'verification', 'access', 'edit')
        AND (claim_id IS NULL OR EXISTS (SELECT 1 FROM public.restaurant_claims c WHERE c.id = claim_id AND c.user_id = auth.uid()))
      )
    )
  );

-- ---------------------------------------------------------------------------
-- 7 + 9. Internal functions: service role only
-- ---------------------------------------------------------------------------
-- Only edge functions call these, always through the service-role client (_shared/rateLimit.ts,
-- check-owner-pro-status, stripe-webhook).
DO $$
DECLARE
  f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.check_and_log_rate_limit(text,text,integer,integer)',
    'public.cleanup_rate_limit_log()',
    'public.sync_owner_pro_restaurants(uuid)',
    'public.purge_old_integration_events()'] LOOP
    IF to_regprocedure(f) IS NOT NULL THEN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
    END IF;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 8. promo_code_redemptions: only valid codes can be redeemed
-- ---------------------------------------------------------------------------
-- Nothing in src or the edge functions inserts redemptions yet (the owner screen only reads them).
CREATE OR REPLACE FUNCTION public.validate_promo_redemption()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  p public.promo_codes;
BEGIN
  SELECT * INTO p FROM public.promo_codes WHERE id = NEW.promo_code_id;
  IF NOT FOUND OR NOT p.is_active THEN
    RAISE EXCEPTION 'Deze actiecode bestaat niet of is niet actief' USING ERRCODE = '22023';
  END IF;
  IF p.valid_from > now() OR (p.valid_until IS NOT NULL AND p.valid_until <= now()) THEN
    RAISE EXCEPTION 'Deze actiecode is niet geldig op dit moment' USING ERRCODE = '22023';
  END IF;
  IF p.max_uses IS NOT NULL AND (SELECT count(*) FROM public.promo_code_redemptions r WHERE r.promo_code_id = p.id) >= p.max_uses THEN
    RAISE EXCEPTION 'Deze actiecode is al het maximale aantal keer gebruikt' USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS validate_promo_redemption ON public.promo_code_redemptions;
CREATE TRIGGER validate_promo_redemption BEFORE INSERT ON public.promo_code_redemptions
  FOR EACH ROW EXECUTE FUNCTION public.validate_promo_redemption();

DROP POLICY IF EXISTS "Anyone can redeem promo code" ON public.promo_code_redemptions;
DROP POLICY IF EXISTS "Users redeem promo code" ON public.promo_code_redemptions;
CREATE POLICY "Users redeem promo code" ON public.promo_code_redemptions
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 10. restaurant_dishes: owners confirm dishes, they do not approve or score them
-- ---------------------------------------------------------------------------
-- Owner flow (useRestaurantDishes.addOwnerDish / verifyDish): status verified_by_owner with their own
-- id in verified_by. The CSV upload (OwnerMenuUpload) sends 'approved_by_admin' and confidence 0.95:
-- that status becomes verified_by_owner (both count the same everywhere) and the score is capped.
CREATE OR REPLACE FUNCTION public.guard_restaurant_dish_write()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NOT public.guard_is_restricted_mod() THEN
    RETURN NEW;
  END IF;
  IF NEW.status = 'approved_by_admin' THEN
    NEW.status := 'verified_by_owner';
  END IF;
  IF NEW.verified_by IS NOT NULL AND NEW.verified_by IS DISTINCT FROM auth.uid() THEN
    NEW.verified_by := CASE WHEN TG_OP = 'UPDATE' THEN OLD.verified_by ELSE NULL END;
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.approved_by := NULL;
    NEW.approved_at := NULL;
    NEW.screen_canonical := NULL;
    NEW.screen_course := NULL;
    NEW.screen_reason := NULL;
    NEW.screen_score := NULL;
    NEW.tier := NULL;
    NEW.clicks := 0;
    NEW.confidence_score := LEAST(coalesce(NEW.confidence_score, 0.5), 0.5);
  ELSE
    NEW.approved_by := OLD.approved_by;
    NEW.approved_at := OLD.approved_at;
    NEW.screen_canonical := OLD.screen_canonical;
    NEW.screen_course := OLD.screen_course;
    NEW.screen_reason := OLD.screen_reason;
    NEW.screen_score := OLD.screen_score;
    NEW.tier := OLD.tier;
    NEW.clicks := OLD.clicks;
    NEW.confidence_score := OLD.confidence_score;
    NEW.restaurant_id := OLD.restaurant_id;
    NEW.dish_id := OLD.dish_id;
    NEW.created_by := OLD.created_by;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS guard_restaurant_dish_write ON public.restaurant_dishes;
CREATE TRIGGER guard_restaurant_dish_write BEFORE INSERT OR UPDATE ON public.restaurant_dishes
  FOR EACH ROW EXECUTE FUNCTION public.guard_restaurant_dish_write();
