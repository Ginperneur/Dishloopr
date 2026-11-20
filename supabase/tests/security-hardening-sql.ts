import { PGlite } from "npm:@electric-sql/pglite@0.2.17";
// Checks 20261120100000_security_hardening.sql: owners cannot touch paid/ranking/ownership columns of
// restaurants (but still edit their profile), links must be http(s), SECURITY DEFINER owner RPCs and
// admins/service role keep working, review/claim/dish writes are pinned, loyalty stamps are issued by the
// owner only, promo redemptions are validated, internal functions are service-role only. The migration
// runs twice to prove it is idempotent.
// Usage from the repo root: deno run -A --config supabase/tests/deno.json supabase/tests/security-hardening-sql.ts
const repo = Deno.args[0] ?? ".";
const db = new PGlite();
await db.exec(await Deno.readTextFile(new URL("./stubs.sql", import.meta.url)));
await db.exec(`
  CREATE TYPE public.app_role AS ENUM ('admin','user','owner','moderator');
  CREATE FUNCTION public.has_role(uuid, public.app_role) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT public.has_role($1, $2::text) $$;
  CREATE FUNCTION public.is_moderator_or_admin(_u uuid) RETURNS boolean LANGUAGE sql STABLE AS $$
    SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _u AND role IN ('admin','moderator')) $$;
  ALTER TABLE auth.users ADD COLUMN email_confirmed_at timestamptz;
  ALTER TABLE public.restaurants ADD COLUMN description text, ADD COLUMN phone text, ADD COLUMN website_url text,
    ADD COLUMN instagram_url text, ADD COLUMN tiktok_url text, ADD COLUMN reservation_url text, ADD COLUMN opening_hours jsonb,
    ADD COLUMN is_featured boolean DEFAULT false, ADD COLUMN is_top_listing boolean DEFAULT false, ADD COLUMN claim_status text DEFAULT 'unclaimed',
    ADD COLUMN review_count int DEFAULT 0, ADD COLUMN updated_at timestamptz DEFAULT now(), ADD COLUMN images text[], ADD COLUMN accepts_reservations boolean;
  DROP TABLE public.reviews;
  CREATE TABLE public.reviews (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), restaurant_id uuid, user_id uuid, rating int, title text, body text,
    photos text[], tag_votes jsonb, suggested_tags text[], dishes_eaten uuid[], status text NOT NULL DEFAULT 'published', is_verified boolean DEFAULT false,
    owner_response text, owner_response_at timestamptz, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());
  DROP TABLE public.restaurant_dishes;
  CREATE TABLE public.restaurant_dishes (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), restaurant_id uuid, dish_id uuid, status text DEFAULT 'suggested',
    approved_by uuid, approved_at timestamptz, verified_by uuid, verified_at timestamptz, created_by uuid, source text, clicks int DEFAULT 0,
    confidence_score numeric DEFAULT 0.5, screen_canonical text, screen_course text, screen_reason text, screen_score numeric, tier text);
  CREATE TABLE public.restaurant_claims (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), restaurant_id uuid, user_id uuid, status text NOT NULL DEFAULT 'pending',
    is_primary boolean DEFAULT false, email_verified boolean DEFAULT false, email_verified_at timestamptz, phone_number text, phone_verified boolean DEFAULT false,
    phone_verified_at timestamptz, phone_verification_code text, phone_code_expires_at timestamptz, verification_method text, verification_started_at timestamptz,
    verification_completed_at timestamptz, verification_proof jsonb DEFAULT '{}', admin_notes text, reviewed_by uuid, reviewed_at timestamptz, claim_attempt_count int DEFAULT 1);
  CREATE TABLE public.claim_requests (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), restaurant_id uuid, user_id uuid, status text NOT NULL DEFAULT 'pending',
    notes text, admin_notes text, reviewed_by uuid, reviewed_at timestamptz);
  CREATE TABLE public.loyalty_stamps (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), restaurant_id uuid NOT NULL, user_id uuid NOT NULL, redeemed boolean DEFAULT false);
  CREATE TABLE public.claim_activity_logs (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), actor_id uuid NOT NULL, actor_role text NOT NULL, restaurant_id uuid,
    claim_id uuid, action_type text NOT NULL, action_category text NOT NULL);
  CREATE TABLE public.promo_codes (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), restaurant_id uuid, code text, max_uses int, valid_from timestamptz DEFAULT now(),
    valid_until timestamptz, is_active boolean DEFAULT true);
  CREATE TABLE public.promo_code_redemptions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), promo_code_id uuid NOT NULL, user_id uuid);
  CREATE TABLE public.featured_subscriptions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), restaurant_id uuid);
  CREATE TABLE public.sponsored_purchases (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), restaurant_id uuid);
  CREATE FUNCTION public.check_and_log_rate_limit(p_identifier text, p_function text, p_max int, p_window_seconds int) RETURNS jsonb LANGUAGE sql AS $$ SELECT '{}'::jsonb $$;
  CREATE FUNCTION public.cleanup_rate_limit_log() RETURNS integer LANGUAGE sql AS $$ SELECT 0 $$;
  CREATE FUNCTION public.sync_owner_pro_restaurants(_user_id uuid) RETURNS void LANGUAGE sql AS $$ SELECT $$ ;
  CREATE FUNCTION public.purge_old_integration_events() RETURNS int LANGUAGE sql AS $$ SELECT 0 $$;
  GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;
  ALTER ROLE service_role BYPASSRLS;
`);
// A real SECURITY DEFINER owner RPC that updates restaurants.
await db.exec(await Deno.readTextFile(`${repo}/supabase/migrations/20261113190000_owner_contact_details.sql`));
// The original owner policy and RLS on the tables whose policies the migration replaces.
await db.exec(`
  ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "Owners can update their restaurants" ON public.restaurants FOR UPDATE USING (claimed_by_owner_id = auth.uid());
  CREATE POLICY "Admins can manage all restaurants" ON public.restaurants FOR ALL USING (public.has_role(auth.uid(), 'admin'::public.app_role));
  CREATE POLICY "read" ON public.restaurants FOR SELECT USING (true);
  ALTER TABLE public.loyalty_stamps ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "Users create own stamps" ON public.loyalty_stamps FOR INSERT WITH CHECK (user_id = auth.uid());
  CREATE POLICY "Owners update restaurant stamps" ON public.loyalty_stamps FOR UPDATE USING (EXISTS (SELECT 1 FROM restaurants r WHERE r.id = loyalty_stamps.restaurant_id AND r.claimed_by_owner_id = auth.uid()));
  CREATE POLICY "sel" ON public.loyalty_stamps FOR SELECT USING (true);
  ALTER TABLE public.claim_activity_logs ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "Authenticated users can insert own activity logs" ON public.claim_activity_logs FOR INSERT TO authenticated WITH CHECK (actor_id = auth.uid());
  ALTER TABLE public.promo_code_redemptions ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "Anyone can redeem promo code" ON public.promo_code_redemptions FOR INSERT WITH CHECK (true);
  ALTER TABLE public.featured_subscriptions ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "Owners can create subscriptions for their restaurants" ON public.featured_subscriptions FOR INSERT
    WITH CHECK (EXISTS (SELECT 1 FROM restaurants WHERE restaurants.id = featured_subscriptions.restaurant_id AND restaurants.claimed_by_owner_id = auth.uid()));
  ALTER TABLE public.sponsored_purchases ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "Owners can create purchases for their restaurants" ON public.sponsored_purchases FOR INSERT
    WITH CHECK (EXISTS (SELECT 1 FROM restaurants WHERE restaurants.id = sponsored_purchases.restaurant_id AND restaurants.claimed_by_owner_id = auth.uid()));
  GRANT USAGE ON SCHEMA public, auth TO anon, authenticated, service_role;
  GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
  GRANT SELECT ON ALL TABLES IN SCHEMA auth TO anon, authenticated, service_role;
`);
const sql = await Deno.readTextFile(`${repo}/supabase/migrations/20261120100000_security_hardening.sql`);
await db.exec(sql); await db.exec(sql);

