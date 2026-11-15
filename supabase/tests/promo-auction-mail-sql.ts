import { PGlite } from "npm:@electric-sql/pglite@0.2.17";
// Checks who gets an auction reminder: holders where others bid (routing and unprotected
// Uitgelicht), every open bidder; nobody without competition, protected Founding Partners never.
// Usage from the repo root: deno run -A --config supabase/tests/deno.json supabase/tests/promo-auction-mail-sql.ts
const repo = Deno.args[0] ?? ".";
const db = new PGlite();
await db.exec(await Deno.readTextFile(new URL("./stubs.sql", import.meta.url)));
await db.exec(`ALTER TABLE seo_landing_pages ADD COLUMN city_id uuid;
  CREATE TABLE profiles (id uuid PRIMARY KEY, email text);
  CREATE TABLE package_orders (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), restaurant_id uuid, user_id uuid, package text,
    plan text, page_slug text, status text, amount_cents int, stripe_subscription_id text, current_period_end timestamptz,
    created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());
  CREATE FUNCTION founding_partner_live(p_status text) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$ SELECT p_status IN ('active','trialing','past_due') $$;`);
for (const f of ["20261114130000_promo_slots", "20261114140000_uitgelicht_auction", "20261115100000_promo_auction_mail"]) {
  const sql = await Deno.readTextFile(`${repo}/supabase/migrations/${f}.sql`);
  await db.exec(sql); if (f.endsWith("mail")) await db.exec(sql);
}
let ok = true;
const check = (l: string, p: boolean, g?: unknown) => { ok &&= p; console.log(p ? "PASS" : "FAIL", l, p ? "" : JSON.stringify(g)); };
const id = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const CITY = id(1), DISH = id(10), DISH2 = id(11), PAGE = "biefstuk-den-haag";
await db.exec(`INSERT INTO cities VALUES ('${CITY}', 'Den Haag'); INSERT INTO dishes (id, name) VALUES ('${DISH}', 'biefstuk'), ('${DISH2}', 'sushi');
  INSERT INTO seo_landing_pages (slug, dish_id, city_id) VALUES ('${PAGE}', '${DISH}', '${CITY}');
  ${[0, 1, 2, 3, 4, 5].map(i => `INSERT INTO restaurants (id, name, slug, city_id, claimed_by_owner_id) VALUES ('${id(200 + i)}', 'R${i}', 'r${i}', '${CITY}', '${id(100 + i)}');
  INSERT INTO profiles VALUES ('${id(100 + i)}', 'r${i}@x.nl');`).join("\n")}`);
await db.exec("DELETE FROM test_ctx; INSERT INTO test_ctx VALUES (NULL, 'service_role');");
const m1 = (await db.query<{ m: string }>(`SELECT promo_market_id('routing', '${CITY}', '${DISH}') m`)).rows[0].m;
const m2 = (await db.query<{ m: string }>(`SELECT promo_market_id('routing', '${CITY}', '${DISH2}') m`)).rows[0].m;
const mu = (await db.query<{ m: string }>(`SELECT promo_market_id('uitgelicht', '${CITY}', '${DISH}') m`)).rows[0].m;
await db.exec(`
  INSERT INTO promo_slots (market_id, restaurant_id, user_id, status, price_cents) VALUES
    ('${m1}', '${id(200)}', '${id(100)}', 'active', 1500),   -- holder with competition
    ('${m2}', '${id(201)}', '${id(101)}', 'active', 1500);   -- holder, no bids on sushi
  INSERT INTO promo_bids (market_id, restaurant_id, user_id, amount_cents) VALUES ('${m1}', '${id(202)}', '${id(102)}', 2500);
  INSERT INTO package_orders (restaurant_id, user_id, package, plan, page_slug, status, amount_cents, created_at) VALUES
    ('${id(203)}', '${id(103)}', 'founding_partner', 'month', '${PAGE}', 'active', 9900, '2027-02-01'),  -- unprotected
    ('${id(204)}', '${id(104)}', 'founding_partner', 'month', '${PAGE}', 'active', 5900, '2026-12-01'); -- Founding Partner
  INSERT INTO promo_bids (market_id, restaurant_id, user_id, amount_cents, page_slug) VALUES ('${mu}', '${id(205)}', '${id(105)}', 12000, '${PAGE}');`);
const rows = (await db.query<{ email: string; role: string; product: string; label: string; highest_bid_cents: number; open_bids: number; auction_date: string }>("SELECT * FROM promo_auction_reminders()")).rows;
const who = rows.map(r => `${r.email}:${r.role}:${r.product}`).sort();
check("holder with competition, both bidders and the unprotected Uitgelicht holder", JSON.stringify(who) === JSON.stringify(["r0@x.nl:holder:routing", "r2@x.nl:bidder:routing", "r3@x.nl:holder:uitgelicht", "r5@x.nl:bidder:uitgelicht"]), who);
check("holder without bids and protected Founding Partner get nothing", !who.some(w => w.startsWith("r1@") || w.startsWith("r4@")));
const r0 = rows.find(r => r.email === "r0@x.nl")!;
check("label and highest bid for routing", r0.label === "Vraag doorsturen voor biefstuk in Den Haag" && r0.highest_bid_cents === 2500 && r0.open_bids === 1, r0);
const r3 = rows.find(r => r.email === "r3@x.nl")!;
check("label for Uitgelicht page", r3.label === "Uitgelicht op de pagina biefstuk in Den Haag", r3);
check("auction date is the 1st of the next quarter", /^\d{4}-(01|04|07|10)-01$/.test(new Date(r0.auction_date as unknown as string).toISOString().slice(0, 10)), r0.auction_date);
const slot = (await db.query<{ id: string }>(`SELECT id FROM promo_slots WHERE restaurant_id = '${id(200)}'`)).rows[0].id;
const mail = (await db.query<{ email: string; label: string }>("SELECT * FROM promo_action_mail('routing', $1, NULL)", [slot])).rows[0];
check("action mail details for a slot", mail.email === "r0@x.nl" && mail.label.includes("biefstuk"), mail);
Deno.exit(ok ? 0 : 1);
