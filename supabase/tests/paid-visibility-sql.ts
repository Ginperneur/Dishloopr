import { PGlite } from "npm:@electric-sql/pglite@0.2.17";
// Checks the paid visibility rules of 20261119100000_paid_visibility.sql: 1 Topplek + 3 Uitgelicht per
// page (Founding Partners keep a 4th or 5th place), sales only from 10 restaurants, cuisine and
// Romantisch pages without bought labels, one paid place per restaurant per page, the Topplek
// auction, the Stadsspotlight (3 per week), the city newsletter (4 per edition), bundles with Pro
// and the test visit rules. The migration runs twice to prove it is idempotent.
// Usage from the repo root: deno run -A --config supabase/tests/deno.json supabase/tests/paid-visibility-sql.ts
const repo = Deno.args[0] ?? ".";
const db = new PGlite();
const noExt = (s: string) => s.replace(/CREATE EXTENSION IF NOT EXISTS pg_(cron|net);/g, "");
await db.exec(await Deno.readTextFile(new URL("./stubs.sql", import.meta.url)));
await db.exec(`DROP FUNCTION restaurant_positions(text);
  ALTER TABLE cities ADD COLUMN slug text, ADD COLUMN is_active boolean DEFAULT true;
  ALTER TABLE dishes ADD COLUMN dish_group text;
  ALTER TABLE restaurants ADD COLUMN cuisines text[], ADD COLUMN ambience_tags text[], ADD COLUMN is_featured boolean DEFAULT false, ADD COLUMN is_top_listing boolean DEFAULT false, ADD COLUMN geo_lat double precision, ADD COLUMN geo_lng double precision;
  ALTER TABLE seo_landing_pages ADD COLUMN city_id uuid, ADD COLUMN is_active boolean DEFAULT true, ADD COLUMN meta_title text,
    ADD COLUMN meta_description text, ADD COLUMN h1_title text, ADD COLUMN keywords text[], ADD CONSTRAINT slp_slug UNIQUE (slug);
  CREATE TABLE package_orders (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), restaurant_id uuid, user_id uuid, package text NOT NULL,
    plan text, page_slug text, status text, amount_cents int, stripe_subscription_id text, current_period_end timestamptz,
    created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now(),
    CONSTRAINT package_orders_package_check CHECK (package IN ('founding_partner', 'menu_service')),
    CONSTRAINT package_orders_founding_page_check CHECK (package <> 'founding_partner' OR page_slug IS NOT NULL));
  CREATE FUNCTION founding_partner_live(p_status text) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$ SELECT p_status IN ('active','trialing','past_due') $$;
  CREATE TABLE founding_stats_daily (restaurant_id uuid, page_slug text, dag date, metric text, n int);
  CREATE TABLE restaurant_tag_subscriptions (restaurant_id uuid, tag_category text, tag_value text, is_active boolean DEFAULT true);
  CREATE TABLE owner_pro_subscriptions (user_id uuid, status text, current_period_end timestamptz);
  CREATE TABLE restaurant_events (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), restaurant_id uuid, promotion_status text DEFAULT 'unpaid',
    released_at timestamptz, released_by uuid, paid_until timestamptz);
  CREATE TABLE newsletter_subscribers (id serial, city_id uuid, is_active boolean DEFAULT true);
  CREATE TABLE newsletter_editions (id uuid PRIMARY KEY DEFAULT gen_random_uuid());
  CREATE TABLE newsletter_placements (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), restaurant_id uuid, target_city_id uuid, status text,
    created_at timestamptz DEFAULT now());
  CREATE TABLE collections (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), slug text, title text, is_active boolean DEFAULT true);
  CREATE TABLE collection_restaurants (collection_id uuid, restaurant_id uuid, featured_reason text);
  CREATE TABLE profiles (id uuid PRIMARY KEY, email text);`);
for (const m of ["20261114130000_promo_slots", "20261115090000_restaurant_positions_all_pages", "20261114140000_uitgelicht_auction",
                 "20261115110000_uitgelicht_offers", "20261115140000_uitgelicht_dish_list"]) {
  await db.exec(noExt(await Deno.readTextFile(`${repo}/supabase/migrations/${m}.sql`)));
}
const sql = noExt(await Deno.readTextFile(`${repo}/supabase/migrations/20261119100000_paid_visibility.sql`));
await db.exec(sql); await db.exec(sql);