let ok = true;
const check = (l: string, p: boolean, g?: unknown) => { ok &&= p; console.log(p ? "PASS" : "FAIL", l, p ? "" : JSON.stringify(g)); };
const id = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const as = async (role: string, uid: string | null) => {
  await db.exec(`RESET ROLE; DELETE FROM test_ctx; INSERT INTO test_ctx VALUES (${uid ? `'${uid}'` : "NULL"}, '${role}'); SET ROLE ${role};`);
};
const sup = () => db.exec("RESET ROLE");
const fails = async (q: string, p: unknown[] = []) => { try { await db.query(q, p); return false; } catch { return true; } };
const errText = async (q: string, p: unknown[] = []) => { try { await db.query(q, p); return ""; } catch (e) { return String(e); } };
const one = async <T>(q: string, p: unknown[] = []) => (await db.query<{ v: T }>(q, p)).rows[0]?.v;

const OWN = id(1), OTHER = id(2), ADM = id(3), REV = id(4), MOD = id(5);
const R = id(100), R2 = id(101);
await db.exec(`INSERT INTO auth.users (id, email_confirmed_at) VALUES ('${OWN}', now()), ('${OTHER}', NULL), ('${REV}', now());
  INSERT INTO user_roles VALUES ('${ADM}', 'admin'), ('${MOD}', 'moderator');
  INSERT INTO restaurants (id, name, slug, claimed_by_owner_id, rating, claim_status) VALUES ('${R}', 'Eigen', 'eigen', '${OWN}', 4.2, 'verified_owner'), ('${R2}', 'Ander', 'ander', '${OTHER}', 3, 'verified_owner');`);

