import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { safeOrigin } from "../_shared/auth.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { getOrCreateCustomer } from "../_shared/stripeCustomer.ts";
import { createClient } from "npm:@supabase/supabase-js@2.118.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (step: string, details?: unknown) =>
  console.log(`[OWNER-PRO-PORTAL] ${step}${details ? ` - ${JSON.stringify(details)}` : ""}`);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY not configured");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !userData.user?.email) throw new Error("Not authenticated");
    const user = userData.user;
    // Billing data is matched on the email address, so it must be a confirmed one.
    if (!user.email_confirmed_at) throw new Error("Bevestig eerst je e-mailadres");

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    // The user's own customer (the one with their running subscriptions), never just the newest.
    const customerId = await getOrCreateCustomer(stripe, admin, user);

    const origin = safeOrigin(req);
    const portal = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/owner`,
    });

    log("Portal session created", { customerId });

    return new Response(JSON.stringify({ url: portal.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    log("ERROR", { msg });
    return new Response(JSON.stringify({ error: msg === "Bevestig eerst je e-mailadres" ? msg : "Het betaalportaal kon niet worden geopend." }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});