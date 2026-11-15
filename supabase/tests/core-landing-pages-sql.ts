import { PGlite } from "npm:@electric-sql/pglite@0.2.17";
// Checks ensure_core_landing_pages: a page per core dish per city with >= 3 restaurants, hub dishes
// via dish_group, no duplicates (also not under another dish name), and a second run adds nothing.
// Usage from the repo root: deno run -A --config supabase/tests/deno.json supabase/tests/core-landing-pages-sql.ts
const repo = Deno.args[0] ?? ".";
const db = new PGlite();
await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated;
  CREATE TABLE cities (id uuid PRIMARY KEY, name text, slug text, is_active boolean DEFAULT true);
  CREATE TABLE dishes (id uuid PRIMARY KEY, name text, slug text, canonical_slug text, dish_group text);
  CREATE TABLE restaurants (id uuid PRIMARY KEY, city_id uuid, is_active boolean DEFAULT true);
  CREATE TABLE restaurant_dishes (id serial, restaurant_id uuid, dish_id uuid, status text);
  CREATE TABLE seo_landing_pages (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), slug text UNIQUE, dish_id uuid, city_id uuid,
    meta_title text NOT NULL, meta_description text NOT NULL, h1_title text NOT NULL, keywords text[], canonical_url text,
    is_active boolean DEFAULT true, is_auto_generated boolean DEFAULT true);`);
const id = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const UT = id(1), ZW = id(2);
await db.exec(`INSERT INTO cities VALUES ('${UT}', 'Utrecht', 'utrecht'), ('${ZW}', 'Zwolle', 'zwolle');
  INSERT INTO dishes VALUES
    ('${id(10)}', 'Pizza', 'pizza', 'pizza', 'pizza'), ('${id(11)}', 'Pizza margherita', 'pizza-margherita', 'pizza-margherita', 'pizza'),
    ('${id(12)}', 'Ramen', 'ramen', 'ramen', NULL), ('${id(13)}', 'Tonkotsu ramen', 'tonkotsu-ramen', 'ramen', NULL),
    ('${id(14)}', 'Taco', 'taco', 'taco', NULL), ('${id(15)}', 'Tacos', 'tacos', 'taco', NULL),
    ('${id(16)}', 'Mosselen', 'mosselen', 'mosselen', NULL);`);
let n = 300;
const serve = async (city: string, dish: string, count: number) => {
  for (let i = 0; i < count; i++) {
    const r = id(n++);
    await db.exec(`INSERT INTO restaurants VALUES ('${r}', '${city}'); INSERT INTO restaurant_dishes (restaurant_id, dish_id, status) VALUES ('${r}', '${dish}', 'approved_by_admin');`);
  }
};
await serve(UT, id(11), 4);  // pizza via the hub group
await serve(UT, id(13), 3);  // ramen via canonical
await serve(UT, id(15), 5);  // tacos -> taco
await serve(UT, id(16), 2);  // mosselen: too few
await serve(ZW, id(13), 3);  // ramen in Zwolle
await db.exec(`INSERT INTO seo_landing_pages (slug, dish_id, city_id, meta_title, meta_description, h1_title)
  VALUES ('tacos-utrecht', '${id(15)}', '${UT}', 't', 't', 't');`);  // existing page under another dish row
const sql = await Deno.readTextFile(`${repo}/supabase/migrations/20261115120000_core_landing_pages.sql`);
await db.exec(sql); await db.exec(sql);
const pages = (await db.query<{ slug: string; h1_title: string; meta_description: string }>("SELECT slug, h1_title, meta_description FROM seo_landing_pages ORDER BY slug")).rows;
let ok = true;
const check = (l: string, p: boolean, g?: unknown) => { ok &&= p; console.log(p ? "PASS" : "FAIL", l, p ? "" : JSON.stringify(g)); };
const slugs = pages.map(p => p.slug);
check("pizza (hub) and ramen pages created in Utrecht, ramen in Zwolle", ["pizza-utrecht", "ramen-utrecht", "ramen-zwolle"].every(s => slugs.includes(s)), slugs);
check("no page under 3 restaurants (mosselen)", !slugs.includes("mosselen-utrecht"), slugs);
check("no duplicate taco page next to tacos-utrecht", !slugs.includes("taco-utrecht") && slugs.includes("tacos-utrecht"), slugs);
const pz = pages.find(p => p.slug === "pizza-utrecht")!;
check("titles and description filled in", pz.h1_title === "Beste Pizza in Utrecht" && pz.meta_description.startsWith("4 restaurants in Utrecht"), pz);
const again = (await db.query<{ n: number }>("SELECT ensure_core_landing_pages() n")).rows[0].n;
check("a second run adds nothing", again === 0, again);
Deno.exit(ok ? 0 : 1);