// --- 1. restaurants ---
await as("authenticated", OWN);
const upd = (set: string) => db.query(`UPDATE restaurants SET ${set} WHERE id = '${R}'`);
check("owner cannot set is_top_listing", await fails(`UPDATE restaurants SET is_top_listing = true WHERE id = '${R}'`));
check("owner cannot set is_featured", await fails(`UPDATE restaurants SET is_featured = true WHERE id = '${R}'`));
check("owner cannot set rating", await fails(`UPDATE restaurants SET rating = 5 WHERE id = '${R}'`));
check("owner cannot set owner_tier", await fails(`UPDATE restaurants SET owner_tier = 'pro' WHERE id = '${R}'`));
check("owner cannot set claim_status", await fails(`UPDATE restaurants SET claim_status = 'locked' WHERE id = '${R}'`));
check("owner cannot set slug", await fails(`UPDATE restaurants SET slug = 'x' WHERE id = '${R}'`));
check("owner cannot hand over ownership", await fails(`UPDATE restaurants SET claimed_by_owner_id = '${OTHER}' WHERE id = '${R}'`));
check("the error is in Dutch and names the field", (await errText(`UPDATE restaurants SET review_count = 99 WHERE id = '${R}'`)).includes("review_count"));
await upd(`description = 'Lekker', phone = '020 123 45 67', opening_hours = '{"ma":"9-17"}'::jsonb, updated_at = now()`);
await sup();
const rr = (await db.query<{ description: string; phone: string; opening_hours: unknown }>(`SELECT description, phone, opening_hours FROM restaurants WHERE id = '${R}'`)).rows[0];
check("owner can still update description, phone and opening hours", rr.description === "Lekker" && rr.phone === "020 123 45 67" && !!rr.opening_hours, rr);
await as("authenticated", OWN);
check("owner can set https/http links and accepts_reservations", !(await fails(`UPDATE restaurants SET instagram_url = 'https://instagram.com/eigen', reservation_url = 'http://reserveer.nl/eigen', accepts_reservations = true WHERE id = '${R}'`)));
check("javascript: website_url is rejected", await fails(`UPDATE restaurants SET website_url = 'javascript:alert(1)' WHERE id = '${R}'`));
check("data: instagram_url is rejected", await fails(`UPDATE restaurants SET instagram_url = 'data:text/html,x' WHERE id = '${R}'`));
check("empty link clears the field", !(await fails(`UPDATE restaurants SET tiktok_url = '' WHERE id = '${R}'`)));
check("owner cannot update another restaurant", (await db.query(`UPDATE restaurants SET description = 'hack' WHERE id = '${R2}' RETURNING id`)).rows.length === 0);
await as("authenticated", ADM);
check("admin can set is_featured and a javascript-free link", !(await fails(`UPDATE restaurants SET is_featured = true, is_top_listing = true, rating = 4.9, website_url = 'https://x.nl' WHERE id = '${R}'`)));
check("link rule also binds admin", await fails(`UPDATE restaurants SET website_url = 'ftp://x' WHERE id = '${R}'`));
await as("service_role", null);
check("service role can set paid columns", !(await fails(`UPDATE restaurants SET is_featured = false, review_count = 7, owner_tier = 'pro' WHERE id = '${R}'`)));
check("link rule also binds service role", await fails(`UPDATE restaurants SET website_url = 'javascript:x' WHERE id = '${R}'`));
// SECURITY DEFINER owner RPC keeps working for a plain owner.
await as("authenticated", OWN);
const rpc = await db.query<{ v: { website_url: string } }>(`SELECT set_restaurant_contact('${R}', '020 111 22 33', 'jouwrestaurant.nl') v`);
check("SECURITY DEFINER set_restaurant_contact still works for the owner", rpc.rows[0].v.website_url === "https://jouwrestaurant.nl", rpc.rows);
// Owner WITH CHECK: row must stay theirs (admin policy not involved).
check("owner policy WITH CHECK keeps claimed_by_owner_id", (await db.query("SELECT polwithcheck IS NOT NULL v FROM pg_policy WHERE polname = 'Owners can update their restaurants'")).rows[0].v === true);

