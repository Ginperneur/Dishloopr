import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { enforceRateLimit } from "../_shared/rateLimit.ts";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const __rl = await enforceRateLimit(req, {
    functionName: "classify-dishes",
    isAi: true,
    user: { max: 20, window: 1800 },
    anon: { max: 0, window: 3600 },
  });
  if (!__rl.allowed && __rl.response) return __rl.response;

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Admin-only
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const authClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user } } = await authClient.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!isAdmin) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { dishIds, mode } = await req.json();
    // mode: 'all_empty' = classify dishes missing data, 'specific' = classify specific IDs

    let query = supabase.from("dishes").select("id, name, name_en, synonyms, cuisine_tags, is_halal, is_vegetarian, is_vegan, is_gluten_free").eq("is_active", true);

    if (mode === "specific" && dishIds?.length > 0) {
      query = query.in("id", dishIds);
    } else {
      // Get dishes that have empty synonyms or no dietary info set
      query = query.or("synonyms.is.null,synonyms.eq.{}");
    }

    const { data: dishes, error: fetchError } = await query.limit(50);
    if (fetchError) throw fetchError;
    if (!dishes || dishes.length === 0) {
      return new Response(JSON.stringify({ classified: 0, message: "Geen gerechten om te classificeren" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const dishNames = dishes.map(d => `- ${d.name}${d.name_en ? ` (${d.name_en})` : ""}`).join("\n");

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
            content: `Je bent een expert in gerechten en voedsel. Classificeer elk gerecht met:\n1. synonyms: alternatieve namen in NL en EN (lowercase). Bijv. voor "Pad Thai": ["pad thai", "padthai", "thai noodles"]\n2. is_halal: true als het gerecht standaard halal is (geen varken, geen alcohol). Bij twijfel: false.\n3. is_vegetarian: true ALLEEN als het gerecht GEEN vlees, vis, kip, of gevogelte bevat. Een kipburger, shoarma, of visgerecht is NOOIT vegetarisch. Bij twijfel: false.\n4. is_vegan: true ALLEEN als het gerecht GEEN dierlijke producten bevat (geen vlees, vis, zuivel, eieren, honing). Bij twijfel: false.\n5. is_gluten_free: true als het gerecht standaard glutenvrij is.\n6. cuisine_tags: relevante keukentags (lowercase). Bijv. ["thai", "aziatisch"]\n7. course_type: classificeer als "voorgerecht", "hoofdgerecht", "dessert", "bijgerecht", "drank", of "menu". Gebruik "menu" voor samengestelde formules zoals "3 gangen menu", "lunchformule", "business lunch", "dagmenu", "prix fixe", "chef's menu", "proeverij", etc.\n\nBelangrijk:\n- Vlees/vis/kip = NIET vegetarisch, NIET vegan. Geen uitzonderingen.\n- "Kipburger", "Shoarma", "Tonijn" zijn NIET vegetarisch.\n- "Vegaburger", "Falafel", "Paneer" zijn WEL vegetarisch.\n- Samengestelde menu's/arrangementen/formules = "menu", NIET "hoofdgerecht".`
          },
          {
            role: "user",
            content: `Classificeer deze gerechten:\n${dishNames}`
          }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "classify_dishes",
              description: "Classificeer gerechten met synoniemen en dieetlabels",
              parameters: {
                type: "object",
                properties: {
                  dishes: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string", description: "Exacte naam van het gerecht zoals opgegeven" },
                        synonyms: { type: "array", items: { type: "string" } },
                        cuisine_tags: { type: "array", items: { type: "string" } },
                        course_type: { type: "string", enum: ["voorgerecht", "hoofdgerecht", "dessert", "bijgerecht", "drank", "menu"], description: "Gang type of menu/arrangement" },
                        is_halal: { type: "boolean" },
                        is_vegetarian: { type: "boolean" },
                        is_vegan: { type: "boolean" },
                        is_gluten_free: { type: "boolean" }
                      },
                      required: ["name", "synonyms", "is_halal", "is_vegetarian", "is_vegan", "is_gluten_free", "cuisine_tags", "course_type"],
                      additionalProperties: false
                    }
                  }
                },
                required: ["dishes"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "classify_dishes" } }
      }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit bereikt, probeer het later opnieuw." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "Onvoldoende credits voor AI-classificatie." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI error:", status, t);
      throw new Error("AI gateway error");
    }

    const aiResult = await response.json();
    const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No tool call in AI response");

    const classified = JSON.parse(toolCall.function.arguments);
    let updateCount = 0;

    for (const item of classified.dishes) {
      const matchDish = dishes.find(d => d.name.toLowerCase() === item.name.toLowerCase());
      if (!matchDish) continue;

      // Merge synonyms: keep existing + add new
      const existingSynonyms = matchDish.synonyms || [];
      const mergedSynonyms = [...new Set([...existingSynonyms, ...item.synonyms.map((s: string) => s.toLowerCase())])];

      const existingCuisines = matchDish.cuisine_tags || [];
      const mergedCuisines = [...new Set([...existingCuisines, ...item.cuisine_tags.map((c: string) => c.toLowerCase())])];

      const { error: updateError } = await supabase
        .from("dishes")
        .update({
          synonyms: mergedSynonyms,
          cuisine_tags: mergedCuisines,
          is_halal: item.is_halal,
          is_vegetarian: item.is_vegetarian,
          is_vegan: item.is_vegan,
          is_gluten_free: item.is_gluten_free,
        })
        .eq("id", matchDish.id);

      if (!updateError) {
        updateCount++;
        // Also update course_type on restaurant_dishes for this dish
        if (item.course_type) {
          await supabase
            .from("restaurant_dishes")
            .update({ course_type: item.course_type })
            .eq("dish_id", matchDish.id)
            .eq("course_type", "hoofdgerecht"); // Only update default ones
        }
      }
    }

    return new Response(JSON.stringify({ classified: updateCount, total: dishes.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("classify-dishes error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
