import { safeOrigin } from "../_shared/auth.ts";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Price IDs from Stripe
const PRICES = {
  featured: "price_1SlyPi3EXkDnjHC3pnORRZY3", // €49 - Featured Listing
  top: "price_1SlySd3EXkDnjHC3DaiHtd8y", // €99 - Top Listing
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-LISTING-CHECKOUT] ${step}${detailsStr}`);
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
    const { listingType, restaurantId } = await req.json();
    logStep("Request body", { listingType, restaurantId });

    if (!listingType || !restaurantId) {
      throw new Error("Missing listingType or restaurantId");
    }

    if (!PRICES[listingType as keyof typeof PRICES]) {
      throw new Error("Invalid listing type");
    }

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    // Verify user owns or is admin for this restaurant
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
      throw new Error("Not authorized to purchase listing for this restaurant");
    }
    logStep("Authorization verified", { isOwner, isAdmin });

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

    // Check for unredeemed verification credit
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: credit } = await supabaseAdmin
      .from("verification_credits")
      .select("id, amount")
      .eq("user_id", user.id)
      .eq("is_redeemed", false)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    logStep("Verification credit check", { hasCredit: !!credit, creditAmount: credit?.amount });

    // Create Stripe coupon if credit exists
    let discounts: { coupon: string }[] | undefined;
    if (credit) {
      const coupon = await stripe.coupons.create({
        amount_off: Math.round((credit.amount || 1) * 100), // €1 = 100 cents
        currency: "eur",
        duration: "once",
        name: "Verificatie tegoed",
        max_redemptions: 1,
      });
      discounts = [{ coupon: coupon.id }];
      logStep("Created coupon for verification credit", { couponId: coupon.id });
    }

    // Create checkout session
    const priceId = PRICES[listingType as keyof typeof PRICES];
    const origin = safeOrigin(req);

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      payment_method_types: ["card", "ideal", "bancontact"],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      ...(discounts ? { discounts } : {}),
      mode: "payment",
      success_url: `${origin}/owner-dashboard?payment=success&type=${listingType}&restaurant=${restaurantId}`,
      cancel_url: `${origin}/owner-dashboard?payment=cancelled`,
      metadata: {
        type: "listing",
        restaurant_id: restaurantId,
        listing_type: listingType,
        user_id: user.id,
        verification_credit_id: credit?.id || "",
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