// --- 2. paid purchases ---
await as("authenticated", OWN);
check("owner cannot insert featured_subscriptions", await fails(`INSERT INTO featured_subscriptions (restaurant_id) VALUES ('${R}')`));
check("owner cannot insert sponsored_purchases", await fails(`INSERT INTO sponsored_purchases (restaurant_id) VALUES ('${R}')`));
await as("service_role", null);
check("service role can insert both", !(await fails(`INSERT INTO featured_subscriptions (restaurant_id) VALUES ('${R}')`)) && !(await fails(`INSERT INTO sponsored_purchases (restaurant_id) VALUES ('${R}')`)));

// --- 3. reviews ---
await as("authenticated", REV);
await db.query(`INSERT INTO reviews (id, restaurant_id, user_id, rating, title, status, is_verified, owner_response) VALUES ('${id(900)}', '${R}', '${REV}', 5, 't', 'published', true, 'zelf')`);
const rv = (await db.query<{ is_verified: boolean; owner_response: string | null; status: string }>(`SELECT is_verified, owner_response, status FROM reviews WHERE id = '${id(900)}'`)).rows[0];
check("review insert cannot set is_verified or owner_response; published/flagged flow stays", !rv.is_verified && rv.owner_response === null && rv.status === "published", rv);
await db.query(`UPDATE reviews SET rating = 4, body = 'aangepast', status = 'pending', is_verified = true, owner_response = 'x' WHERE id = '${id(900)}'`);
const rv2 = (await db.query<{ rating: number; body: string; is_verified: boolean; owner_response: string | null; status: string }>(`SELECT rating, body, is_verified, owner_response, status FROM reviews WHERE id = '${id(900)}'`)).rows[0];
check("author can edit content but not status/verified/response", rv2.rating === 4 && rv2.body === "aangepast" && !rv2.is_verified && rv2.owner_response === null && rv2.status === "published", rv2);
await as("authenticated", OWN);
await db.query(`UPDATE reviews SET owner_response = 'Bedankt!', owner_response_at = now(), rating = 1, status = 'flagged', body = 'weg' WHERE id = '${id(900)}'`);
const rv3 = (await db.query<{ rating: number; body: string; owner_response: string; status: string }>(`SELECT rating, body, owner_response, status FROM reviews WHERE id = '${id(900)}'`)).rows[0];
check("restaurant owner can set owner_response but not rating/status/body", rv3.owner_response === "Bedankt!" && rv3.rating === 4 && rv3.status === "published" && rv3.body === "aangepast", rv3);
await as("authenticated", MOD);
await db.query(`UPDATE reviews SET status = 'flagged' WHERE id = '${id(900)}'`);
check("moderator can still change review status", (await one<string>(`SELECT status v FROM reviews WHERE id = '${id(900)}'`)) === "flagged");
await as("service_role", null);
await db.query(`UPDATE reviews SET is_verified = true WHERE id = '${id(900)}'`);
check("service role can set is_verified", (await one<boolean>(`SELECT is_verified v FROM reviews WHERE id = '${id(900)}'`)) === true);

