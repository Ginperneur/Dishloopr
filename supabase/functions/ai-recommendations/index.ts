import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Server-side input validation to prevent abuse / prompt injection padding
const shortStr = z.string().trim().max(200);
const RequestSchema = z.object({
  type: z.enum(["surprise", "personalized", "smart-suggestion", "dish-explorer"]),
  favorites: z.array(shortStr).max(50).optional(),
  recentSearches: z.array(shortStr).max(50).optional(),
  reviewedDishes: z.array(shortStr).max(100).optional(),
  preferredCuisines: z.array(shortStr).max(50).optional(),
  currentDish: shortStr.optional(),
  mood: shortStr.optional(),
  city: shortStr.optional(),
  priceLevel: z.number().int().min(1).max(4).optional(),
  dietary: z.array(shortStr).max(20).optional(),
  trendingDishes: z.array(z.object({ name: shortStr, searchCount: z.number().int().nonnegative() })).max(100).optional(),
  seasonalDishes: z.array(z.object({ name: shortStr, tags: z.array(shortStr).max(20) })).max(100).optional(),
});

interface RecommendationRequest {
  type: "surprise" | "personalized" | "smart-suggestion" | "dish-explorer";
  // User context
  favorites?: string[];
  recentSearches?: string[];
  reviewedDishes?: string[];
  preferredCuisines?: string[];
  // Discovery context
  currentDish?: string;
  mood?: string;
  city?: string;
  priceLevel?: number;
  dietary?: string[];
  // Enrichment from client
  trendingDishes?: { name: string; searchCount: number }[];
  seasonalDishes?: { name: string; tags: string[] }[];
}

function getCurrentSeason(): string {
  const month = new Date().getMonth();
  if (month >= 2 && month <= 4) return "lente";
  if (month >= 5 && month <= 7) return "zomer";
  if (month >= 8 && month <= 10) return "herfst";
  return "winter";
}

