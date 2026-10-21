import { safeOrigin } from "../_shared/auth.ts";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const {
      restaurantId,
      restaurantName,
      title,
      description,
      promoType,
      editionId,
      scope,
      targetCityId,
      targetProvince,
    } = await req.json();

    if (!restaurantId || !title) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const allowedScopes = ["city", "province", "national"] as const;
    const finalScope: typeof allowedScopes[number] = allowedScopes.includes(scope)
      ? scope
      : "city";

    if (finalScope === "city" && !targetCityId) {
      return new Response(JSON.stringify({ error: "targetCityId is required for city scope" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (finalScope === "province" && !targetProvince) {
      return new Response(JSON.stringify({ error: "targetProvince is required for province scope" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );

    // Only admins or the restaurant's verified managers (finance rights) may buy placements
    const { data: callerIsAdmin } = await supabaseAdmin.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!callerIsAdmin) {
      const { data: hasAccess } = await supabaseAdmin.rpc("has_restaurant_access", {
        _user_id: user.id, _restaurant_id: restaurantId, _min_role: "finance",
      });
      if (hasAccess !== true) {
        return new Response(JSON.stringify({ error: "Forbidden: no access to this restaurant" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Look up scope-specific Stripe price ID + EUR amount from app_settings
    const priceKey =
      finalScope === "city"
        ? "newsletter_price_id_city"
        : finalScope === "province"
          ? "newsletter_price_id_province"
          : "newsletter_price_id_national";

    const priceMap: Record<typeof allowedScopes[number], number> = {
      city: 15,
      province: 20,
      national: 40,
    };

    const { data: setting } = await supabaseAdmin
      .from("app_settings")
      .select("value")
      .eq("key", priceKey)
      .maybeSingle();

    const stripePriceId = setting?.value;
    if (!stripePriceId) {
      return new Response(
        JSON.stringify({ error: `Stripe price not configured for scope ${finalScope}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Create placement record
    const { data: placement, error: placementError } = await supabaseAdmin
      .from("newsletter_placements")
      .insert({
        restaurant_id: restaurantId,
        user_id: user.id,
        title,
        description: description || null,
        promo_type: promoType || "actie",
        edition_id: editionId || null,
        scope: finalScope,
        target_city_id: finalScope === "city" ? targetCityId : null,
        target_province: finalScope === "province" ? targetProvince : null,
        price_paid: priceMap[finalScope],
        status: "pending_payment",
      })
      .select()
      .single();

    if (placementError) {
      console.error("Placement error:", placementError);
      return new Response(JSON.stringify({ error: placementError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create Stripe checkout
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    const origin = safeOrigin(req);

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card", "ideal"],
      line_items: [
        {
          price: stripePriceId,
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${origin}/owner-dashboard?newsletter=success&placementId=${placement.id}`,
      cancel_url: `${origin}/owner-dashboard?newsletter=cancelled`,
      metadata: {
        type: "newsletter_placement",
        placement_id: placement.id,
        restaurant_id: restaurantId,
        user_id: user.id,
        scope: finalScope,
        target_city_id: targetCityId || "",
        target_province: targetProvince || "",
      },
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