// --- 4. claims ---
await as("authenticated", OWN);
await db.query(`INSERT INTO restaurant_claims (id, restaurant_id, user_id, status, is_primary, email_verified, email_verified_at, phone_verified, admin_notes, reviewed_by, verification_completed_at)
  VALUES ('${id(910)}', '${R}', '${OWN}', 'verified', true, true, now(), true, 'ok', '${ADM}', now())`);
const cl = (await db.query<Record<string, unknown>>(`SELECT status, is_primary, email_verified, phone_verified, admin_notes, reviewed_by, verification_completed_at FROM restaurant_claims WHERE id = '${id(910)}'`)).rows[0];
check("user cannot insert a verified claim", cl.status === "pending" && cl.is_primary === false && cl.phone_verified === false && cl.admin_notes === null && cl.reviewed_by === null && cl.verification_completed_at === null, cl);
check("email_verified from a confirmed Auth email is kept (createClaim flow)", cl.email_verified === true, cl);
await as("authenticated", OTHER);
await db.query(`INSERT INTO restaurant_claims (id, restaurant_id, user_id, email_verified) VALUES ('${id(911)}', '${R2}', '${OTHER}', true)`);
check("email_verified is dropped when Auth did not confirm the email", (await one<boolean>(`SELECT email_verified v FROM restaurant_claims WHERE id = '${id(911)}'`)) === false);
await db.query(`UPDATE restaurant_claims SET status = 'phone_verified', phone_verified = true, is_primary = true, verification_method = 'email' WHERE id = '${id(911)}'`);
const cl2 = (await db.query<Record<string, unknown>>(`SELECT status, phone_verified, is_primary, verification_method FROM restaurant_claims WHERE id = '${id(911)}'`)).rows[0];
check("user update cannot self-verify but can start a method", cl2.status === "pending" && cl2.phone_verified === false && cl2.is_primary === false && cl2.verification_method === "email", cl2);
await db.query(`INSERT INTO claim_requests (id, restaurant_id, user_id, status, admin_notes, reviewed_by) VALUES ('${id(920)}', '${R2}', '${OTHER}', 'approved', 'x', '${ADM}')`);
const cr = (await db.query<Record<string, unknown>>(`SELECT status, admin_notes, reviewed_by FROM claim_requests WHERE id = '${id(920)}'`)).rows[0];
check("user cannot insert an approved claim_request", cr.status === "pending" && cr.admin_notes === null && cr.reviewed_by === null, cr);
await as("authenticated", ADM);
await db.query(`UPDATE claim_requests SET status = 'approved', admin_notes = 'ok', reviewed_by = '${ADM}' WHERE id = '${id(920)}'`);
await db.query(`UPDATE restaurant_claims SET status = 'verified', phone_verified = true WHERE id = '${id(911)}'`);
check("admin can approve claims", (await one<string>(`SELECT status v FROM claim_requests WHERE id = '${id(920)}'`)) === "approved" && (await one<string>(`SELECT status v FROM restaurant_claims WHERE id = '${id(911)}'`)) === "verified");

