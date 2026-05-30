import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ClassificationResult {
  cuisines: string[];
  ambience_tags: string[];
  concepts: string[];
  meal_types: string[];
  experiences: string[];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Admin-only: verify caller is an admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const authClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user } } = await authClient.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { batch_size = 25, dry_run = false } = await req.json().catch(() => ({}));

    // Fetch restaurants missing metadata
    const { data: restaurants, error: fetchError } = await supabase
      .from("restaurants")
      .select("id, name, address, cuisines, ambience_tags, concepts, meal_types, experiences, price_level")
      .eq("is_active", true)
      .or("cuisines.is.null,cuisines.eq.{}")
      .limit(Math.min(batch_size, 50));

    if (fetchError) throw fetchError;
    if (!restaurants || restaurants.length === 0) {
      return new Response(JSON.stringify({ message: "No restaurants need classification", updated: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const VALID_CUISINES = [
      "Italiaans", "Japans", "Chinees", "Indiaas", "Mexicaans", "Thais", "Grieks",
      "Spaans", "Koreaans", "Vietnamees", "Amerikaans", "Frans", "Turks", "Marokkaans",
      "Surinaams", "Indonesisch", "Aziatisch", "Mediterraans", "Nederlands", "Internationaal",
      "Fusion", "Midden-Oosters", "Ethiopisch", "Braziliaans", "Peruaans", "Argentijns",
      "Caribisch", "Afghaans", "Libanees", "Steakhouse", "Sushi", "Vis & Zeevruchten",
      "Vegetarisch", "Veganistisch", "Pizza", "Burger", "BBQ", "Ramen", "Dim Sum",
      "Tapas", "Bistro", "Brasserie", "Gastropub"
    ];

    const VALID_AMBIENCE = [
      "Gezellig", "Romantisch", "Modern", "Trendy", "Klassiek", "Casual", "Fine Dining",
      "Kindvriendelijk", "Zakelijk", "Levendig", "Intiem", "Industrieel", "Traditioneel",
      "Luxe", "Bohemian", "Minimalistisch", "Warm", "Bruisend"
    ];

    const VALID_CONCEPTS = [
      "All you can eat", "Shared dining", "Teppanyaki", "Omakase", "Farm to table",
      "Street food", "Food hall", "Pop-up", "Buffet", "À la carte", "Tasting menu",
      "Brunch spot", "Lunchroom", "Grand café", "Eetcafé", "Foodtruck", "Dark kitchen",
      "Open keuken", "Chef's table", "Terras restaurant"
    ];

    const VALID_MEAL_TYPES = ["breakfast", "brunch", "lunch", "dinner"];

    const VALID_EXPERIENCES = [
      "Quick bite", "Comfort food", "Healthy", "Luxe avond uit", "Date night",
      "Zakendiner", "Familiefeest", "Groepsdiner", "Solo dining", "Late night"
    ];

    // Build prompt for batch classification
    const restaurantList = restaurants.map((r, i) => 
      `${i + 1}. "${r.name}" - ${r.address || "onbekend adres"} (prijs: ${r.price_level || "?"})`
    ).join("\n");

    const prompt = `Je bent een expert in de Nederlandse horeca. Classificeer elk restaurant op basis van naam en adres.

Restaurants:
${restaurantList}

Geef per restaurant de volgende classificaties. Gebruik ALLEEN waarden uit de lijsten hieronder:

KEUKENS (kies precies 1): ${VALID_CUISINES.join(", ")}
SFEER (kies precies 1): ${VALID_AMBIENCE.join(", ")}
CONCEPTEN (kies precies 1): ${VALID_CONCEPTS.join(", ")}
MAALTIJDEN (kies 1-4): ${VALID_MEAL_TYPES.join(", ")}
BELEVINGEN (kies precies 1): ${VALID_EXPERIENCES.join(", ")}

Antwoord ALLEEN met een JSON array. Elk element heeft:
{
  "index": 1,
  "cuisines": ["..."],
  "ambience_tags": ["..."],
  "concepts": ["..."],
  "meal_types": ["..."],
  "experiences": ["..."]
}

BELANGRIJK: Geef precies 1 keuken, 1 sfeer, 1 concept en 1 beleving per restaurant. Alleen maaltijdtypes mag je er meerdere geven.
Wees specifiek en realistisch. Als je het niet zeker weet op basis van de naam, kies dan de meest waarschijnlijke optie.`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "Je classificeert Nederlandse restaurants. Antwoord altijd met valide JSON." },
          { role: "user", content: prompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "classify_restaurants",
              description: "Classify a batch of restaurants with metadata",
              parameters: {
                type: "object",
                properties: {
                  classifications: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        index: { type: "number" },
                        cuisines: { type: "array", items: { type: "string" } },
                        ambience_tags: { type: "array", items: { type: "string" } },
                        concepts: { type: "array", items: { type: "string" } },
                        meal_types: { type: "array", items: { type: "string" } },
                        experiences: { type: "array", items: { type: "string" } },
                      },
                      required: ["index", "cuisines", "ambience_tags", "concepts", "meal_types", "experiences"],
                    },
                  },
                },
                required: ["classifications"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "classify_restaurants" } },
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI error:", aiResponse.status, errText);
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit bereikt, probeer later opnieuw" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Onvoldoende credits" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No tool call in AI response");

    const parsed = JSON.parse(toolCall.function.arguments);
    const classifications: ClassificationResult[] = parsed.classifications;

    if (dry_run) {
      const preview = classifications.map((c, i) => ({
        restaurant: restaurants[c.index - 1]?.name || `#${c.index}`,
        ...c,
      }));
      return new Response(JSON.stringify({ preview, count: preview.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate and update
    let updated = 0;
    const errors: string[] = [];

    for (const classification of classifications) {
      const restaurant = restaurants[classification.index - 1];
      if (!restaurant) continue;

      // Filter to only valid values
      // Free tier: limit to 1 tag per category (except meal_types)
      // Free tier: limit to 1 tag per category (max extra via paid = 3)
      const validCuisines = classification.cuisines.filter(c => VALID_CUISINES.includes(c)).slice(0, 1);
      const validAmbience = classification.ambience_tags.filter(a => VALID_AMBIENCE.includes(a)).slice(0, 1);
      const validConcepts = classification.concepts.filter(c => VALID_CONCEPTS.includes(c)).slice(0, 1);
      const validMealTypes = classification.meal_types.filter(m => VALID_MEAL_TYPES.includes(m));
      const validExperiences = classification.experiences.filter(e => VALID_EXPERIENCES.includes(e)).slice(0, 1);

      const updateData: Record<string, any> = {};
      
      // Only update fields that are currently empty
      if (!restaurant.cuisines || restaurant.cuisines.length === 0) {
        updateData.cuisines = validCuisines;
      }
      if (!restaurant.ambience_tags || restaurant.ambience_tags.length === 0) {
        updateData.ambience_tags = validAmbience;
      }
      if (!restaurant.concepts || restaurant.concepts.length === 0) {
        updateData.concepts = validConcepts;
      }
      if (!restaurant.meal_types || restaurant.meal_types.length === 0) {
        updateData.meal_types = validMealTypes;
      }
      if (!restaurant.experiences || restaurant.experiences.length === 0) {
        updateData.experiences = validExperiences;
      }

      if (Object.keys(updateData).length === 0) continue;

      const { error: updateError } = await supabase
        .from("restaurants")
        .update(updateData)
        .eq("id", restaurant.id);

      if (updateError) {
        errors.push(`${restaurant.name}: ${updateError.message}`);
      } else {
        updated++;
      }
    }

    // Count remaining
    const { count: remaining } = await supabase
      .from("restaurants")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true)
      .or("cuisines.is.null,cuisines.eq.{}");

    return new Response(JSON.stringify({
      updated,
      errors: errors.length > 0 ? errors : undefined,
      remaining: remaining || 0,
      batch_size: restaurants.length,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("classify-restaurants error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
