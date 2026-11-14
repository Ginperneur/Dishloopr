import { PGlite } from "npm:@electric-sql/pglite@0.2.17";
// Checks Uitgelicht after the Founding Partner window: list price per page from 99 euro, bids when
// the 5 places are full, Founding Partners and year plans protected, quarterly auction with a
// uniform clearing price, and freed places going to the waiting list.
// Usage from the repo root: deno run -A --config supabase/tests/deno.json supabase/tests/uitgelicht-auction-sql.ts
const repo = Deno.args[0] ?? ".";
const db = new PGlite();
await db.exec(await Deno.readTextFile(new URL("./stubs.sql", import.meta.url)));
await db.exec(`ALTER TABLE seo_landing_pages ADD COLUMN city_id uuid;
  CREATE TABLE package_orders (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), restaurant_id uuid, user_id uuid, package text,
    plan text, page_slug text, status text, amount_cents int, stripe_subscription_id text, current_period_end timestamptz,
    created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());
  CREATE FUNCTION founding_partner_live(p_status text) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$ SELECT p_status IN ('active','trialing','past_due') $$;`);
await db.exec(await Deno.readTextFile(`${repo}/supabase/migrations/20261114130000_promo_slots.sql`));
const sql = await Deno.readTextFile(`${repo}/supabase/migrations/20261114140000_uitgelicht_auction.sql`);
await db.exec(sql); await db.exec(sql);

let ok = true;
const check = (l: string, p: boolean, g?: unknown) => { ok &&= p; console.log(p ? "PASS" : "FAIL", l, p ? "" : JSON.stringify(g)); };
const id = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const CITY = id(1), DISH = id(10), PAGE = "carbonara-utrecht";
const owners = Array.from({ length: 8 }, (_, i) => id(100 + i));
const rests = Array.from({ length: 8 }, (_, i) => id(200 + i));
await db.exec(`INSERT INTO cities VALUES ('${CITY}', 'Utrecht'); INSERT INTO dishes (id, name) VALUES ('${DISH}', 'carbonara');
  INSERT INTO seo_landing_pages (slug, dish_id, city_id) VALUES ('${PAGE}', '${DISH}', '${CITY}');
  ${rests.map((r, i) => `INSERT INTO restaurants (id, name, slug, city_id, claimed_by_owner_id) VALUES ('${r}', 'R${i}', 'r${i}', '${CITY}', '${owners[i]}');`).join("\n")}`);
const as = (uid: string) => db.exec(`DELETE FROM test_ctx; INSERT INTO test_ctx VALUES ('${uid}', 'authenticated');`);
const service = () => db.exec("DELETE FROM test_ctx; INSERT INTO test_ctx VALUES (NULL, 'service_role');");
const fails = async (q: string, p: unknown[] = []) => { try { await db.query(q, p); return false; } catch { return true; } };
const order = (i: number, opts: { plan?: string; created?: string; cents?: number; end?: string } = {}) =>
  db.query(`INSERT INTO package_orders (restaurant_id, user_id, package, plan, page_slug, status, amount_cents, stripe_subscription_id, created_at, current_period_end)
    VALUES ($1, $2, 'founding_partner', $3, $4, 'active', $5, $6, $7, $8)`,
    [rests[i], owners[i], opts.plan ?? "month", PAGE, opts.cents ?? 9900, `sub_${i}`, opts.created ?? "2027-02-01", opts.end ?? null]);

const list = (await db.query<{ p: number }>("SELECT uitgelicht_list_price($1) p", [PAGE])).rows[0].p;
check("list price starts at 99 euro", list === 9900, list);
check("unknown page falls back to 99 euro", (await db.query<{ p: number }>("SELECT uitgelicht_list_price('nergens') p")).rows[0].p === 9900);

// Page: 2 Founding Partners (bought in the window), 1 year plan, 2 normal monthly places = full.
await order(0, { created: "2026-12-01", cents: 5900 });
await order(1, { created: "2027-01-05 12:00+01", cents: 5900 });
await order(2, { plan: "year", end: "2099-01-01", cents: 99000 });
await order(3); await order(4);
await service();
check("full page: no direct checkout", await fails("SELECT uitgelicht_reserve($1, $2)", [PAGE, rests[5]]));

