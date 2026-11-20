import { createClient } from "https://esm.sh/@supabase/supabase-js@2.118.0";
import { enforceRateLimit } from "../_shared/rateLimit.ts";
import { safeFetch } from "../_shared/safeFetch.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Known reservation providers (in order of preference). Hosts are matched against the PARSED
// hostname of each candidate link, anchored to the exact provider domains, never against page text.
const PROVIDERS: { name: string; host: RegExp; extractZenchef?: RegExp }[] = [
  { name: 'zenchef', host: /(^|\.)zenchef\.com$/, extractZenchef: /^\/(?:(?:reservation|widget|results)\/)?(\d{3,8})(?:[/?#]|$)/i },
  { name: 'thefork', host: /(^|\.)thefork\.(nl|com|be|de|fr|es|it|pt|dk|se|ch|at|co\.uk)$/ },
  { name: 'opentable', host: /(^|\.)opentable\.(nl|com|co\.uk|de|be|fr|es|it|ie|ca|com\.au)$/ },
  { name: 'resy', host: /(^|\.)resy\.com$/ },
  { name: 'formitable', host: /(^|\.)formitable\.com$/ },
  { name: 'quandoo', host: /(^|\.)quandoo\.(nl|com|de|co\.uk|fi|se|it|dk|pl|sg|hk)$/ },
  { name: 'bookatable', host: /(^|\.)bookatable\.(nl|com|co\.uk|de|fr|es|it)$/ },
  { name: 'sevenrooms', host: /(^|\.)sevenrooms\.com$/ },
  { name: 'eveve', host: /(^|\.)eveve\.com$/ },
];

async function fetchHtml(url: string, timeoutMs = 8000): Promise<string | null> {
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    const res = await safeFetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Dishloopr/1.0; +https://dishloopr.com/bot)',
        'Accept': 'text/html,application/xhtml+xml',
      },
    }, { maxBytes: 2_000_000, maxRedirects: 4 });
    clearTimeout(t);
    if (!res.ok) return null;
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('text/html') && !ct.includes('xml')) return null;
    // limit to 500KB
    const text = await res.text();
    return text.slice(0, 500_000);
  } catch {
    return null;
  }
}

