import { PGlite } from "npm:@electric-sql/pglite@0.2.17";
// Runs the outreach migration in PGlite on top of stubs and checks segments, mail status,
// the claimable lookup, the auto-unhide trigger at the menu minimum and the unsubscribe RPC.
// Usage from the repo root: deno run -A --config supabase/tests/deno.json supabase/tests/outreach-sql.ts
const repo = Deno.args[0] ?? ".";
const db = new PGlite();
await db.exec(await Deno.readTextFile(new URL("./stubs.sql", import.meta.url)));
await db.exec(`
  ALTER TABLE restaurants ADD COLUMN claim_status text DEFAULT 'unclaimed', ADD COLUMN updated_at timestamptz;
  ALTER TABLE restaurant_dishes ADD COLUMN course_type text;
  CREATE TABLE restaurants_verborgen (id uuid PRIMARY KEY, reden text, hidden_at timestamptz DEFAULT now(), was_active boolean);
  CREATE TABLE restaurant_contacts (restaurant_id uuid PRIMARY KEY, email text, email_kwaliteit text, email_bron text,
    rechtsvorm text, kvk text, instagram text, facebook text, telefoon_site text, status text, mail_golf int,
    laatst_gemaild_op timestamptz, afgemeld_op timestamptz, afmeld_token text, updated_at timestamptz);
  CREATE TABLE restaurant_optout_requests (id serial, restaurant_id uuid, email text);
  ALTER TABLE restaurants ADD COLUMN address text, ADD COLUMN phone text, ADD COLUMN website_url text;
  CREATE SCHEMA storage;
  CREATE TABLE storage.buckets (id text PRIMARY KEY, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
  CREATE TABLE storage.objects (id serial, bucket_id text, name text);
`);
const migration = (await Deno.readTextFile(`${repo}/supabase/migrations/20261112150000_outreach_agent.sql`))
  .replace(/WITH \(security_invoker = true\)/, ""); // PGlite 0.2 predates security_invoker views
await db.exec(migration);
console.log("migrated outreach_agent");

const C = "00000000-0000-0000-0000-0000000000c1";
const R = (i: number) => `00000000-0000-0000-0000-0000000002${String(i).padStart(2, "0")}`;
const D = (i: number) => `00000000-0000-0000-0000-0000000003${String(i).padStart(2, "0")}`;
await db.exec(`
  INSERT INTO restaurants (id, name, slug, city_id, is_active, claimed_by_owner_id, claim_status) VALUES
    ('${R(1)}', 'Zichtbaar BV', 'zichtbaar', '${C}', true, NULL, 'unclaimed'),
    ('${R(2)}', 'Verborgen menu', 'verborgen-menu', '${C}', false, NULL, 'unclaimed'),
    ('${R(3)}', 'Gesloten', 'gesloten', '${C}', false, NULL, 'unclaimed'),
    ('${R(4)}', 'Geen mail', 'geen-mail', '${C}', true, NULL, 'unclaimed'),
    ('${R(5)}', 'Afgemeld', 'afgemeld', '${C}', true, NULL, 'unclaimed'),
    ('${R(6)}', 'Eenmanszaak', 'eenmanszaak', '${C}', true, NULL, 'unclaimed'),
    ('${R(7)}', 'Geclaimd', 'geclaimd', '${C}', true, '00000000-0000-0000-0000-0000000000a1', 'verified_owner'),
    ('${R(8)}', 'Verborgen maar vol', 'verborgen-vol', '${C}', false, NULL, 'unclaimed');
  INSERT INTO restaurants_verborgen (id, reden) VALUES ('${R(2)}', 'te weinig gerechten op menu'), ('${R(3)}', 'permanent gesloten'), ('${R(8)}', NULL);
  INSERT INTO restaurant_contacts (restaurant_id, email, rechtsvorm, afgemeld_op, afmeld_token) VALUES
    ('${R(1)}', 'info@zichtbaar.nl', 'Besloten Vennootschap', NULL, 'tok-zichtbaar-0000000001'),
    ('${R(2)}', 'info@verborgen.nl', 'BV', NULL, NULL),
    ('${R(3)}', 'info@gesloten.nl', 'BV', NULL, NULL),
    ('${R(4)}', NULL, 'BV', NULL, NULL),
    ('${R(5)}', 'info@afgemeld.nl', 'BV', now(), NULL),
    ('${R(6)}', 'jan@eenmanszaak.nl', 'Eenmanszaak', NULL, NULL),
    ('${R(7)}', 'info@geclaimd.nl', 'BV', NULL, NULL),
    ('${R(8)}', 'info@vol.nl', 'BV', NULL, NULL);
  INSERT INTO dishes (id, name, slug) SELECT ('00000000-0000-0000-0000-0000000003' || lpad(g::text, 2, '0'))::uuid, 'Dish ' || g, 'dish-' || g FROM generate_series(1, 20) g;
  INSERT INTO restaurant_dishes (restaurant_id, dish_id, status, course_type) VALUES
    ('${R(1)}', '${D(1)}', 'approved_by_admin', NULL),
    ('${R(2)}', '${D(1)}', 'approved_by_admin', NULL), ('${R(2)}', '${D(2)}', 'approved_by_admin', 'drank');
`);
// R(8) is hidden without reason but already has 6 food dishes; insert with the trigger off-path by
// adding them before it is hidden would be realistic, here we add them and re-hide to simulate legacy data.
await db.exec(`
  INSERT INTO restaurant_dishes (restaurant_id, dish_id, status) SELECT '${R(8)}', ('00000000-0000-0000-0000-0000000003' || lpad(g::text, 2, '0'))::uuid, 'approved_by_admin' FROM generate_series(10, 15) g;
  UPDATE restaurants SET is_active = false WHERE id = '${R(8)}';
  INSERT INTO restaurants_verborgen (id, reden) VALUES ('${R(8)}', NULL) ON CONFLICT DO NOTHING;
`);

