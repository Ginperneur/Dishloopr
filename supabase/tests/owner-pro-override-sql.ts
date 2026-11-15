import { PGlite } from 'npm:@electric-sql/pglite@0.2.17';

// deno run -A --config supabase/tests/deno.json supabase/tests/owner-pro-override-sql.ts
const db = new PGlite();
await db.exec(await Deno.readTextFile(new URL('./stubs.sql', import.meta.url)));
await db.exec(`
  CREATE TYPE public.app_role AS ENUM ('admin','user','owner');
  CREATE FUNCTION public.has_role(uuid, public.app_role) RETURNS boolean LANGUAGE sql STABLE
    AS $$ SELECT public.has_role($1, $2::text) $$;
  CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT jsonb_build_object('role', auth.role()) $$;
  CREATE TABLE public.restaurant_managers (restaurant_id uuid, user_id uuid, accepted_at timestamptz);
  CREATE TABLE public.owner_pro_subscriptions (user_id uuid, status text, current_period_end timestamptz);
  CREATE FUNCTION public.is_owner_pro(uuid) RETURNS boolean LANGUAGE sql STABLE AS $$
    SELECT EXISTS (SELECT 1 FROM owner_pro_subscriptions WHERE user_id=$1 AND status='active'
      AND (current_period_end IS NULL OR current_period_end > now())) $$;
`);
await db.exec(await Deno.readTextFile('drizzle/migrations/0037_admin_restaurant_owner_pro_override.sql'));
await db.exec(`CREATE TRIGGER protect_restaurant_owner_tier BEFORE UPDATE ON public.restaurants
  FOR EACH ROW EXECUTE FUNCTION public.protect_restaurant_owner_tier();`);
const admin = '00000000-0000-0000-0000-0000000000a2';
const owner = '00000000-0000-0000-0000-0000000000a1';
const r = '00000000-0000-0000-0000-000000000101';
await db.exec(`INSERT INTO user_roles VALUES ('${admin}', 'admin');
  INSERT INTO restaurants (id, claimed_by_owner_id) VALUES ('${r}','${owner}');
  INSERT INTO restaurant_managers VALUES ('${r}','${owner}',now());`);
const as = (uid: string | null, role = 'authenticated') => db.query('UPDATE test_ctx SET uid=$1, role=$2', [uid, role]);
const set = (enabled: boolean) => db.query('SELECT admin_set_restaurant_owner_pro($1,$2) AS tier',[r,enabled]);
const row = async () => (await db.query<{ owner_tier: string; owner_pro_override: boolean }>('SELECT owner_tier, owner_pro_override FROM restaurants WHERE id=$1',[r])).rows[0];
let failures = 0;
const check = (name: string, pass: boolean) => { console.log(pass ? 'PASS' : 'FAIL',name); if (!pass) failures++; };
const denied = async () => { try { await set(true); return false; } catch (e) { return String(e).includes('Not authorized'); } };
await as(null,'anon');
check('signed-out cannot grant Pro',await denied());
await as(owner);
check('owner cannot grant Pro',await denied());
await db.query('UPDATE restaurants SET owner_pro_override=true, owner_tier=\'pro\' WHERE id=$1',[r]);
check('direct owner update cannot grant Pro',(await row()).owner_tier==='basic' && !(await row()).owner_pro_override);
await as(admin);
await set(true);
check('admin can grant free Pro',(await row()).owner_tier==='pro' && (await row()).owner_pro_override);
await as(null,'service_role');
await db.query('SELECT sync_owner_pro_restaurants($1)',[owner]);
check('Stripe sync without a paid subscription preserves free Pro',(await row()).owner_tier==='pro');
await as(admin);
await set(false);
check('admin can revoke free Pro',(await row()).owner_tier==='basic' && !(await row()).owner_pro_override);
await db.query("INSERT INTO owner_pro_subscriptions VALUES ($1,'active',now()+interval '1 month')",[owner]);
await set(true);
await set(false);
check('revocation preserves a paid Pro subscription',(await row()).owner_tier==='pro' && !(await row()).owner_pro_override);
await db.close();
Deno.exit(failures ? 1 : 0);