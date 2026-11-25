import { PGlite } from "npm:@electric-sql/pglite@0.2.17";
// Checks the self-filling collections (20261125095000_dish_reviews.sql, 20261125100000_dish_collections.sql):
// the nine entry rules, the start period for the review rule, reviews as the main weight, hand
// picks, the city filter and picker, and the owner's live status.
// Usage from the repo root: deno run -A --config supabase/tests/deno.json supabase/tests/collections-sql.ts
const repo = Deno.args[0] ?? ".";
const db = new PGlite();
await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
  CREATE SCHEMA cron; CREATE TABLE cron.job (jobid serial, jobname text);
  CREATE FUNCTION cron.schedule(n text, s text, c text) RETURNS int LANGUAGE sql AS $$ INSERT INTO cron.job (jobname) VALUES (n) RETURNING jobid $$;
  CREATE FUNCTION cron.unschedule(id int) RETURNS boolean LANGUAGE sql AS $$ DELETE FROM cron.job WHERE jobid = id RETURNING true $$;
  CREATE SCHEMA auth; CREATE TABLE test_ctx (uid uuid); INSERT INTO test_ctx VALUES (NULL);
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT uid FROM public.test_ctx LIMIT 1 $$;
  CREATE FUNCTION has_role(u uuid, r text) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT false $$;
  CREATE FUNCTION guard_is_restricted_mod() RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT false $$;
  CREATE TABLE cities (id uuid PRIMARY KEY, name text, slug text);
  CREATE TABLE restaurants (id uuid PRIMARY KEY, name text, slug text, address text, city_id uuid, is_active boolean DEFAULT true,
    images text[], price_level int DEFAULT 2, cuisines text[], ambience_tags text[], concepts text[], is_fully_halal boolean DEFAULT false,
    google_rating double precision, opening_hours jsonb, claimed_by_owner_id uuid);
  CREATE FUNCTION is_verified_owner(u uuid, r uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT EXISTS (SELECT 1 FROM restaurants WHERE id = r AND claimed_by_owner_id = u) $$;
  CREATE TABLE dishes (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text, slug text, canonical_slug text, dish_group text);
  CREATE TABLE restaurant_dishes (id serial, restaurant_id uuid, dish_id uuid, status text DEFAULT 'approved_by_admin', price numeric,
    is_signature boolean DEFAULT false, is_halal boolean DEFAULT false, is_gluten_free boolean DEFAULT false,
    dietary_tags text[] NOT NULL DEFAULT '{}', course_type text DEFAULT 'hoofdgerecht');
  CREATE TABLE reviews (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), restaurant_id uuid, user_id uuid, rating int NOT NULL, status text,
    title text, body text, photos text[], tag_votes jsonb, suggested_tags text[], dishes_eaten text[], is_verified boolean,
    owner_response text, owner_response_at timestamptz, updated_at timestamptz);
  CREATE TABLE dish_ratings (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), review_id uuid, dish_id uuid, rating int);
  CREATE TABLE collections (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), slug text UNIQUE, title text, subtitle text, description text,
    cover_image text, city_id uuid, is_active boolean DEFAULT true, sort_order int DEFAULT 0, seo_title text, seo_description text,
    title_i18n jsonb DEFAULT '{}', subtitle_i18n jsonb DEFAULT '{}', description_i18n jsonb DEFAULT '{}',
    updated_at timestamptz DEFAULT now());
  CREATE TABLE collection_restaurants (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), collection_id uuid, restaurant_id uuid,
    sort_order int DEFAULT 0, featured_reason text);`);

const noExt = (s: string) => s.replace(/CREATE EXTENSION IF NOT EXISTS pg_cron;/g, "");
const reviewsSql = await Deno.readTextFile(`${repo}/supabase/migrations/20261125095000_dish_reviews.sql`);
await db.exec(reviewsSql); await db.exec(reviewsSql);

const id = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const AMS = id(1), UT = id(2), OWNER = id(900), STRANGER = id(901);
const HOURS = `'{"mon":"12:00 - 22:00"}'`;
const TONK = id(10), MISO = id(11), SHOARMA = id(12), FALAFEL = id(13), SOEP = id(14);
await db.exec(`
  INSERT INTO cities VALUES ('${AMS}', 'Amsterdam', 'amsterdam'), ('${UT}', 'Utrecht', 'utrecht');
  INSERT INTO dishes (id, name, slug, canonical_slug) VALUES ('${TONK}', 'Tonkotsu ramen', 'tonkotsu-ramen', 'ramen'),
    ('${MISO}', 'Miso ramen', 'miso-ramen', 'ramen'), ('${SHOARMA}', 'Kip shoarma', 'kip-shoarma', 'shoarma'),
    ('${FALAFEL}', 'Falafel', 'falafel', 'falafel'), ('${SOEP}', 'Linzensoep', 'linzensoep', 'linzensoep');`);

// A restaurant with n filler dishes that have a price, plus the given menu rows.
let filler = 0;
async function restaurant(n: number, o: { city?: string; photo?: boolean; hours?: boolean; priced?: number; active?: boolean;
  concepts?: string; halal?: boolean; owner?: string }) {
  await db.exec(`INSERT INTO restaurants (id, name, slug, address, city_id, images, opening_hours, is_active, concepts, is_fully_halal, claimed_by_owner_id, google_rating)
    VALUES ('${id(n)}', 'R${n}', 'r${n}', 'Straat ${n}', '${o.city ?? AMS}', ${o.photo === false ? "NULL" : `ARRAY['r${n}.jpg']`},
    ${o.hours === false ? "NULL" : HOURS}, ${o.active ?? true}, ${o.concepts ? `ARRAY['${o.concepts}']` : "NULL"}, ${o.halal ?? false},
    ${o.owner ? `'${o.owner}'` : "NULL"}, 5.0)`);
  for (let i = 0; i < (o.priced ?? 12); i++) {
    const d = `filler-${filler++}`;
    await db.exec(`WITH d AS (INSERT INTO dishes (name, slug, canonical_slug) VALUES ('${d}', '${d}', '${d}') RETURNING id)
      INSERT INTO restaurant_dishes (restaurant_id, dish_id, price, course_type) SELECT '${id(n)}', id, 10, 'voorgerecht' FROM d`);
  }
}
const menu = (n: number, dish: string, extra = "") =>
  db.exec(`INSERT INTO restaurant_dishes (restaurant_id, dish_id, price, status, is_halal, course_type)
    VALUES ('${id(n)}', '${dish}', ${extra.includes("noprice") ? "NULL" : 15}, '${extra.includes("suggested") ? "suggested" : "approved_by_admin"}',
    ${extra.includes("halal")}, '${extra.includes("bij") ? "bijgerecht" : "hoofdgerecht"}')`);
async function dishReviews(n: number, dish: string, count: number, stars: number, aboutRestaurant = false) {
  for (let i = 0; i < count; i++) {
    await db.exec(`WITH r AS (INSERT INTO reviews (restaurant_id, rating, status, about_restaurant) VALUES ('${id(n)}', ${stars}, 'published', ${aboutRestaurant}) RETURNING id)
      INSERT INTO dish_ratings (review_id, dish_id, rating) SELECT id, '${dish}', ${stars} FROM r`);
  }
}

await restaurant(100, {});                                   // A: everything, 12 ramen reviews of 4.5+
await menu(100, TONK); await dishReviews(100, TONK, 12, 5);
await restaurant(101, { city: UT, owner: OWNER });           // B: everything but reviews
await menu(101, MISO);
await restaurant(102, { city: UT, photo: false }); await menu(102, TONK);   // C: no photo
await restaurant(103, { priced: 5 }); await menu(103, TONK);                // D: 5 + 1 priced dishes
await restaurant(104, { hours: false }); await menu(104, TONK);             // E: no opening hours
await restaurant(105, {}); await menu(105, TONK, "noprice");               // F: ramen without a price
await restaurant(106, { active: false }); await menu(106, TONK);            // inactive
await restaurant(107, {}); await menu(107, TONK, "suggested");              // ramen only suggested
await restaurant(110, {}); await menu(110, SHOARMA, "halal"); await menu(110, FALAFEL, "halal bij"); await menu(110, SOEP, "halal bij");
await restaurant(111, {}); await menu(111, SHOARMA, "halal"); await menu(111, FALAFEL, "halal bij");
await restaurant(112, {}); await menu(112, FALAFEL, "halal bij"); await menu(112, SOEP, "halal bij"); await menu(112, SHOARMA, "halal bij");
await restaurant(113, { halal: true });
await restaurant(120, { concepts: "All you can eat" });
// Dish-only reviews must not count for the restaurant itself; a general review does.
await dishReviews(101, MISO, 3, 2);
await db.exec(`INSERT INTO reviews (restaurant_id, rating, status) VALUES ('${id(101)}', 5, 'published')`);
await db.exec(`INSERT INTO collections (slug, title, cover_image, sort_order) VALUES ('beste-ramen-amsterdam', 'Beste Ramen in Amsterdam', '/collections/beste-ramen-amsterdam.jpg', 1);
  INSERT INTO collection_restaurants (collection_id, restaurant_id, featured_reason, sort_order)
    SELECT id, '${id(107)}', 'Niet op de kaart', 1 FROM collections WHERE slug = 'beste-ramen-amsterdam';
  UPDATE collections SET title_i18n = '{"nl": "Beste Ramen in Amsterdam"}' WHERE slug = 'beste-ramen-amsterdam';
  INSERT INTO collection_restaurants (collection_id, restaurant_id, featured_reason, sort_order)
    SELECT id, '${id(102)}', 'Onze favoriet', 2 FROM collections WHERE slug = 'beste-ramen-amsterdam';`);

const sql = noExt(await Deno.readTextFile(`${repo}/supabase/migrations/20261125100000_dish_collections.sql`));
await db.exec(sql); await db.exec(sql);

let ok = true;
const check = (l: string, p: boolean, g?: unknown) => { ok &&= p; console.log(p ? "PASS" : "FAIL", l, p ? "" : JSON.stringify(g)); };
type Row = { slug: string; dish_name: string | null; dish_price: string | null; review_count: number; review_avg: string | null;
  is_pick: boolean; pick_reason: string | null; total: number; city_slug: string };
const list = async (slug: string, city: string | null = null, limit = 50) =>
  (await db.query<Row>(`SELECT * FROM collection_list($1, $2, $3)`, [slug, city, limit])).rows;
const slugs = (rows: Row[]) => rows.map(r => r.slug);
const fails = async (q: string, p: unknown[] = []) => { try { await db.query(q, p); return false; } catch { return true; } };

const cols = (await db.query<{ slug: string; auto_cover: string | null; cover_image: string | null }>("SELECT slug, auto_cover, cover_image FROM collections")).rows;
check("old ramen slug renamed, 16 launch collections", !cols.some(c => c.slug === "beste-ramen-amsterdam") && cols.length === 16, cols.map(c => c.slug));

// Start period: rule 9 does not apply yet.
const nl = await list("beste-ramen");
check("start period: A and B in, C (no photo) only as hand pick, D/E/F/inactive/suggested out",
  JSON.stringify(slugs(nl).sort()) === '["r100","r101","r102"]', slugs(nl));
check("reviews weigh most: A (12 ramen reviews of 5) above B", slugs(nl).indexOf("r100") < slugs(nl).indexOf("r101"), slugs(nl));
const a = nl.find(r => r.slug === "r100")!;
check("A shows its dish, price and ramen reviews", a.dish_name === "Tonkotsu ramen" && Number(a.dish_price) === 15 && a.review_count === 12 && Number(a.review_avg) === 5, a);
const c = nl.find(r => r.slug === "r102")!;
check("hand pick that matches is listed and marked", c.is_pick && c.pick_reason === "Onze favoriet", c);
check("cover from the number 1", cols.find(x => x.slug === "beste-ramen")?.auto_cover === "r100.jpg", cols.find(x => x.slug === "beste-ramen"));
const ut = await list("beste-ramen", "utrecht");
check("city view: hand pick first, only that city", JSON.stringify(slugs(ut)) === '["r102","r101"]', slugs(ut));
check("limit keeps the top", (await list("beste-ramen", null, 1)).length === 1 && (await list("beste-ramen", null, 1))[0].total === 3);
const cities = (await db.query<{ city_slug: string; restaurants: number }>("SELECT * FROM collection_cities('beste-ramen')")).rows;
check("city picker counts the list", JSON.stringify(cities.map(x => [x.city_slug, x.restaurants])) === '[["utrecht",2],["amsterdam",1]]', cities);

const halal = slugs(await list("halal-uit-eten")).sort();
check("halal: 3 halal dishes with a main, or fully halal; 2 dishes or no main is not enough", JSON.stringify(halal) === '["r110","r113"]', halal);
check("all you can eat by its (free) concept tag", JSON.stringify(slugs(await list("all-you-can-eat"))) === '["r120"]');

// Owner status, live.
await db.exec(`UPDATE test_ctx SET uid = '${STRANGER}'`);
check("a stranger cannot read the owner status", await fails("SELECT * FROM owner_collection_status($1)", [id(101)]));
await db.exec(`UPDATE test_ctx SET uid = '${OWNER}'`);
type St = { collection_slug: string; eligible: boolean; review_count: number; review_avg: string; reviews_enforced: boolean;
  position: number | null; in_list: number; priced_dishes: number; has_photo: boolean; hours_known: boolean; dish_priced: boolean };
const st = (await db.query<St>("SELECT * FROM owner_collection_status($1)", [id(101)])).rows;
const ramen = st.find(s => s.collection_slug === "beste-ramen")!;
check("owner sees beste ramen: in the list at #1 of 1 in Utrecht, 3 ramen reviews, rule 9 not yet enforced",
  st.length === 1 && ramen.eligible && ramen.position === 1 && ramen.in_list === 1 && ramen.review_count === 3 && !ramen.reviews_enforced, st);
check("checks are reported one by one", ramen.has_photo && ramen.hours_known && ramen.dish_priced && ramen.priced_dishes === 13, ramen);

// From 1 April 2027: at least 10 reviews of the dish.
await db.exec(`CREATE OR REPLACE FUNCTION collection_reviews_enforced() RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT true $$;
  SELECT refresh_collection_entries();`);
check("after the start period only A (12 reviews) stays, plus the hand pick", JSON.stringify(slugs(await list("beste-ramen")).sort()) === '["r100","r102"]', slugs(await list("beste-ramen")));
const after = (await db.query<St>("SELECT * FROM owner_collection_status($1)", [id(101)])).rows[0];
check("owner then sees why: not in the list, no position", !after.eligible && after.position === null && after.reviews_enforced, after);

// A dish-only review does not count for the restaurant's own score.
check("dish-only reviews keep about_restaurant false", (await db.query<{ n: number }>(`SELECT count(*)::int n FROM reviews WHERE restaurant_id = '${id(101)}' AND about_restaurant`)).rows[0].n === 1);
const listed = noExt(await Deno.readTextFile(`${repo}/supabase/migrations/20261125130000_collection_listed_count.sql`));
await db.exec(listed); await db.exec(listed);
const counts = Object.fromEntries((await db.query<{ slug: string; listed_count: number }>("SELECT slug, listed_count FROM collections")).rows.map(r => [r.slug, r.listed_count]));
check("the stale translation of the ramen title is gone", (await db.query<{ t: unknown }>("SELECT title_i18n t FROM collections WHERE slug = 'beste-ramen'")).rows[0].t !== null
  && JSON.stringify((await db.query<{ t: unknown }>("SELECT title_i18n t FROM collections WHERE slug = 'beste-ramen'")).rows[0].t) === "{}");
// The review rule is enforced at this point of the test: only A (12 ramen reviews) is listed.
check("listed_count counts the restaurants in the list", counts["beste-ramen"] === 1 && counts["halal-uit-eten"] === 0 && counts["beste-pho"] === 0, counts);
const jobs = (await db.query<{ n: number }>("SELECT count(*)::int n FROM cron.job WHERE jobname = 'refresh-collection-entries'")).rows[0].n;
check("one nightly job after running twice", jobs === 1, jobs);

if (!ok) Deno.exit(1);
console.log("all collection checks passed");
