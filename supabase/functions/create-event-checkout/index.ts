import { safeOrigin, serviceClient, getCaller, isAdmin } from "../_shared/auth.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { billingParams } from "../_shared/billing.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

// Starts a €5/month subscription for one event. STRIPE_EVENT_PRICE_ID wins when
// set, otherwise the price is created inline; stripe-webhook flips the event to 'paid'.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const user = await getCaller(req);
    if (!user?.email) return json({ error: "Niet ingelogd" }, 401);

    const { event_id } = await req.json().catch(() => ({}));
    if (typeof event_id !== "string") return json({ error: "Ontbrekend evenement" }, 400);

    const admin = serviceClient();
    const { data: event } = await admin
      .from("restaurant_events")
      .select("id, restaurant_id, title, promotion_status")
      .eq("id", event_id)
      .maybeSingle();
    if (!event) return json({ error: "Evenement niet gevonden" }, 404);

    const { data: verified } = await admin.rpc("is_verified_owner", { _user_id: user.id, _restaurant_id: event.restaurant_id });
    if (verified !== true && !(await isAdmin(admin, user.id))) return json({ error: "Geen toegang tot dit evenement" }, 403);
    if (event.promotion_status === "paid") return json({ error: "Dit evenement is al betaald" }, 409);

    const priceId = Deno.env.get("STRIPE_EVENT_PRICE_ID");
    const lineItem = priceId
      ? { price: priceId, quantity: 1 }
      : { quantity: 1, price_data: { currency: "eur", unit_amount: 500, tax_behavior: "exclusive" as const, recurring: { interval: "month" as const }, product_data: { name: "Evenement op Dishloopr" } } };

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { apiVersion: "2025-08-27.basil" });
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    const customerId = customers.data[0]?.id;

    const metadata = { type: "event_promotion", event_id: event.id, restaurant_id: event.restaurant_id, user_id: user.id };
    const origin = safeOrigin(req);
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [lineItem],
      mode: "subscription",
      ...billingParams({ mode: "subscription", customerId }),
      metadata,
      subscription_data: { metadata, description: `Evenement: ${event.title}`.slice(0, 500) },
      success_url: `${origin}/owner-dashboard?event_checkout=success`,
      cancel_url: `${origin}/owner-dashboard?event_checkout=cancelled`,
    });

    return json({ url: session.url });
  } catch (e) {
    console.error("create-event-checkout error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
