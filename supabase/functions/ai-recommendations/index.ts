import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RecommendationRequest {
  type: "surprise" | "personalized" | "smart-suggestion";
  favorites?: string[];
  recentSearches?: string[];
  currentDish?: string;
  mood?: string;
  availableDishes?: string[];
  availableCuisines?: string[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      type, 
      favorites = [], 
      recentSearches = [],
      currentDish,
      mood,
      availableDishes = [],
      availableCuisines = []
    }: RecommendationRequest = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    let systemPrompt = "";
    let userPrompt = "";

    switch (type) {
      case "surprise":
        systemPrompt = `You are a culinary expert helping users discover new dishes. You must ONLY recommend dishes from the provided list. Be enthusiastic and descriptive. Always respond in JSON format with the structure: { "dish": "dish name", "reason": "why this dish", "description": "appetizing description", "pairingTip": "what to pair it with" }`;
        userPrompt = `Available dishes: ${availableDishes.join(", ")}.
Available cuisines: ${availableCuisines.join(", ")}.
${mood ? `User's mood: ${mood}` : ""}
${favorites.length > 0 ? `User previously liked: ${favorites.join(", ")}` : ""}
${recentSearches.length > 0 ? `Recent searches: ${recentSearches.join(", ")}` : ""}

Recommend ONE surprising dish from the available dishes list that the user might love. Pick something they haven't tried but would likely enjoy based on their preferences.`;
        break;

      case "personalized":
        systemPrompt = `You are a personalization engine for a food discovery app. Analyze user preferences and suggest relevant dishes. Always respond in JSON format with the structure: { "recommendations": [{ "dish": "name", "reason": "why recommended", "matchScore": 85 }] }. Limit to 3-5 recommendations.`;
        userPrompt = `Available dishes: ${availableDishes.join(", ")}.
User's favorite restaurants serve: ${favorites.join(", ")}.
Recent searches: ${recentSearches.join(", ")}.

Generate personalized dish recommendations based on their taste profile. Only recommend from the available dishes list.`;
        break;

      case "smart-suggestion":
        systemPrompt = `You are a food pairing expert. Given a dish the user enjoyed, suggest related dishes they might also like. Always respond in JSON format with the structure: { "suggestions": [{ "dish": "name", "connection": "why similar" }] }. Limit to 3 suggestions.`;
        userPrompt = `The user enjoyed: ${currentDish}.
Available dishes: ${availableDishes.join(", ")}.

Suggest 3 similar or complementary dishes from the available list with explanations of the connection.`;
        break;

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
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add funds." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    // Parse JSON from response
    let recommendation;
    try {
      // Extract JSON from potential markdown code blocks
      const jsonMatch = content.match(/```json\n?([\s\S]*?)\n?```/) || content.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : content;
      recommendation = JSON.parse(jsonStr);
    } catch (e) {
      console.error("Failed to parse AI response:", content);
      recommendation = { raw: content };
    }

    return new Response(
      JSON.stringify({ success: true, type, recommendation }),
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
