import { PGlite } from "npm:@electric-sql/pglite@0.2.17";
import { isMinorNameChange, isRealDishName } from "../functions/_shared/textCheck.ts";
// admin_digest counts every admin queue; apply_pending_edit applies or rejects an owner's change and
// only admins (or the service role) may call it. Plus the pure name checks used by admin-automation.
// Usage from the repo root: deno run -A --config supabase/tests/deno.json supabase/tests/admin-automation-sql.ts
const repo = Deno.args[0] ?? ".";
const db = new PGlite();
await db.exec(await Deno.readTextFile(new URL("./stubs.sql", import.meta.url)));
await db.exec(`CREATE TYPE app_role AS ENUM ('admin', 'owner', 'user');
  DROP FUNCTION has_role(uuid, text);
  CREATE FUNCTION public.has_role(_user_id uuid, _role app_role) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role::text) $$;
  ALTER TABLE restaurants ADD COLUMN updated_at timestamptz;
  ALTER TABLE restaurant_dishes ADD COLUMN created_at timestamptz DEFAULT now();
  CREATE TABLE restaurant_translations (restaurant_id uuid, language_code text, description text, updated_at timestamptz, UNIQUE (restaurant_id, language_code));
  CREATE TABLE restaurant_pending_edits (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), restaurant_id uuid, submitted_by uuid, proposed_changes jsonb,
    status text DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','auto_applied')), reviewed_by uuid, reviewed_at timestamptz,
    review_notes text, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());
  ALTER TABLE restaurant_pending_edits ENABLE ROW LEVEL SECURITY;
  CREATE TABLE restaurant_claims (status text, created_at timestamptz DEFAULT now());
  CREATE TABLE claim_requests (status text, created_at timestamptz DEFAULT now());
  CREATE TABLE contact_messages (status text, created_at timestamptz DEFAULT now());
  CREATE TABLE support_conversations (escalated boolean, resolved_at timestamptz, created_at timestamptz DEFAULT now());
  CREATE TABLE outreach_replies (status text, received_at timestamptz DEFAULT now());
  CREATE TABLE newsletter_placements (status text, created_at timestamptz DEFAULT now());
  CREATE TABLE package_orders (package text, fulfillment_status text, created_at timestamptz DEFAULT now());
  CREATE TABLE restaurant_tag_requests (status text, created_at timestamptz DEFAULT now());
  CREATE TABLE restaurant_suggestions (status text, created_at timestamptz DEFAULT now());
  GRANT SELECT ON test_ctx, user_roles TO anon, authenticated; GRANT USAGE ON SCHEMA auth TO anon, authenticated;
  GRANT SELECT ON restaurant_pending_edits TO authenticated;`);
const sql = await Deno.readTextFile(`${repo}/supabase/migrations/20261115160000_admin_automation.sql`);
await db.exec(sql); await db.exec(sql);

const R = "00000000-0000-0000-0000-0000000000r1".replace("r", "e"), A = "00000000-0000-0000-0000-0000000000a1", O = "00000000-0000-0000-0000-0000000000b1";
await db.exec(`INSERT INTO user_roles VALUES ('${A}', 'admin');
  INSERT INTO restaurants (id, name, slug) VALUES ('${R}', 'Bella Napoli', 'bella-napoli');
  INSERT INTO restaurant_claims (status, created_at) VALUES ('pending', now() - interval '3 days'), ('approved', now());
  INSERT INTO claim_requests (status) VALUES ('pending');
  INSERT INTO contact_messages (status) VALUES ('nieuw'), ('afgehandeld');
  INSERT INTO support_conversations (escalated, resolved_at) VALUES (true, NULL), (true, now()), (false, NULL);
  INSERT INTO outreach_replies (status) VALUES ('te_beoordelen');
  INSERT INTO newsletter_placements (status) VALUES ('paid'), ('approved');
  INSERT INTO package_orders (package, fulfillment_status) VALUES ('menu_service', 'todo'), ('menu_service', 'done'), ('uitgelicht', 'todo');
  INSERT INTO restaurant_tag_requests (status) VALUES ('pending');
  INSERT INTO restaurant_suggestions (status) VALUES ('pending');
  INSERT INTO reviews (status) VALUES ('flagged'), ('approved');
  INSERT INTO restaurant_dishes (status) VALUES ('suggested'), ('suggested'), ('approved_by_admin');
  INSERT INTO restaurant_pending_edits (id, restaurant_id, submitted_by, proposed_changes) VALUES
    ('00000000-0000-0000-0000-000000000e01', '${R}', '${O}', '{"name":"Bella Napoli Pizzeria","description_nl":"Echte Napolitaanse pizza."}'),
    ('00000000-0000-0000-0000-000000000e02', '${R}', '${O}', '{"description_nl":"Onzin"}'),
    ('00000000-0000-0000-0000-000000000e03', '${R}', '${O}', '{"description_nl":"Poging van eigenaar"}');`);

