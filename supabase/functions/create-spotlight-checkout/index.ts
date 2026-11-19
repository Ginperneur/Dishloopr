// Stadsspotlight: 39 euro per week, 3 restaurants per city per week on the homepage and city page.
// The weeks are held for 30 minutes (spotlight_reserve); stripe-webhook activates them once paid.
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
const PRICE_CENTS = 3900;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const user = await getCaller(req);
    if (!user?.email) return json({ error: "Log opnieuw in" }, 401);
    const { restaurant_id, weeks, headline, body } = await req.json().catch(() => ({}));
    if (typeof restaurant_id !== "string" || !/^[0-9a-f-]{36}$/i.test(restaurant_id)) return json({ error: "Ongeldig restaurant" }, 400);
    const list = Array.isArray(weeks) ? weeks.filter((w): w is string => typeof w === "string" && /^\d{4}-\d{2}-\d{2}$/.test(w)) : [];
    if (!list.length || list.length > 8) return json({ error: "Kies 1 tot 8 weken" }, 400);
    const title = typeof headline === "string" ? headline.trim() : "";
    const text = typeof body === "string" ? body.trim() : "";
    if (title.length < 2 || title.length > 40) return json({ error: "Geef een korte kop van maximaal 40 tekens" }, 400);
    if (text.length < 2 || text.length > 160) return json({ error: "Geef een tekst van maximaal 160 tekens" }, 400);

    const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const [{ data: owns }, { data: isAdmin }] = await Promise.all([
      admin.rpc("is_verified_owner", { _user_id: user.id, _restaurant_id: restaurant_id }),
      admin.rpc("has_role", { _user_id: user.id, _role: "admin" }),
    ]);
    if (owns !== true && isAdmin !== true) return json({ error: "Alleen de geverifieerde eigenaar kan de Stadsspotlight boeken" }, 403);

    const { data: ids, error: resErr } = await admin.rpc("spotlight_reserve", {
      p_restaurant: restaurant_id, p_user: user.id, p_weeks: list, p_headline: title, p_body: text,
    });
    if (resErr) return json({ error: resErr.message }, 409);
    const bookingIds = (ids ?? []) as string[];

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { apiVersion: "2025-08-27.basil" });
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    const customerId = customers.data[0]?.id;
    const meta = { type: "spotlight", restaurant_id, user_id: user.id, booking_ids: bookingIds.join(","), weeks: list.join(",") };
    const origin = safeOrigin(req);
    const session = await stripe.checkout.sessions.create(await withVat(stripe, {
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      mode: "payment",
      line_items: [{
        quantity: bookingIds.length,
        price_data: { currency: "eur", unit_amount: PRICE_CENTS, tax_behavior: "exclusive", product_data: { name: "Stadsspotlight (per week)" } },
      }],
      ...billingParams({ mode: "payment", customerId, description: `Stadsspotlight, ${bookingIds.length} ${bookingIds.length === 1 ? "week" : "weken"}` }),
      metadata: meta,
      payment_intent_data: { metadata: meta },
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
      success_url: `${origin}/owner-dashboard?section=promotions&spotlight=success`,
      cancel_url: `${origin}/owner-dashboard?section=promotions`,
    }));
    return json({ url: session.url });
  } catch (e) {
    console.error("create-spotlight-checkout", e);
    return json({ error: e instanceof Error ? e.message : "Onbekende fout" }, 500);
  }
});
