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

      const metadata = session.metadata || {};
      const { restaurantId, listingType, userId, productId, durationDays, type } = metadata;

      // Handle micro-payment verification
      if (type === "micro_payment_verification" && metadata.claimId && metadata.restaurantId) {
        logStep("Processing micro-payment verification", { claimId: metadata.claimId, restaurantId: metadata.restaurantId });

        // Get the restaurant name for name matching
        const { data: restaurant } = await supabaseAdmin
          .from("restaurants")
          .select("name")
          .eq("id", metadata.restaurantId)
          .single();

        const restaurantName = restaurant?.name?.toLowerCase().trim() || "";

        // Get payer name from Stripe session
        let payerName = "";
        if (session.customer_details?.name) {
          payerName = session.customer_details.name.toLowerCase().trim();
        } else if (session.customer) {
          const customer = await stripe.customers.retrieve(session.customer as string);
          if (customer && !customer.deleted && customer.name) {
            payerName = customer.name.toLowerCase().trim();
          }
        }

        logStep("Name matching", { payerName, restaurantName });

        // Check if payer name matches restaurant name (fuzzy: one contains the other or significant overlap)
        const nameMatches = payerName.length > 0 && restaurantName.length > 0 && (
          restaurantName.includes(payerName) ||
          payerName.includes(restaurantName) ||
          // Check if any word (3+ chars) from payer name appears in restaurant name
          payerName.split(/\s+/).some((word: string) => word.length >= 3 && restaurantName.includes(word)) ||
          restaurantName.split(/\s+/).some((word: string) => word.length >= 3 && payerName.includes(word))
        );

        if (nameMatches) {
          logStep("Name match succeeded, auto-verifying");

          // Update claim to verified
          const { error: claimError } = await supabaseAdmin
            .from("restaurant_claims")
            .update({
              status: "verified",
              verification_method: "micro_payment",
              verification_completed_at: new Date().toISOString(),
              verification_proof: { method: "micro_payment", stripe_session_id: session.id, payment_intent: session.payment_intent, name_match: true, payer_name: payerName },
              is_primary: true,
            })
            .eq("id", metadata.claimId);

          if (claimError) {
            logStep("Claim update error", { error: claimError.message });
          } else {
            // Store €1 verification credit for future purchase
            await supabaseAdmin
              .from("verification_credits")
              .insert({
                user_id: metadata.userId,
                restaurant_id: metadata.restaurantId,
                claim_id: metadata.claimId,
                amount: 1.00,
                stripe_payment_intent: session.payment_intent as string,
              });
            logStep("Verification credit stored for user", { userId: metadata.userId });

            // Update restaurant status
            await supabaseAdmin
              .from("restaurants")
              .update({ claim_status: "verified_owner" })
              .eq("id", metadata.restaurantId);

            // Add user as primary owner
            await supabaseAdmin
              .from("restaurant_managers")
              .upsert({
                restaurant_id: metadata.restaurantId,
                user_id: metadata.userId,
                role: "primary_owner",
                accepted_at: new Date().toISOString(),
              }, { onConflict: "restaurant_id,user_id" });

            // Give user owner role
            const { data: existingRole } = await supabaseAdmin
              .from("user_roles")
              .select("id")
              .eq("user_id", metadata.userId)
              .eq("role", "owner")
              .maybeSingle();

            if (!existingRole) {
              await supabaseAdmin
                .from("user_roles")
                .insert({ user_id: metadata.userId, role: "owner" });
            }

            // Supersede other claims
            await supabaseAdmin
              .from("restaurant_claims")
              .update({ status: "superseded" })
              .eq("restaurant_id", metadata.restaurantId)
              .neq("id", metadata.claimId);

            logStep("Micro-payment verification completed successfully (name matched)");
          }
        } else {
          logStep("Name mismatch, setting to pending_admin_review", { payerName, restaurantName });

          // Name doesn't match - require admin review
          const { error: claimError } = await supabaseAdmin
            .from("restaurant_claims")
            .update({
              status: "pending_admin_review",
              verification_method: "micro_payment",
              verification_completed_at: new Date().toISOString(),
              verification_proof: { method: "micro_payment", stripe_session_id: session.id, payment_intent: session.payment_intent, name_match: false, payer_name: payerName, restaurant_name: restaurantName },
              admin_notes: `Automatische naam-controle mislukt. Betaler: "${payerName}", Restaurant: "${restaurantName}". Handmatige review nodig.`,
            })
            .eq("id", metadata.claimId);

          if (claimError) {
            logStep("Claim update error", { error: claimError.message });
          } else {
            logStep("Claim set to pending_admin_review due to name mismatch");
          }
        }
      }
      // Handle featured subscription purchase
      else if (type === "featured_subscription" && metadata.slot_id && restaurantId) {
        const durationMonths = parseInt(metadata.duration_months || "1");
        const monthlyPrice = parseFloat(metadata.monthly_price || "0");
        const ambianceAddonPrice = parseFloat(metadata.ambiance_addon_price || "0");
        const totalMonthlyPrice = parseFloat(metadata.total_monthly_price || "0");
        const includedAmbiance = metadata.included_ambiance || null;
        const extraAmbiances = metadata.extra_ambiances ? JSON.parse(metadata.extra_ambiances) : [];

        const startsAt = new Date();
        const expiresAt = new Date();
        expiresAt.setMonth(expiresAt.getMonth() + durationMonths);

        // Get existing consecutive months count
        const { data: existingSub } = await supabaseAdmin
          .from("featured_subscriptions")
          .select("consecutive_months")
          .eq("restaurant_id", restaurantId)
          .eq("slot_id", metadata.slot_id)
          .in("status", ["expired", "cooling_off"])
          .order("expires_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        const previousMonths = existingSub?.consecutive_months || 0;
        const newConsecutiveMonths = previousMonths + durationMonths;

        // If exceeding 3 months, set cooling off
        const willExceedMax = newConsecutiveMonths >= 3;

        const { error: subError } = await supabaseAdmin
          .from("featured_subscriptions")
          .insert({
            slot_id: metadata.slot_id,
            restaurant_id: restaurantId,
            monthly_price: monthlyPrice,
            ambiance_addon_price: ambianceAddonPrice,
            total_monthly_price: totalMonthlyPrice,
            included_ambiance: includedAmbiance,
            extra_ambiances: extraAmbiances,
            starts_at: startsAt.toISOString(),
            expires_at: expiresAt.toISOString(),
            consecutive_months: newConsecutiveMonths,
            status: "active",
            stripe_subscription_id: session.subscription as string || null,
            stripe_customer_id: session.customer as string || null,
            cooling_off_until: willExceedMax 
              ? new Date(expiresAt.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString() 
              : null,
          });

        if (subError) {
          logStep("Featured subscription insert error", { error: subError.message });
          return new Response(JSON.stringify({ error: subError.message }), { status: 500 });
        }

        // Also set restaurant as featured
        await supabaseAdmin
          .from("restaurants")
          .update({ is_featured: true, featured_until: expiresAt.toISOString() })
          .eq("id", restaurantId);

        logStep("Featured subscription created", { 
          slotId: metadata.slot_id, 
          restaurantId, 
          durationMonths,
          consecutiveMonths: newConsecutiveMonths
        });
      }
      // Handle sponsored dish purchase
      else if (type === "sponsored_dish" && productId && restaurantId) {
        const duration = parseInt(durationDays || "30");
        const startsAt = new Date();
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + duration);

        const { error: purchaseError } = await supabaseAdmin
          .from("sponsored_purchases")
          .insert({
            product_id: productId,
            restaurant_id: restaurantId,
            purchased_by: userId,
            price_paid: (session.amount_total || 0) / 100,
            duration_days: duration,
            starts_at: startsAt.toISOString(),
            expires_at: expiresAt.toISOString(),
            is_active: true,
            stripe_payment_id: session.payment_intent as string,
          });

        if (purchaseError) {
          logStep("Sponsored purchase insert error", { error: purchaseError.message });
          return new Response(JSON.stringify({ error: purchaseError.message }), { status: 500 });
        }

        logStep("Sponsored purchase created successfully", { productId, restaurantId, duration });
      }
      // Handle featured/top listing purchase (legacy)
      else if (restaurantId && listingType) {
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

        // Mark verification credit as redeemed if used
        const verificationCreditId = metadata.verificationCreditId;
        if (verificationCreditId) {
          await supabaseAdmin
            .from("verification_credits")
            .update({
              is_redeemed: true,
              redeemed_at: new Date().toISOString(),
              redeemed_on_checkout: session.id,
            })
            .eq("id", verificationCreditId);
          logStep("Verification credit redeemed", { creditId: verificationCreditId });
        }

        logStep("Restaurant updated successfully", { restaurantId, listingType });
      } else {
        logStep("Missing metadata for purchase", { metadata: session.metadata });
      }
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
