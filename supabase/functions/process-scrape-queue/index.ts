import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BATCH_SIZE = 1;
const MAX_ATTEMPTS = 2;

type WorkerResult = {
  id: string;
  name: string;
  ok: boolean;
  added?: number;
  error?: string;
  canceled?: boolean;
};

const getErrorMessage = (error: unknown) => error instanceof Error ? error.message : 'Unknown error';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    // Require admin authentication (or service role bearer)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const token = authHeader.replace('Bearer ', '');
    if (token !== serviceKey) {
      const authClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!);
      const { data: { user } } = await authClient.auth.getUser(token);
      if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      const { data: isAdmin } = await supabase.rpc('has_role', { _user_id: user.id, _role: 'admin' });
      if (!isAdmin) return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

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

    const results: WorkerResult[] = [];

    // Process sequentially to avoid hammering Firecrawl/Gemini
    for (const item of items) {
      const newAttempts = item.attempts + 1;
      try {
        const { data: currentItem } = await supabase
          .from('scrape_queue')
          .select('status')
          .eq('id', item.id)
          .maybeSingle();

        if (currentItem?.status === 'canceled') {
          results.push({ id: item.id, name: item.restaurant_name, ok: false, canceled: true });
          continue;
        }

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
        const { data: afterScrapeItem } = await supabase
          .from('scrape_queue')
          .select('status')
          .eq('id', item.id)
          .maybeSingle();

        if (afterScrapeItem?.status === 'canceled') {
          results.push({ id: item.id, name: item.restaurant_name, ok: false, canceled: true });
          continue;
        }

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
      } catch (e: unknown) {
        const errMsg = getErrorMessage(e);
        const shouldRetry = newAttempts < MAX_ATTEMPTS;
        const { data: afterErrorItem } = await supabase
          .from('scrape_queue')
          .select('status')
          .eq('id', item.id)
          .maybeSingle();

        if (afterErrorItem?.status === 'canceled') {
          results.push({ id: item.id, name: item.restaurant_name, ok: false, canceled: true });
          continue;
        }

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
  } catch (e: unknown) {
    return new Response(JSON.stringify({ error: getErrorMessage(e) || 'Worker failed' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});