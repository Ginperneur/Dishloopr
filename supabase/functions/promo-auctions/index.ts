// Daily job for paid promotion slots (pg_cron, 03:00 UTC):
//  * every day: drop abandoned checkouts, expire unpaid wins, give freed slots to the waiting list;
//  * on the first day of a quarter: the auction (promo_settle), whose new prices and outbid
//    slots are applied to the Stripe subscriptions here.
// Owners hear about wins, outbids and new prices through owner_notifications.
import { isInternalCaller, getCaller, isAdmin } from "../_shared/auth.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.118.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const NAME = { routing: "Vraag doorsturen", uitgelicht: "Uitgelicht" } as const;
const euro = (c: number) => `€${(c / 100).toLocaleString("nl-NL", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

interface Action { product: "routing" | "uitgelicht"; action: "reprice" | "cancel" | "won"; slot_id: string | null; bid_id: string | null; restaurant_id: string; user_id: string; price_cents: number; stripe_subscription_id: string | null }

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const db = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "") as unknown as SupabaseClient;
  try {
    if (!(await isInternalCaller(req, db))) {
      const user = await getCaller(req);
      if (!user || !(await isAdmin(db, user.id))) return json({ error: "Forbidden" }, 403);
    }
    const body = await req.json().catch(() => ({}));
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
    }
    await run("promo_daily", "routing");
    await run("uitgelicht_daily", "uitgelicht");

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
            await notify(db, a, "Nieuwe prijs voor je plek", `Vanaf je volgende factuur betaal je ${euro(a.price_cents)} per maand voor ${NAME[a.product]}.`);
          }
        } else if (a.action === "cancel" && a.stripe_subscription_id) {
          await stripe.subscriptions.update(a.stripe_subscription_id, { cancel_at_period_end: true });
          await notify(db, a, "Je bent overboden", `Andere restaurants boden meer voor je plek bij ${NAME[a.product]}. Je plek loopt af aan het eind van je betaalde periode. Je kunt opnieuw bieden.`);
        } else if (a.action === "won") {
          await notify(db, a, "Je hebt een plek gewonnen", `Rond binnen 7 dagen af voor ${euro(a.price_cents)} per maand bij ${NAME[a.product]}${a.product === "uitgelicht" ? " (Pakketten)" : " (Promoties)"}.`);
        }
        results.push({ action: a.action, ok: true });
      } catch (e) {
        console.error("promo-auctions action", a, e);
        results.push({ action: a.action, ok: false, error: e instanceof Error ? e.message : String(e) });
      }
    }
    return json({ settled: settle, actions: results.length, failed: results.filter(r => !r.ok).length, results });
  } catch (e) {
    console.error("promo-auctions", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

async function notify(db: SupabaseClient, a: Action, title: string, body: string) {
  await db.from("owner_notifications").insert({
    user_id: a.user_id, restaurant_id: a.restaurant_id, type: "promo_slot", title, body,
    link: a.product === "uitgelicht" ? "/voor-restaurants/pakketten" : "/owner-dashboard?tab=promotions",
  });
}
