import { PGlite } from "npm:@electric-sql/pglite@0.2.17";
// Checks owner simulations: real numbers for add_dish / change_price / remove_tag, 3 free, then a
// paid credit per simulation, Pro unlimited, and credits granted once per Stripe session.
// Usage from the repo root: deno run -A --config supabase/tests/deno.json supabase/tests/owner-simulations-sql.ts
const repo = Deno.args[0] ?? ".";
const db = new PGlite();
await db.exec(await Deno.readTextFile(new URL("./stubs.sql", import.meta.url)));
await db.exec(`ALTER TABLE restaurants ADD COLUMN is_featured boolean, ADD COLUMN is_top_listing boolean, ADD COLUMN price_level int;
  ALTER TABLE dishes ADD COLUMN dish_group text; ALTER TABLE search_logs ADD COLUMN filters jsonb DEFAULT '{}'::jsonb, ADD COLUMN session_id text;`);
const sql = await Deno.readTextFile(`${repo}/supabase/migrations/20261115130000_owner_simulations.sql`);
await db.exec(sql); await db.exec(sql);
// Counting by visitor (one per session per day, heavy sessions out, whole-word dish match).
const visitors = await Deno.readTextFile(`${repo}/supabase/migrations/20261115170000_simulation_visitors.sql`);
await db.exec(visitors); await db.exec(visitors);
let ok = true;
const check = (l: string, p: boolean, g?: unknown) => { ok &&= p; console.log(p ? "PASS" : "FAIL", l, p ? "" : JSON.stringify(g)); };
const id = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const C = id(1), RAMEN = id(10), OWNER = id(100), ME = id(200), PRO = id(201), PRO_OWNER = id(101);
await db.exec(`INSERT INTO cities VALUES ('${C}', 'Utrecht');
  INSERT INTO dishes (id, name, slug, canonical_slug) VALUES ('${RAMEN}', 'Ramen', 'ramen', 'ramen');
  INSERT INTO restaurants (id, name, slug, city_id, claimed_by_owner_id, rating, price_level) VALUES ('${ME}', 'Mij', 'mij', '${C}', '${OWNER}', 4.5, 2);
  INSERT INTO restaurants (id, name, slug, city_id, claimed_by_owner_id, rating, owner_tier) VALUES ('${PRO}', 'Pro', 'pro', '${C}', '${PRO_OWNER}', 4.0, 'pro');
  INSERT INTO restaurants (id, name, slug, city_id, rating, is_featured) VALUES ('${id(300)}', 'A', 'a', '${C}', 4.8, false), ('${id(301)}', 'B', 'b', '${C}', 4.0, false), ('${id(302)}', 'F', 'f', '${C}', 3.0, true);
  INSERT INTO restaurant_dishes (restaurant_id, dish_id, status) SELECT r, '${RAMEN}', 'approved_by_admin' FROM unnest(ARRAY['${id(300)}','${id(301)}','${id(302)}']::uuid[]) r;
  INSERT INTO search_logs (query_norm, city) SELECT 'ramen', 'Utrecht' FROM generate_series(1, 300);
  INSERT INTO search_logs (query_norm, city, session_id) SELECT 'ramen', 'Utrecht', 'same-visitor' FROM generate_series(1, 10);
  INSERT INTO search_logs (query_norm, city, session_id) SELECT 'ramen', 'Utrecht', 'bot-session' FROM generate_series(1, 70);
  INSERT INTO search_logs (query_norm, city) SELECT 'ramenbar', 'Utrecht' FROM generate_series(1, 3);
  INSERT INTO search_logs (query_norm, city) SELECT 'tonkotsu ramen', 'Utrecht' FROM generate_series(1, 3);
  INSERT INTO search_logs (query_norm, city, filters) SELECT 'sushi', 'Utrecht', '{"prijs": ["2"]}' FROM generate_series(1, 60);
  INSERT INTO search_logs (query_norm, city, filters) SELECT 'sushi', 'Utrecht', '{"prijs": ["3"]}' FROM generate_series(1, 30);
  INSERT INTO search_logs (query_norm, city, filters) SELECT 'x', 'Utrecht', '{"sfeer": ["Romantisch"]}' FROM generate_series(1, 45);
  DELETE FROM test_ctx; INSERT INTO test_ctx VALUES ('${OWNER}', 'authenticated');`);
