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

    const { restaurantName, topic, platform = 'instagram', tone = 'enthousiast' } = await req.json();
    if (!topic || typeof topic !== 'string') {
      return new Response(JSON.stringify({ error: 'topic required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: 'AI not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const lengthHint: Record<string, string> = {
      instagram: '4-6 zinnen, gevolgd door 5-8 relevante hashtags',
      tiktok: '2-3 korte zinnen, gevolgd door 4-6 trending hashtags',
      facebook: '3-5 zinnen, geen hashtags, met call-to-action',
    };
    const toneInstr: Record<string, string> = {
      enthousiast: 'enthousiast en levendig',
      sfeervol: 'sfeervol, beschrijvend en uitnodigend',
      kort: 'kort, krachtig en direct',
    };

    const prompt = `Je bent een social-media expert voor restaurants. Schrijf een ${toneInstr[tone] || toneInstr.enthousiast} ${platform}-post in het Nederlands voor restaurant "${restaurantName}".

Onderwerp: ${topic}

Formaat: ${lengthHint[platform] || lengthHint.instagram}. Geen aanhalingstekens. Geef ALLEEN de kant-en-klare post terug.`;

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
    const post = data?.choices?.[0]?.message?.content?.trim() || '';

    return new Response(JSON.stringify({ post }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('generate-social-post error', e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});