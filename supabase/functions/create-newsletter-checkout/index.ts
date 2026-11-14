import { safeOrigin } from "../_shared/auth.ts";
import { billingParams } from "../_shared/billing.ts";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.118.0";

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
      imageUrl,
    } = await req.json();

    if (!restaurantId || !title) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Only all of the Netherlands is sold for now: the newsletter goes to every subscriber, so a city
    // or province placement could not be delivered as promised. Old clients sending another scope get national.
    const allowedScopes = ["city", "province", "national"] as const;
    const finalScope: typeof allowedScopes[number] = "national";
    void scope; void targetCityId; void targetProvince;

    // An optional photo, only from the restaurant's own folder in Dishloopr storage.
    if (!/^[0-9a-f-]{36}$/i.test(String(restaurantId))) {
      return new Response(JSON.stringify({ error: "Ongeldig restaurant" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const photo = typeof imageUrl === "string" && imageUrl.trim() ? imageUrl.trim() : null;
    if (photo && !new RegExp(`^https://[a-z0-9]+\\.supabase\\.co/storage/v1/object/public/restaurant-images/${restaurantId}/[A-Za-z0-9/_.-]+$`).test(photo)) {
      return new Response(JSON.stringify({ error: "Ongeldige foto: upload hem opnieuw" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );

    // Admins, the verified owner, or a team member with finance rights may buy placements.
    // (has_restaurant_access alone missed owners verified through a claim, who got a 403.)
    const [{ data: callerIsAdmin }, { data: isOwner }, { data: hasAccess }] = await Promise.all([
      supabaseAdmin.rpc("has_role", { _user_id: user.id, _role: "admin" }),
      supabaseAdmin.rpc("is_verified_owner", { _user_id: user.id, _restaurant_id: restaurantId }),
      supabaseAdmin.rpc("has_restaurant_access", { _user_id: user.id, _restaurant_id: restaurantId, _min_role: "finance" }),
    ]);
    if (callerIsAdmin !== true && isOwner !== true && hasAccess !== true) {
      return new Response(JSON.stringify({ error: "Alleen de geverifieerde eigenaar kan een nieuwsbriefplaatsing kopen" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Prices are set here, so the owner can't influence them. A Stripe price ID in app_settings
    // (newsletter_price_id_<scope>) is no longer required: those prices were removed from the
    // Stripe catalogue, which made every placement fail. The amount is created inline instead.
    const priceMap: Record<typeof allowedScopes[number], number> = {
      city: 20,
      province: 20,
      national: 20,
    };
    const scopeLabel = { city: "één stad", province: "één provincie", national: "heel Nederland" }[finalScope];

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
        target_city_id: null,
        target_province: null,
        image_url: photo,
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
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "eur",
            unit_amount: priceMap[finalScope] * 100,
            tax_behavior: "exclusive",
            product_data: { name: `Nieuwsbriefplaatsing, ${scopeLabel}`, description: String(title).slice(0, 200) },
          },
        },
      ],
      mode: "payment",
      customer_email: user.email,
      ...billingParams({ mode: "payment", description: `Nieuwsbriefplaatsing ${restaurantName ?? ""}: ${title}` }),
      success_url: `${origin}/owner-dashboard?newsletter=success&placementId=${placement.id}`,
      cancel_url: `${origin}/owner-dashboard?newsletter=cancelled`,
      metadata: {
        type: "newsletter_placement",
        placement_id: placement.id,
        restaurant_id: restaurantId,
        user_id: user.id,
        scope: finalScope,

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