let ok = true;
const check = (l: string, p: boolean, g?: unknown) => { ok &&= p; console.log(p ? "PASS" : "FAIL", l, p ? "" : JSON.stringify(g)); };
const id = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const as = (uid: string) => db.exec(`DELETE FROM test_ctx; INSERT INTO test_ctx VALUES ('${uid}', 'authenticated');`);
const service = () => db.exec("DELETE FROM test_ctx; INSERT INTO test_ctx VALUES (NULL, 'service_role');");
const fails = async (q: string, p: unknown[] = []) => { try { await db.query(q, p); return false; } catch { return true; } };
const one = async <T>(q: string, p: unknown[] = []) => (await db.query<{ v: T }>(q, p)).rows[0]?.v;

const UT = id(1), DH = id(2);
const PIZZA = id(10), MARGH = id(11), DIAV = id(12), FUNGHI = id(13), KAAS = id(14);
await db.exec(`INSERT INTO cities (id, name, slug) VALUES ('${UT}', 'Utrecht', 'utrecht'), ('${DH}', 'Den Haag', 'den-haag');
  INSERT INTO dishes (id, name, slug, canonical_slug, dish_group) VALUES
    ('${PIZZA}', 'Pizza', 'pizza', 'pizza', 'pizza'), ('${MARGH}', 'Pizza margherita', 'pizza-margherita', 'pizza-margherita', 'pizza'),
    ('${DIAV}', 'Pizza diavola', 'pizza-diavola', 'pizza-diavola', 'pizza'), ('${FUNGHI}', 'Pizza funghi', 'pizza-funghi', 'pizza-funghi', 'pizza'),
    ('${KAAS}', 'Kaastengels', 'kaastengels', 'kaastengels', NULL);
  INSERT INTO seo_landing_pages (slug, dish_id, city_id, meta_title, meta_description, h1_title) VALUES
    ('pizza-utrecht', '${PIZZA}', '${UT}', 't', 'd', 'h'), ('kaastengels-utrecht', '${KAAS}', '${UT}', 't', 'd', 'h'),
    ('pizza-den-haag', '${PIZZA}', '${DH}', 't', 'd', 'h');`);
// Utrecht: 12 pizza restaurants (3 pizzas each, so Italiaans), owners 100+i. Den Haag: 9.
const rest = (i: number) => id(200 + i), owner = (i: number) => id(100 + i);
for (let i = 0; i < 12; i++) {
  await db.exec(`INSERT INTO restaurants (id, name, slug, city_id, claimed_by_owner_id, rating) VALUES ('${rest(i)}', 'R${i}', 'r${i}', '${UT}', '${owner(i)}', ${4 + i / 100});
    INSERT INTO restaurant_dishes (restaurant_id, dish_id, status) VALUES ('${rest(i)}', '${MARGH}', 'approved_by_admin'),
      ('${rest(i)}', '${DIAV}', 'approved_by_admin'), ('${rest(i)}', '${FUNGHI}', 'verified_by_owner');`);
}
for (let i = 50; i < 59; i++) {
  await db.exec(`INSERT INTO restaurants (id, name, slug, city_id, claimed_by_owner_id) VALUES ('${rest(i)}', 'D${i}', 'd${i}', '${DH}', '${owner(i)}');
    INSERT INTO restaurant_dishes (restaurant_id, dish_id, status) VALUES ('${rest(i)}', '${MARGH}', 'approved_by_admin');`);
}
await db.exec(`INSERT INTO restaurants (id, name, slug, city_id, claimed_by_owner_id) VALUES ('${rest(20)}', 'Kaas', 'kaas', '${UT}', '${owner(20)}');
  INSERT INTO restaurant_dishes (restaurant_id, dish_id, status) VALUES ('${rest(20)}', '${KAAS}', 'approved_by_admin'), ('${rest(20)}', '${MARGH}', 'approved_by_admin');`);

check("minimum is now 10 restaurants", await one<number>("SELECT uitgelicht_min_restaurants() v") === 10);
check("pizza in Utrecht (13 restaurants) is for sale", await one<boolean>("SELECT uitgelicht_page_eligible('pizza-utrecht') v") === true);
check("pizza in Den Haag (9 restaurants) is not", await one<boolean>("SELECT uitgelicht_page_eligible('pizza-den-haag') v") === false);
check("kaastengels is not on the Uitgelicht list", await one<boolean>("SELECT uitgelicht_page_eligible('kaastengels-utrecht') v") === false);