// --- 5. loyalty stamps ---
await as("authenticated", OTHER);
check("customer cannot mint own stamp", await fails(`INSERT INTO loyalty_stamps (restaurant_id, user_id) VALUES ('${R}', '${OTHER}')`));
await as("authenticated", OWN);
check("owner can issue a stamp for own restaurant", !(await fails(`INSERT INTO loyalty_stamps (restaurant_id, user_id) VALUES ('${R}', '${OTHER}')`)));
check("owner cannot issue a stamp for another restaurant", await fails(`INSERT INTO loyalty_stamps (restaurant_id, user_id) VALUES ('${R2}', '${OTHER}')`));

// --- 6. claim_activity_logs ---
await as("authenticated", OWN);
check("user can log own claim activity", !(await fails(`INSERT INTO claim_activity_logs (actor_id, actor_role, claim_id, action_type, action_category) VALUES ('${OWN}', 'user', '${id(910)}', 'CLAIM_INITIATED', 'claim')`)));
check("user cannot log as admin", await fails(`INSERT INTO claim_activity_logs (actor_id, actor_role, action_type, action_category) VALUES ('${OWN}', 'admin', 'X', 'claim')`));
check("user cannot log payment/admin categories", await fails(`INSERT INTO claim_activity_logs (actor_id, actor_role, action_type, action_category) VALUES ('${OWN}', 'user', 'X', 'payment')`));
check("user cannot log on someone else's claim", await fails(`INSERT INTO claim_activity_logs (actor_id, actor_role, claim_id, action_type, action_category) VALUES ('${OWN}', 'user', '${id(911)}', 'X', 'claim')`));
check("user cannot log as another actor", await fails(`INSERT INTO claim_activity_logs (actor_id, actor_role, action_type, action_category) VALUES ('${OTHER}', 'user', 'X', 'claim')`));
await as("authenticated", ADM);
check("admin can log admin actions", !(await fails(`INSERT INTO claim_activity_logs (actor_id, actor_role, action_type, action_category) VALUES ('${ADM}', 'admin', 'APPROVED', 'admin')`)));

// --- 7 + 9. internal functions ---
await sup();
const canRun = async (r: string, f: string) => (await one<boolean>(`SELECT has_function_privilege('${r}', '${f}', 'EXECUTE') v`)) === true;
for (const f of ["public.check_and_log_rate_limit(text,text,int,int)", "public.cleanup_rate_limit_log()", "public.sync_owner_pro_restaurants(uuid)", "public.purge_old_integration_events()"]) {
  check(`${f}: authenticated and anon cannot execute`, !(await canRun("authenticated", f)) && !(await canRun("anon", f)));
  check(`${f}: service_role can execute`, await canRun("service_role", f));
}

// --- 8. promo codes ---
const PC_OK = id(930), PC_OFF = id(931), PC_OLD = id(932), PC_ONE = id(933);
await db.exec(`INSERT INTO promo_codes (id, restaurant_id, code, max_uses, valid_until, is_active) VALUES
  ('${PC_OK}', '${R}', 'OK', NULL, now() + interval '1 day', true), ('${PC_OFF}', '${R}', 'OFF', NULL, NULL, false),
  ('${PC_OLD}', '${R}', 'OLD', NULL, now() - interval '1 day', true), ('${PC_ONE}', '${R}', 'ONE', 1, NULL, true)`);
await as("authenticated", OTHER);
check("valid promo code can be redeemed", !(await fails(`INSERT INTO promo_code_redemptions (promo_code_id, user_id) VALUES ('${PC_OK}', '${OTHER}')`)));
check("inactive promo code is rejected", await fails(`INSERT INTO promo_code_redemptions (promo_code_id, user_id) VALUES ('${PC_OFF}', '${OTHER}')`));
check("expired promo code is rejected", await fails(`INSERT INTO promo_code_redemptions (promo_code_id, user_id) VALUES ('${PC_OLD}', '${OTHER}')`));
check("unknown promo code is rejected", await fails(`INSERT INTO promo_code_redemptions (promo_code_id, user_id) VALUES ('${id(999)}', '${OTHER}')`));
check("redeeming for another user is rejected", await fails(`INSERT INTO promo_code_redemptions (promo_code_id, user_id) VALUES ('${PC_OK}', '${OWN}')`));
check("usage limit is enforced", !(await fails(`INSERT INTO promo_code_redemptions (promo_code_id, user_id) VALUES ('${PC_ONE}', '${OTHER}')`))
  && await fails(`INSERT INTO promo_code_redemptions (promo_code_id, user_id) VALUES ('${PC_ONE}', '${OTHER}')`));
