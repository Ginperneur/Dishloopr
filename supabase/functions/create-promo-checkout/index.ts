// Checkout for a paid promotion slot (Vraag doorsturen: one dish in one city, monthly).
// The database decides availability and price (promo_reserve_slot): a free slot at the list price,
// or a won bid at its clearing price. The slot is held for 30 minutes while the owner pays.
import { safeOrigin, getCaller } from "../_shared/auth.ts";
import { billingParams } from "../_shared/billing.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.118.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const user = await getCaller(req);
    if (!user?.email) return json({ error: "Log opnieuw in" }, 401);
    const { product = "routing", city_id, dish_id, restaurant_id } = await req.json();
    if (product !== "routing") return json({ error: "Onbekend product" }, 400);
    if (!city_id || !dish_id || !restaurant_id) return json({ error: "Kies een stad en een gerecht" }, 400);

    const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const [{ data: owns }, { data: isAdmin }, { data: onMenu }] = await Promise.all([
      admin.rpc("is_verified_owner", { _user_id: user.id, _restaurant_id: restaurant_id }),
      admin.rpc("has_role", { _user_id: user.id, _role: "admin" }),
      admin.rpc("promo_dish_on_menu", { p_restaurant: restaurant_id, p_dish: dish_id }),
    ]);
    if (owns !== true && isAdmin !== true) return json({ error: "Alleen de geverifieerde eigenaar kan dit kopen" }, 403);
    if (onMenu !== true) return json({ error: "Dit gerecht staat niet op je menu" }, 400);

    const { data: reserved, error: resErr } = await admin.rpc("promo_reserve_slot", {
      p_product: product, p_city: city_id, p_dish: dish_id, p_restaurant: restaurant_id, p_user: user.id,
    });
    if (resErr) return json({ error: resErr.message }, 409);
    const { slot_id, price_cents, bid_id } = reserved as { slot_id: string; price_cents: number; bid_id: string | null };

    const [{ data: dish }, { data: city }] = await Promise.all([
      admin.from("dishes").select("name").eq("id", dish_id).single(),
      admin.from("cities").select("name").eq("id", city_id).single(),
    ]);
    const label = `Vraag doorsturen: ${dish?.name ?? "gerecht"} in ${city?.name ?? "stad"}`.slice(0, 200);

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { apiVersion: "2025-08-27.basil" });
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    const customerId = customers.data[0]?.id;
    const meta = { type: "promo_slot", slot_id, bid_id: bid_id ?? "", restaurant_id, user_id: user.id, product };
    const origin = safeOrigin(req);
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      mode: "subscription",
      line_items: [{
        quantity: 1,
        price_data: {
          currency: "eur",
          unit_amount: price_cents,
          tax_behavior: "exclusive",
          recurring: { interval: "month" },
          product_data: { name: label },
        },
      }],
      ...billingParams({ mode: "subscription", customerId }),
      metadata: meta,
      subscription_data: { metadata: meta, description: label },
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60 + 60,
      success_url: `${origin}/owner-dashboard?tab=promotions&promo=success`,
      cancel_url: `${origin}/owner-dashboard?tab=promotions`,
    });
    return json({ url: session.url });
  } catch (e) {
    console.error("create-promo-checkout", e);
    return json({ error: e instanceof Error ? e.message : "Onbekende fout" }, 500);
  }
});