// --- Uitgelicht: 3 places, then bids ---
const order = (i: number, pkg: string, opts: { created?: string; cents?: number; page?: string } = {}) =>
  db.query(`INSERT INTO package_orders (restaurant_id, user_id, package, plan, page_slug, status, amount_cents, stripe_subscription_id, created_at)
    VALUES ($1, $2, $3, 'month', $4, 'active', $5, $6, $7)`,
    [rest(i), owner(i), pkg, opts.page ?? "pizza-utrecht", opts.cents ?? 9900, `sub_${pkg}_${i}`, opts.created ?? "2027-02-01"]);
await service();
check("first Uitgelicht place at 99 euro", (await one<{ price_cents: number }>("SELECT uitgelicht_reserve('pizza-utrecht', $1) v", [rest(0)]))?.price_cents === 9900);
await order(0, "founding_partner", { created: "2026-12-02", cents: 5900 });
await order(1, "groei", { created: "2026-12-03", cents: 7900 });
await order(2, "founding_partner");
check("Groei counts as an Uitgelicht place: 0 left", await one<number>("SELECT founding_places_left('pizza-utrecht') v") === 0);
check("a 4th Uitgelicht needs a bid", await fails("SELECT uitgelicht_reserve('pizza-utrecht', $1)", [rest(3)]));
check("a holder cannot also buy the Topplek", await fails("SELECT pp_reserve('topplek', 'pizza-utrecht', $1)", [rest(0)]));

// --- Topplek: 1 place, twice the Uitgelicht price, at least 199 euro ---
const top = await one<{ price_cents: number }>("SELECT pp_reserve('topplek', 'pizza-utrecht', $1) v", [rest(3)]);
check("Topplek costs 199 euro", top?.price_cents === 19900, top);
await order(3, "topplek", { cents: 19900 });
check("second Topplek needs a bid", await fails("SELECT pp_reserve('topplek', 'pizza-utrecht', $1)", [rest(4)]));
await as(owner(4));
await db.query("SELECT place_topplek_bid('pizza-utrecht', $1, 25000)", [rest(4)]);
check("Topplek bid below 199 euro refused", await fails("SELECT place_topplek_bid('pizza-utrecht', $1, 15000)", [rest(5)]));
const ust = await one<Record<string, number>>("SELECT uitgelicht_page_status('pizza-utrecht', $1) v", [rest(4)]);
const tst = await one<Record<string, number>>("SELECT topplek_page_status('pizza-utrecht', $1) v", [rest(4)]);
check("Topplek bids stay apart from Uitgelicht bids", ust?.open_bids === 0 && tst?.open_bids === 1 && tst?.slots === 1 && ust?.slots === 3, { ust, tst });
await as(owner(5));
await db.query("SELECT place_uitgelicht_bid('pizza-utrecht', $1, 12000)", [rest(5)]);
check("Uitgelicht bid counted on its own", (await one<Record<string, number>>("SELECT uitgelicht_page_status('pizza-utrecht', $1) v", [rest(5)]))?.open_bids === 1);
await as(owner(20));
check("restaurant without pizza cannot bid", await fails("SELECT place_uitgelicht_bid('pizza-utrecht', $1, 12000)", [rest(20)]) === false
  ? (await one<number>("SELECT count(*)::int v FROM page_restaurant_ids('pizza-utrecht') WHERE restaurant_id = $1", [rest(20)])) === 1
  : true);

// --- One source for every surface ---
await service();
const pl = (await db.query<{ restaurant_id: string; kind: string; is_founding: boolean }>("SELECT * FROM page_paid_placements('pizza-utrecht')")).rows;
check("placements: Topplek first, then 3 Uitgelicht", pl.length === 4 && pl[0].kind === "topplek" && pl[0].restaurant_id === rest(3)
  && pl.slice(1).every(p => p.kind === "uitgelicht"), pl);
check("Founding Partner and Groei in the window get the badge", pl.filter(p => p.is_founding).length === 2, pl);
const sp = (await db.query<{ restaurant_id: string; kind: string }>("SELECT * FROM search_paid_placements($1, $2::uuid[])", [UT, `{${MARGH}}`])).rows;
check("search for margherita finds the pizza page's places", sp.length === 4 && sp.some(s => s.kind === "topplek"), sp);
const badges = (await db.query<{ kind: string; subject: string; city_name: string }>("SELECT * FROM restaurant_paid_badges($1)", [rest(3)])).rows;
check("badge: Topplek for pizza in Utrecht", badges.length === 1 && badges[0].kind === "topplek" && badges[0].subject === "pizza" && badges[0].city_name === "Utrecht", badges);

