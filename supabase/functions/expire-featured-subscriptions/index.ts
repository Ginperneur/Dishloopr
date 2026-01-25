import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[EXPIRE-FEATURED] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Starting expiration check");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const now = new Date().toISOString();

    // 1. Find all active subscriptions that have expired
    const { data: expiredSubs, error: fetchError } = await supabaseAdmin
      .from("featured_subscriptions")
      .select("id, restaurant_id, slot_id, consecutive_months, expires_at")
      .eq("status", "active")
      .lt("expires_at", now);

    if (fetchError) {
      logStep("Error fetching expired subscriptions", { error: fetchError.message });
      throw fetchError;
    }

    logStep("Found expired subscriptions", { count: expiredSubs?.length || 0 });

    if (expiredSubs && expiredSubs.length > 0) {
      for (const sub of expiredSubs) {
        // Check if they hit the 3-month max
        const hitMaxDuration = sub.consecutive_months >= 3;

        // Calculate cooling off period (30 days after expiry)
        const coolingOffUntil = new Date(sub.expires_at);
        coolingOffUntil.setDate(coolingOffUntil.getDate() + 30);

        // Update subscription to expired or cooling_off
        const newStatus = hitMaxDuration ? "cooling_off" : "expired";
        
        const { error: updateSubError } = await supabaseAdmin
          .from("featured_subscriptions")
          .update({
            status: newStatus,
            cooling_off_until: hitMaxDuration ? coolingOffUntil.toISOString() : null,
          })
          .eq("id", sub.id);

        if (updateSubError) {
          logStep("Error updating subscription", { id: sub.id, error: updateSubError.message });
          continue;
        }

        // Also update the restaurant's featured status
        const { error: updateRestError } = await supabaseAdmin
          .from("restaurants")
          .update({ 
            is_featured: false, 
            featured_until: null 
          })
          .eq("id", sub.restaurant_id);

        if (updateRestError) {
          logStep("Error updating restaurant", { id: sub.restaurant_id, error: updateRestError.message });
        }

        logStep("Subscription expired", { 
          id: sub.id, 
          restaurantId: sub.restaurant_id, 
          newStatus,
          hitMaxDuration 
        });
      }
    }

    // 2. Clear cooling-off periods that have ended
    const { data: cooledOffSubs, error: coolingFetchError } = await supabaseAdmin
      .from("featured_subscriptions")
      .select("id, restaurant_id")
      .eq("status", "cooling_off")
      .lt("cooling_off_until", now);

    if (coolingFetchError) {
      logStep("Error fetching cooling-off subscriptions", { error: coolingFetchError.message });
    } else if (cooledOffSubs && cooledOffSubs.length > 0) {
      logStep("Found subscriptions ready to leave cooling-off", { count: cooledOffSubs.length });

      for (const sub of cooledOffSubs) {
        // Reset consecutive_months and mark as ready for re-registration
        const { error: resetError } = await supabaseAdmin
          .from("featured_subscriptions")
          .update({
            status: "expired",
            consecutive_months: 0,
            cooling_off_until: null,
          })
          .eq("id", sub.id);

        if (resetError) {
          logStep("Error resetting cooling-off subscription", { id: sub.id, error: resetError.message });
        } else {
          logStep("Subscription left cooling-off, ready for re-registration", { id: sub.id });
        }
      }
    }

    // 3. Process waitlist entries - notify if slots become available
    const { data: slotsWithSpace, error: slotsError } = await supabaseAdmin
      .from("featured_slots")
      .select("id, city_id, cuisine, max_slots");

    if (!slotsError && slotsWithSpace) {
      for (const slot of slotsWithSpace) {
        // Count active subscriptions for this slot
        const { count: activeCount } = await supabaseAdmin
          .from("featured_subscriptions")
          .select("*", { count: "exact", head: true })
          .eq("slot_id", slot.id)
          .eq("status", "active");

        if (activeCount !== null && activeCount < slot.max_slots) {
          // There are available spots - check waitlist
          const { data: waitlistEntries } = await supabaseAdmin
            .from("featured_waitlist")
            .select("id, restaurant_id, position")
            .eq("slot_id", slot.id)
            .is("notified_at", null)
            .order("position", { ascending: true })
            .limit(slot.max_slots - activeCount);

          if (waitlistEntries && waitlistEntries.length > 0) {
            // Update waitlist entries to notify them
            const notifyTime = new Date();
            // Expires in 48 hours
            const expiresAt = new Date(notifyTime.getTime() + 48 * 60 * 60 * 1000);

            for (const entry of waitlistEntries) {
              await supabaseAdmin
                .from("featured_waitlist")
                .update({
                  notified_at: notifyTime.toISOString(),
                  expires_at: expiresAt.toISOString(),
                })
                .eq("id", entry.id);

              logStep("Waitlist entry notified", { 
                entryId: entry.id, 
                restaurantId: entry.restaurant_id,
                slotId: slot.id 
              });
            }
          }
        }
      }
    }

    // 4. Clear expired waitlist notifications
    const { error: clearWaitlistError } = await supabaseAdmin
      .from("featured_waitlist")
      .delete()
      .lt("expires_at", now)
      .not("notified_at", "is", null);

    if (clearWaitlistError) {
      logStep("Error clearing expired waitlist entries", { error: clearWaitlistError.message });
    }

    logStep("Expiration check completed successfully");

    return new Response(
      JSON.stringify({ 
        success: true, 
        expired_count: expiredSubs?.length || 0,
        cooled_off_count: cooledOffSubs?.length || 0 
      }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200 
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500 
      }
    );
  }
});
