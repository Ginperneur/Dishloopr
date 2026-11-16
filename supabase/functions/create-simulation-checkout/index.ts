// Buy simulations at 1.99 euro each (after the 3 free ones). The owner can change the number in
// Stripe Checkout (1 to 20); stripe-webhook credits them once per session (grant_simulation_credits).
import { safeOrigin, getCaller } from "../_shared/auth.ts";
import { billingParams } from "../_shared/billing.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.118.0";
import { withVat } from "../_shared/vat.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const PRICE_CENTS = 199;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const user = await getCaller(req);
    if (!user?.email) return json({ error: "Log opnieuw in" }, 401);
    const { restaurant_id, quantity } = await req.json().catch(() => ({}));
    if (typeof restaurant_id !== "string" || !/^[0-9a-f-]{36}$/i.test(restaurant_id)) return json({ error: "Ongeldig restaurant" }, 400);
    const qty = Math.min(20, Math.max(1, Math.round(Number(quantity) || 1)));

    const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const [{ data: owns }, { data: isAdmin }] = await Promise.all([
      admin.rpc("is_verified_owner", { _user_id: user.id, _restaurant_id: restaurant_id }),
      admin.rpc("has_role", { _user_id: user.id, _role: "admin" }),
    ]);
    if (owns !== true && isAdmin !== true) return json({ error: "Alleen de geverifieerde eigenaar kan simulaties kopen" }, 403);

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { apiVersion: "2025-08-27.basil" });
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    const customerId = customers.data[0]?.id;
    const meta = { type: "simulation_credits", restaurant_id, user_id: user.id };
    const origin = safeOrigin(req);
    const session = await stripe.checkout.sessions.create(await withVat(stripe, {
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      mode: "payment",
      line_items: [{
        quantity: qty,
        adjustable_quantity: { enabled: true, minimum: 1, maximum: 20 },
        price_data: { currency: "eur", unit_amount: PRICE_CENTS, tax_behavior: "exclusive", product_data: { name: "Simulatie" } },
      }],
      ...billingParams({ mode: "payment", customerId, description: "Simulaties Dishloopr" }),
      metadata: meta,
      payment_intent_data: { metadata: meta },
      success_url: `${origin}/owner-dashboard?tab=menu&simulation=success`,
      cancel_url: `${origin}/owner-dashboard?tab=menu`,
    }));
    return json({ url: session.url });
  } catch (e) {
    console.error("create-simulation-checkout", e);
    return json({ error: e instanceof Error ? e.message : "Onbekende fout" }, 500);
  }
});