function detectInHtml(html: string): { url: string; provider: string; zenchefId?: string } | null {
  const candidates: URL[] = [];
  for (const m of html.matchAll(/https?:\/\/[^\s"'<>)\\]+/gi)) {
    try {
      const u = new URL(m[0]);
      if (!u.username && !u.password) candidates.push(u);
    } catch { /* ignore */ }
  }
  for (const p of PROVIDERS) {
    for (const u of candidates) {
      if (!p.host.test(u.hostname.toLowerCase())) continue;
      let zenchefId: string | undefined;
      if (p.extractZenchef) {
        const z = u.pathname.match(p.extractZenchef);
        if (z) zenchefId = z[1];
      }
      return { url: u.toString(), provider: p.name, zenchefId };
    }
  }
  return null;
}

function normalizeUrl(u: string | null | undefined): string | null {
  if (!u) return null;
  let url = u.trim();
  if (!url) return null;
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
  try {
    return new URL(url).toString();
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const rl = await enforceRateLimit(req, {
      functionName: "detect-reservation-links",
      user: { max: 60, window: 3600 },
      anon: { max: 5, window: 3600 },
    });
    if (!rl.allowed && rl.response) return rl.response;

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Admin-only
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const token = authHeader.replace('Bearer ', '');
    const body = await req.json().catch(() => ({}));
    const restaurantId: string | undefined = body.restaurantId;

    // Allow service-role internal calls (used by triggers/other edge functions)
    const isServiceCall = token === supabaseKey;
    if (!isServiceCall) {
      const authClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!);
      const { data: { user } } = await authClient.auth.getUser(token);
      if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      const { data: isAdmin } = await supabase.rpc('has_role', { _user_id: user.id, _role: 'admin' });
      if (!isAdmin) {
        // Allow owners/managers to scan their own single restaurant
        if (!restaurantId) {
          return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        const { data: hasAccess } = await supabase.rpc('has_restaurant_access', {
          _user_id: user.id,
          _restaurant_id: restaurantId,
          _min_role: 'editor',
        });
        let allowed = !!hasAccess;
        if (!allowed) {
          const { data: rest } = await supabase
            .from('restaurants')
            .select('claimed_by_owner_id')
            .eq('id', restaurantId)
            .maybeSingle();
          if (rest?.claimed_by_owner_id === user.id) allowed = true;
        }
        if (!allowed) {
          return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
      }
    }

    const batchSize: number = Math.min(body.batchSize || 25, 50);
    const forceRefresh: boolean = !!body.forceRefresh;

    // Build candidate list
    let query = supabase
      .from('restaurants')
      .select('id, name, website_url, reservation_url, zenchef_id')
      .not('website_url', 'is', null);

    if (restaurantId) {
      query = query.eq('id', restaurantId);
    } else {
      if (!forceRefresh) {
        query = query.is('reservation_url', null).is('zenchef_id', null);
      }
      query = query.order('updated_at', { ascending: true }).limit(batchSize);
    }

    const { data: restaurants, error } = await query;
    if (error) throw error;

    // Also get remaining count
    const { count: remaining } = await supabase
      .from('restaurants')
      .select('id', { count: 'exact', head: true })
      .not('website_url', 'is', null)
      .is('reservation_url', null)
      .is('zenchef_id', null);

    const results: Array<{ id: string; name: string; status: string; provider?: string; url?: string }> = [];

    for (const r of restaurants || []) {
      const websiteUrl = normalizeUrl(r.website_url);
      if (!websiteUrl) {
        results.push({ id: r.id, name: r.name, status: 'no_website' });
        continue;
      }

      const html = await fetchHtml(websiteUrl);
      if (!html) {
        results.push({ id: r.id, name: r.name, status: 'fetch_failed' });
        continue;
      }

      const found = detectInHtml(html);
      if (!found) {
        // Try a /reservation or /reserveren subpage as fallback
        let foundSub: { url: string; provider: string; zenchefId?: string } | null = null;
        for (const path of ['/reserveren', '/reservation', '/reservations', '/book', '/boeken', '/reserve']) {
          try {
            const subUrl = new URL(path, websiteUrl).toString();
            const subHtml = await fetchHtml(subUrl, 5000);
            if (subHtml) {
              foundSub = detectInHtml(subHtml);
              if (foundSub) break;
            }
          } catch { /* ignore */ }
        }
        if (!foundSub) {
          results.push({ id: r.id, name: r.name, status: 'no_provider' });
          continue;
        }
        const update: Record<string, unknown> = { reservation_url: foundSub.url, accepts_reservations: true };
        // Only store a detected Zenchef id when none exists yet (never overwrite).
        if (foundSub.zenchefId && foundSub.provider === 'zenchef' && !r.zenchef_id) update.zenchef_id = foundSub.zenchefId;
        await supabase.from('restaurants').update(update).eq('id', r.id);
        results.push({ id: r.id, name: r.name, status: 'found', provider: foundSub.provider, url: foundSub.url });
        continue;
      }

      const update: Record<string, unknown> = { reservation_url: found.url, accepts_reservations: true };
      // Only store a detected Zenchef id when none exists yet (never overwrite).
      if (found.zenchefId && found.provider === 'zenchef' && !r.zenchef_id) update.zenchef_id = found.zenchefId;
      await supabase.from('restaurants').update(update).eq('id', r.id);
      results.push({ id: r.id, name: r.name, status: 'found', provider: found.provider, url: found.url });
    }

    const summary = {
      processed: results.length,
      found: results.filter(r => r.status === 'found').length,
      no_provider: results.filter(r => r.status === 'no_provider').length,
      fetch_failed: results.filter(r => r.status === 'fetch_failed').length,
      remaining: remaining ?? 0,
    };

    return new Response(
      JSON.stringify({ summary, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('detect-reservation-links error:', err);
    return new Response(
      JSON.stringify({ error: 'Er ging iets mis. Probeer het later opnieuw.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});