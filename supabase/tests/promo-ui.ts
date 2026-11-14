// Checks what the Vraag doorsturen dashboard offers per state (buy, bid, pay a won bid, active).
// Usage from the repo root: deno run supabase/tests/promo-ui.ts
import { routingAction, formatEuroCents, type MarketStatus } from "../../src/lib/promoSlots.ts";
let ok = true;
const check = (l: string, p: boolean, g?: unknown) => { ok &&= p; console.log(p ? "PASS" : "FAIL", l, p ? "" : JSON.stringify(g)); };
const base: MarketStatus = { list_price_cents: 1500, slots: 3, taken: 1, open_bids: 0, highest_bid_cents: null, searches_per_month: 10, suppliers: 4, next_auction: "2027-01-01", my_slot: null, my_bid: null };
check("free slot, no waiting list: buy", routingAction(base).kind === "buy");
check("buy text shows price", routingAction(base).text.includes("15"), routingAction(base).text);
check("full: bid", routingAction({ ...base, taken: 3 }).kind === "bid");
check("free slot but others waiting: bid", routingAction({ ...base, open_bids: 2 }).kind === "bid");
check("free slot and only my own bid waiting: buy", routingAction({ ...base, open_bids: 1, my_bid: { id: "b", status: "open", amount_cents: 2000, clearing_cents: null, pay_by: null } }).kind === "buy");
check("won bid: pay the clearing price", (() => { const a = routingAction({ ...base, taken: 3, my_bid: { id: "b", status: "won", amount_cents: 4000, clearing_cents: 2500, pay_by: null } }); return a.kind === "pay_won" && a.text.includes("25"); })());
check("own active slot", routingAction({ ...base, my_slot: { status: "active", price_cents: 1500, term_end: null } }).kind === "active");
check("own slot ending", routingAction({ ...base, my_slot: { status: "ending", price_cents: 1500, term_end: null } }).kind === "ending");
check("euro format without cents", formatEuroCents(1500).replace(/\s/g, " ") === "€ 15", formatEuroCents(1500));
check("euro format with cents", formatEuroCents(1550).replace(/\s/g, " ") === "€ 15,50", formatEuroCents(1550));
Deno.exit(ok ? 0 : 1);