await as("anon", null);
check("anonymous redemption is no longer possible", await fails(`INSERT INTO promo_code_redemptions (promo_code_id, user_id) VALUES ('${PC_OK}', NULL)`));

// --- 10. restaurant_dishes ---
const DISH = id(950);
await as("authenticated", OWN);
await db.query(`INSERT INTO restaurant_dishes (id, restaurant_id, dish_id, status, verified_by, verified_at, source, confidence_score, created_by, approved_by, screen_score, tier)
  VALUES ('${DISH}', '${R}', '${id(951)}', 'verified_by_owner', '${OWN}', now(), 'owner', 1, '${OWN}', '${ADM}', 1, 'gold')`);
const d = (await db.query<Record<string, unknown>>(`SELECT status, verified_by, approved_by, screen_score, tier, confidence_score FROM restaurant_dishes WHERE id = '${DISH}'`)).rows[0];
check("owner dish insert keeps verified_by_owner + own verified_by, drops moderation fields", d.status === "verified_by_owner" && d.verified_by === OWN
  && d.approved_by === null && d.screen_score === null && d.tier === null && Number(d.confidence_score) <= 0.5, d);
await db.query(`INSERT INTO restaurant_dishes (id, restaurant_id, dish_id, status, source, confidence_score) VALUES ('${id(952)}', '${R}', '${id(953)}', 'approved_by_admin', 'owner_csv', 0.95)`);
check("CSV upload: approved_by_admin from an owner becomes verified_by_owner", (await one<string>(`SELECT status v FROM restaurant_dishes WHERE id = '${id(952)}'`)) === "verified_by_owner");
await db.query(`UPDATE restaurant_dishes SET status = 'suggested', approved_by = '${ADM}', screen_score = 9, tier = 'x', confidence_score = 1, verified_by = '${ADM}' WHERE id = '${DISH}'`);
const d2 = (await db.query<Record<string, unknown>>(`SELECT status, verified_by, approved_by, screen_score, tier FROM restaurant_dishes WHERE id = '${DISH}'`)).rows[0];
check("owner update cannot set moderation fields or someone else's verified_by", d2.approved_by === null && d2.screen_score === null && d2.tier === null && d2.verified_by === OWN, d2);
await db.query(`UPDATE restaurant_dishes SET status = 'verified_by_owner', verified_by = '${OWN}', verified_at = now() WHERE id = '${DISH}'`);
check("owner can still confirm a dish", (await one<string>(`SELECT status v FROM restaurant_dishes WHERE id = '${DISH}'`)) === "verified_by_owner");
await as("authenticated", ADM);
await db.query(`UPDATE restaurant_dishes SET status = 'approved_by_admin', approved_by = '${ADM}', screen_score = 0.9, tier = 'a' WHERE id = '${DISH}'`);
const d3 = (await db.query<Record<string, unknown>>(`SELECT status, approved_by, tier FROM restaurant_dishes WHERE id = '${DISH}'`)).rows[0];
check("admin can approve and screen dishes", d3.status === "approved_by_admin" && d3.approved_by === ADM && d3.tier === "a", d3);

// --- idempotency ---
await sup();
await db.exec(sql);
check("migration runs a third time", true);
check("exactly one guard trigger per table", (await one<number>(`SELECT count(*)::int v FROM pg_trigger WHERE tgname IN ('guard_restaurant_owner_update','guard_review_write','guard_restaurant_claim_write','guard_claim_request_write','guard_restaurant_dish_write','validate_promo_redemption')`)) === 6);

console.log(ok ? "ALL PASS" : "SOME FAILED");
if (!ok) Deno.exit(1);
