// ============================================================
// Dishloopr — Batch Menu Scraper Edge Function
// Scrapet echte gerechten van restaurantwebsites in batches
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SKIP_DOMAINS = [
  'nlcompanies.org', 'nlnavii.org', 'nlmapnova.top', 'amsterdambusi.org',
  'facebook.com', 'instagram.com', 'tripadvisor.com', 'yelp.com',
  'thuisbezorgd.nl', 'ubereats.com', 'deliveroo.nl',
];

const MENU_KEYWORDS = [
  '/menu', '/menukaart', '/kaart', '/eten', '/gerechten',
  '/lunch', '/diner', '/dinner', '/food', '/spijskaart',
  '/onze-kaart', '/ons-menu', '/a-la-carte', '/carte', '/eat',
];

const DEFAULT_BATCH_SIZE = 3;
const MAX_BATCH_SIZE = 5;
const FETCH_TIMEOUT_MS = 3500;
const MAX_HTML_CHARS = 160_000;
const MAX_CONTENT_LENGTH = 650_000;
const MAX_FUNCTION_MS = 18_000;
const MAX_DISHES_PER_RESTAURANT = 12;

const BLACKLIST = new Set([
  'contact', 'reserveer', 'reserveren', 'over ons', 'home', 'welkom',
  'openingstijden', 'locatie', 'route', 'team', 'vacature', 'privacy',
  'cookies', 'meer info', 'lees meer', 'klik hier', 'instagram',
  'facebook', 'twitter', 'linkedin', 'allergenen', 'allergies',
  'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag', 'zondag',
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
  'nieuws', 'events', 'evenementen', 'cadeaubon', 'galerij', 'gallery',
  'download', 'bestellen', 'order', 'sitemap', 'geschiedenis', 'about us',
]);

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 100);
}

function cleanDishName(name: string): string {
  return name
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/^\d+[\.\)]\s*/, '')
    .replace(/\s*[-–]?\s*€\s*\d+[,.]?\d*/g, '')
    .replace(/\s*\d+[,.]\d+\s*$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isValidDish(name: string): boolean {
  if (!name || name.length < 3 || name.length > 80) return false;
  if (!/[a-zA-ZÀ-ÿ]/.test(name)) return false;
  if (name.includes('http') || name.includes('www.') || name.includes('@')) return false;
  if (/^[\d\s€.,\-]+$/.test(name)) return false;
  if (BLACKLIST.has(name.toLowerCase())) return false;
  return true;
}

function findMenuUrl(html: string, baseUrl: string): string | null {
  try {
    const baseDomain = new URL(baseUrl).hostname;
    const linkRegex = /<a[^>]+href=["']([^"'#?]+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    let match: RegExpExecArray | null;

    while ((match = linkRegex.exec(html)) !== null) {
      const href = match[1];
      const linkText = match[2].replace(/<[^>]+>/g, '').toLowerCase().trim();

      for (const keyword of MENU_KEYWORDS) {
        const kw = keyword.replace('/', '');
        if (href.toLowerCase().includes(keyword) || linkText === kw) {
          try {
            const fullUrl = new URL(href, baseUrl).toString();
            if (new URL(fullUrl).hostname === baseDomain && fullUrl !== baseUrl) {
              return fullUrl;
            }
          } catch { /* ignore */ }
        }
      }
    }
  } catch { /* ignore */ }
  return null;
}

function extractDishesFromHtml(html: string): string[] {
  const cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '');

  const candidates: string[] = [];
  let match: RegExpExecArray | null;

  // 1) <li> items
  const liRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi;
  while ((match = liRegex.exec(cleaned)) !== null) {
    const text = cleanDishName(match[1]);
    if (isValidDish(text)) candidates.push(text);
  }

  // 2) elementen met menu-gerelateerde classes
  const menuClassRegex = /<[^>]+class=["'][^"']*(?:menu-item|dish|gerecht|food-item|meal|item-name|product-name|menu__item)[^"']*["'][^>]*>([\s\S]*?)<\/[a-z]+>/gi;
  while ((match = menuClassRegex.exec(cleaned)) !== null) {
    const text = cleanDishName(match[1]);
    if (isValidDish(text)) candidates.push(text);
  }

  // 3) h3 / h4
  const headingRegex = /<h[34][^>]*>([\s\S]*?)<\/h[34]>/gi;
  while ((match = headingRegex.exec(cleaned)) !== null) {
    const text = cleanDishName(match[1]);
    if (isValidDish(text)) candidates.push(text);
  }

  // 4) <strong>/<b> als weinig kandidaten
  if (candidates.length < 5) {
    const boldRegex = /<(?:strong|b)[^>]*>([\s\S]*?)<\/(?:strong|b)>/gi;
    while ((match = boldRegex.exec(cleaned)) !== null) {
      const text = cleanDishName(match[1]);
      if (isValidDish(text) && text.split(' ').length <= 8) candidates.push(text);
    }
  }

  const seen = new Set<string>();
  return candidates.filter(d => {
    const key = d.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, MAX_DISHES_PER_RESTAURANT);
}

async function fetchWithTimeout(url: string, timeoutMs = FETCH_TIMEOUT_MS): Promise<Response | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'nl-NL,nl;q=0.9,en;q=0.8',
        'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8',
      },
    });
    if (!response.ok) return null;
    const contentLength = Number(response.headers.get('content-length') || 0);
    if (contentLength > MAX_CONTENT_LENGTH) {
      await response.body?.cancel();
      return null;
    }
    return response;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function readLimitedText(response: Response): Promise<string> {
  if (!response.body) {
    const text = await response.text().catch(() => '');
    return text.slice(0, MAX_HTML_CHARS);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let html = '';

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      html += decoder.decode(value, { stream: true });
      if (html.length >= MAX_HTML_CHARS) {
        await reader.cancel();
        break;
      }
    }
    html += decoder.decode();
  } catch {
    await reader.cancel().catch(() => undefined);
  }

  return html.slice(0, MAX_HTML_CHARS);
}

