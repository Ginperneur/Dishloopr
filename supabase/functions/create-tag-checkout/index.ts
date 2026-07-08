import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

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

    const authHeader = req.headers.get("Authorization")!;
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

    // Price is determined server-side. The client can NOT influence what
    // the user pays for an extra tag.
    const priceId = Deno.env.get("STRIPE_TAG_PRICE_ID");
    if (!priceId) {
      throw new Error("STRIPE_TAG_PRICE_ID is not configured");
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Find or create customer
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId: string | undefined;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    }

    const origin = req.headers.get("origin") || "https://dishloopr.com";

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "subscription",
      metadata: {
        type: "extra_tag",
        restaurant_id,
        user_id: user.id,
        tag_category,
        tag_value,
      },
      success_url: `${origin}/owner-dashboard?tag_added=${tag_value}`,
      cancel_url: `${origin}/owner-dashboard`,
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
