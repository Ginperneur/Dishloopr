import { safeOrigin } from "../_shared/auth.ts";
import { billingParams } from "../_shared/billing.ts";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.118.0";
import { withVat } from "../_shared/vat.ts";

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
      pdfUrl,
      editionDate,
    } = await req.json();

    if (!restaurantId || !title) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // The newsletter goes out per city: the restaurant's own city, one edition per Tuesday, at most
    // 4 restaurants per edition, 30 euro per 1.000 readers (at least 20 euro).
    void scope; void targetCityId; void targetProvince; void editionId;
    if (typeof editionDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(editionDate)) {
      return new Response(JSON.stringify({ error: "Kies een editie" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
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

    const pdf = typeof pdfUrl === "string" && pdfUrl.trim() ? pdfUrl.trim() : null;
    if (pdf && !new RegExp(`^https://[a-z0-9]+\\.supabase\\.co/storage/v1/object/public/restaurant-images/${restaurantId}/[A-Za-z0-9/_.-]+\\.pdf$`).test(pdf)) {
      return new Response(JSON.stringify({ error: "Ongeldige pdf: upload hem opnieuw" }), {
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

    const { data: rest } = await supabaseAdmin.from("restaurants").select("city_id, cities(name)").eq("id", restaurantId).maybeSingle();
    const cityId = rest?.city_id as string | undefined;
    if (!cityId) {
      return new Response(JSON.stringify({ error: "Je restaurant heeft nog geen stad" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const cityName = (rest?.cities as { name?: string } | null)?.name ?? "je stad";
    const { data: editions } = await supabaseAdmin.rpc("newsletter_city_editions", { p_city: cityId });
    const edition = ((editions ?? []) as { edition_date: string; places_left: number; price_cents: number }[])
      .find(e => e.edition_date === editionDate);
    if (!edition) {
      return new Response(JSON.stringify({ error: "Deze editie kun je niet meer boeken" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (edition.places_left <= 0) {
      return new Response(JSON.stringify({ error: "Deze editie is vol, kies een andere week" }), { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    // Dominant includes one placement a month.
    const monthStart = `${editionDate.slice(0, 7)}-01`;
    const [{ count: dominant }, { count: usedCredit }] = await Promise.all([
      supabaseAdmin.from("package_orders").select("id", { count: "exact", head: true })
        .eq("restaurant_id", restaurantId).eq("package", "dominant").in("status", ["active", "trialing", "past_due"]),
      supabaseAdmin.from("newsletter_placements").select("id", { count: "exact", head: true })
        .eq("restaurant_id", restaurantId).eq("price_paid", 0).gte("edition_date", monthStart)
        .lt("edition_date", new Date(Date.UTC(Number(editionDate.slice(0, 4)), Number(editionDate.slice(5, 7)), 1)).toISOString().slice(0, 10)),
    ]);
    const included = (dominant ?? 0) > 0 && (usedCredit ?? 0) === 0;
    const priceCents = included ? 0 : edition.price_cents;
    const finalScope = "city";
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
        target_city_id: cityId,
        target_province: null,
        edition_date: editionDate,
        image_url: photo,
        pdf_url: pdf,
        price_paid: priceCents / 100,
        status: included ? "paid" : "pending_payment",
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

    if (included) {
      return new Response(JSON.stringify({ included: true, placementId: placement.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create Stripe checkout
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    const origin = safeOrigin(req);

    const session = await stripe.checkout.sessions.create(await withVat(stripe, {
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "eur",
            unit_amount: priceCents,
            tax_behavior: "exclusive",
            product_data: { name: `Nieuwsbrief ${cityName}, ${editionDate}`, description: String(title).slice(0, 200) },
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
        city_id: cityId,
        edition_date: editionDate,
      },
    }));

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
