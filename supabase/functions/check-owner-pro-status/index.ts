import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PRICE_MONTHLY = "price_1TdPdO3EXkDnjHC3dK2LdvFT";
const PRICE_YEARLY = "price_1TdPeD3EXkDnjHC3J5T79Qe7";

const log = (step: string, details?: unknown) =>
  console.log(`[CHECK-OWNER-PRO-STATUS] ${step}${details ? ` - ${JSON.stringify(details)}` : ""}`);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY not configured");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !userData.user?.email) throw new Error("Not authenticated");
    const user = userData.user;

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });

    let isActive = false;
    let interval: string | null = null;
    let periodEnd: string | null = null;
    let cancelAtPeriodEnd = false;
    let stripeCustomerId: string | null = null;
    let stripeSubscriptionId: string | null = null;
    let stripePriceId: string | null = null;

    if (customers.data.length > 0) {
      stripeCustomerId = customers.data[0].id;
      const subs = await stripe.subscriptions.list({
        customer: stripeCustomerId,
        status: "all",
        limit: 10,
      });
      const activeSub = subs.data.find((s) => {
        const priceId = s.items.data[0]?.price?.id;
        return (
          (s.status === "active" || s.status === "trialing") &&
          (priceId === PRICE_MONTHLY || priceId === PRICE_YEARLY)
        );
      });
      if (activeSub) {
        isActive = true;
        stripeSubscriptionId = activeSub.id;
        stripePriceId = activeSub.items.data[0].price.id;
        interval = stripePriceId === PRICE_YEARLY ? "yearly" : "monthly";
        periodEnd = new Date(activeSub.current_period_end * 1000).toISOString();
        cancelAtPeriodEnd = activeSub.cancel_at_period_end;
      }
    }

    // Upsert into owner_pro_subscriptions
    if (stripeSubscriptionId) {
      await supabaseAdmin
        .from("owner_pro_subscriptions")
        .upsert(
          {
            user_id: user.id,
            stripe_customer_id: stripeCustomerId,
            stripe_subscription_id: stripeSubscriptionId,
            stripe_price_id: stripePriceId,
            status: isActive ? "active" : "inactive",
            billing_interval: interval,
            current_period_end: periodEnd,
            cancel_at_period_end: cancelAtPeriodEnd,
          },
          { onConflict: "stripe_subscription_id" }
        );
    } else {
      // Mark any previous record as inactive
      await supabaseAdmin
        .from("owner_pro_subscriptions")
        .update({ status: "inactive" })
        .eq("user_id", user.id);
    }

    // Sync restaurants owner_tier
    await supabaseAdmin.rpc("sync_owner_pro_restaurants", { _user_id: user.id });

    log("Status checked", { userId: user.id, isActive, interval });

    return new Response(
      JSON.stringify({
        is_pro: isActive,
        interval,
        current_period_end: periodEnd,
        cancel_at_period_end: cancelAtPeriodEnd,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    log("ERROR", { msg });
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});