function getDayContext(): string {
  const day = new Date().getDay();
  const hour = new Date().getHours();
  const isWeekend = day === 0 || day === 5 || day === 6;
  let timeOfDay = "avond";
  if (hour < 12) timeOfDay = "ochtend";
  else if (hour < 17) timeOfDay = "middag";
  
  return `${isWeekend ? "weekend" : "doordeweeks"}, ${timeOfDay}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const raw = await req.json().catch(() => null);
    const parsed = RequestSchema.safeParse(raw);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: "Invalid input", details: parsed.error.flatten().fieldErrors }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const body: RecommendationRequest = parsed.data as RecommendationRequest;
    const {
      type,
      favorites = [],
      recentSearches = [],
      reviewedDishes = [],
      preferredCuisines = [],
      currentDish,
      mood,
      city,
      priceLevel,
      dietary = [],
      trendingDishes = [],
      seasonalDishes = [],
    } = body;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Fetch real data from database for richer context
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch active dishes with cuisine tags
    const { data: dbDishes } = await supabase
      .from("dishes")
      .select("name, cuisine_tags, seasonal_tags, search_count")
      .eq("is_active", true)
      .order("search_count", { ascending: false })
      .limit(150);

    // Fetch popular restaurants in the user's city (if provided)
    let cityRestaurants: { name: string; cuisines: string[]; rating: number; ambience_tags: string[] }[] = [];
    if (city) {
      const { data: cityData } = await supabase
        .from("cities")
        .select("id")
        .ilike("name", city)
        .limit(1);

      if (cityData && cityData.length > 0) {
        const { data: restaurants } = await supabase
          .from("restaurants")
          .select("name, cuisines, rating, ambience_tags")
          .eq("city_id", cityData[0].id)
          .eq("is_active", true)
          .order("rating", { ascending: false })
          .limit(30);
        cityRestaurants = restaurants || [];
      }
    }

    const allDishes = dbDishes || [];
    const season = getCurrentSeason();
    const dayContext = getDayContext();

    // Build context blocks
    const dishList = allDishes.map(d => d.name).join(", ");
    const topDishes = allDishes.slice(0, 20).map(d => `${d.name} (${d.search_count}x gezocht)`).join(", ");
    const seasonalContext = allDishes
      .filter(d => d.seasonal_tags?.includes(season))
      .map(d => d.name)
      .slice(0, 10)
      .join(", ");
    const availableCuisines = [...new Set(allDishes.flatMap(d => d.cuisine_tags || []))].join(", ");
    const cityContext = cityRestaurants.length > 0
      ? `Top restaurants in ${city}: ${cityRestaurants.slice(0, 10).map(r => `${r.name} (${r.cuisines?.join("/") || "divers"}, ★${r.rating})`).join(", ")}`
      : "";

    let systemPrompt = "";
    let userPrompt = "";

    // ── DECISION TREE ──────────────────────────────────────────────
    switch (type) {
      case "surprise": {
        // Determine user profile depth
        const hasHistory = favorites.length > 0 || reviewedDishes.length > 0;
        const hasPreferences = preferredCuisines.length > 0;

        systemPrompt = `Je bent een enthousiaste culinaire ontdekker voor Dishloopr, het platform waar Nederlanders gerechten ontdekken. Je geeft ALLEEN gerechten aan die op het platform beschikbaar zijn. Reageer ALTIJD in het Nederlands.

BESLISSINGSKADER:
1. Als de gebruiker een mood/stemming heeft opgegeven → prioriteer gerechten die bij die stemming passen
2. Als de gebruiker een eetgeschiedenis heeft → vermijd wat ze al kennen en zoek verrassende maar verwante gerechten
3. Als er seizoensgerechten zijn → geef die extra gewicht (het is nu ${season})
4. Als er trending gerechten zijn → overweeg deze, maar mix met hidden gems
5. Houd rekening met het moment: ${dayContext}
${dietary.length > 0 ? `6. Dieetwensen: ${dietary.join(", ")} — FILTER hier strikt op` : ""}

REGELS:
- Kies ALTIJD een gerecht uit de beschikbare lijst
- Geef een persoonlijk en warm advies, geen generieke tekst
- De "pairingTip" moet een concreet drankje of bijgerecht noemen
- De "discoveryAngle" legt uit WAAROM dit nu een goede keuze is (seizoen, trending, verborgen parel, etc.)

Reageer in JSON: { "dish": "naam", "reason": "persoonlijke reden max 2 zinnen", "description": "smaakomschrijving max 3 zinnen", "pairingTip": "concreet bijgerecht of drankje", "discoveryAngle": "waarom nu ontdekken", "confidence": 0-100 }`;

        userPrompt = `BESCHIKBARE GERECHTEN: ${dishList}

CONTEXT:
- Moment: ${dayContext}, seizoen: ${season}
${mood ? `- Stemming: ${mood}` : "- Geen specifieke stemming opgegeven"}
${city ? `- Stad: ${city}` : ""}
${priceLevel ? `- Prijsniveau voorkeur: ${"€".repeat(priceLevel)}` : ""}
${hasHistory ? `- Eerder gegeten/beoordeeld: ${[...favorites, ...reviewedDishes].slice(0, 15).join(", ")}` : "- Nieuwe gebruiker, geen geschiedenis"}
${hasPreferences ? `- Voorkeurskeuken: ${preferredCuisines.join(", ")}` : ""}
${recentSearches.length > 0 ? `- Recent gezocht: ${recentSearches.slice(0, 5).join(", ")}` : ""}
${seasonalContext ? `- Seizoensgerechten (${season}): ${seasonalContext}` : ""}
- Meest gezochte gerechten: ${topDishes}
${cityContext}

${hasHistory
  ? "Verras de gebruiker met iets dat aansluit bij hun smaak maar dat ze nog niet kennen. Vermijd gerechten die ze al hebben gehad."
  : mood
    ? "Focus op de stemming en geef een perfect passend gerecht."
    : "Kies een toegankelijk maar bijzonder gerecht dat een nieuwe gebruiker zou aanspreken. Geef voorkeur aan trending of seizoensgerechten."}`;
        break;
      }

      case "personalized": {
        systemPrompt = `Je bent een personalisatie-engine voor Dishloopr. Je analyseert het smaakprofiel van gebruikers en vindt gerechten die ze nog niet kennen maar wel zouden waarderen. Reageer in het Nederlands.

BESLISSINGSKADER:
1. Analyseer de overlap tussen favorieten, reviews en zoekopdrachten om de "smaak-DNA" te bepalen
2. Zoek gerechten met dezelfde keuken-tags maar uit een ander segment (bijv. ze houden van ramen → probeer tantanmen)
3. Weeg seizoensrelevantie mee (het is ${season})
4. Diversifieer: niet alle suggesties uit dezelfde keuken
5. Geef elke suggestie een "matchScore" gebaseerd op hoe sterk de verbinding is

Reageer in JSON: { "recommendations": [{ "dish": "naam", "reason": "max 2 zinnen", "matchScore": 60-98, "matchBasis": "flavor|cuisine|trending|seasonal" }] }. Geef exact 4 aanbevelingen, gesorteerd op matchScore.`;

        userPrompt = `BESCHIKBARE GERECHTEN: ${dishList}
BESCHIKBARE KEUKENS: ${availableCuisines}

GEBRUIKERSPROFIEL:
- Favoriete restaurants serveren: ${favorites.length > 0 ? favorites.join(", ") : "nog geen favorieten"}
- Beoordeelde gerechten: ${reviewedDishes.length > 0 ? reviewedDishes.join(", ") : "geen"}
- Voorkeurskeuken: ${preferredCuisines.length > 0 ? preferredCuisines.join(", ") : "niet opgegeven"}
- Recent gezocht: ${recentSearches.length > 0 ? recentSearches.join(", ") : "geen"}
- Seizoen: ${season}
- Trending nu: ${topDishes}
${cityContext}

Genereer 4 gepersonaliseerde aanbevelingen. Mix vertrouwd en avontuurlijk. Vermijd gerechten die de gebruiker al kent.`;
        break;
      }

      case "smart-suggestion": {
        systemPrompt = `Je bent een food-pairing expert voor Dishloopr. Je vindt gerechten die qua smaakprofiel, bereidingswijze of culturele context verwant zijn. Reageer in het Nederlands.

BESLISSINGSLOGICA:
1. SMAAKPROFIEL: Zoek gerechten met vergelijkbare smaken (umami, zoet-zuur, pittig, etc.)
2. KEUKEN-CROSSOVER: Zoek vergelijkbare gerechten uit andere keukens
3. BEREIDINGSWIJZE: Dezelfde techniek maar ander resultaat
4. SEIZOEN: Geef bonus aan seizoensrelevante suggesties (${season})

Reageer in JSON: { "suggestions": [{ "dish": "naam", "connection": "max 1 zin uitleg", "connectionType": "flavor|crossover|technique|seasonal" }] }. Geef exact 3 suggesties.`;

        userPrompt = `De gebruiker genoot van: ${currentDish}
Beschikbare gerechten: ${dishList}
${seasonalContext ? `Seizoensgerechten (${season}): ${seasonalContext}` : ""}
Trending: ${topDishes}

Geef 3 verwante gerechten met diverse verbindingstypes. Niet allemaal dezelfde keuken.`;
        break;
      }

      case "dish-explorer": {
        systemPrompt = `Je bent een culinaire gids voor Dishloopr. Je geeft diepgaande informatie over een gerecht: oorsprong, variaties, en hoe het te waarderen. Reageer in het Nederlands.

Reageer in JSON: { "origin": "korte oorsprong max 2 zinnen", "funFact": "leuk weetje", "bestWith": "wat erbij past", "variations": ["variatie1", "variatie2"], "seasonalNote": "seizoenstip of null" }`;

        userPrompt = `Vertel over: ${currentDish}
Het is ${season}. ${cityContext ? `De gebruiker is in ${city}.` : ""}`;
        break;
      }

      default:
        throw new Error("Invalid recommendation type");
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.8,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Te veel verzoeken. Probeer het zo opnieuw." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI-tegoed op. Neem contact op met support." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    let recommendation;
    try {
      const jsonMatch = content.match(/```json\n?([\s\S]*?)\n?```/) || content.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : content;
      recommendation = JSON.parse(jsonStr);
    } catch (e) {
      console.error("Failed to parse AI response:", content);
      recommendation = { raw: content };
    }

    return new Response(
      JSON.stringify({ success: true, type, recommendation, meta: { season, dayContext } }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("AI recommendations error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
