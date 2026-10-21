import { getCaller } from "../_shared/auth.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { enforceRateLimit } from "../_shared/rateLimit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    { const __u = await getCaller(req); if (!__u) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }
    const rl = await enforceRateLimit(req, {
      functionName: "analyze-reviews",
      user: { max: 10, window: 3600 },
      anon: { max: 2, window: 3600 },
      isAi: true,
    });
    if (!rl.allowed && rl.response) return rl.response;

    const { reviews } = await req.json();

    if (!reviews || !Array.isArray(reviews) || reviews.length === 0) {
      return new Response(
        JSON.stringify({ error: "No reviews provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Build a compact representation of reviews for analysis
    const reviewTexts = reviews.map((r: any, i: number) => 
      `[${i}] Rating: ${r.rating}/5 | Title: "${r.title || ''}" | Body: "${r.body || ''}"`
    ).join("\n");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `You are a review analysis system for a Dutch restaurant platform. Analyze reviews and return structured data. Respond ONLY with valid JSON, no markdown.`
          },
          {
            role: "user",
            content: `Analyze these restaurant reviews and return JSON with this exact structure:
{
  "analyses": [
    {
      "index": 0,
      "sentiment": "positive" | "neutral" | "negative",
      "categories": ["food", "service", "ambiance", "price", "location", "hygiene"],
      "suggestedTemplate": "thank" | "apologize" | "invite_back" | null
    }
  ],
  "summary": {
    "averageSentiment": "positive" | "neutral" | "negative",
    "sentimentDistribution": { "positive": 0, "neutral": 0, "negative": 0 },
    "topCategories": [{ "category": "food", "count": 0, "sentiment": "positive" }],
    "actionItems": ["string"]
  }
}

Categories to detect: food (eten/drinken), service (bediening/personeel), ambiance (sfeer/inrichting), price (prijs/waarde), location (locatie/bereikbaarheid), hygiene (hygiëne/netheid).

Reviews:
${reviewTexts}`
          }
        ],
        temperature: 0.2,
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

    let analysis;
    try {
      const jsonMatch = content.match(/```json\n?([\s\S]*?)\n?```/) || content.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : content;
      analysis = JSON.parse(jsonStr);
    } catch (e) {
      console.error("Failed to parse AI response:", content);
      analysis = { raw: content };
    }

    return new Response(
      JSON.stringify({ success: true, analysis }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Review analysis error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
