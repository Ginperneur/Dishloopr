import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')!;

function weekStart(d = new Date()): string {
  const date = new Date(d);
  const day = (date.getUTCDay() + 6) % 7; // Mon=0
  date.setUTCDate(date.getUTCDate() - day);
  return date.toISOString().slice(0, 10);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json().catch(() => ({}));
    const restaurantId: string | undefined = body.restaurantId;
    const force = !!body.force;
    if (!restaurantId) {
      return new Response(JSON.stringify({ error: 'restaurantId required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Authorize: user must have access to the restaurant
    const { data: hasAccess } = await admin.rpc('has_restaurant_access', {
      _user_id: user.id, _restaurant_id: restaurantId, _min_role: 'viewer',
    });
    if (!hasAccess) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const ws = weekStart();

    if (!force) {
      const { data: cached } = await admin
        .from('owner_weekly_recommendations')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .eq('week_start', ws)
        .maybeSingle();
      if (cached) {
        return new Response(JSON.stringify({ cached: true, ...cached }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Gather context
    const [{ data: restaurant }, { data: funnel }, { data: heat }, { data: reviews }] = await Promise.all([
      admin.from('restaurants').select('name, cuisines, city_id, rating, review_count, ambience_tags').eq('id', restaurantId).maybeSingle(),
      admin.rpc('get_owner_funnel', { p_restaurant_id: restaurantId, p_days: 7 }),
      admin.rpc('get_search_term_heatmap', { p_restaurant_id: restaurantId, p_days: 7, p_limit: 10 }),
      admin.from('reviews').select('rating, content, created_at').eq('restaurant_id', restaurantId).eq('status', 'published').order('created_at', { ascending: false }).limit(10),
    ]);

    const fn = funnel?.[0] ?? { views: 0, clicks: 0, conversions: 0 };
    const topTerms = (heat ?? []).map((h: any) => `${h.search_term} (${h.hits})`).join(', ');
    const recentReviews = (reviews ?? []).map((r: any) => `${r.rating}★: ${(r.content ?? '').slice(0, 140)}`).join('\n');

    const systemPrompt = `Je bent een growth-consultant voor restaurants op Dishloopr. Geef PRECIES 3 concrete, uitvoerbare acties voor deze week. Antwoord ALLEEN met geldige JSON van vorm: {"summary":"...","actions":[{"title":"...","why":"...","how":"...","impact":"high|medium|low"}]}. Maximaal 1 zin per veld in actions.title/why/how/impact. Geen markdown.`;

    const userPrompt = `Restaurant: ${restaurant?.name}\nKeukens: ${(restaurant?.cuisines ?? []).join(', ')}\nRating: ${restaurant?.rating} (${restaurant?.review_count} reviews)\n\nFunnel (7d): ${fn.views} views → ${fn.clicks} clicks → ${fn.conversions} conversies\nTop zoektermen (7d): ${topTerms || 'geen data'}\n\nRecente reviews:\n${recentReviews || 'geen'}`;

    const aiRes = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
      }),
    });

    if (!aiRes.ok) {
      const txt = await aiRes.text();
      console.error('AI gateway error', aiRes.status, txt);
      if (aiRes.status === 429) {
        return new Response(JSON.stringify({ error: 'AI rate limit, probeer later opnieuw.' }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (aiRes.status === 402) {
        return new Response(JSON.stringify({ error: 'AI credits op. Voeg credits toe in Settings > Workspace > Usage.' }), {
          status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      throw new Error('AI gateway failed');
    }

    const aiJson = await aiRes.json();
    const raw = aiJson?.choices?.[0]?.message?.content ?? '{}';
    let parsed: { summary?: string; actions?: any[] };
    try { parsed = JSON.parse(raw); } catch { parsed = { summary: '', actions: [] }; }
    const actions = Array.isArray(parsed.actions) ? parsed.actions.slice(0, 3) : [];

    const { data: saved, error: saveErr } = await admin
      .from('owner_weekly_recommendations')
      .upsert({
        restaurant_id: restaurantId,
        week_start: ws,
        actions,
        summary: parsed.summary ?? null,
        model: 'google/gemini-2.5-flash',
      }, { onConflict: 'restaurant_id,week_start' })
      .select()
      .single();
    if (saveErr) throw saveErr;

    return new Response(JSON.stringify({ cached: false, ...saved }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('owner-weekly-recommendation error', e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});