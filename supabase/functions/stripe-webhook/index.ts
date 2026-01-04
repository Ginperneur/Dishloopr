import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[STRIPE-WEBHOOK] ${step}${detailsStr}`);
};

serve(async (req) => {
  try {
    logStep("Webhook received");

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Use service role for database updates
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const signature = req.headers.get("stripe-signature");
    const body = await req.text();
    
    // Get webhook secret from environment
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    
    let event: Stripe.Event;
    
    if (webhookSecret && signature) {
      try {
        event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
        logStep("Webhook signature verified");
      } catch (err) {
        logStep("Webhook signature verification failed", { error: String(err) });
        return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 400 });
      }
    } else {
      // For testing without webhook secret
      event = JSON.parse(body);
      logStep("Processing webhook without signature verification (dev mode)");
    }

    logStep("Event type", { type: event.type });

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      logStep("Checkout session completed", { sessionId: session.id });

      const { restaurantId, listingType, userId } = session.metadata || {};
      
      if (!restaurantId || !listingType) {
        logStep("Missing metadata", { metadata: session.metadata });
        return new Response(JSON.stringify({ error: "Missing metadata" }), { status: 400 });
      }

      // Calculate expiration date (30 days from now)
      const expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() + 30);

      // Update restaurant based on listing type
      const updateData: Record<string, any> = {};
      
      if (listingType === "featured") {
        updateData.is_featured = true;
        updateData.featured_until = expirationDate.toISOString();
        logStep("Setting featured listing", { restaurantId, until: expirationDate.toISOString() });
      } else if (listingType === "top") {
        updateData.is_top_listing = true;
        updateData.top_until = expirationDate.toISOString();
        logStep("Setting top listing", { restaurantId, until: expirationDate.toISOString() });
      }

      const { error: updateError } = await supabaseAdmin
        .from("restaurants")
        .update(updateData)
        .eq("id", restaurantId);

      if (updateError) {
        logStep("Database update error", { error: updateError.message });
        return new Response(JSON.stringify({ error: updateError.message }), { status: 500 });
      }

      logStep("Restaurant updated successfully", { restaurantId, listingType });
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), { status: 500 });
  }
});