async function getDishesForRestaurant(restaurant: { id: string; name: string; website_url: string }): Promise<string[]> {
  const url = restaurant.website_url?.trim();
  if (!url) return [];
  if (SKIP_DOMAINS.some(d => url.includes(d))) return [];

  const fullUrl = url.startsWith('http') ? url : `https://${url}`;

  const homepageResp = await fetchWithTimeout(fullUrl);
  if (!homepageResp) return [];

  const contentType = homepageResp.headers.get('content-type') || '';
  if (contentType.includes('pdf')) {
    await homepageResp.body?.cancel();
    return [];
  }

  const homepageHtml = await readLimitedText(homepageResp);
  if (!homepageHtml) return [];

  const menuUrl = findMenuUrl(homepageHtml, fullUrl);

  if (menuUrl) {
    const menuResp = await fetchWithTimeout(menuUrl);
    if (menuResp) {
      const menuCt = menuResp.headers.get('content-type') || '';
      if (!menuCt.includes('pdf')) {
        const menuHtml = await readLimitedText(menuResp);
        const dishes = extractDishesFromHtml(menuHtml);
        if (dishes.length >= 3) return dishes;
      } else {
        await menuResp.body?.cancel();
      }
    }
  }

  return extractDishesFromHtml(homepageHtml);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // ── Auth: admin-only (sta service-role interne aanroepen toe) ──
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const token = authHeader.replace('Bearer ', '');
    const isInternalWorker = token === supabaseServiceKey;

    if (!isInternalWorker) {
      const authClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: userData, error: userErr } = await authClient.auth.getUser(token);
      if (userErr || !userData?.user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const { data: isAdmin } = await authClient.rpc('has_role', {
        _user_id: userData.user.id, _role: 'admin',
      });
      if (!isAdmin) {
        return new Response(JSON.stringify({ error: 'Admin access required' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json().catch(() => ({}));
    const batchSize: number = Math.min(Math.max(body.batch_size ?? 40, 1), 100);
    const offset: number = body.offset ?? 0;

    // ── Laad alle dish slugs in één keer ──
    const { data: allDishes } = await supabase.from('dishes').select('id, slug');
    const slugToId = new Map<string, string>(
      (allDishes || []).map((d: { id: string; slug: string }) => [d.slug, d.id])
    );

    const { data: restaurants, error: restaurantsError } = await supabase
      .from('restaurants')
      .select('id, name, website_url')
      .eq('is_active', true)
      .not('website_url', 'is', null)
      .neq('website_url', '')
      .range(offset, offset + batchSize - 1);

    if (restaurantsError || !restaurants) {
      return new Response(
        JSON.stringify({ error: restaurantsError?.message || 'Kon restaurants niet ophalen' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const stats = {
      processed: 0,
      with_dishes: 0,
      dishes_found: 0,
      dishes_new: 0,
      links_created: 0,
      skipped: 0,
      log: [] as string[],
    };

    for (const restaurant of restaurants) {
      stats.processed++;

      const { count } = await supabase
        .from('restaurant_dishes')
        .select('id', { count: 'exact', head: true })
        .eq('restaurant_id', restaurant.id);

      if ((count ?? 0) >= 10) {
        stats.skipped++;
        continue;
      }

      const dishes = await getDishesForRestaurant(restaurant);

      if (dishes.length === 0) {
        stats.log.push(`✗ ${restaurant.name}: geen menu gevonden`);
        continue;
      }

      stats.with_dishes++;
      stats.dishes_found += dishes.length;

      let newForRestaurant = 0;
      let linksForRestaurant = 0;

      for (const dishName of dishes) {
        const slug = slugify(dishName);
        if (!slug || slug.length < 2) continue;

        let dishId = slugToId.get(slug);

        if (!dishId) {
          const newId = crypto.randomUUID();
          const { error: insertError } = await supabase
            .from('dishes')
            .insert({
              id: newId,
              name: dishName,
              slug,
              synonyms: [],
              cuisine_tags: [],
              seasonal_tags: [],
              is_active: true,
              search_count: 0,
              is_halal: false,
              is_vegetarian: false,
              is_vegan: false,
              is_gluten_free: false,
            });

          if (!insertError) {
            dishId = newId;
            slugToId.set(slug, newId);
            stats.dishes_new++;
            newForRestaurant++;
          } else {
            const { data: existing } = await supabase
              .from('dishes')
              .select('id')
              .eq('slug', slug)
              .maybeSingle();
            if (existing) {
              dishId = existing.id;
              slugToId.set(slug, existing.id);
            }
          }
        }

        if (!dishId) continue;

        const { error: linkError } = await supabase
          .from('restaurant_dishes')
          .insert({
            id: crypto.randomUUID(),
            restaurant_id: restaurant.id,
            dish_id: dishId,
            confidence_score: 0.85,
            status: 'approved_by_admin',
            source: 'website_scrape',
            is_signature: false,
            course_type: 'hoofdgerecht',
            is_halal: false,
            is_vegetarian: false,
            is_vegan: false,
            is_gluten_free: false,
          });

        if (!linkError) {
          stats.links_created++;
          linksForRestaurant++;
        }
      }

      stats.log.push(
        `✓ ${restaurant.name}: ${dishes.length} gerechten (${newForRestaurant} nieuw, ${linksForRestaurant} koppelingen)`
      );

      await new Promise(resolve => setTimeout(resolve, 300));
    }

    const done = restaurants.length < batchSize;
    const nextOffset = offset + batchSize;

    return new Response(
      JSON.stringify({
        success: true,
        batch: { offset, size: batchSize },
        stats,
        next_offset: nextOffset,
        done,
        message: done ? '✅ Alle restaurants verwerkt!' : `Volgende batch: offset ${nextOffset}`,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});