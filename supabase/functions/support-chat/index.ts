import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(4000),
});

const RequestSchema = z.object({
  conversationId: z.string().uuid().optional(),
  sessionId: z.string().min(8).max(80).optional(),
  message: z.string().trim().min(1).max(2000),
  history: z.array(MessageSchema).max(30).optional(),
});

const SYSTEM_PROMPT = `Je bent de AI-klantenservice van Dishloopr — een Europese zoekmachine voor gerechten.

TAAL: antwoord altijd in dezelfde taal als de gebruiker (NL, EN, DE, FR, ES).
TOON: vriendelijk, beknopt, behulpzaam. Gebruik markdown waar nuttig.

WAT JE WEET OVER DISHLOOPR:
- Zoeken op gerecht (bv. "ramen Amsterdam") in plaats van alleen op restaurant
- 1.600+ restaurants in 30+ Europese steden
- Filters: keuken, dieet (vegan/vegetarisch/halal/glutenvrij), prijs, sfeer
- Account-types: Foodie (gewone gebruiker) en Eigenaar (restauranthouder)
- Restauranthouders kunnen hun pagina claimen via /claim, menu's beheren, reviews zien
- Gebruikers kunnen reviews schrijven, favorieten opslaan, badges verdienen
- Featured spots zijn betaalde premium plekken voor restaurants

ESCALATIE — zet needs_human=true ALLEEN als:
- De gebruiker expliciet vraagt om menselijke hulp / mail / contact
- Het gaat om: betalingen, facturen, account-toegang verloren, bug die je niet kunt oplossen, juridische vraag, datadeletie, klachten over een restaurant
- Je het echt niet weet en herhalen niet helpt

Voor algemene vragen ("hoe zoek ik", "wat is dishloopr", "kan ik filteren op halal") → needs_human=false.

OUTPUT FORMAT — antwoord ALTIJD met geldige JSON, geen markdown wrapping:
{"answer": "<je antwoord in markdown>", "needs_human": <true|false>, "reason": "<korte reden indien needs_human=true, anders null>"}`;

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

    const { conversationId, sessionId, message, history = [] } = parsed.data;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Identify user (optional)
    const authHeader = req.headers.get("Authorization");
    let userId: string | null = null;
    if (authHeader?.startsWith("Bearer ")) {
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user } } = await userClient.auth.getUser();
      userId = user?.id ?? null;
    }

    if (!userId && !sessionId) {
      return new Response(
        JSON.stringify({ error: "Authentication or sessionId required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // Resolve / create conversation
    let convId = conversationId;
    if (!convId) {
      const { data: newConv, error: convErr } = await admin
        .from("support_conversations")
        .insert({
          user_id: userId,
          session_id: userId ? null : sessionId,
          title: message.slice(0, 80),
        })
        .select("id")
        .single();
      if (convErr) throw convErr;
      convId = newConv.id;
    }

    // Persist user message
    await admin.from("support_messages").insert({
      conversation_id: convId,
      role: "user",
      content: message,
    });

    // Build messages for AI
    const aiMessages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...history.slice(-20).map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: message },
    ];

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: aiMessages,
        temperature: 0.4,
        response_format: { type: "json_object" },
      }),
    });

    if (!aiRes.ok) {
      if (aiRes.status === 429) {
        return new Response(
          JSON.stringify({ error: "rate_limit", conversationId: convId }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (aiRes.status === 402) {
        return new Response(
          JSON.stringify({ error: "ai_credits_exhausted", conversationId: convId }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const txt = await aiRes.text();
      console.error("AI error", aiRes.status, txt);
      throw new Error("AI gateway error");
    }

    const aiData = await aiRes.json();
    const content = aiData.choices?.[0]?.message?.content ?? "{}";

    let parsedAnswer: { answer: string; needs_human: boolean; reason?: string | null };
    try {
      parsedAnswer = JSON.parse(content);
    } catch {
      parsedAnswer = { answer: content, needs_human: false, reason: null };
    }

    const answer = String(parsedAnswer.answer || "").slice(0, 4000) ||
      "Sorry, ik kon geen antwoord genereren. Probeer het opnieuw of mail support@dishloopr.com.";
    const needsHuman = Boolean(parsedAnswer.needs_human);

    // Persist assistant message
    await admin.from("support_messages").insert({
      conversation_id: convId,
      role: "assistant",
      content: answer,
      needs_human: needsHuman,
    });

    if (needsHuman) {
      await admin
        .from("support_conversations")
        .update({ escalated: true, escalated_at: new Date().toISOString() })
        .eq("id", convId);
    }

    return new Response(
      JSON.stringify({
        conversationId: convId,
        answer,
        needs_human: needsHuman,
        reason: parsedAnswer.reason ?? null,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("support-chat error", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});