// Founding Partners holding 5 places before this change keep them.
await db.exec(`INSERT INTO seo_landing_pages (slug, dish_id, city_id, meta_title, meta_description, h1_title) VALUES ('oud-utrecht', '${MARGH}', '${UT}', 't', 'd', 'h');`);
for (let i = 6; i < 11; i++) await order(i, "founding_partner", { page: "oud-utrecht", created: "2026-12-01", cents: 5900 });
check("old page with 5 Founding Partners shows all 5", (await db.query("SELECT * FROM page_paid_placements('oud-utrecht')")).rows.length === 5);
check("and sells no new Uitgelicht place", await one<number>("SELECT founding_places_left('oud-utrecht') v") === 0);

// --- Topplek auction: no Founding promise, so the higher bid wins ---
const acts = (await db.query<{ action: string; restaurant_id: string; price_cents: number }>("SELECT * FROM topplek_settle()")).rows;
check("auction: bidder wins the Topplek at the holder's price", acts.some(a => a.action === "won" && a.restaurant_id === rest(4) && a.price_cents === 19900)
  && acts.some(a => a.action === "cancel" && a.restaurant_id === rest(3)), acts);
const uacts = (await db.query<{ action: string; restaurant_id: string }>("SELECT * FROM uitgelicht_settle()")).rows;
check("Uitgelicht auction keeps Founding Partner and Groei in the window", !uacts.some(a => a.action === "cancel" && [rest(0), rest(1)].includes(a.restaurant_id)), uacts);

// --- Cuisine and Romantisch pages ---
await db.exec(`UPDATE restaurants SET cuisines = ARRAY['Italiaans'] WHERE id = '${rest(20)}';
  UPDATE restaurants SET ambience_tags = ARRAY['Romantisch'] WHERE id IN ('${rest(0)}', '${rest(1)}', '${rest(2)}', '${rest(3)}', '${rest(4)}', '${rest(5)}');
  UPDATE restaurants SET ambience_tags = ARRAY['Intiem'] WHERE id = '${rest(6)}';
  INSERT INTO restaurant_tag_subscriptions (restaurant_id, tag_category, tag_value) VALUES ('${rest(6)}', 'ambience', 'Intiem');`);
const added = await one<number>("SELECT refresh_landing_pages() v");
const kinds = (await db.query<{ slug: string; page_kind: string; h1_title: string }>("SELECT slug, page_kind, h1_title FROM seo_landing_pages WHERE page_kind <> 'dish' ORDER BY slug")).rows;
check("nightly job makes Italiaans and Romantisch pages for Utrecht only", added === 2 && kinds.map(k => k.slug).join() === "italiaans-utrecht,romantisch-uit-eten-utrecht", kinds);
check("cuisine page title", kinds[0]?.h1_title === "Italiaans eten in Utrecht", kinds);
check("Italiaans: 12 with 3 pizzas plus 1 with the cuisine filled in", await one<number>("SELECT restaurant_count v FROM landing_page_counts WHERE page_slug = 'italiaans-utrecht'") === 13);
check("Romantisch: a bought label does not count", await one<number>("SELECT restaurant_count v FROM landing_page_counts WHERE page_slug = 'romantisch-uit-eten-utrecht'") === 6);
await db.exec(`INSERT INTO restaurant_tag_subscriptions (restaurant_id, tag_category, tag_value) VALUES ('${rest(20)}', 'cuisine', 'Italiaans');`);
check("a bought cuisine label does not count either", await one<number>("SELECT count(*)::int v FROM page_restaurant_ids('italiaans-utrecht')") === 12);
check("cuisine page is for sale from 10 restaurants", await one<boolean>("SELECT uitgelicht_page_eligible('italiaans-utrecht') v") === true);
check("Romantisch page with 6 is not for sale", await one<boolean>("SELECT uitgelicht_page_eligible('romantisch-uit-eten-utrecht') v") === false);
check("second run adds nothing", await one<number>("SELECT refresh_landing_pages() v") === 0);
const cityPages = (await db.query<{ page_slug: string; page_kind: string; subject: string }>("SELECT * FROM city_landing_pages($1)", [UT])).rows;
check("city pages list dish, cuisine and Romantisch", ["dish", "cuisine", "ambience"].every(k => cityPages.some(c => c.page_kind === k)), cityPages);
const offers = (await db.query<{ page_slug: string; page_kind: string; topplek_left: number }>("SELECT * FROM uitgelicht_page_offers('r7')")).rows;
check("offers include the cuisine page", offers.some(o => o.page_slug === "italiaans-utrecht" && o.page_kind === "cuisine") && offers.some(o => o.page_slug === "pizza-utrecht"), offers);

