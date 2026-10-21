import { getCaller } from "../_shared/auth.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";

import { enforceRateLimit } from "../_shared/rateLimit.ts";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ModerationResult {
  decision: "allow" | "flag" | "block";
  reason: string;
  categories: string[];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  { const __u = await getCaller(req); if (!__u) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }
  const __rl = await enforceRateLimit(req, {
    functionName: "moderate-review",
    isAi: true,
    user: { max: 30, window: 1800 },
    anon: { max: 10, window: 3600 },
  });
  if (!__rl.allowed && __rl.response) return __rl.response;

  try {
    const { title, body, rating } = await req.json();
    const text = `${title ?? ""}\n${body ?? ""}`.trim();

    if (!text) {
      return new Response(
        JSON.stringify({ decision: "block", reason: "Lege review", categories: ["empty"] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY missing — defaulting to allow");
      return new Response(
        JSON.stringify({ decision: "allow", reason: "moderation unavailable", categories: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const systemPrompt = `Je bent een content moderator voor restaurantreviews op Dishloopr (NL/EN/DE/FR/ES).
Beoordeel of de review geplaatst mag worden. Reviews mogen kritisch, negatief of emotioneel zijn — dat is geen reden om te blokkeren.

BLOCK (volledig weigeren) als de tekst bevat:
- Scheldwoorden of grove beledigingen gericht op personen/personeel (kanker, kut, klootzak, fuck you, etc.)
- Bedreigingen of oproepen tot geweld
- Haatzaaien op basis van ras, religie, geslacht, seksualiteit, herkomst
- Seksueel expliciete inhoud
- Doxing / persoonlijke gegevens van anderen (telefoon, adres)
- Duidelijke spam, advertenties of phishing-links

FLAG (voor handmatige review) als:
- Mogelijk fake/niet-authentiek (te generiek, copy-paste, geen restaurantcontext)
- Beschuldigingen van strafbare feiten zonder context (vergiftiging, diefstal)
- Twijfelgevallen mild taalgebruik

ALLOW: alles wat een eerlijke (ook negatieve) ervaring beschrijft.

Geef ALLEEN JSON terug: {"decision":"allow|flag|block","reason":"korte uitleg in NL","categories":["profanity"|"threat"|"hate"|"sexual"|"spam"|"fake"|"pii"|"other"]}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Rating: ${rating ?? "?"}/5\n\nReview:\n${text}` },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI gateway error", response.status, errText);
      if (response.status === 429 || response.status === 402) {
        // Don't block users if our AI is down — flag for manual review
        return new Response(
          JSON.stringify({ decision: "flag", reason: "AI moderatie tijdelijk niet beschikbaar", categories: ["unavailable"] }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({ decision: "flag", reason: "moderation error", categories: ["error"] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content ?? "{}";
    let result: ModerationResult;
    try {
      result = JSON.parse(content);
    } catch {
      result = { decision: "flag", reason: "Kon AI-antwoord niet parsen", categories: ["parse_error"] };
    }

    if (!["allow", "flag", "block"].includes(result.decision)) {
      result.decision = "flag";
    }

    console.log("Moderation decision:", result.decision, result.categories);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("moderate-review error:", err);
    return new Response(
      JSON.stringify({ decision: "flag", reason: "internal error", categories: ["error"] }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});