import { isSafePublicUrl } from "../_shared/auth.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

import { enforceRateLimit } from "../_shared/rateLimit.ts";
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function formatDishName(name: string): string {
  if (!name || typeof name !== 'string') return '';
  const trimmed = name.trim();
  if (trimmed.length === 0) return '';
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const __rl = await enforceRateLimit(req, {
    functionName: "parse-menu-pdf",
    isAi: true,
    user: { max: 10, window: 1800 },
    anon: { max: 0, window: 3600 },
  });
  if (!__rl.allowed && __rl.response) return __rl.response;

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY is not configured');

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Authorization header required' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { restaurantId, pdfBase64, pdfUrl } = await req.json();
    if (!restaurantId) {
      return new Response(JSON.stringify({ error: 'restaurantId is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Allow: admins, restaurant managers, or users with a claim_request for this restaurant
    const { data: isAdmin } = await supabase.rpc('has_role', { _user_id: user.id, _role: 'admin' });
    let allowed = !!isAdmin;
    if (!allowed) {
      const { data: mgr } = await supabase
        .from('restaurant_managers')
        .select('id')
        .eq('user_id', user.id)
        .eq('restaurant_id', restaurantId)
        .maybeSingle();
      if (mgr) allowed = true;
    }
    if (!allowed) {
      const { data: claim } = await supabase
        .from('claim_requests')
        .select('id')
        .eq('user_id', user.id)
        .eq('restaurant_id', restaurantId)
        .maybeSingle();
      if (claim) allowed = true;
    }
    if (!allowed) {
      return new Response(JSON.stringify({ error: 'Forbidden: no access to this restaurant' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!pdfBase64 && !pdfUrl) {
      return new Response(JSON.stringify({ error: 'pdfBase64 or pdfUrl required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Processing menu PDF for restaurant: ${restaurantId}`);

    // Build base64 PDF data — fetch URL if needed
    let base64Data: string;
    if (pdfBase64) {
      base64Data = pdfBase64.startsWith('data:')
        ? pdfBase64.split(',')[1]
        : pdfBase64;
    } else {
      if (!isSafePublicUrl(String(pdfUrl))) {
        return new Response(JSON.stringify({ error: 'Invalid pdfUrl' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const resp = await fetch(String(pdfUrl), { redirect: 'manual' });
      if (!resp.ok) {
        return new Response(JSON.stringify({ error: `PDF kon niet worden opgehaald (${resp.status})` }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const buf = new Uint8Array(await resp.arrayBuffer());
      let binary = '';
      const chunkSize = 8192;
      for (let i = 0; i < buf.length; i += chunkSize) {
        binary += String.fromCharCode(...buf.subarray(i, i + chunkSize));
      }
      base64Data = btoa(binary);
    }

    // Gemini accepts PDFs directly via the file_data block; the OpenAI-compatible
    // gateway exposes this through image_url with the application/pdf data URL.
    const dataUrl = `data:application/pdf;base64,${base64Data}`;

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `Je bent een expert in het lezen van menukaarten. Analyseer de PDF en extraheer ALLE gerechten uit alle pagina's.

BELANGRIJK:
- Extraheer alleen de NAMEN van gerechten (geen prijzen, beschrijvingen of ingrediënten)
- Negeer categorieën, kopjes en secties
- Negeer drankjes, tenzij het specifieke cocktails of speciale dranken zijn
- Focus op hoofdgerechten, voorgerechten, bijgerechten en desserts
- Geef elk gerecht een confidence score (0.0 tot 1.0)

Retourneer als JSON array: [{"name": "Gerecht Naam", "confidence": 0.95}, ...]`
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Analyseer dit menu PDF en extraheer alle gerechten als JSON array.' },
              { type: 'image_url', image_url: { url: dataUrl } },
            ],
          },
        ],
        max_tokens: 8192,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', aiResponse.status, errorText);
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded. Probeer later.' }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: 'AI credits op. Voeg credits toe.' }), {
          status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      throw new Error(`AI API error: ${aiResponse.status} ${errorText.slice(0, 200)}`);
    }

    const aiData = await aiResponse.json();
    const aiContent = aiData.choices?.[0]?.message?.content;
    if (!aiContent) throw new Error('Geen respons van AI');

    let dishes: Array<{ name: string; confidence: number }> = [];
    const jsonMatch = aiContent.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error('AI antwoord bevat geen JSON array');
    dishes = JSON.parse(jsonMatch[0]);

    console.log(`Found ${dishes.length} dishes in PDF`);

    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const results = { added: [] as string[], existing: [] as string[], errors: [] as string[] };

    for (const dish of dishes) {
      try {
        const dishName = formatDishName(dish.name);
        const confidence = dish.confidence || 0.7;
        if (!dishName || dishName.length < 2) continue;

        const slug = dishName.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').trim();
        if (!slug) continue;

        const { data: existingDish } = await supabaseAdmin
          .from('dishes')
          .select('id, name')
          .or(`slug.eq.${slug},name.ilike.${dishName}`)
          .maybeSingle();

        let dishId: string;
        if (existingDish) {
          dishId = existingDish.id;
          results.existing.push(dishName);
        } else {
          const { data: newDish, error: insertError } = await supabaseAdmin
            .from('dishes')
            .insert({ name: dishName, slug, is_active: true })
            .select('id')
            .single();
          if (insertError) {
            results.errors.push(dishName);
            continue;
          }
          dishId = newDish.id;
          results.added.push(dishName);
        }

        await supabaseAdmin.from('restaurant_dishes').upsert({
          restaurant_id: restaurantId,
          dish_id: dishId,
          status: 'suggested',
          source: 'menu_pdf',
          confidence_score: confidence,
        }, { onConflict: 'restaurant_id,dish_id' });
      } catch (dishError) {
        console.error('Error processing dish:', dishError);
        results.errors.push(dish.name || 'Unknown');
      }
    }

    return new Response(JSON.stringify({
      success: true,
      message: `Processed ${dishes.length} dishes from menu PDF`,
      added: results.added,
      existing: results.existing,
      errors: results.errors,
      totalProcessed: dishes.length,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: unknown) {
    console.error('Error in parse-menu-pdf:', error);
    const msg = error instanceof Error ? error.message : 'Internal server error';
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});