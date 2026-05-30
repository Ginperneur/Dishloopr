import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const authClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!);
    const { data: { user } } = await authClient.auth.getUser(authHeader.replace('Bearer ', ''));
    if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const { reviewText, rating, restaurantName, tone = 'warm' } = await req.json();
    if (!reviewText || typeof reviewText !== 'string') {
      return new Response(JSON.stringify({ error: 'reviewText required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: 'AI not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const toneInstruction: Record<string, string> = {
      warm: 'warm, persoonlijk en uitnodigend',
      professional: 'beleefd en professioneel',
      apologetic: 'oprecht verontschuldigend, empathisch en constructief',
    };
    const tInstr = toneInstruction[tone] || toneInstruction.warm;

    const prompt = `Je bent de eigenaar van restaurant "${restaurantName}". Een gast plaatste een ${rating}-sterren review:

"${reviewText}"

Schrijf een ${tInstr} antwoord in het Nederlands. Maximaal 4 zinnen. Bedank de gast bij naam niet (we hebben die niet), verwijs naar specifieke punten uit de review, en sluit warm af. Geen aanhef zoals "Beste gast", begin direct. Geen emoji. Geef ALLEEN de tekst terug, geen aanhalingstekens.`;

    const aiRes = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!aiRes.ok) {
      const err = await aiRes.text();
      console.error('AI error:', err);
      return new Response(JSON.stringify({ error: 'AI request failed' }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await aiRes.json();
    const response = data?.choices?.[0]?.message?.content?.trim() || '';

    return new Response(JSON.stringify({ response }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('generate-review-response error', e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});