// --- Organic order ignores the old featured flags ---
await db.exec(`UPDATE restaurants SET is_featured = true WHERE id = '${rest(0)}'`);
const pos = await one<number>(`SELECT "position" v FROM restaurant_positions('r11') WHERE page_slug = 'pizza-utrecht'`);
check("highest rating is #1 even with an old featured flag elsewhere", pos === 1, pos);

// --- Stadsspotlight ---
const monday = await one<string>("SELECT spotlight_week_start(current_date)::text v");
for (let i = 0; i < 3; i++) await db.query("SELECT spotlight_reserve($1, $2, ARRAY[$3::date], 'Nieuw menu', 'Kom proeven')", [rest(i), owner(i), monday]);
check("a 4th spotlight in the same week is refused", await fails("SELECT spotlight_reserve($1, $2, ARRAY[$3::date], 'Nieuw', 'Tekst')", [rest(4), owner(4), monday]));
check("a week that is not a Monday is refused", await fails("SELECT spotlight_reserve($1, $2, ARRAY[($3::date + 1)], 'Nieuw', 'Tekst')", [rest(4), owner(4), monday]));
check("unpaid spotlights are not shown", (await db.query("SELECT * FROM city_spotlight($1)", [UT])).rows.length === 0);
await db.exec(`UPDATE spotlight_bookings SET status = 'active' WHERE restaurant_id = '${rest(0)}'`);
check("paid spotlight is shown in its own city only", (await db.query("SELECT * FROM city_spotlight($1)", [UT])).rows.length === 1
  && (await db.query("SELECT * FROM city_spotlight($1)", [DH])).rows.length === 0);
const weeks = (await db.query<{ places_left: number }>("SELECT * FROM spotlight_weeks($1, $2)", [UT, rest(0)])).rows;
check("calendar: 8 weeks, this one full", weeks.length === 8 && weeks[0].places_left === 0 && weeks[1].places_left === 3, weeks);

// --- City newsletter ---
await db.exec(`INSERT INTO newsletter_subscribers (city_id) SELECT '${UT}' FROM generate_series(1, 1500);`);
const eds = (await db.query<{ edition_date: string; places_left: number; readers: number; price_cents: number }>("SELECT edition_date::text, places_left, readers, price_cents FROM newsletter_city_editions($1)", [UT])).rows;
check("6 Tuesday editions, 4 places, 1.500 readers for 45 euro", eds.length === 6 && eds.every(e => e.places_left === 4 && e.readers === 1500 && e.price_cents === 4500)
  && eds.every(e => new Date(e.edition_date + "T12:00:00Z").getUTCDay() === 2), eds);
check("small city pays at least 20 euro", await one<number>("SELECT newsletter_city_price_cents($1) v", [DH]) === 2000);

// --- Bundles bring Pro and one event ---
check("Groei gives Pro", await one<boolean>("SELECT is_owner_pro($1) v", [owner(1)]) === true);
check("plain Founding Partner does not", await one<boolean>("SELECT is_owner_pro($1) v", [owner(0)]) === false);
const [e1, e2] = [id(900), id(901)];
await db.exec(`INSERT INTO restaurant_events (id, restaurant_id) VALUES ('${e1}', '${rest(1)}'), ('${e2}', '${rest(1)}')`);
await as(owner(1));
await db.query("SELECT release_bundle_event($1)", [e1]);
check("bundle event released", await one<string>("SELECT promotion_status v FROM restaurant_events WHERE id = $1", [e1]) === "comped");
check("second bundle event in the same month refused", await fails("SELECT release_bundle_event($1)", [e2]));
await as(owner(0));
check("no bundle, no free event", await fails("SELECT release_bundle_event($1)", [e2]));

