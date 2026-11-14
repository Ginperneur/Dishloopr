import { PGlite } from "npm:@electric-sql/pglite@0.2.17";
// Checks paid promotion slots: demand price, buying a free slot, bids when full, the quarterly
// auction (uniform clearing price, holders outbid) and the waiting list filling freed slots.
// Usage from the repo root: deno run -A --config supabase/tests/deno.json supabase/tests/promo-slots-sql.ts
const repo = Deno.args[0] ?? ".";
const db = new PGlite();
await db.exec(await Deno.readTextFile(new URL("./stubs.sql", import.meta.url)));
const sql = await Deno.readTextFile(`${repo}/supabase/migrations/20261114130000_promo_slots.sql`);
await db.exec(sql); await db.exec(sql); // idempotent

let ok = true;
const check = (l: string, p: boolean, g?: unknown) => { ok &&= p; console.log(p ? "PASS" : "FAIL", l, p ? "" : JSON.stringify(g)); };
const id = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const CITY = id(1), QUIET = id(2), DISH = id(10), SUSHI = id(11);
const owners = [1, 2, 3, 4, 5].map(n => id(100 + n));
const rests = [1, 2, 3, 4, 5].map(n => id(200 + n));
await db.exec(`INSERT INTO cities VALUES ('${CITY}', 'Den Haag'), ('${QUIET}', 'Ergens');
  INSERT INTO dishes (id, name) VALUES ('${DISH}', 'biefstuk'), ('${SUSHI}', 'sushi');
  ${rests.map((r, i) => `INSERT INTO restaurants (id, name, slug, city_id, claimed_by_owner_id) VALUES ('${r}', 'R${i}', 'r${i}', '${CITY}', '${owners[i]}');
  INSERT INTO restaurant_dishes (restaurant_id, dish_id, status) VALUES ('${r}', '${DISH}', 'verified_by_owner');`).join("\n")}`);
const as = (uid: string) => db.exec(`DELETE FROM test_ctx; INSERT INTO test_ctx VALUES ('${uid}', 'authenticated');`);
const one = async <T,>(q: string, p: unknown[] = []) => (await db.query<T>(q, p)).rows[0];
const fails = async (q: string, p: unknown[] = []) => { try { await db.query(q, p); return false; } catch { return true; } };

// Price
let p = (await one<{ p: number }>("SELECT promo_list_price('routing', $1, $2) p", [QUIET, SUSHI])).p;
check("no demand: base price 15 euro", p === 1500, p);
const base = (await one<{ p: number }>("SELECT promo_list_price('routing', $1, $2) p", [CITY, DISH])).p;
await db.exec(`INSERT INTO search_logs (query_norm, city) SELECT 'biefstuk den haag', 'Den Haag' FROM generate_series(1, 1500);`);
p = (await one<{ p: number }>("SELECT promo_list_price('routing', $1, $2) p", [CITY, DISH])).p;
check("5 restaurants serving it raise the price a little", base === 1500 || base === 2000, base);
check("high demand (500 searches/month) raises the price in steps of 5 euro", p > base && (p - 1500) % 500 === 0 && p <= 7500, p);
await db.exec(`INSERT INTO search_logs (query_norm, city) SELECT 'biefstuk', 'Den Haag' FROM generate_series(1, 400000);`);
const cap = (await one<{ p: number }>("SELECT promo_list_price('routing', $1, $2) p", [CITY, DISH])).p;
check("never above 5x base", cap === 7500, cap);
await db.exec("DELETE FROM search_logs WHERE query_norm = 'biefstuk'");
const list = p;
check("uitgelicht base is 99 euro", (await one<{ p: number }>("SELECT promo_list_price('uitgelicht', $1, $2) p", [QUIET, SUSHI])).p === 9900);

// Buying: three free slots (reserve as the edge function does, then mark paid as the webhook does)
const buy = async (i: number) => {
  const r = await one<{ j: { slot_id: string; price_cents: number } }>("SELECT promo_reserve_slot('routing', $1, $2, $3, $4) j", [CITY, DISH, rests[i], owners[i]]);
  await db.query("UPDATE promo_slots SET status = 'active', stripe_subscription_id = $2, reserved_until = NULL WHERE id = $1", [r.j.slot_id, `sub_${i}`]);
  return r.j;
};
const b0 = await buy(0);
check("free slot sold at the list price", b0.price_cents === list, b0);
await buy(1); await buy(2);
check("fourth restaurant cannot buy when full", await fails("SELECT promo_reserve_slot('routing', $1, $2, $3, $4)", [CITY, DISH, rests[3], owners[3]]));
check("same restaurant cannot buy twice", await fails("SELECT promo_reserve_slot('routing', $1, $2, $3, $4)", [CITY, DISH, rests[0], owners[0]]));

