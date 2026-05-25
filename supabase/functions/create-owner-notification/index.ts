import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-internal-secret',
};

/**
 * Internal helper to create owner notifications. Requires X-Internal-Secret header
 * matching the N8N_WEBHOOK_SECRET env var (re-used as a shared internal token).
 *
 * POST body: { user_id: string, restaurant_id?: string, type: string, title: string, body?: string, link?: string }
 * Or bulk: { items: [{...}] }
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const secret = req.headers.get('x-internal-secret');
    const expected = Deno.env.get('N8N_WEBHOOK_SECRET');
    if (!expected || secret !== expected) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const items = Array.isArray(body?.items) ? body.items : [body];

    const valid = items.filter((it: any) =>
      it && typeof it.user_id === 'string' && typeof it.type === 'string' && typeof it.title === 'string'
    ).map((it: any) => ({
      user_id: it.user_id,
      restaurant_id: it.restaurant_id ?? null,
      type: it.type,
      title: it.title,
      body: it.body ?? null,
      link: it.link ?? null,
    }));

    if (valid.length === 0) {
      return new Response(JSON.stringify({ error: 'no valid items' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { error } = await supabase.from('owner_notifications').insert(valid);
    if (error) throw error;

    return new Response(JSON.stringify({ inserted: valid.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});