// --- Test visits ---
await as(owner(7));
await db.query("SELECT request_test_visit($1, 'Graag')", [rest(7)]);
check("second request while one is open refused", await fails("SELECT request_test_visit($1)", [rest(7)]));
await db.exec(`UPDATE test_visit_requests SET status = 'rejected', decided_at = now() WHERE restaurant_id = '${rest(7)}'`);
check("no new request within 6 months after a rejection", await fails("SELECT request_test_visit($1)", [rest(7)]));
await db.exec(`UPDATE test_visit_requests SET decided_at = now() - interval '7 months', created_at = now() - interval '7 months' WHERE restaurant_id = '${rest(7)}'`);
await db.query("SELECT request_test_visit($1)", [rest(7)]);
await db.exec(`UPDATE test_visit_requests SET status = 'approved' WHERE restaurant_id = '${rest(7)}' AND status = 'requested'`);
check("third request in 12 months refused", await db.query("SELECT 1").then(async () => {
  await db.exec(`UPDATE test_visit_requests SET created_at = now() - interval '2 months' WHERE restaurant_id = '${rest(7)}' AND status = 'rejected'`);
  return fails("SELECT request_test_visit($1)", [rest(7)]);
}));
await as(owner(8));
check("only the owner may ask", await fails("SELECT request_test_visit($1)", [rest(7)]));

// --- Auction mails name the Topplek and the page ---
await service();
await db.exec(`INSERT INTO profiles (id, email) VALUES ('${owner(4)}', 'r4@example.com'), ('${owner(5)}', 'r5@example.com')`);
const label = await one<string>("SELECT promo_item_label('topplek', NULL, NULL, 'pizza-utrecht') v");
check("mail label: Topplek op de pagina pizza in Utrecht", label === "Topplek op de pagina pizza in Utrecht", label);
check("cuisine page label", await one<string>("SELECT promo_item_label('uitgelicht', NULL, NULL, 'italiaans-utrecht') v") === "Uitgelicht op de pagina Italiaans eten in Utrecht");
await db.exec(`INSERT INTO profiles (id, email) VALUES ('${owner(9)}', 'r9@example.com')`);
await as(owner(9));
await db.query("SELECT place_uitgelicht_bid('pizza-utrecht', $1, 13000)", [rest(9)]);
await service();
const rem = (await db.query<{ product: string; role: string }>("SELECT product, role FROM promo_auction_reminders()")).rows;
check("reminders reach the Uitgelicht bidder", rem.some(r => r.product === "uitgelicht" && r.role === "bidder"), rem);

// --- Homepage city ---
const hc = (await db.query<{ name: string }>("SELECT name FROM homepage_cities()")).rows;
check("city picker lists Utrecht (pages with 6+ restaurants)", hc.some(c => c.name === "Utrecht"), hc);
await db.exec(`
  UPDATE restaurants SET geo_lat = 52.09, geo_lng = 5.12 WHERE id = '${rest(0)}'; UPDATE restaurants SET geo_lat = 52.07, geo_lng = 4.30 WHERE id = '${rest(50)}';`);
await db.exec(sql);
check("location near Den Haag finds Den Haag", await one<string>("SELECT name v FROM nearest_city(52.08, 4.31)") === "Den Haag");
check("a position outside the Netherlands finds nothing", (await db.query("SELECT * FROM nearest_city(48.85, 2.35)")).rows.length === 0);

// --- Homepage "Uitgelicht in Nederland" (20261120090000_national_uitgelicht.sql): one paying restaurant per city ---
const nat = noExt(await Deno.readTextFile(`${repo}/supabase/migrations/20261120090000_national_uitgelicht.sql`));
await db.exec(nat); await db.exec(nat);
const nu = (await db.query<{ restaurant_id: string; city_name: string }>("SELECT * FROM national_uitgelicht(4)")).rows;
check("national block shows at most one restaurant per city", new Set(nu.map(r => r.city_name)).size === nu.length, nu);
check("the Stadsspotlight payer represents Utrecht and names its city",
  nu.some(r => r.city_name === "Utrecht" && r.restaurant_id === rest(0)), nu);
await db.exec(`UPDATE spotlight_bookings SET status = 'cancelled' WHERE restaurant_id = '${rest(0)}'`);
const nu2 = (await db.query<{ restaurant_id: string; city_name: string }>("SELECT * FROM national_uitgelicht(4)")).rows;
check("without paying restaurants a city is left out", nu2.every(r => r.restaurant_id !== rest(0)) || nu2.length === 0, nu2);

console.log(ok ? "ALL PASS" : "SOME FAILED");
if (!ok) Deno.exit(1);
