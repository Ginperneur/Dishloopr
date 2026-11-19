// Daily job for paid promotion slots (pg_cron, 03:00 UTC):
//  * every day: drop abandoned checkouts, expire unpaid wins, give freed slots to the waiting list;
//  * on the first day of a quarter: the auction (promo_settle), whose new prices and outbid
//    slots are applied to the Stripe subscriptions here.
// Owners hear about wins, outbids and new prices through owner_notifications.
import { isInternalCaller, getCaller, isAdmin } from "../_shared/auth.ts";
import { sendTemplateEmail } from "../_shared/transactional-email-templates/send-email.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.118.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const NAME = { routing: "Vraag doorsturen", uitgelicht: "Uitgelicht", topplek: "Topplek" } as const;
const LINK = { routing: "https://dishloopr.nl/owner-dashboard?tab=promotions", uitgelicht: "https://dishloopr.nl/voor-restaurants/pakketten", topplek: "https://dishloopr.nl/voor-restaurants/pakketten" } as const;
interface Reminder { user_id: string; email: string; restaurant_name: string; product: "routing" | "uitgelicht" | "topplek"; label: string; role: "holder" | "bidder";
  my_cents: number; highest_bid_cents: number | null; open_bids: number; auction_date: string }
const nextQuarterStart = (d: Date) => new Date(Date.UTC(d.getUTCFullYear() + (d.getUTCMonth() >= 9 ? 1 : 0), (Math.floor(d.getUTCMonth() / 3) * 3 + 3) % 12, 1));
const euro = (c: number) => `€${(c / 100).toLocaleString("nl-NL", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

interface Action { product: "routing" | "uitgelicht" | "topplek"; action: "reprice" | "cancel" | "won"; slot_id: string | null; bid_id: string | null; restaurant_id: string; user_id: string; price_cents: number; stripe_subscription_id: string | null }

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const db = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "") as unknown as SupabaseClient;
  try {
    let caller: { id: string; email?: string } | null = null;
    if (!(await isInternalCaller(req, db))) {
      caller = await getCaller(req);
      if (!caller || !(await isAdmin(db, caller.id))) return json({ error: "Forbidden" }, 403);
    }
    const body = await req.json().catch(() => ({}));

    // Test: an admin gets every auction mail once, with sample data. Nothing else runs.
    if (body.test_mail === true) {
      if (!caller?.email) return json({ error: "Alleen vanuit het adminpaneel" }, 400);
      const next = nextQuarterStart(new Date()).toISOString().slice(0, 10);
      const base = { restaurantName: "Dishloopr Testkeuken", label: "Vraag doorsturen voor ramen in Utrecht", link: LINK.routing, auctionDate: next };
      const variants = [
        { kind: "reminder_holder", myCents: 1500, highestBidCents: 2500, openBids: 2, daysLeft: 14 },
        { kind: "reminder_bidder", myCents: 2000, highestBidCents: 2500, openBids: 2, daysLeft: 3 },
        { kind: "won", priceCents: 2000 },
        { kind: "outbid" },
        { kind: "reprice", priceCents: 2000 },
      ];
      const stamp = Date.now();
      for (const v of variants)
        await sendTemplateEmail("promo-auction", caller.email, { templateData: { ...base, ...v }, idempotencyKey: `promo-test-${v.kind}-${caller.id}-${stamp}` });
      return json({ test: true, sent: variants.length, to: caller.email });
    }
    const today = new Date();
    const quarterStart = today.getUTCDate() === 1 && [0, 3, 6, 9].includes(today.getUTCMonth());
    const settle = quarterStart || body.settle === true;

    // Vraag doorsturen (promo_slots) and Uitgelicht (package_orders) share the same auction rules.
    const actions: Action[] = [];
    const run = async (fn: string, product: Action["product"]) => {
      const { data, error } = await db.rpc(fn);
      if (error) throw error;
      actions.push(...((data ?? []) as Action[]).map(a => ({ ...a, product })));
    };
    if (settle) {
      await run("promo_settle", "routing");
      await run("uitgelicht_settle", "uitgelicht");
      await run("topplek_settle", "topplek");
    }
    await run("promo_daily", "routing");
    await run("uitgelicht_daily", "uitgelicht");
    await run("topplek_daily", "topplek");

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { apiVersion: "2025-08-27.basil" });
    const results: { action: string; ok: boolean; error?: string }[] = [];
    for (const a of actions) {
      try {
        if (a.action === "reprice" && a.stripe_subscription_id) {
          const sub = await stripe.subscriptions.retrieve(a.stripe_subscription_id);
          const item = sub.items.data[0];
          const product = typeof item.price.product === "string" ? item.price.product : item.price.product.id;
          if (item.price.unit_amount !== a.price_cents) {
            await stripe.subscriptions.update(sub.id, {
              items: [{ id: item.id, price_data: { currency: "eur", unit_amount: a.price_cents, tax_behavior: "exclusive", recurring: { interval: "month" }, product } }],
              proration_behavior: "none",
            });
            await notify(db, a, "Nieuwe prijs voor je plek", `Vanaf je volgende factuur betaal je ${euro(a.price_cents)} per maand excl. btw voor ${NAME[a.product]}.`);
          }
        } else if (a.action === "cancel" && a.stripe_subscription_id) {
          await stripe.subscriptions.update(a.stripe_subscription_id, { cancel_at_period_end: true });
          await notify(db, a, "Je bent overboden", `Andere restaurants boden meer voor je plek bij ${NAME[a.product]}. Je plek loopt af aan het eind van je betaalde periode. Je kunt opnieuw bieden.`);
        } else if (a.action === "won") {
          await notify(db, a, "Je hebt een plek gewonnen", `Rond binnen 7 dagen af voor ${euro(a.price_cents)} per maand excl. btw bij ${NAME[a.product]}${a.product === "routing" ? " (Promoties)" : " (Pakketten)"}.`);
        }
        results.push({ action: a.action, ok: true });
      } catch (e) {
        console.error("promo-auctions action", a, e);
        results.push({ action: a.action, ok: false, error: e instanceof Error ? e.message : String(e) });
      }
    }
    // Reminders 14 and 3 days before the auction on the 1st of the next quarter.
    const next = nextQuarterStart(today);
    const daysLeft = Math.round((next.getTime() - Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())) / 86_400_000);
    let reminders = 0;
    if ([14, 3].includes(daysLeft) || body.reminders === true) {
      const { data: rows, error: remErr } = await db.rpc("promo_auction_reminders");
      if (remErr) throw remErr;
      for (const r of (rows ?? []) as Reminder[]) {
        try {
          await sendTemplateEmail("promo-auction", r.email, {
            templateData: { kind: r.role === "holder" ? "reminder_holder" : "reminder_bidder", restaurantName: r.restaurant_name,
              label: r.label, myCents: r.my_cents, highestBidCents: r.highest_bid_cents, openBids: r.open_bids,
              auctionDate: r.auction_date, daysLeft, link: LINK[r.product] },
            idempotencyKey: `promo-reminder-${r.role}-${r.user_id}-${r.label}-${r.auction_date}-${daysLeft}`,
          });
          reminders++;
        } catch (e) {
          console.error("promo-auctions reminder", r.email, e);
        }
      }
    }
    return json({ settled: settle, actions: results.length, failed: results.filter(r => !r.ok).length, reminders, results });
  } catch (e) {
    console.error("promo-auctions", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

async function notify(db: SupabaseClient, a: Action, title: string, body: string) {
  // Also by mail: owners must not miss a win (7 days to pay), an outbid or a new price.
  try {
    const { data } = await db.rpc("promo_action_mail", { p_product: a.product, p_slot: a.slot_id, p_bid: a.bid_id });
    const m = (data ?? [])[0] as { email: string; restaurant_name: string; label: string } | undefined;
    if (m?.email) {
      await sendTemplateEmail("promo-auction", m.email, {
        templateData: { kind: a.action === "cancel" ? "outbid" : a.action, restaurantName: m.restaurant_name, label: m.label,
          priceCents: a.price_cents, link: LINK[a.product] },
        idempotencyKey: `promo-${a.action}-${a.slot_id ?? a.bid_id}-${new Date().toISOString().slice(0, 10)}`,
      });
    }
  } catch (e) {
    console.error("promo-auctions mail", a, e);
  }
  await db.from("owner_notifications").insert({
    user_id: a.user_id, restaurant_id: a.restaurant_id, type: "promo_slot", title, body,
    link: a.product === "routing" ? "/owner-dashboard?tab=promotions" : "/voor-restaurants/pakketten",
  });
}
