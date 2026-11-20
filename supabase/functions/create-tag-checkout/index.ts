import { safeOrigin } from "../_shared/auth.ts";
import { billingParams } from "../_shared/billing.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.118.0";
import { withVat } from "../_shared/vat.ts";
import { expireOpenCheckouts, getOrCreateCustomer } from "../_shared/stripeCustomer.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Server-side whitelist (must stay in sync with TagManager). Prevents clients
// from persisting arbitrary tag values via checkout metadata.
const VALID_CUISINES = [
  "Italiaans","Japans","Chinees","Indiaas","Mexicaans","Thais","Grieks","Spaans","Koreaans","Vietnamees",
  "Amerikaans","Frans","Turks","Marokkaans","Surinaams","Indonesisch","Aziatisch","Mediterraans","Nederlands",
  "Internationaal","Fusion","Midden-Oosters","Ethiopisch","Braziliaans","Peruaans","Argentijns","Caribisch",
  "Afghaans","Libanees","Steakhouse","Sushi","Vis & Zeevruchten","Vegetarisch","Veganistisch","Pizza","Burger",
  "BBQ","Ramen","Dim Sum","Tapas","Bistro","Brasserie","Gastropub",
];
const VALID_AMBIENCE = [
  "Gezellig","Romantisch","Modern","Trendy","Klassiek","Casual","Fine Dining","Kindvriendelijk","Zakelijk",
  "Levendig","Intiem","Industrieel","Traditioneel","Luxe","Bohemian","Minimalistisch","Warm","Bruisend",
];
const VALID_CONCEPTS = [
  "All you can eat","Shared dining","Teppanyaki","Omakase","Farm to table","Street food","Food hall","Pop-up",
  "Buffet","À la carte","Tasting menu","Brunch spot","Lunchroom","Grand café","Eetcafé","Foodtruck",
  "Dark kitchen","Open keuken","Chef's table","Terras restaurant",
];
const VALID_EXPERIENCES = [
  "Quick bite","Comfort food","Healthy","Luxe avond uit","Date night","Zakendiner","Familiefeest","Groepsdiner",
  "Solo dining","Late night",
];

const CATEGORY_WHITELIST: Record<string, string[]> = {
  cuisine: VALID_CUISINES,
  ambience: VALID_AMBIENCE,
  concept: VALID_CONCEPTS,
  experience: VALID_EXPERIENCES,
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    const { data: userData } = await supabaseClient.auth.getUser(token);
    const user = userData.user;
    if (!user?.email) throw new Error("Niet ingelogd");

    const { restaurant_id, tag_category, tag_value } = await req.json();
    if (!restaurant_id || !tag_category || !tag_value) {
      throw new Error("Ontbrekende velden");
    }

    // Validate category + value against server-side whitelist
    const allowed = CATEGORY_WHITELIST[tag_category];
    if (!allowed) {
      throw new Error(`Onbekende tag-categorie: ${tag_category}`);
    }
    if (!allowed.includes(tag_value)) {
      throw new Error(`Ongeldige tag-waarde voor ${tag_category}`);
    }

    // Only the verified owner (or an admin) may buy a tag for this restaurant.
    const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const [{ data: owns }, { data: isAdmin }] = await Promise.all([
      admin.rpc("is_verified_owner", { _user_id: user.id, _restaurant_id: restaurant_id }),
      admin.rpc("has_role", { _user_id: user.id, _role: "admin" }),
    ]);
    if (owns !== true && isAdmin !== true) {
      return new Response(JSON.stringify({ error: "Alleen de geverifieerde eigenaar kan tags voor dit restaurant kopen" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // At most 3 extra tags per category (the free one is stored on the restaurant itself).
    const { count: extraInCategory } = await admin.from("restaurant_tag_subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("restaurant_id", restaurant_id).eq("tag_category", tag_category).eq("is_active", true).neq("tag_value", tag_value);
    if ((extraInCategory ?? 0) >= 3) {
      return new Response(JSON.stringify({ error: "Je hebt al 3 extra tags in deze categorie" }), {
        status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Extra tags are included with Owner Pro (paid, part of Groei or Dominant, or given by
    // Dishloopr): no checkout, the tag is switched on straight away and switches off with Pro.
    const { data: rest } = await admin.from("restaurants").select("owner_tier, owner_pro_override").eq("id", restaurant_id).maybeSingle();
    if (rest?.owner_tier === "pro" || rest?.owner_pro_override === true) {
      const { error: tagErr } = await admin.from("restaurant_tag_subscriptions").upsert({
        restaurant_id, user_id: user.id, tag_category, tag_value, payment_type: "owner_pro", stripe_subscription_id: null, is_active: true,
      }, { onConflict: "restaurant_id,tag_category,tag_value" });
      if (tagErr) throw tagErr;
      return new Response(JSON.stringify({ included: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Price is determined server-side. The client can NOT influence what
    // the user pays for an extra tag.
    // STRIPE_TAG_PRICE_ID wins when set; otherwise the advertised €5/month is created inline.
    const priceId = Deno.env.get("STRIPE_TAG_PRICE_ID");
    const lineItem = priceId
      ? { price: priceId, quantity: 1 }
      : { quantity: 1, price_data: { currency: "eur", unit_amount: 500, tax_behavior: "exclusive" as const, recurring: { interval: "month" as const }, product_data: { name: "Extra tag" } } };

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    const customerId = await getOrCreateCustomer(stripe, admin, user);
    await expireOpenCheckouts(stripe, customerId, md => md.type === "extra_tag" && md.restaurant_id === restaurant_id
      && md.tag_category === tag_category && md.tag_value === tag_value);

    const origin = safeOrigin(req);

    const session = await stripe.checkout.sessions.create(await withVat(stripe, {
      customer: customerId,
      line_items: [lineItem],
      mode: "subscription",
      ...billingParams({ mode: "subscription", customerId }),
      metadata: {
        type: "extra_tag",
        restaurant_id,
        user_id: user.id,
        tag_category,
        tag_value,
      },
      subscription_data: {
        metadata: { type: "extra_tag", restaurant_id, user_id: user.id, tag_category, tag_value },
        description: `Extra tag: ${tag_value}`.slice(0, 500),
      },
      // Encode: values like "Luxe avond uit" or "Vis & Zeevruchten" made this an invalid URL,
      // which Stripe refused, so the owner only saw a generic error.
      success_url: `${origin}/owner-dashboard?tag_added=${encodeURIComponent(tag_value)}`,
      cancel_url: `${origin}/owner-dashboard`,
    }));

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("create-tag-checkout", e);
    // Validation messages above are thrown on purpose; anything else stays on the server.
    const msg = e instanceof Error && /^(Niet ingelogd|Ontbrekende velden|Onbekende tag-categorie|Ongeldige tag-waarde)/.test(e.message)
      ? e.message : "Afrekenen lukte niet. Probeer het later opnieuw.";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
