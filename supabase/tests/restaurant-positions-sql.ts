import { PGlite } from "npm:@electric-sql/pglite@0.2.17";
// Checks restaurant_positions(): every dish x city page a restaurant appears on (hub pages by
// dish_group, other pages by canonical_slug, as the dish page itself), with the same order.
// Usage from the repo root: deno run -A --config supabase/tests/deno.json supabase/tests/restaurant-positions-sql.ts
const repo = Deno.args[0] ?? ".";
const db = new PGlite();
await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
  CREATE TABLE restaurants (id uuid PRIMARY KEY, slug text, city_id uuid, is_active boolean DEFAULT true, is_featured boolean, is_top_listing boolean, rating numeric);
  CREATE TABLE dishes (id uuid PRIMARY KEY, name text, slug text, canonical_slug text, dish_group text);
  CREATE TABLE restaurant_dishes (id serial, restaurant_id uuid, dish_id uuid, status text);
  CREATE TABLE seo_landing_pages (slug text, city_id uuid, dish_id uuid, is_active boolean DEFAULT true);`);
const sql = await Deno.readTextFile(`${repo}/supabase/migrations/20261115090000_restaurant_positions_all_pages.sql`);
await db.exec(sql); await db.exec(sql);
let ok = true;
const check = (l: string, p: boolean, g?: unknown) => { ok &&= p; console.log(p ? "PASS" : "FAIL", l, p ? "" : JSON.stringify(g)); };
const id = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const UT = id(1), AMS = id(2);
await db.exec(`
  INSERT INTO dishes VALUES
    ('${id(10)}', 'Biefstuk', 'biefstuk', 'biefstuk', 'biefstuk'),
    ('${id(11)}', 'Philly cheese steak', 'philly-cheese-steak', 'biefstuk', 'biefstuk'),
    ('${id(12)}', 'Garnalen', 'garnalen', 'garnalen', NULL),
    ('${id(13)}', 'Gambas aioli', 'gambas-aioli', 'garnalen', NULL),
    ('${id(14)}', 'Mosselen', 'mosselen', 'mosselen', NULL),
    ('${id(15)}', 'Verse mosselen', 'verse-mosselen', 'mosselen', NULL),
    ('${id(16)}', 'Oesters', 'oesters', 'oesters', NULL),
    ('${id(17)}', 'Maguro', 'maguro', NULL, NULL);
  INSERT INTO seo_landing_pages VALUES ('biefstuk-utrecht', '${UT}', '${id(10)}'), ('garnalen-utrecht', '${UT}', '${id(12)}'),
    ('mosselen-utrecht', '${UT}', '${id(14)}'), ('oesters-utrecht', '${UT}', '${id(16)}'), ('garnalen-amsterdam', '${AMS}', '${id(12)}'),
    ('gerecht-garnalen-utrecht', '${UT}', '${id(12)}');
  INSERT INTO restaurants VALUES ('${id(100)}', 'testkeuken', '${UT}', true, false, false, 4.0),
    ('${id(101)}', 'beter', '${UT}', true, false, false, 4.8), ('${id(102)}', 'featured', '${UT}', true, true, false, 3.0);
  INSERT INTO restaurant_dishes (restaurant_id, dish_id, status) VALUES
    ('${id(100)}', '${id(11)}', 'verified_by_owner'), ('${id(100)}', '${id(13)}', 'verified_by_owner'),
    ('${id(100)}', '${id(15)}', 'verified_by_owner'), ('${id(100)}', '${id(17)}', 'verified_by_owner'),
    ('${id(101)}', '${id(13)}', 'approved_by_admin'), ('${id(102)}', '${id(13)}', 'approved_by_admin'),
    ('${id(101)}', '${id(16)}', 'suggested');`);
const rows = (await db.query<{ page_slug: string; position: number; total: number }>("SELECT * FROM restaurant_positions('testkeuken')")).rows;
const pages = rows.map(r => r.page_slug).sort();
check("hub page via dish_group, shrimp and mussels via canonical_slug", JSON.stringify(pages) === '["biefstuk-utrecht","garnalen-utrecht","mosselen-utrecht"]', rows);
check("no page for a dish it does not serve (oesters), nor another city, nor gerecht- pages", !pages.includes("oesters-utrecht") && !pages.includes("garnalen-amsterdam") && !pages.some(p => p.startsWith("gerecht-")), pages);
const g = rows.find(r => r.page_slug === "garnalen-utrecht")!;
check("order: featured first, then rating (testkeuken #3 of 3 on shrimp)", g.position === 3 && g.total === 3, g);
check("suggested dishes do not count", (await db.query("SELECT * FROM restaurant_positions('beter')")).rows.length === 1);
Deno.exit(ok ? 0 : 1);
