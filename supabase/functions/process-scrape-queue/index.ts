import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BATCH_SIZE = 3;
const MAX_ATTEMPTS = 2;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    // Reset stuck 'processing' items older than 10 minutes back to queued/failed
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    await supabase
      .from('scrape_queue')
      .update({ status: 'failed', error: 'Timeout after 10min', finished_at: new Date().toISOString() })
      .eq('status', 'processing')
      .lt('started_at', tenMinAgo);

    // Claim next batch of queued items
    const { data: items, error: claimErr } = await supabase
      .from('scrape_queue')
      .select('id, restaurant_id, restaurant_name, website_url, attempts')
      .eq('status', 'queued')
      .order('created_at', { ascending: true })
      .limit(BATCH_SIZE);

    if (claimErr) throw claimErr;
    if (!items || items.length === 0) {
      return new Response(JSON.stringify({ processed: 0, message: 'Queue empty' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Mark as processing
    const ids = items.map((i) => i.id);
    await supabase
      .from('scrape_queue')
      .update({ status: 'processing', started_at: new Date().toISOString() })
      .in('id', ids);

    const results: any[] = [];

    // Process sequentially to avoid hammering Firecrawl/Gemini
    for (const item of items) {
      const newAttempts = item.attempts + 1;
      try {
        const scrapeRes = await fetch(`${supabaseUrl}/functions/v1/scrape-menu`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({
            restaurantId: item.restaurant_id,
            websiteUrl: item.website_url,
          }),
        });

        const data = await scrapeRes.json().catch(() => ({}));

        if (!scrapeRes.ok || !data?.success) {
          const errMsg = data?.error || `HTTP ${scrapeRes.status}`;
          const shouldRetry = newAttempts < MAX_ATTEMPTS;
          await supabase
            .from('scrape_queue')
            .update({
              status: shouldRetry ? 'queued' : 'failed',
              attempts: newAttempts,
              error: errMsg.slice(0, 500),
              started_at: null,
              finished_at: shouldRetry ? null : new Date().toISOString(),
            })
            .eq('id', item.id);
          results.push({ id: item.id, name: item.restaurant_name, ok: false, error: errMsg });
        } else {
          await supabase
            .from('scrape_queue')
            .update({
              status: 'done',
              attempts: newAttempts,
              added_dishes: data.results?.added || 0,
              error: null,
              finished_at: new Date().toISOString(),
            })
            .eq('id', item.id);
          results.push({
            id: item.id,
            name: item.restaurant_name,
            ok: true,
            added: data.results?.added || 0,
          });
        }
      } catch (e: any) {
        const errMsg = e?.message || 'Unknown error';
        const shouldRetry = newAttempts < MAX_ATTEMPTS;
        await supabase
          .from('scrape_queue')
          .update({
            status: shouldRetry ? 'queued' : 'failed',
            attempts: newAttempts,
            error: errMsg.slice(0, 500),
            started_at: null,
            finished_at: shouldRetry ? null : new Date().toISOString(),
          })
          .eq('id', item.id);
        results.push({ id: item.id, name: item.restaurant_name, ok: false, error: errMsg });
      }
    }

    return new Response(JSON.stringify({ processed: items.length, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || 'Worker failed' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});