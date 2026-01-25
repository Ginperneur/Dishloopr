import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[FEATURED-MARKETPLACE] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const url = new URL(req.url);
    const action = url.searchParams.get("action");
    
    logStep("Action requested", { action });

    switch (action) {
      case "get-market-overview": {
        // Get overview of all available slots per city + cuisine
        const { cityId, cuisine } = await req.json();
        
        const { data: priceData, error: priceError } = await supabaseClient.rpc(
          'calculate_featured_market_price',
          { p_city_id: cityId, p_cuisine: cuisine }
        );

        if (priceError) throw priceError;

        // Get ambiance pricing
        const { data: ambiancePricing } = await supabaseClient
          .from('ambiance_pricing')
          .select('*')
          .eq('is_active', true)
          .order('display_order');

        return new Response(JSON.stringify({
          pricing: priceData,
          ambiancePricing: ambiancePricing || []
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }

      case "get-available-cuisines": {
        // Get all cuisines with slot availability for a city
        const { cityId } = await req.json();

        // Get all unique cuisines from restaurants in this city
        const { data: restaurants } = await supabaseClient
          .from('restaurants')
          .select('cuisines')
          .eq('city_id', cityId)
          .eq('is_active', true);

        const cuisineSet = new Set<string>();
        restaurants?.forEach(r => {
          r.cuisines?.forEach((c: string) => cuisineSet.add(c));
        });

        const cuisines = Array.from(cuisineSet);

        // Get slot info for each cuisine
        const cuisineData = await Promise.all(
          cuisines.map(async (cuisine) => {
            const { data: priceData } = await supabaseClient.rpc(
              'calculate_featured_market_price',
              { p_city_id: cityId, p_cuisine: cuisine }
            );
            return {
              cuisine,
              ...priceData
            };
          })
        );

        return new Response(JSON.stringify({ cuisines: cuisineData }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }

      case "check-eligibility": {
        // Check if restaurant can subscribe to a slot
        const authHeader = req.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
          return new Response(
            JSON.stringify({ error: 'Unauthorized' }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { restaurantId, cityId, cuisine } = await req.json();

        // Get or create slot
        let { data: slot } = await supabaseClient
          .from('featured_slots')
          .select('*')
          .eq('city_id', cityId)
          .eq('cuisine', cuisine)
          .single();

        if (!slot) {
          // Create new slot with default settings
          const { data: newSlot, error: createError } = await supabaseClient
            .from('featured_slots')
            .insert({
              city_id: cityId,
              cuisine: cuisine,
              max_slots: 15,
              base_price: 99.00
            })
            .select()
            .single();

          if (createError) throw createError;
          slot = newSlot;
        }

        // Check cooling off
        const { data: inCoolingOff } = await supabaseClient.rpc(
          'is_in_cooling_off',
          { p_restaurant_id: restaurantId, p_slot_id: slot.id }
        );

        // Check existing subscription
        const { data: existingSub } = await supabaseClient
          .from('featured_subscriptions')
          .select('*')
          .eq('restaurant_id', restaurantId)
          .eq('slot_id', slot.id)
          .eq('status', 'active')
          .maybeSingle();

        // Check waitlist position
        const { data: waitlistPos } = await supabaseClient.rpc(
          'get_waitlist_position',
          { p_restaurant_id: restaurantId, p_slot_id: slot.id }
        );

        // Get active count
        const { data: activeCount } = await supabaseClient.rpc(
          'get_featured_active_count',
          { p_slot_id: slot.id }
        );

        const isFull = activeCount >= slot.max_slots;

        return new Response(JSON.stringify({
          eligible: !inCoolingOff && !existingSub && !isFull,
          inCoolingOff,
          hasActiveSubscription: !!existingSub,
          existingSubscription: existingSub,
          isFull,
          waitlistPosition: waitlistPos,
          activeCount,
          maxSlots: slot.max_slots,
          slotId: slot.id
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }

      case "join-waitlist": {
        const authHeader = req.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
          return new Response(
            JSON.stringify({ error: 'Unauthorized' }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { restaurantId, slotId, selectedAmbiances } = await req.json();

        // Get current waitlist count
        const { count } = await supabaseClient
          .from('featured_waitlist')
          .select('*', { count: 'exact', head: true })
          .eq('slot_id', slotId);

        // Get current market price
        const { data: slot, error: slotError } = await supabaseClient
          .from('featured_slots')
          .select('city_id, cuisine')
          .eq('id', slotId)
          .single();

        if (slotError || !slot) {
          throw new Error("Slot niet gevonden");
        }

        const { data: priceData } = await supabaseClient.rpc(
          'calculate_featured_market_price',
          { p_city_id: slot.city_id, p_cuisine: slot.cuisine }
        );

        const { data: entry, error } = await supabaseClient
          .from('featured_waitlist')
          .insert({
            slot_id: slotId,
            restaurant_id: restaurantId,
            position: (count || 0) + 1,
            price_at_registration: priceData.final_price,
            selected_ambiances: selectedAmbiances || []
          })
          .select()
          .single();

        if (error) throw error;

        return new Response(JSON.stringify({ 
          success: true, 
          position: entry.position 
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }

      default:
        return new Response(JSON.stringify({ error: "Unknown action" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