await as(owners[5]);
check("bid below list refused", await fails("SELECT place_uitgelicht_bid($1, $2, $3)", [PAGE, rests[5], 9000]));
check("bid for another restaurant refused", await fails("SELECT place_uitgelicht_bid($1, $2, $3)", [PAGE, rests[6], 15000]));
await db.query("SELECT place_uitgelicht_bid($1, $2, $3)", [PAGE, rests[5], 15000]);
await as(owners[6]);
await db.query("SELECT place_uitgelicht_bid($1, $2, $3)", [PAGE, rests[6], 12000]);
await as(owners[3]); // holder 3 defends with a bid
await db.query("SELECT place_uitgelicht_bid($1, $2, $3)", [PAGE, rests[3], 13000]);
const st = (await db.query<{ j: Record<string, unknown> }>("SELECT uitgelicht_page_status($1, $2) j", [PAGE, rests[3]])).rows[0].j;
check("status: 5 taken, 3 bids, window still open until 5 Jan 2027", st.taken === 5 && st.open_bids === 3 && st.window_open === (Date.now() <= Date.parse("2027-01-05T22:59:59Z")), st);

// Auction: 2 unprotected places; candidates 3 (13000), 4 (list 9900), bids 5 (15000), 6 (12000).
await service();
const acts = (await db.query<{ action: string; restaurant_id: string; price_cents: number; stripe_subscription_id: string | null }>("SELECT * FROM uitgelicht_settle()")).rows;
const by = (a: string) => acts.filter(x => x.action === a).map(x => x.restaurant_id).sort().join();
check("bidder 5 and holder 3 win the 2 open places", by("won") === rests[5] && by("reprice") === rests[3], acts);
check("holder 4 and bidder 6 lose; holder 4 is cancelled", by("cancel") === rests[4], acts);
check("winners pay the highest losing amount (120 euro)", acts.filter(a => a.action !== "cancel").every(a => a.price_cents === 12000), acts);
const fp = (await db.query<{ amount_cents: number }>("SELECT amount_cents FROM package_orders WHERE restaurant_id IN ($1, $2, $3) ORDER BY restaurant_id", [rests[0], rests[1], rests[2]])).rows;
check("Founding Partners and year plan untouched", fp.map(r => r.amount_cents).join() === "5900,5900,99000", fp);
const r3 = (await db.query<{ amount_cents: number }>("SELECT amount_cents FROM package_orders WHERE restaurant_id = $1", [rests[3]])).rows[0];
check("holder 3 repriced in package_orders", r3.amount_cents === 12000, r3);
const res = (await db.query<{ j: { price_cents: number; bid_id: string } }>("SELECT uitgelicht_reserve($1, $2) j", [PAGE, rests[5]])).rows[0].j;
check("winner 5 checks out at the clearing price", res.price_cents === 12000 && !!res.bid_id, res);
const b6 = (await db.query<{ status: string }>("SELECT status FROM promo_bids WHERE restaurant_id = $1", [rests[6]])).rows[0];
check("losing bid stays on the waiting list", b6.status === "open", b6);

// Holder 4's subscription ends (webhook sets cancelled); winner 5 pays (order created).
await db.exec(`UPDATE package_orders SET status = 'cancelled' WHERE restaurant_id = '${rests[4]}'`);
await order(5, { cents: 12000 });
await db.exec(`UPDATE promo_bids SET status = 'converted' WHERE restaurant_id = '${rests[5]}'`);
check("page full again: nothing to give away", (await db.query("SELECT * FROM uitgelicht_daily()")).rows.length === 0);
await db.exec(`UPDATE package_orders SET status = 'cancelled' WHERE restaurant_id = '${rests[0]}'`); // a Founding Partner stops
const daily = (await db.query<{ action: string; restaurant_id: string; price_cents: number }>("SELECT * FROM uitgelicht_daily()")).rows;
check("freed place goes to the waiting list (bidder 6) at the list price", daily.length === 1 && daily[0].restaurant_id === rests[6] && daily[0].price_cents === 9900, daily);

// Routing jobs ignore Uitgelicht bids
const routing = (await db.query("SELECT * FROM promo_daily()")).rows.length + (await db.query("SELECT * FROM promo_settle()")).rows.length;
check("routing jobs leave Uitgelicht alone", routing === 0, routing);

// After 2027 Founding Partners are no longer protected (simulated by the rule itself)
const prot = (await db.query<{ a: boolean; b: boolean }>(`SELECT uitgelicht_protected('2026-12-01', 'month', NULL) a, uitgelicht_protected('2027-02-01', 'month', NULL) b`)).rows[0];
check("window buyers protected, later buyers not", prot.a === true && prot.b === false, prot);
Deno.exit(ok ? 0 : 1);
