import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-SPONSORED-CHECKOUT] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  try {
    logStep("Function started");

    // Get request body
    const { productId, restaurantId, durationDays } = await req.json();
    logStep("Request body", { productId, restaurantId, durationDays });

    if (!productId || !restaurantId) {
      throw new Error("Missing productId or restaurantId");
    }

    const duration = durationDays || 30;
    if (duration < 14 || duration > 60) {
      throw new Error("Duration must be between 14 and 60 days");
    }

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id });

    // Get product details
    const { data: product, error: productError } = await supabaseClient
      .from("sponsored_products")
      .select("*, dishes(name), cities(name)")
      .eq("id", productId)
      .eq("is_active", true)
      .single();

    if (productError || !product) {
      throw new Error("Product not found or inactive");
    }
    logStep("Product found", { product });

    // Verify restaurant ownership
    const { data: restaurant, error: restaurantError } = await supabaseClient
      .from("restaurants")
      .select("id, name, claimed_by_owner_id")
      .eq("id", restaurantId)
      .single();

    if (restaurantError || !restaurant) {
      throw new Error("Restaurant not found");
    }

    // Check if user is owner or admin
    const { data: userRole } = await supabaseClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    const isOwner = restaurant.claimed_by_owner_id === user.id;
    const isAdmin = userRole?.role === "admin";

    if (!isOwner && !isAdmin) {
      throw new Error("Not authorized to purchase for this restaurant");
    }
    logStep("Authorization verified", { isOwner, isAdmin });

    // Check available slots
    const { data: availableSlots } = await supabaseClient.rpc('get_available_slots', { 
      p_product_id: productId 
    });

    if (availableSlots !== null && availableSlots <= 0) {
      throw new Error("No slots available for this product");
    }
    logStep("Slots available", { availableSlots });

    // Calculate price using database function
    const { data: calculatedPrice } = await supabaseClient.rpc('calculate_sponsored_price', {
      p_dish_id: product.dish_id,
      p_city_id: product.city_id,
      p_duration_days: duration
    });

    const priceInCents = Math.round((calculatedPrice || 49) * 100);
    logStep("Price calculated", { calculatedPrice, priceInCents });

    // Initialize Stripe
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Check for existing Stripe customer
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      logStep("Found existing customer", { customerId });
    }

    // Create checkout session
    const origin = req.headers.get("origin") || "https://dishloopr.com";
    const dishName = (product as any).dishes?.name || 'Gerecht';
    const cityName = (product as any).cities?.name || 'Stad';

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      payment_method_types: ["card", "ideal", "bancontact"],
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: {
              name: `Sponsored Listing: ${dishName} in ${cityName}`,
              description: `${duration} dagen sponsoring voor ${restaurant.name}`,
            },
            unit_amount: priceInCents,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${origin}/owner-dashboard?sponsored=success&product=${productId}&restaurant=${restaurantId}&duration=${duration}`,
      cancel_url: `${origin}/owner-dashboard?sponsored=cancelled`,
      metadata: {
        type: "sponsored_dish",
        product_id: productId,
        restaurant_id: restaurantId,
        duration_days: duration.toString(),
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
