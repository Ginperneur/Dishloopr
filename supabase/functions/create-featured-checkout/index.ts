import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-FEATURED-CHECKOUT] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: claims, error: authError } = await supabaseClient.auth.getUser(token);
    
    if (authError || !claims?.user) {
      logStep("Auth error", { error: authError?.message });
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const user = claims.user;
    logStep("User authenticated", { userId: user.id, email: user.email });

    const { 
      restaurantId, 
      slotId, 
      includedAmbiance,
      extraAmbiances,
      durationMonths 
    } = await req.json();

    logStep("Request body", { restaurantId, slotId, includedAmbiance, extraAmbiances, durationMonths });

    // Validate ownership
    const { data: restaurant, error: restError } = await supabaseClient
      .from('restaurants')
      .select('id, name, claimed_by_owner_id, city_id')
      .eq('id', restaurantId)
      .single();

    if (restError || !restaurant) {
      throw new Error("Restaurant niet gevonden");
    }

    if (restaurant.claimed_by_owner_id !== user.id) {
      // Check if admin
      const { data: isAdmin } = await supabaseClient.rpc('has_role', {
        _user_id: user.id,
        _role: 'admin'
      });
      
      if (!isAdmin) {
        throw new Error("Geen toegang tot dit restaurant");
      }
    }

    // Get slot details
    const { data: slot, error: slotError } = await supabaseClient
      .from('featured_slots')
      .select('*, cities(name)')
      .eq('id', slotId)
      .single();

    if (slotError || !slot) {
      throw new Error("Slot niet gevonden");
    }

    // Calculate pricing
    const { data: priceData } = await supabaseClient.rpc(
      'calculate_featured_market_price',
      { p_city_id: slot.city_id, p_cuisine: slot.cuisine }
    );

    const baseMonthlyPrice = priceData.final_price;

    // Calculate ambiance addon price
    let ambianceAddonPrice = 0;
    if (extraAmbiances && extraAmbiances.length > 0) {
      const { data: ambiancePrices } = await supabaseClient
        .from('ambiance_pricing')
        .select('ambiance_tag, monthly_price')
        .in('ambiance_tag', extraAmbiances);

      ambianceAddonPrice = ambiancePrices?.reduce((sum, a) => sum + Number(a.monthly_price), 0) || 0;
    }

    const totalMonthlyPrice = baseMonthlyPrice + ambianceAddonPrice;
    const duration = Math.min(durationMonths || 1, 3); // Max 3 months

    logStep("Pricing calculated", { 
      baseMonthlyPrice, 
      ambianceAddonPrice, 
      totalMonthlyPrice,
      duration
    });

    // Initialize Stripe
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Check for existing Stripe customer
    const customers = await stripe.customers.list({ email: user.email!, limit: 1 });
    let customerId: string | undefined;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    }

    // Create line items
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
      {
        price_data: {
          currency: 'eur',
          product_data: {
            name: `Premium Plek: ${slot.cuisine} in ${slot.cities?.name || 'Stad'}`,
            description: `${duration} maand${duration > 1 ? 'en' : ''} premium zichtbaarheid`,
          },
          unit_amount: Math.round(baseMonthlyPrice * duration * 100),
        },
        quantity: 1,
      },
    ];

    // Add ambiance addons if any
    if (ambianceAddonPrice > 0 && extraAmbiances) {
      lineItems.push({
        price_data: {
          currency: 'eur',
          product_data: {
            name: `Extra ambiance tags: ${extraAmbiances.join(', ')}`,
            description: 'Verhoogde zichtbaarheid voor specifieke sfeer-zoekopdrachten',
          },
          unit_amount: Math.round(ambianceAddonPrice * duration * 100),
        },
        quantity: 1,
      });
    }

    // Create Stripe session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email!,
      line_items: lineItems,
      mode: 'payment',
      success_url: `${req.headers.get("origin")}/owner-dashboard?payment=success&type=featured`,
      cancel_url: `${req.headers.get("origin")}/owner-dashboard?payment=cancelled`,
      metadata: {
        type: 'featured_subscription',
        restaurant_id: restaurantId,
        slot_id: slotId,
        included_ambiance: includedAmbiance || '',
        extra_ambiances: JSON.stringify(extraAmbiances || []),
        duration_months: String(duration),
        monthly_price: String(baseMonthlyPrice),
        ambiance_addon_price: String(ambianceAddonPrice),
        total_monthly_price: String(totalMonthlyPrice),
        user_id: user.id,
      },
    });

    logStep("Checkout session created", { sessionId: session.id, url: session.url });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