const run = async (kind: string, dish: string | null, tag: string | null, price: number | null) =>
  (await db.query<{ j: Record<string, any> }>("SELECT run_owner_simulation($1, $2, $3, $4, $5) j", [ME, kind, dish, tag, price])).rows[0].j;
const fails = async (f: () => Promise<unknown>) => { try { await f(); return false; } catch { return true; } };

const a = await run("add_dish", RAMEN, null, null);
check("add_dish: position after featured and better-rated (#3 of 4)", a.position === 3 && a.total === 4, a);
check("add_dish: 304 visitors / 3 (one visitor 10x = 1, bot session out, 'ramenbar' no match, 'tonkotsu ramen' match)", Number(a.searches_per_month) === 101.3 && Number(a.extra_visitors_per_month) === 10, a);
const p = await run("change_price", null, null, 3);
check("change_price 2 -> 3: lose 20/month, gain 10/month, 30 price searches/month", Number(p.lose_per_month) === 20 && Number(p.gain_per_month) === 10 && Number(p.price_filter_searches_per_month) === 30, p);
const t = await run("remove_tag", null, "romantisch", null);
check("remove_tag: 15 searches/month filter on it (case-insensitive)", Number(t.filter_searches_per_month) === 15, t);
check("after 3 free: none left", t.quota.free_left === 0 && t.quota.credits === 0, t.quota);
check("4th without credit: payment required", await fails(() => run("add_dish", RAMEN, null, null)));

await db.exec("DELETE FROM test_ctx; INSERT INTO test_ctx VALUES (NULL, 'service_role');");
const g1 = (await db.query<{ g: boolean }>("SELECT grant_simulation_credits('cs_1', $1, $2, 2) g", [ME, OWNER])).rows[0].g;
const g2 = (await db.query<{ g: boolean }>("SELECT grant_simulation_credits('cs_1', $1, $2, 2) g", [ME, OWNER])).rows[0].g;
check("credits granted once per session", g1 === true && g2 === false);
await db.exec(`DELETE FROM test_ctx; INSERT INTO test_ctx VALUES ('${OWNER}', 'authenticated');`);
const c1 = await run("add_dish", RAMEN, null, null);
check("paid simulation uses a credit", c1.quota.credits === 1, c1.quota);
await run("add_dish", RAMEN, null, null);
check("credits used up: payment required again", await fails(() => run("add_dish", RAMEN, null, null)));
const charges = (await db.query<{ charge: string; n: number }>("SELECT charge, count(*)::int n FROM owner_simulations WHERE restaurant_id = $1 GROUP BY charge ORDER BY charge", [ME])).rows;
check("3 free and 2 credit simulations recorded", JSON.stringify(charges) === '[{"charge":"credit","n":2},{"charge":"free","n":3}]', charges);

await db.exec(`DELETE FROM test_ctx; INSERT INTO test_ctx VALUES ('${PRO_OWNER}', 'authenticated');`);
for (let i = 0; i < 5; i++) await db.query("SELECT run_owner_simulation($1, 'add_dish', $2)", [PRO, RAMEN]);
const q = (await db.query<{ j: any }>("SELECT owner_simulation_quota($1) j", [PRO])).rows[0].j;
check("Pro: unlimited", q.unlimited === true, q);
check("someone else's restaurant refused", await fails(() => db.query("SELECT run_owner_simulation($1, 'add_dish', $2)", [ME, RAMEN])));
Deno.exit(ok ? 0 : 1);
