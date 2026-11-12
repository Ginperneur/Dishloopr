import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { periodEndIso } from "../_shared/stripePeriod.ts";
import { commitmentEnd } from "../_shared/launch.ts";

// Supabase edge runtime: keep work running after the response is sent.
declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined;
import { Resend } from "https://esm.sh/resend@2.0.0";

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

    if (!webhookSecret || !signature) {
      logStep("Webhook rejected: missing secret or signature");
      return new Response(
        JSON.stringify({ error: "Webhook secret not configured or signature missing" }),
        { status: 400 }
      );
    }

    try {
      // Deno only has async (SubtleCrypto) HMAC: the sync constructEvent throws on every
      // request, which made Stripe see all live webhooks as failed.
      event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret, undefined, Stripe.createSubtleCryptoProvider());
      logStep("Webhook signature verified");
    } catch (err) {
      logStep("Webhook signature verification failed", { error: String(err) });
      return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 400 });
    }

    logStep("Event type", { type: event.type });

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      logStep("Checkout session completed", { sessionId: session.id });

      const metadata = session.metadata || {};
      const {
        type,
        restaurant_id: restaurantId,
        user_id: userId,
        listing_type: listingType,
        product_id: productId,
        duration_days: durationDays,
      } = metadata as Record<string, string | undefined>;

      // Handle micro-payment verification
      if (type === "micro_payment_verification" && metadata.claim_id && restaurantId) {
        const claimId = metadata.claim_id;
        logStep("Processing micro-payment verification", { claimId, restaurantId });

        // The claim must belong to the paying user and to this restaurant
        const { data: claimRow } = await supabaseAdmin
          .from("restaurant_claims")
          .select("id, user_id, restaurant_id, status")
          .eq("id", claimId)
          .maybeSingle();
        if (!claimRow || claimRow.user_id !== userId || claimRow.restaurant_id !== restaurantId ||
            ["verified", "rejected", "superseded"].includes(claimRow.status)) {
          logStep("Claim does not match payment metadata, ignoring", { claimId });
          return new Response(JSON.stringify({ received: true }), { status: 200 });
        }

        // Get the restaurant name for name matching
        const { data: restaurant } = await supabaseAdmin
          .from("restaurants")
          .select("name, claim_status")
          .eq("id", restaurantId)
          .single();
        const alreadyOwned = restaurant?.claim_status === "verified_owner";

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
        // Strict: the payer name must contain the full restaurant name, and an
        // already-owned restaurant is never auto-transferred (admin review instead).
        const nameMatches = !alreadyOwned && restaurantName.length >= 3 &&
          payerName.length > 0 && payerName.includes(restaurantName);

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
            .eq("id", claimId);

          if (claimError) {
            logStep("Claim update error", { error: claimError.message });
          } else {
            // Store €1 verification credit for future purchase
            await supabaseAdmin
              .from("verification_credits")
              .insert({
                user_id: userId,
                restaurant_id: restaurantId,
                claim_id: claimId,
                amount: 1.00,
                stripe_payment_intent: session.payment_intent as string,
              });
            logStep("Verification credit stored for user", { userId });

            // Update restaurant status
            await supabaseAdmin
              .from("restaurants")
              .update({ claim_status: "verified_owner" })
              .eq("id", restaurantId);

            // Add user as primary owner
            await supabaseAdmin
              .from("restaurant_managers")
              .upsert({
                restaurant_id: restaurantId,
                user_id: userId,
                role: "primary_owner",
                accepted_at: new Date().toISOString(),
              }, { onConflict: "restaurant_id,user_id" });

            // Give user owner role
            const { data: existingRole } = await supabaseAdmin
              .from("user_roles")
              .select("id")
              .eq("user_id", userId)
              .eq("role", "owner")
              .maybeSingle();

            if (!existingRole) {
              await supabaseAdmin
                .from("user_roles")
                .insert({ user_id: userId, role: "owner" });
            }

            // Supersede other claims
            await supabaseAdmin
              .from("restaurant_claims")
              .update({ status: "superseded" })
              .eq("restaurant_id", restaurantId)
              .neq("id", claimId);

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
            .eq("id", claimId);

          if (claimError) {
            logStep("Claim update error", { error: claimError.message });
          } else {
            logStep("Claim set to pending_admin_review due to name mismatch");
          }
        }
      }
      // Handle extra_tag subscription purchase
      else if (type === "extra_tag" && restaurantId && userId && metadata.tag_category && metadata.tag_value) {
        logStep("Processing extra_tag subscription", {
          restaurantId,
          userId,
          tag_category: metadata.tag_category,
          tag_value: metadata.tag_value,
        });

        const { error: tagError } = await supabaseAdmin
          .from("restaurant_tag_subscriptions")
          .upsert(
            {
              restaurant_id: restaurantId,
              user_id: userId,
              tag_category: metadata.tag_category,
              tag_value: metadata.tag_value,
              payment_type: "subscription",
              stripe_subscription_id: (session.subscription as string) || null,
              is_active: true,
            },
            { onConflict: "stripe_subscription_id" }
          );

        if (tagError) {
          logStep("Extra tag subscription insert error", { error: tagError.message });
          return new Response(JSON.stringify({ error: tagError.message }), { status: 500 });
        }
        logStep("Extra tag subscription activated");
      }
      // Handle event promotion (€5/month per event)
      else if (type === "event_promotion" && metadata.event_id && restaurantId) {
        const subscriptionId = (session.subscription as string) || null;
        let paidUntil: string | null = null;
        if (subscriptionId) {
          const sub = await stripe.subscriptions.retrieve(subscriptionId);
          paidUntil = periodEndIso(sub);
        }
        const { error: eventError } = await supabaseAdmin
          .from("restaurant_events")
          .update({ promotion_status: "paid", stripe_subscription_id: subscriptionId, paid_until: paidUntil })
          .eq("id", metadata.event_id)
          .eq("restaurant_id", restaurantId);
        if (eventError) {
          logStep("Event promotion update error", { error: eventError.message });
          return new Response(JSON.stringify({ error: eventError.message }), { status: 500 });
        }
        logStep("Event promotion activated", { eventId: metadata.event_id });
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
      else if (type === "listing" && restaurantId && listingType) {
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
        const verificationCreditId = metadata.verification_credit_id;
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
    }
      // Handle newsletter placement payment
      else if (type === "newsletter_placement" && metadata.placement_id) {
        logStep("Processing newsletter placement payment", { placementId: metadata.placement_id });

        const { error: updateError } = await supabaseAdmin
          .from("newsletter_placements")
          .update({
            status: "paid",
            stripe_payment_id: session.payment_intent as string,
          })
          .eq("id", metadata.placement_id);

        if (updateError) {
          logStep("Newsletter placement update error", { error: updateError.message });
          return new Response(JSON.stringify({ error: updateError.message }), { status: 500 });
        }

        logStep("Newsletter placement paid successfully", { placementId: metadata.placement_id });
      }
      // Handle Owner Pro subscription checkout
      // Founding Partner and Menuservice (create-package-checkout)
      else if ((type === "founding_partner" || type === "menu_service") && restaurantId && metadata.plan) {
        const subscriptionId = (session.subscription as string) || null;
        let status = "active";
        let periodEnd: string | null = null;
        let commitmentUntil: string | null = null;
        if (subscriptionId) {
          const sub = await stripe.subscriptions.retrieve(subscriptionId);
          status = sub.status === "trialing" ? "trialing" : "active";
          periodEnd = periodEndIso(sub);
          if (type === "founding_partner" && metadata.plan === "month") {
            // Minimum term of 6 months, counted from the first paid day (launch).
            commitmentUntil = commitmentEnd((sub.trial_end ?? sub.start_date) * 1000);
          }
        }
        const { error: orderError } = await supabaseAdmin.from("package_orders").upsert({
          restaurant_id: restaurantId,
          user_id: userId ?? null,
          package: type,
          plan: metadata.plan,
          page_slug: metadata.page_slug ?? null,
          status,
          fulfillment_status: type === "menu_service" ? "todo" : "n_a",
          amount_cents: parseInt(metadata.amount_cents || "0") || session.amount_total || 0,
          stripe_session_id: session.id,
          stripe_subscription_id: subscriptionId,
          stripe_customer_id: (session.customer as string) || null,
          commitment_until: commitmentUntil,
          current_period_end: periodEnd,
        }, { onConflict: "stripe_session_id" });
        if (orderError) {
          logStep("Package order insert error", { error: orderError.message });
          return new Response(JSON.stringify({ error: orderError.message }), { status: 500 });
        }
        if (type === "menu_service") {
          // Start the automatic import and translation; the owner then checks and publishes it.
          const run = fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/run-menu-service`, {
            method: "POST",
            headers: { Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`, "Content-Type": "application/json" },
            body: JSON.stringify({ restaurant_id: restaurantId }),
          }).catch(e => logStep("run-menu-service call failed", { error: String(e) }));
          if (typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(run);
          // The admin hears about it too, in case the import needs a hand.
          try {
            const [{ data: setting }, { data: restaurant }] = await Promise.all([
              supabaseAdmin.from("app_settings").select("value").eq("key", "admin_email").maybeSingle(),
              supabaseAdmin.from("restaurants").select("name").eq("id", restaurantId).maybeSingle(),
            ]);
            await new Resend(Deno.env.get("RESEND_API_KEY")).emails.send({
              from: "Dishloopr <noreply@resend.dev>",
              to: [setting?.value || "admin@dishloopr.com"],
              subject: `Nieuwe Menuservice: ${restaurant?.name ?? "restaurant"} (import loopt automatisch)`,
              html: `<p>${restaurant?.name ?? "Een restaurant"} heeft Menuservice afgenomen (${metadata.plan === "once" ? "eenmalig €79" : "€19 per maand"}).</p><p>De menukaart wordt automatisch geïmporteerd en vertaald; de eigenaar zet hem daarna zelf live. Lukt de import niet, dan staat de bestelling weer als "nog leveren" in Admin, Pakketten &amp; abonnementen (belofte: binnen 3 werkdagen).</p>`,
            });
          } catch (e) {
            logStep("Menuservice admin mail failed", { error: String(e) });
          }
        }
        logStep("Package order recorded", { type, plan: metadata.plan, restaurantId });
      }
      else if (type === "owner_pro" && metadata.user_id) {
        logStep("Processing owner_pro checkout", { userId: metadata.user_id });
        const subscriptionId = session.subscription as string | null;
        const customerId = session.customer as string | null;
        let priceId: string | null = null;
        let interval: string | null = metadata.billing_interval || null;
        let periodEnd: string | null = null;
        let cancelAtPeriodEnd = false;

        if (subscriptionId) {
          const sub = await stripe.subscriptions.retrieve(subscriptionId);
          priceId = sub.items.data[0]?.price?.id ?? null;
          periodEnd = periodEndIso(sub);
          cancelAtPeriodEnd = sub.cancel_at_period_end;
          if (!interval) {
            interval = sub.items.data[0]?.price?.recurring?.interval === "year" ? "yearly" : "monthly";
          }
        }

        await supabaseAdmin
          .from("owner_pro_subscriptions")
          .upsert(
            {
              user_id: metadata.user_id,
              stripe_customer_id: customerId,
              stripe_subscription_id: subscriptionId,
              stripe_price_id: priceId,
              status: "active",
              billing_interval: interval,
              current_period_end: periodEnd,
              cancel_at_period_end: cancelAtPeriodEnd,
            },
            { onConflict: "stripe_subscription_id" }
          );

        await supabaseAdmin.rpc("sync_owner_pro_restaurants", { _user_id: metadata.user_id });
        logStep("Owner Pro subscription activated", { userId: metadata.user_id, interval });
      } else {
        logStep("Missing metadata for purchase", { metadata: session.metadata });
      }
    }

    // Subscription lifecycle events for Owner Pro
    if (
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      const sub = event.data.object as Stripe.Subscription;
      const userId = sub.metadata?.user_id;
      if (userId && sub.metadata?.type === "owner_pro") {
        const isActive = sub.status === "active" || sub.status === "trialing";
        const priceId = sub.items.data[0]?.price?.id ?? null;
        const interval = sub.items.data[0]?.price?.recurring?.interval === "year" ? "yearly" : "monthly";
        await supabaseAdmin
          .from("owner_pro_subscriptions")
          .upsert(
            {
              user_id: userId,
              stripe_customer_id: sub.customer as string,
              stripe_subscription_id: sub.id,
              stripe_price_id: priceId,
              status: isActive ? "active" : "inactive",
              billing_interval: interval,
              current_period_end: periodEndIso(sub),
              cancel_at_period_end: sub.cancel_at_period_end,
            },
            { onConflict: "stripe_subscription_id" }
          );
        await supabaseAdmin.rpc("sync_owner_pro_restaurants", { _user_id: userId });
        logStep("Owner Pro subscription synced", { userId, status: sub.status });
      }
      if (sub.metadata?.type === "founding_partner" || sub.metadata?.type === "menu_service") {
        const live = ["active", "trialing", "past_due"].includes(sub.status);
        const { data: order } = await supabaseAdmin.from("package_orders")
          .select("id, commitment_until").eq("stripe_subscription_id", sub.id).maybeSingle();
        // Enforce the 6-month minimum term: a cancellation before it ends is moved to the end of the term.
        const commitment = order?.commitment_until ? Date.parse(order.commitment_until) : 0;
        const cancelsAt = sub.cancel_at ? sub.cancel_at * 1000 : (sub.cancel_at_period_end ? Date.parse(periodEndIso(sub) ?? "") : 0);
        if (live && commitment && cancelsAt && cancelsAt < commitment) {
          await stripe.subscriptions.update(sub.id, { cancel_at_period_end: false, cancel_at: Math.floor(commitment / 1000) });
          logStep("Cancellation moved to end of minimum term", { subscriptionId: sub.id });
        }
        await supabaseAdmin.from("package_orders").update({
          status: !live ? "cancelled" : sub.status === "trialing" ? "trialing" : sub.status === "past_due" ? "past_due" : "active",
          current_period_end: periodEndIso(sub),
          updated_at: new Date().toISOString(),
        }).eq("stripe_subscription_id", sub.id);
        logStep("Package order synced", { subscriptionId: sub.id, status: sub.status });
      }
      if (sub.metadata?.type === "event_promotion" && sub.metadata?.event_id) {
        const isActive = sub.status === "active" || sub.status === "trialing";
        await supabaseAdmin
          .from("restaurant_events")
          .update({
            promotion_status: isActive ? "paid" : "lapsed",
            stripe_subscription_id: sub.id,
            paid_until: periodEndIso(sub),
          })
          .eq("id", sub.metadata.event_id);
        logStep("Event promotion synced", { eventId: sub.metadata.event_id, status: sub.status });
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