let ok = true;
const check = (label: string, pass: boolean, got?: unknown) => { ok &&= pass; console.log(pass ? "PASS" : "FAIL", label, pass ? "" : JSON.stringify(got)); };
const rows = (await db.query<{ name: string; segment: string; mail_status: string; goedgekeurde_gerechten: number }>(
  "SELECT name, segment, mail_status, goedgekeurde_gerechten FROM outreach_targets ORDER BY name")).rows;
const by = Object.fromEntries(rows.map((r) => [r.name, r]));
check("active restaurant is zichtbaar and mailbaar", by["Zichtbaar BV"].segment === "zichtbaar" && by["Zichtbaar BV"].mail_status === "mailbaar", by["Zichtbaar BV"]);
check("hidden for menu below minimum is onzichtbaar_menu", by["Verborgen menu"].segment === "onzichtbaar_menu" && by["Verborgen menu"].mail_status === "mailbaar", by["Verborgen menu"]);
check("drinks are not counted", by["Verborgen menu"].goedgekeurde_gerechten === 1, by["Verborgen menu"]);
check("hidden for another reason is uitgesloten", by["Gesloten"].segment === "uitgesloten" && by["Gesloten"].mail_status === "uitgesloten", by["Gesloten"]);
check("hidden but already at the minimum is uitgesloten", by["Verborgen maar vol"].segment === "uitgesloten", by["Verborgen maar vol"]);
check("no email", by["Geen mail"].mail_status === "geen_email", by["Geen mail"]);
check("unsubscribed", by["Afgemeld"].mail_status === "afgemeld", by["Afgemeld"]);
check("sole trader skipped by default", by["Eenmanszaak"].mail_status === "natuurlijk_persoon", by["Eenmanszaak"]);
check("claimed restaurant not mailed", by["Geclaimd"].mail_status === "al_geclaimd", by["Geclaimd"]);

const claimable = async (slug: string) => (await db.query<{ name: string; menu_count: number; menu_minimum: number }>("SELECT * FROM claimable_restaurant($1)", [slug])).rows[0];
const hidden = await claimable("verborgen-menu");
check("hidden-for-menu restaurant is claimable with counts", hidden?.menu_count === 1 && hidden?.menu_minimum === 5, hidden);
check("closed restaurant is not claimable", !(await claimable("gesloten")));
check("active restaurant is claimable", !!(await claimable("zichtbaar")));

// Trigger: add food dishes until the minimum; a drink must not count.
await db.exec(`INSERT INTO restaurant_dishes (restaurant_id, dish_id, status, course_type) VALUES ('${R(2)}', '${D(3)}', 'approved_by_admin', 'drank')`);
await db.exec(`INSERT INTO restaurant_dishes (restaurant_id, dish_id, status) VALUES ('${R(2)}', '${D(4)}', 'approved_by_admin'), ('${R(2)}', '${D(5)}', 'approved_by_admin'), ('${R(2)}', '${D(6)}', 'pending')`);
let st = (await db.query<{ is_active: boolean }>(`SELECT is_active FROM restaurants WHERE id = '${R(2)}'`)).rows[0];
check("still hidden at 3 food dishes (drinks and pending excluded)", st.is_active === false, st);
await db.exec(`UPDATE restaurant_dishes SET status = 'verified_by_owner' WHERE restaurant_id = '${R(2)}' AND dish_id = '${D(6)}'`);
await db.exec(`INSERT INTO restaurant_dishes (restaurant_id, dish_id, status) VALUES ('${R(2)}', '${D(7)}', 'approved_by_admin')`);
st = (await db.query<{ is_active: boolean }>(`SELECT is_active FROM restaurants WHERE id = '${R(2)}'`)).rows[0];
const stillListed = (await db.query(`SELECT 1 FROM restaurants_verborgen WHERE id = '${R(2)}'`)).rows.length;
check("goes live at 5 food dishes and leaves restaurants_verborgen", st.is_active === true && stillListed === 0, { st, stillListed });
st = (await db.query<{ is_active: boolean }>(`SELECT is_active FROM restaurants WHERE id = '${R(3)}'`)).rows[0];
await db.exec(`INSERT INTO restaurant_dishes (restaurant_id, dish_id, status) SELECT '${R(3)}', ('00000000-0000-0000-0000-0000000003' || lpad(g::text, 2, '0'))::uuid, 'approved_by_admin' FROM generate_series(1, 6) g`);
st = (await db.query<{ is_active: boolean }>(`SELECT is_active FROM restaurants WHERE id = '${R(3)}'`)).rows[0];
check("closed restaurant never goes live by itself", st.is_active === false, st);

const name = (await db.query<{ n: string }>("SELECT outreach_unsubscribe('tok-zichtbaar-0000000001') AS n")).rows[0].n;
const after = (await db.query<{ mail_status: string }>(`SELECT mail_status FROM outreach_targets WHERE restaurant_id = '${R(1)}'`)).rows[0];
check("unsubscribe by token", name === "Zichtbaar BV" && after.mail_status === "afgemeld", { name, after });
check("short token rejected", (await db.query<{ n: string | null }>("SELECT outreach_unsubscribe('kort') AS n")).rows[0].n === null);
Deno.exit(ok ? 0 : 1);
