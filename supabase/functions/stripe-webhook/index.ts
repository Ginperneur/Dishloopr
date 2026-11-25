import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.118.0";
import { periodEndIso } from "../_shared/stripePeriod.ts";
import { commitmentEnd } from "../_shared/launch.ts";
import { releasePaidEvent } from "../_shared/eventPayment.ts";

// Supabase edge runtime: keep work running after the response is sent.
declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined;
import { Resend } from "https://esm.sh/resend@2.0.0";

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[STRIPE-WEBHOOK] ${step}${detailsStr}`);
};

/** A payment that needs a human (refund, double sale, missing data): mail the admin, never fail the webhook. */
// deno-lint-ignore no-explicit-any
async function alertAdmin(admin: { from(table: string): any }, subject: string, lines: string[]) {
  try {
    const { data: setting } = await admin.from("app_settings").select("value").eq("key", "admin_email").maybeSingle();
    const esc = (t: string) => t.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
    await new Resend(Deno.env.get("RESEND_API_KEY")).emails.send({
      from: "Dishloopr <noreply@resend.dev>",
      to: [(setting?.value as string) || "admin@dishloopr.com"],
      subject: `Betaling vraagt aandacht: ${subject}`.replace(/[\r\n]+/g, " ").slice(0, 150),
      html: lines.map(l => `<p>${esc(l)}</p>`).join(""),
    });
  } catch (e) {
    logStep("Admin alert failed", { error: String(e) });
  }
}

const PLACE_PACKAGES = ["founding_partner", "topplek", "groei", "dominant", "collectieplek"];
const placeKind = (pkg: string) => (pkg === "topplek" || pkg === "dominant" ? "topplek" : pkg === "collectieplek" ? "collectie" : "uitgelicht");

serve(async (req) => {
  // Set once the event is claimed, so a failure can release it for Stripe's retry.
  let releaseEvent: (() => Promise<unknown>) | null = null;
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

    // Each event is handled once: a redelivery must not re-run imports, re-send mails or reactivate
    // a place that was cancelled in the meantime.
    {
      const { error: claimErr } = await supabaseAdmin.from("stripe_processed_events").insert({ event_id: event.id, event_type: event.type });
      if (claimErr?.code === "23505") {
        logStep("Duplicate event, already processed", { id: event.id });
        return new Response(JSON.stringify({ received: true, duplicate: true }), { status: 200 });
      }
      if (claimErr) throw new Error(`Event claim failed: ${claimErr.message}`);
      releaseEvent = async () => { await supabaseAdmin.from("stripe_processed_events").delete().eq("event_id", event.id); };
    }

    if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
      const session = event.data.object as Stripe.Checkout.Session;
      logStep("Checkout session completed", { sessionId: session.id });

      // Bank transfers and other delayed methods complete the session before the money is in:
      // nothing is activated until checkout.session.async_payment_succeeded says it is paid.
      if (session.payment_status === "unpaid") {
        logStep("Payment not confirmed yet, waiting for async_payment_succeeded", { sessionId: session.id });
        return new Response(JSON.stringify({ received: true, pending: true }), { status: 200 });
      }

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

        // The payer types this name on the Stripe page, so it proves nothing on its own: a match is
        // only a hint for the admin. Every micro-payment claim waits for admin review; nothing is
        // granted automatically (no verified status, owner role, manager row or credit here).
        const nameMatches = restaurantName.length >= 3 && payerName.length > 0 && payerName.includes(restaurantName);
        const { error: claimError } = await supabaseAdmin
          .from("restaurant_claims")
          .update({
            status: "pending_admin_review",
            verification_method: "micro_payment",
            verification_completed_at: new Date().toISOString(),
            verification_proof: {
              method: "micro_payment", stripe_session_id: session.id, payment_intent: session.payment_intent,
              name_match: nameMatches, payer_name: payerName, restaurant_name: restaurantName, already_owned: alreadyOwned,
            },
            admin_notes: `Betaling van €1 ontvangen. Naam op de betaling: "${payerName}". Restaurant: "${restaurantName}". `
              + (nameMatches ? "De namen komen overeen, maar die naam typt de betaler zelf: controleer het eigendom." : "De namen komen niet overeen.")
              + (alreadyOwned ? " Let op: dit restaurant heeft al een geverifieerde eigenaar." : ""),
          })
          .eq("id", claimId);
        if (claimError) {
          logStep("Claim update error", { error: claimError.message });
          throw new Error("Claim update failed");
        }
        logStep("Micro-payment received, claim waits for admin review", { claimId, nameMatches });
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
              // The table only allows 'per_tag' or 'owner_pro', and the only unique key is
              // (restaurant_id, tag_category, tag_value). With "subscription" and
              // onConflict stripe_subscription_id every paid tag failed to save, so owners paid
              // and never got their tag. Re-buying a cancelled tag reuses its row.
              payment_type: "per_tag",
              stripe_subscription_id: (session.subscription as string) || null,
              is_active: true,
            },
            { onConflict: "restaurant_id,tag_category,tag_value" }
          );

        if (tagError) {
          logStep("Extra tag subscription insert error", { error: tagError.message });
          throw new Error(`Extra tag activation failed: ${tagError.message}`);
        }
        logStep("Extra tag subscription activated");
      }
      // Purchased simulations: the quantity comes from the line item (adjustable in Checkout).
      else if (type === "simulation_credits" && restaurantId) {
        const items = await stripe.checkout.sessions.listLineItems(session.id, { limit: 1 });
        const quantity = items.data[0]?.quantity ?? 1;
        const { error: simErr } = await supabaseAdmin.rpc("grant_simulation_credits", {
          p_session: session.id, p_restaurant: restaurantId, p_user: userId ?? null, p_quantity: quantity,
        });
        if (simErr) {
          logStep("Simulation credits error", { error: simErr.message });
          throw new Error(`Simulation credits failed: ${simErr.message}`);
        }
        logStep("Simulation credits granted", { restaurantId, quantity });
      }
      // Paid promotion slot (Vraag doorsturen): the reserved slot becomes active.
      else if (type === "promo_slot" && metadata.slot_id) {
        // Only the reservation this checkout made: never revive a slot that ended or was replaced.
        const { data: activated, error: slotErr } = await supabaseAdmin.from("promo_slots")
          .update({ status: "active", stripe_subscription_id: (session.subscription as string) || null, reserved_until: null, updated_at: new Date().toISOString() })
          .eq("id", metadata.slot_id).eq("status", "pending_payment").select("id");
        if (slotErr) throw new Error(`Promo slot activation failed: ${slotErr.message}`);
        if (!activated?.length) {
          await alertAdmin(supabaseAdmin, "Vraag doorsturen betaald voor een vervallen plek", [
            `Restaurant ${restaurantId ?? "?"} betaalde voor plek ${metadata.slot_id}, maar die reservering was al vervallen of vervangen.`,
            `Stripe-sessie ${session.id}, abonnement ${session.subscription ?? "-"}. Zet de plek handmatig aan als er ruimte is, of zeg het abonnement op en betaal terug.`,
          ]);
        }
        if (metadata.bid_id) {
          await supabaseAdmin.from("promo_bids").update({ status: "converted", updated_at: new Date().toISOString() }).eq("id", metadata.bid_id);
        }
        logStep("Promo slot activated", { slotId: metadata.slot_id });
      }
      // Handle event promotion (€5/month per event)
      else if (type === "event_promotion" && metadata.event_id && restaurantId) {
        if (session.payment_status !== "paid") {
          logStep("Event payment pending", { eventId: metadata.event_id });
        } else {
          const subscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
          if (!subscriptionId) throw new Error("Event payment missing subscription");
          const sub = await stripe.subscriptions.retrieve(subscriptionId);
          await releasePaidEvent(supabaseAdmin, sub);
          logStep("Event promotion activated", { eventId: metadata.event_id });
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
          throw new Error(`Legacy activation failed: ${subError.message}`);
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
            price_paid: (session.amount_subtotal ?? session.amount_total ?? 0) / 100,
            duration_days: duration,
            starts_at: startsAt.toISOString(),
            expires_at: expiresAt.toISOString(),
            is_active: true,
            stripe_payment_id: session.payment_intent as string,
          });

        if (purchaseError) {
          logStep("Sponsored purchase insert error", { error: purchaseError.message });
          throw new Error(`Legacy activation failed: ${purchaseError.message}`);
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
          throw new Error(`Legacy activation failed: ${updateError.message}`);
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

        const { data: paid, error: updateError } = await supabaseAdmin
          .from("newsletter_placements")
          .update({
            status: "paid",
            stripe_payment_id: session.payment_intent as string,
          })
          .eq("id", metadata.placement_id).eq("status", "pending_payment").select("id");
        if (updateError) throw new Error(`Newsletter placement update failed: ${updateError.message}`);
        if (!paid?.length) {
          await alertAdmin(supabaseAdmin, "Nieuwsbriefplaatsing betaald na vervallen", [
            `Plaatsing ${metadata.placement_id} (restaurant ${restaurantId ?? "?"}, editie ${metadata.edition_date ?? "?"}) is betaald, maar stond niet meer open.`,
            `Betaling ${session.payment_intent ?? session.id}. Plaats hem handmatig als de editie nog plek heeft, anders terugbetalen.`,
          ]);
        }

        logStep("Newsletter placement paid successfully", { placementId: metadata.placement_id });
      }
      // Handle Owner Pro subscription checkout
      // Founding Partner and Menuservice (create-package-checkout)
      // Stadsspotlight: the reserved weeks become active once paid.
      else if (type === "spotlight" && restaurantId && metadata.booking_ids) {
        const ids = metadata.booking_ids.split(",").filter(Boolean);
        const { data: activated, error: spotError } = await supabaseAdmin.from("spotlight_bookings")
          .update({ status: "active", stripe_session_id: session.id, updated_at: new Date().toISOString() })
          .in("id", ids).eq("restaurant_id", restaurantId).eq("status", "pending_payment")
          .select("id, city_id, week_start");
        if (spotError) throw new Error(`Spotlight activation failed: ${spotError.message}`);
        const problems: string[] = [];
        if ((activated?.length ?? 0) < ids.length) problems.push(`${ids.length - (activated?.length ?? 0)} van de ${ids.length} weken stonden niet meer open.`);
        for (const b of activated ?? []) {
          const { count } = await supabaseAdmin.from("spotlight_bookings").select("id", { count: "exact", head: true })
            .eq("city_id", b.city_id).eq("week_start", b.week_start).eq("status", "active");
          if ((count ?? 0) > 3) problems.push(`De week van ${b.week_start} heeft nu ${count} actieve plekken (maximaal 3).`);
        }
        if (problems.length) {
          await alertAdmin(supabaseAdmin, "Stadsspotlight klopt niet na betaling", [
            `Restaurant ${restaurantId}, Stripe-sessie ${session.id}.`, ...problems, "Betaal het verschil terug of schuif de boeking op.",
          ]);
        }
        logStep("Spotlight weeks activated", { restaurantId, weeks: ids.length });
      }
      // Founding Partner (Uitgelicht), Topplek, the Groei and Dominant bundles and Menuservice (create-package-checkout)
      else if (type && ["founding_partner", "menu_service", "topplek", "groei", "dominant", "collectieplek"].includes(type) && restaurantId && metadata.plan) {
        const subscriptionId = (session.subscription as string) || null;
        let status = "active";
        let periodEnd: string | null = null;
        let commitmentUntil: string | null = null;
        if (subscriptionId) {
          const sub = await stripe.subscriptions.retrieve(subscriptionId);
          status = sub.status === "trialing" ? "trialing" : "active";
          periodEnd = periodEndIso(sub);
          // The owner chose the term at checkout (commitment_months); from 6 months it is the Founding
          // Partner deal. Older checkouts carry no term: their Founding Partner deal is 6 months.
          // Counted from the first paid day; 1 month means cancellable every month.
          const termMonths = Number(metadata.commitment_months)
            || ((type === "founding_partner" || type === "groei" || type === "collectieplek") && metadata.founding_partner === "true" ? 6 : 1);
          if (metadata.plan === "month" && termMonths > 1) {
            commitmentUntil = commitmentEnd((sub.trial_end ?? sub.start_date) * 1000, termMonths);
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
          amount_cents: parseInt(metadata.amount_cents || "0") || session.amount_subtotal || session.amount_total || 0,
          stripe_session_id: session.id,
          stripe_subscription_id: subscriptionId,
          stripe_customer_id: (session.customer as string) || null,
          commitment_until: commitmentUntil,
          current_period_end: periodEnd,
        }, { onConflict: "stripe_session_id" });
        if (orderError) throw new Error(`Package order insert failed: ${orderError.message}`);
        if (PLACE_PACKAGES.includes(type) && metadata.founding_partner) {
          // Founding Partner status per order (20261125090000_founding_minimum_term.sql). Written apart from
          // the order, so a payment is never lost when that migration is not applied yet.
          const { error: termError } = await supabaseAdmin.from("package_orders").update({
            is_founding: metadata.founding_partner === "true",
            commitment_months: Number(metadata.commitment_months) || null,
          }).eq("stripe_session_id", session.id);
          if (termError) logStep("Founding status not stored", { error: termError.message });
        }
        if (PLACE_PACKAGES.includes(type) && metadata.page_slug) {
          // The hold made at checkout is now a real order; a page must never hold more than its places.
          await supabaseAdmin.from("package_checkout_holds").delete().eq("stripe_session_id", session.id);
          if (metadata.hold_id) await supabaseAdmin.from("package_checkout_holds").delete().eq("id", metadata.hold_id);
          const kind = placeKind(type);
          const [{ data: taken }, { data: slots }] = await Promise.all([
            supabaseAdmin.rpc("pp_taken", { p_kind: kind, p_page_slug: metadata.page_slug }),
            supabaseAdmin.rpc("pp_slots", { p_kind: kind }),
          ]);
          if (typeof taken === "number" && typeof slots === "number" && taken > slots) {
            await alertAdmin(supabaseAdmin, "Pagina heeft meer betaalde plekken dan toegestaan", [
              `Pagina ${metadata.page_slug}: ${taken} plekken voor ${kind}, maximaal ${slots}. Nieuwste bestelling: restaurant ${restaurantId}, sessie ${session.id}.`,
              "Betaal de laatste bestelling terug en zeg het abonnement op.",
            ]);
          }
        }
        if ((type === "groei" || type === "dominant") && userId) {
          // Pro is part of both bundles.
          await supabaseAdmin.rpc("sync_owner_pro_restaurants", { _user_id: userId });
        }
        if (metadata.bid_id) {
          // A won bid (Uitgelicht or Topplek) is now paid.
          await supabaseAdmin.from("promo_bids").update({ status: "converted", updated_at: new Date().toISOString() }).eq("id", metadata.bid_id);
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
        logStep("Missing metadata for purchase", { sessionId: session.id, type: session.metadata?.type ?? null });
        await alertAdmin(supabaseAdmin, "Betaling zonder herkenbaar product", [
          `Stripe-sessie ${session.id} is betaald (${(session.amount_total ?? 0) / 100} euro), maar het product kon niet worden toegekend.`,
          `Type: ${session.metadata?.type ?? "onbekend"}. Controleer de sessie in Stripe en lever het product handmatig of betaal terug.`,
        ]);
      }
    }

    // A checkout that was never paid (expired, or a delayed payment that failed) frees its place at once.
    if (event.type === "checkout.session.expired" || event.type === "checkout.session.async_payment_failed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const md = (session.metadata ?? {}) as Record<string, string | undefined>;
      if (md.type === "spotlight" && md.booking_ids) {
        await supabaseAdmin.from("spotlight_bookings").update({ status: "cancelled", updated_at: new Date().toISOString() })
          .in("id", md.booking_ids.split(",").filter(Boolean)).eq("status", "pending_payment");
      } else if (md.type === "newsletter_placement" && md.placement_id) {
        await supabaseAdmin.from("newsletter_placements").update({ status: "rejected" })
          .eq("id", md.placement_id).eq("status", "pending_payment");
      } else if (md.type === "promo_slot" && md.slot_id) {
        await supabaseAdmin.from("promo_slots").update({ status: "ended", updated_at: new Date().toISOString() })
          .eq("id", md.slot_id).eq("status", "pending_payment");
      }
      await supabaseAdmin.from("package_checkout_holds").delete().eq("stripe_session_id", session.id);
      logStep("Unpaid checkout released", { sessionId: session.id, type: md.type ?? null });
    }

    // Money that went back (refund) or is contested (dispute): one-off products stop, the admin hears about it.
    if (event.type === "charge.refunded" || event.type === "charge.dispute.created") {
      const obj = event.data.object as Stripe.Charge | Stripe.Dispute;
      const paymentIntent = typeof obj.payment_intent === "string" ? obj.payment_intent : obj.payment_intent?.id;
      const fullRefund = event.type === "charge.dispute.created" || (obj as Stripe.Charge).refunded === true;
      let summary = `Betaling ${paymentIntent ?? "?"}`;
      if (paymentIntent && fullRefund) {
        const sessions = await stripe.checkout.sessions.list({ payment_intent: paymentIntent, limit: 1 });
        const md = (sessions.data[0]?.metadata ?? {}) as Record<string, string | undefined>;
        summary += `, product ${md.type ?? "onbekend"}, restaurant ${md.restaurant_id ?? "?"}`;
        if (md.type === "spotlight" && md.booking_ids) {
          await supabaseAdmin.from("spotlight_bookings").update({ status: "cancelled", updated_at: new Date().toISOString() })
            .in("id", md.booking_ids.split(",").filter(Boolean));
        } else if (md.type === "newsletter_placement" && md.placement_id) {
          await supabaseAdmin.from("newsletter_placements").update({ status: "rejected" })
            .eq("id", md.placement_id).in("status", ["pending_payment", "paid", "approved"]);
        } else if (md.type === "menu_service" && sessions.data[0]?.id) {
          await supabaseAdmin.from("package_orders").update({ status: "cancelled", updated_at: new Date().toISOString() })
            .eq("stripe_session_id", sessions.data[0].id);
        }
      }
      await alertAdmin(supabaseAdmin, event.type === "charge.refunded" ? "Terugbetaling" : "Betwiste betaling", [
        summary, fullRefund ? "Eenmalige producten zijn stopgezet." : "Gedeeltelijke terugbetaling: niets automatisch gewijzigd.",
        "Abonnementen lopen via Stripe; zeg die daar op als dat nodig is.",
      ]);
    }

    // Invoice payment also recovers a missed checkout notification and handles renewals.
    if (event.type === "invoice.payment_succeeded") {
      const invoice = event.data.object as Stripe.Invoice;
      const subscription = invoice.parent?.subscription_details?.subscription;
      const subscriptionId = typeof subscription === "string" ? subscription : subscription?.id;
      if (subscriptionId && invoice.paid) {
        const sub = await stripe.subscriptions.retrieve(subscriptionId);
        await releasePaidEvent(supabaseAdmin, sub);
      }
    }

    // Subscription lifecycle events for Owner Pro
    if (
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      const sub = event.data.object as Stripe.Subscription;
      const userId = sub.metadata?.user_id;
      // Paid extra tags: a trigger adds or removes the tag on the restaurant when this flips.
      {
        const tagLive = ["active", "trialing", "past_due"].includes(sub.status);
        const { error: tagErr } = await supabaseAdmin.from("restaurant_tag_subscriptions")
          .update({ is_active: tagLive }).eq("stripe_subscription_id", sub.id);
        if (tagErr) logStep("Extra tag status update error", { error: tagErr.message });
      }
      // Paid promotion slots: an ended or unpaid subscription frees the slot for the waiting list.
      if (sub.metadata?.type === "promo_slot") {
        const status = event.type === "customer.subscription.deleted" || ["canceled", "unpaid", "incomplete_expired"].includes(sub.status)
          ? "ended" : sub.cancel_at_period_end ? "ending" : "active";
        const { error: promoErr } = await supabaseAdmin.from("promo_slots")
          .update({ status, updated_at: new Date().toISOString() })
          .eq("stripe_subscription_id", sub.id).neq("status", "ended");
        if (promoErr) logStep("Promo slot status update error", { error: promoErr.message });
      }
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
      if (["founding_partner", "menu_service", "topplek", "groei", "dominant", "collectieplek"].includes(sub.metadata?.type ?? "")) {
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
        if ((sub.metadata?.type === "groei" || sub.metadata?.type === "dominant") && sub.metadata?.user_id) {
          await supabaseAdmin.rpc("sync_owner_pro_restaurants", { _user_id: sub.metadata.user_id });
        }
        logStep("Package order synced", { subscriptionId: sub.id, status: sub.status });
      }
      if (sub.metadata?.type === "event_promotion" && sub.metadata?.event_id) {
        // A subscription status alone is not proof of payment. Activation comes
        // from checkout/invoice payment confirmations above.
        const { error: eventError } = await supabaseAdmin
          .from("restaurant_events")
          .update({
            ...(["canceled", "unpaid", "incomplete_expired", "paused"].includes(sub.status) ? { promotion_status: "lapsed" } : {}),
            stripe_subscription_id: sub.id,
            paid_until: periodEndIso(sub),
          })
          .eq("id", sub.metadata.event_id)
          .eq("restaurant_id", sub.metadata.restaurant_id)
          .eq("stripe_subscription_id", sub.id);
        if (eventError) throw new Error(eventError.message);
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
    // Let Stripe's retry handle the event again.
    if (releaseEvent) await releaseEvent().catch(() => {});
    return new Response(JSON.stringify({ error: "Webhook processing failed" }), { status: 500 });
  }
});
