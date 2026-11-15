import { PGlite } from "npm:@electric-sql/pglite@0.2.17";
// Checks the Uitgelicht dish list: only dishes on the list and pages with >= 6 restaurants can be
// sold; snacks like kaastengels and small pages cannot; bids follow the same rule.
// Usage from the repo root: deno run -A --config supabase/tests/deno.json supabase/tests/uitgelicht-dish-list-sql.ts
const repo = Deno.args[0] ?? ".";
const db = new PGlite();
await db.exec(await Deno.readTextFile(new URL("./stubs.sql", import.meta.url)));
await db.exec(`ALTER TABLE seo_landing_pages ADD COLUMN city_id uuid, ADD COLUMN is_active boolean DEFAULT true;
  ALTER TABLE dishes ADD COLUMN dish_group text;
  CREATE TABLE package_orders (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), restaurant_id uuid, user_id uuid, package text,
    plan text, page_slug text, status text, amount_cents int, stripe_subscription_id text, current_period_end timestamptz,
    created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());
  CREATE FUNCTION founding_partner_live(p_status text) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$ SELECT p_status IN ('active','trialing','past_due') $$;`);
for (const f of ["20261114130000_promo_slots", "20261114140000_uitgelicht_auction", "20261115110000_uitgelicht_offers", "20261115140000_uitgelicht_dish_list"]) {
  const sql = await Deno.readTextFile(`${repo}/supabase/migrations/${f}.sql`);
  await db.exec(sql); if (f.endsWith("dish_list")) await db.exec(sql);
}
let ok = true;
const check = (l: string, p: boolean, g?: unknown) => { ok &&= p; console.log(p ? "PASS" : "FAIL", l, p ? "" : JSON.stringify(g)); };
const id = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const C = id(1);
await db.exec(`INSERT INTO cities VALUES ('${C}', 'Utrecht');
  INSERT INTO dishes (id, name, slug, canonical_slug) VALUES ('${id(10)}', 'Carbonara', 'carbonara', 'carbonara'),
    ('${id(11)}', 'Kaastengels', 'kaastengels', 'kaastengels'), ('${id(12)}', 'Mosselen', 'mosselen', 'mosselen');
  INSERT INTO seo_landing_pages (slug, dish_id, city_id) VALUES ('carbonara-utrecht', '${id(10)}', '${C}'),
    ('kaastengels-utrecht', '${id(11)}', '${C}'), ('mosselen-utrecht', '${id(12)}', '${C}');`);
let n = 200;
const serve = async (dish: string, count: number) => { for (let i = 0; i < count; i++) { const r = id(n++);
  await db.exec(`INSERT INTO restaurants (id, name, slug, city_id, claimed_by_owner_id) VALUES ('${r}', 'R', 'r${r.slice(-4)}', '${C}', '${id(100)}');
    INSERT INTO restaurant_dishes (restaurant_id, dish_id, status) VALUES ('${r}', '${dish}', 'approved_by_admin');`); } };
await serve(id(10), 7); await serve(id(11), 9); await serve(id(12), 4);
const el = async (s: string) => (await db.query<{ e: boolean }>("SELECT uitgelicht_page_eligible($1) e", [s])).rows[0].e;
check("carbonara (on the list, 7 restaurants) is for sale", await el("carbonara-utrecht"));
check("kaastengels (not on the list) is not, even with 9 restaurants", !(await el("kaastengels-utrecht")));
check("mosselen (on the list, only 4 restaurants) is not", !(await el("mosselen-utrecht")));
check("street food not on the starting list", (await db.query("SELECT 1 FROM uitgelicht_dishes WHERE dish_slug IN ('shoarma','kebab','tacos','falafel','gyros','doner','kapsalon','burrito','souvlaki')")).rows.length === 0);
await db.exec("UPDATE uitgelicht_dishes SET enabled = false WHERE dish_slug = 'carbonara'");
check("switched off in Admin: no longer for sale", !(await el("carbonara-utrecht")));
await db.exec("UPDATE uitgelicht_dishes SET enabled = true WHERE dish_slug = 'carbonara'");
// stub restaurant_positions returns carbonara-utrecht (total 7) for any restaurant
const offers = (await db.query<{ page_slug: string }>("SELECT * FROM uitgelicht_page_offers('r0200')")).rows;
check("offers show the eligible page", offers.length === 1 && offers[0].page_slug === "carbonara-utrecht", offers);
await db.exec(`DELETE FROM test_ctx; INSERT INTO test_ctx VALUES ('${id(100)}', 'authenticated');`);
let refused = false;
try { await db.query("SELECT place_uitgelicht_bid('kaastengels-utrecht', $1, 20000)", [id(200)]); } catch (e) { refused = String(e).includes("niet beschikbaar"); }
check("bid on kaastengels refused", refused);
Deno.exit(ok ? 0 : 1);
