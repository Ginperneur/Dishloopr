import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const SITE_URL = "https://dishloopr.com";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parallel fetch all data
    const [restaurantsRes, citiesRes, dishesRes, seoRes, collectionsRes] = await Promise.all([
      supabase.from('restaurants').select('slug, updated_at').eq('is_active', true).order('updated_at', { ascending: false }),
      supabase.from('cities').select('slug, updated_at').eq('is_active', true),
      supabase.from('dishes').select('slug, updated_at').eq('is_active', true).order('search_count', { ascending: false }).limit(100),
      supabase.from('seo_landing_pages').select('slug, updated_at, dishes:dish_id(slug, canonical_slug)').eq('is_active', true),
      supabase.from('collections').select('slug, updated_at').eq('is_active', true).order('sort_order'),
    ]);

    const restaurants = restaurantsRes.data || [];
    const cities = citiesRes.data || [];
    const dishes = dishesRes.data || [];
    const seoLandingPagesRaw = seoRes.data || [];
    // Only emit canonical dish×city URLs: dish must be its own canonical (or have no canonical set)
    const seoLandingPages = seoLandingPagesRaw.filter((p: any) => {
      const d = p.dishes;
      if (!d) return true;
      if (!d.canonical_slug) return true;
      return d.canonical_slug === d.slug;
    });
    const collections = collectionsRes.data || [];

    const now = new Date().toISOString().split('T')[0];

    const urls: string[] = [];

    const addUrl = (loc: string, lastmod: string, changefreq: string, priority: string) => {
      urls.push(`  <url>
    <loc>${loc}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`);
    };

    // Static pages
    addUrl(SITE_URL, now, 'daily', '1.0');
    addUrl(`${SITE_URL}/search`, now, 'hourly', '0.9');
    addUrl(`${SITE_URL}/eten`, now, 'daily', '0.9');
    addUrl(`${SITE_URL}/steden`, now, 'daily', '0.9');
    addUrl(`${SITE_URL}/collections`, now, 'weekly', '0.8');
    addUrl(`${SITE_URL}/events`, now, 'daily', '0.8');
    addUrl(`${SITE_URL}/for-restaurants`, now, 'monthly', '0.7');
    addUrl(`${SITE_URL}/about`, now, 'monthly', '0.5');
    addUrl(`${SITE_URL}/contact`, now, 'monthly', '0.5');
    addUrl(`${SITE_URL}/privacy`, now, 'monthly', '0.3');
    addUrl(`${SITE_URL}/terms`, now, 'monthly', '0.3');

    // SEO Landing Pages (/eten/[slug]) - High priority
    for (const page of seoLandingPages) {
      addUrl(`${SITE_URL}/eten/${page.slug}`, page.updated_at?.split('T')[0] || now, 'weekly', '0.9');
    }

    // Collection pages
    for (const c of collections) {
      addUrl(`${SITE_URL}/collection/${c.slug}`, c.updated_at?.split('T')[0] || now, 'weekly', '0.8');
    }

    // City detail pages (/steden/[slug])
    for (const city of cities) {
      addUrl(`${SITE_URL}/steden/${city.slug}`, city.updated_at?.split('T')[0] || now, 'weekly', '0.8');
    }

    // Dish pillar pages (/eten/gerecht/[slug])
    for (const dish of dishes) {
      addUrl(`${SITE_URL}/eten/gerecht/${dish.slug}`, dish.updated_at?.split('T')[0] || now, 'weekly', '0.8');
    }

    // Restaurant pages
    for (const r of restaurants) {
      addUrl(`${SITE_URL}/restaurant/${r.slug}`, r.updated_at?.split('T')[0] || now, 'weekly', '0.8');
    }

    // Note: Search pages with query parameters are NOT included in the sitemap
    // to avoid canonical duplication issues. Use SEO landing pages (/eten/[slug]) instead.

    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>`;

    console.log(`Sitemap generated: ${restaurants.length} restaurants, ${collections.length} collections, ${seoLandingPages.length} SEO pages, ${cities.length} cities, ${dishes.length} dishes`);

    return new Response(sitemap, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error: unknown) {
    console.error('Sitemap generation error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