// Bids
await as(owners[3]);
check("bid below list price refused", await fails("SELECT place_promo_bid('routing', $1, $2, $3, $4)", [CITY, DISH, rests[3], list - 500]));
check("bid on a dish not on the menu refused", await fails("SELECT place_promo_bid('routing', $1, $2, $3, $4)", [CITY, SUSHI, rests[3], 5000]));
check("bid for another restaurant refused", await fails("SELECT place_promo_bid('routing', $1, $2, $3, $4)", [CITY, DISH, rests[4], 5000]));
await db.query("SELECT place_promo_bid('routing', $1, $2, $3, $4)", [CITY, DISH, rests[3], list + 2000]);
await as(owners[4]);
await db.query("SELECT place_promo_bid('routing', $1, $2, $3, $4)", [CITY, DISH, rests[4], list + 1000]);
await as(owners[0]);
const st = await one<{ j: Record<string, unknown> }>("SELECT promo_market_status('routing', $1, $2, $3) j", [CITY, DISH, rests[0]]);
check("status shows full market and 2 bids", st.j.taken === 3 && st.j.open_bids === 2 && (st.j.my_slot as { status: string })?.status === "active", st.j);
await as(owners[3]);
check("status for another restaurant refused", await fails("SELECT promo_market_status('routing', $1, $2, $3)", [CITY, DISH, rests[0]]));

// Quarterly auction: holder 0 raises to list+3000, holders 1 and 2 at list price, bidders at list+2000 and +1000.
await as(owners[0]);
await db.query("SELECT place_promo_bid('routing', $1, $2, $3, $4)", [CITY, DISH, rests[0], list + 3000]);
await db.exec("DELETE FROM test_ctx; INSERT INTO test_ctx VALUES (NULL, 'service_role');");
const acts = (await db.query<{ action: string; restaurant_id: string; price_cents: number; stripe_subscription_id: string | null }>("SELECT * FROM promo_settle()")).rows;
const by = (a: string) => acts.filter(x => x.action === a);
check("winners: holder 0, bidders 3 and 4", by("reprice").map(x => x.restaurant_id).join() === rests[0] && by("won").map(x => x.restaurant_id).sort().join() === [rests[3], rests[4]].sort().join(), acts);
check("holders 1 and 2 outbid, their subscriptions cancel", by("cancel").map(x => x.stripe_subscription_id).sort().join() === "sub_1,sub_2", by("cancel"));
const clear = list; // highest losing amount = holders at list price
check("everyone pays the clearing price (highest losing bid, at least list)", acts.filter(x => x.action !== "cancel").every(x => x.price_cents === clear), acts);
const slots = (await db.query<{ restaurant_id: string; status: string }>("SELECT restaurant_id, status FROM promo_slots WHERE status <> 'ended' ORDER BY restaurant_id")).rows;
check("outbid slots are ending, winner keeps active", JSON.stringify(slots.map(s => s.status)) === '["active","ending","ending"]', slots);

// Winner pays within 7 days
const won = await one<{ j: { price_cents: number; bid_id: string } }>("SELECT promo_reserve_slot('routing', $1, $2, $3, $4) j", [CITY, DISH, rests[3], owners[3]]);
check("won bidder reserves at the clearing price", won.j.price_cents === clear && !!won.j.bid_id, won.j);

// No bids: holders renew at the new list price
await db.exec("UPDATE promo_bids SET status = 'withdrawn' WHERE status IN ('open', 'won')");
await db.exec("UPDATE promo_slots SET status = 'ended' WHERE status IN ('ending', 'pending_payment')");
await db.exec("DELETE FROM search_logs");
const quiet = (await db.query<{ action: string; price_cents: number }>("SELECT * FROM promo_settle()")).rows;
check("without bids holders are repriced to the list price, nobody cancelled", quiet.every(x => x.action === "reprice" && x.price_cents === base) && quiet.length >= 1, quiet);

// Waiting list fills a freed slot daily
await as(owners[4]);
await db.query("SELECT place_promo_bid('routing', $1, $2, $3, $4)", [CITY, DISH, rests[4], base + 500]);
await db.exec("DELETE FROM test_ctx; INSERT INTO test_ctx VALUES (NULL, 'service_role');");
const daily = (await db.query<{ action: string; restaurant_id: string; price_cents: number }>("SELECT * FROM promo_daily()")).rows;
check("free slot goes to the waiting list at the list price", daily.length === 1 && daily[0].restaurant_id === rests[4] && daily[0].price_cents === base, daily);
check("nobody else can buy past the waiting list", await fails("SELECT promo_reserve_slot('routing', $1, $2, $3, $4)", [CITY, DISH, rests[2], owners[2]]));
await db.exec("UPDATE promo_bids SET pay_by = now() - interval '1 day' WHERE status = 'won'");
await db.query("SELECT * FROM promo_daily()");
const exp = await one<{ status: string }>("SELECT status FROM promo_bids WHERE restaurant_id = $1 ORDER BY created_at DESC LIMIT 1", [rests[4]]);
check("unpaid win expires after 7 days", exp.status === "expired", exp);

// Sponsors lookup (public)
await db.exec("DELETE FROM test_ctx; INSERT INTO test_ctx VALUES (NULL, 'anon');");
const sp = (await db.query<{ restaurant_id: string }>("SELECT * FROM routing_sponsors($1, $2)", [CITY, [DISH]])).rows;
check("sponsors are the active slot holders", sp.length === 1 && sp[0].restaurant_id === rests[0], sp);
Deno.exit(ok ? 0 : 1);