let ok = true;
const check = (l: string, p: boolean, g?: unknown) => { ok &&= p; console.log(p ? "PASS" : "FAIL", l, p ? "" : JSON.stringify(g)); };
const dig = Object.fromEntries((await db.query<{ key: string; open_count: number; new_24h: number; section: string }>("SELECT * FROM admin_digest()")).rows.map(r => [r.key, r]));
const expect: Record<string, number> = { claims: 2, edits: 3, contact: 1, support: 1, outreach: 1, newsletter: 1, menu_service: 1, tags: 1, suggestions: 1, reviews: 1, dishes: 2 };
for (const [k, n] of Object.entries(expect)) check(`digest ${k} = ${n}`, dig[k]?.open_count === n, dig[k]);
check("digest: the 3 day old claim is not new", dig.claims.new_24h === 1, dig.claims);
check("digest links menu service to package-orders", dig.menu_service.section === "package-orders");

const as = async (role: string, uid: string | null) => { await db.exec(`RESET ROLE; DELETE FROM test_ctx; INSERT INTO test_ctx VALUES (${uid ? `'${uid}'` : "NULL"}, '${role}'); SET ROLE ${role};`); };
await db.exec("GRANT EXECUTE ON FUNCTION apply_pending_edit(uuid, text, text) TO authenticated");
await as("authenticated", O);
let blocked = false;
try { await db.query("SELECT apply_pending_edit('00000000-0000-0000-0000-000000000e03', 'approved', NULL)"); } catch { blocked = true; }
check("an owner cannot approve their own change", blocked);
let digBlocked = false;
try { await db.query("SELECT * FROM admin_digest()"); } catch { digBlocked = true; }
check("admin_digest is not callable from the app", digBlocked);
await as("authenticated", A);
check("admin reads all pending edits", (await db.query("SELECT id FROM restaurant_pending_edits")).rows.length === 3);
await db.query("SELECT apply_pending_edit('00000000-0000-0000-0000-000000000e01', 'approved', NULL)");
await db.query("SELECT apply_pending_edit('00000000-0000-0000-0000-000000000e02', 'rejected', 'Te kort')");
await db.exec("RESET ROLE");
const r = (await db.query<{ name: string }>(`SELECT name FROM restaurants WHERE id = '${R}'`)).rows[0];
check("approved: name applied", r.name === "Bella Napoli Pizzeria", r);
const t = (await db.query<{ description: string }>(`SELECT description FROM restaurant_translations WHERE restaurant_id = '${R}' AND language_code = 'nl'`)).rows;
check("approved: description applied once", t.length === 1 && t[0].description === "Echte Napolitaanse pizza.", t);
const st = Object.fromEntries((await db.query<{ id: string; status: string; review_notes: string | null }>("SELECT id, status, review_notes FROM restaurant_pending_edits")).rows.map(x => [x.id.slice(-3), x]));
check("statuses set", st.e01.status === "approved" && st.e02.status === "rejected" && st.e02.review_notes === "Te kort", st);
// service role (automation): auth.uid() is null
await db.exec("DELETE FROM test_ctx; INSERT INTO test_ctx VALUES (NULL, 'service_role')");
await db.query("SELECT apply_pending_edit('00000000-0000-0000-0000-000000000e03', 'auto_applied', 'Automatisch')");
check("automation can apply", (await db.query<{ description: string }>(`SELECT description FROM restaurant_translations`)).rows[0].description === "Poging van eigenaar");
let twice = false;
try { await db.query("SELECT apply_pending_edit('00000000-0000-0000-0000-000000000e03', 'approved', NULL)"); } catch { twice = true; }
check("a processed change cannot be applied again", twice);
check("digest after: no edits open", !(await db.query<{ key: string }>("SELECT key FROM admin_digest()")).rows.some(x => x.key === "edits"));

// pure checks
check("minor name: case/accents", isMinorNameChange("Cafe de Paris", "Café De Paris"));
check("minor name: 'Restaurant' prefix", isMinorNameChange("Sakura", "Restaurant Sakura"));
check("minor name: one typo", isMinorNameChange("Bella Napolli", "Bella Napoli"));
check("not minor: different name", !isMinorNameChange("Bella Napoli", "Sushi Palace"));
check("not minor: empty", !isMinorNameChange("Bella Napoli", "Restaurant"));
check("dish ok: Pad thai", isRealDishName("Pad thai"));
check("dish junk: price glued", !isRealDishName("Pizza12"));
check("dish junk: trailing dash", !isRealDishName("Pizza -"));
Deno.exit(ok ? 0 : 1);
