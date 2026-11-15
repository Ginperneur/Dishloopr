import { PGlite } from "npm:@electric-sql/pglite@0.2.17";
// Checks uitgelicht_page_offers: position from restaurant_positions, searches per month and places left.
// Usage from the repo root: deno run -A --config supabase/tests/deno.json supabase/tests/uitgelicht-offers-sql.ts
const repo = Deno.args[0] ?? ".";
const db = new PGlite();
await db.exec(await Deno.readTextFile(new URL("./stubs.sql", import.meta.url)));
await db.exec(`ALTER TABLE seo_landing_pages ADD COLUMN city_id uuid;
  CREATE TABLE package_orders (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), restaurant_id uuid, user_id uuid, package text,
    plan text, page_slug text, status text, amount_cents int, stripe_subscription_id text, current_period_end timestamptz,
    created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());
  CREATE FUNCTION founding_partner_live(p_status text) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$ SELECT p_status IN ('active','trialing','past_due') $$;`);
for (const f of ["20261114130000_promo_slots", "20261114140000_uitgelicht_auction", "20261115110000_uitgelicht_offers"]) {
  await db.exec(await Deno.readTextFile(`${repo}/supabase/migrations/${f}.sql`));
}
let ok = true;
const check = (l: string, p: boolean, g?: unknown) => { ok &&= p; console.log(p ? "PASS" : "FAIL", l, p ? "" : JSON.stringify(g)); };
const C = "00000000-0000-0000-0000-000000000001", D = "00000000-0000-0000-0000-000000000010";
await db.exec(`INSERT INTO cities VALUES ('${C}', 'Utrecht'); INSERT INTO dishes (id, name) VALUES ('${D}', 'carbonara');
  INSERT INTO seo_landing_pages (slug, dish_id, city_id) VALUES ('carbonara-utrecht', '${D}', '${C}');
  INSERT INTO restaurants (id, name, slug, city_id) VALUES ('00000000-0000-0000-0000-000000000200', 'T', 't', '${C}');
  INSERT INTO search_logs (query_norm, city) SELECT 'carbonara', 'Utrecht' FROM generate_series(1, 300);
  INSERT INTO package_orders (restaurant_id, package, plan, page_slug, status, amount_cents)
    SELECT gen_random_uuid(), 'founding_partner', 'month', 'carbonara-utrecht', 'active', 5900 FROM generate_series(1, 3);
  DELETE FROM test_ctx; INSERT INTO test_ctx VALUES (NULL, 'anon');`);
const r = (await db.query<{ page_slug: string; position: number; total: number; searches_per_month: string; places_left: number; list_price_cents: number }>("SELECT * FROM uitgelicht_page_offers('t')")).rows;
check("one page with position from restaurant_positions", r.length === 1 && r[0].position === 2 && r[0].total === 7, r);
check("searches per month (300 in 90 days = 100)", Number(r[0].searches_per_month) === 100, r[0]);
check("places left = 5 minus 3 live places", r[0].places_left === 2, r[0]);
check("list price from 99 euro", r[0].list_price_cents >= 9900, r[0]);
Deno.exit(ok ? 0 : 1);
