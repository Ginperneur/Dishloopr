import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const SITE_URL = "https://dishloopr.com";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Indexeer-drempel voor /eten/{slug}/{facet} URL's (moet overeenkomen met DishCityPage).
const FACET_INDEX_THRESHOLD = 3;

// Whitelisted facet-definities — moet in sync blijven met src/lib/dishCityFacets.ts
type FacetKind = 'meal' | 'ambience' | 'price';
interface FacetDef { slug: string; kind: FacetKind; dbValues: string[]; }

const FACETS: FacetDef[] = [
  // meal_types
  { slug: 'lunch',   kind: 'meal', dbValues: ['lunch'] },
  { slug: 'diner',   kind: 'meal', dbValues: ['dinner'] },
  { slug: 'ontbijt', kind: 'meal', dbValues: ['breakfast'] },
  { slug: 'brunch',  kind: 'meal', dbValues: ['brunch'] },
  // ambience_tags
  { slug: 'romantisch',      kind: 'ambience', dbValues: ['Romantisch'] },
  { slug: 'gezellig',        kind: 'ambience', dbValues: ['Gezellig'] },
  { slug: 'trendy',          kind: 'ambience', dbValues: ['Trendy'] },
  { slug: 'modern',          kind: 'ambience', dbValues: ['Modern'] },
  { slug: 'casual',          kind: 'ambience', dbValues: ['Casual'] },
  { slug: 'industrieel',     kind: 'ambience', dbValues: ['Industrieel'] },
  { slug: 'klassiek',        kind: 'ambience', dbValues: ['Klassiek'] },
  { slug: 'traditioneel',    kind: 'ambience', dbValues: ['Traditioneel'] },
  { slug: 'levendig',        kind: 'ambience', dbValues: ['Levendig'] },
  { slug: 'kindvriendelijk', kind: 'ambience', dbValues: ['Kindvriendelijk', 'Gezinsvriendelijk'] },
  { slug: 'warm',            kind: 'ambience', dbValues: ['Warm'] },
  { slug: 'fine-dining',     kind: 'ambience', dbValues: ['Fine Dining'] },
  { slug: 'intiem',          kind: 'ambience', dbValues: ['Intiem'] },
  { slug: 'minimalistisch',  kind: 'ambience', dbValues: ['Minimalistisch'] },
  { slug: 'zakelijk',        kind: 'ambience', dbValues: ['Zakelijk'] },
  { slug: 'bruisend',        kind: 'ambience', dbValues: ['Bruisend'] },
  { slug: 'bohemian',        kind: 'ambience', dbValues: ['Bohemian'] },
  { slug: 'luxe',            kind: 'ambience', dbValues: ['Luxe', 'High-end'] },
  // price_level
  { slug: 'budget',       kind: 'price', dbValues: ['1'] },
  { slug: 'middenklasse', kind: 'price', dbValues: ['2'] },
  { slug: 'luxueus',      kind: 'price', dbValues: ['3', '4'] },
];

interface RestFacetFields {
  meal_types: string[] | null;
  ambience_tags: string[] | null;
  price_level: number | null;
}

function matchesFacet(r: RestFacetFields, f: FacetDef): boolean {
  if (f.kind === 'meal') {
    const arr = r.meal_types || [];
    return f.dbValues.some(v => arr.includes(v));
  }
  if (f.kind === 'ambience') {
    const arr = r.ambience_tags || [];
    return f.dbValues.some(v => arr.includes(v));
  }
  if (r.price_level === null || r.price_level === undefined) return false;
  return f.dbValues.includes(String(r.price_level));
}

async function fetchAll<T>(
  query: (from: number, to: number) => Promise<{ data: T[] | null }>,
): Promise<T[]> {
  const out: T[] = [];
  const pageSize = 1000;
  let from = 0;
  while (true) {
    const { data } = await query(from, from + pageSize - 1);
    if (!data || data.length === 0) break;
    out.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return out;
}

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

    // ------------------------------------------------------------------
    // Facet URLs: /eten/{slug}/{facet} — only when >=3 approved restaurants match
    // ------------------------------------------------------------------
    let facetUrlCount = 0;
    try {
      // Fetch SEO pages with dish_id + city_id + canonical dish info
      const { data: fullSeoPages } = await supabase
        .from('seo_landing_pages')
        .select('slug, updated_at, city_id, dish_id, dishes:dish_id(slug, canonical_slug)')
        .eq('is_active', true);

      const indexableSeo = (fullSeoPages || []).filter((p: any) => {
        const d = p.dishes;
        if (!p.city_id || !p.dish_id) return false;
        if (!d) return true;
        if (!d.canonical_slug) return true;
        return d.canonical_slug === d.slug;
      });

      // Bulk fetch: all dishes → canonical mapping
      const allDishes = await fetchAll<{ id: string; slug: string; canonical_slug: string | null }>(
        (from, to) => supabase.from('dishes').select('id, slug, canonical_slug').range(from, to) as any
      );
      const dishIdsByCanonical = new Map<string, string[]>();
      for (const d of allDishes) {
        const c = d.canonical_slug || d.slug;
        if (!c) continue;
        const arr = dishIdsByCanonical.get(c) || [];
        arr.push(d.id);
        dishIdsByCanonical.set(c, arr);
      }

      // Bulk fetch: all approved restaurant_dishes
      const rdRows = await fetchAll<{ restaurant_id: string; dish_id: string }>(
        (from, to) => supabase
          .from('restaurant_dishes')
          .select('restaurant_id, dish_id')
          .eq('status', 'approved_by_admin')
          .range(from, to) as any
      );
      const restaurantIdsByDish = new Map<string, string[]>();
      for (const rd of rdRows) {
        const arr = restaurantIdsByDish.get(rd.dish_id) || [];
        arr.push(rd.restaurant_id);
        restaurantIdsByDish.set(rd.dish_id, arr);
      }

      // Bulk fetch: all active restaurants with facet fields
      const allRestaurants = await fetchAll<{
        id: string; city_id: string | null;
        meal_types: string[] | null; ambience_tags: string[] | null; price_level: number | null;
      }>(
        (from, to) => supabase
          .from('restaurants')
          .select('id, city_id, meal_types, ambience_tags, price_level')
          .eq('is_active', true)
          .range(from, to) as any
      );
      const restaurantById = new Map(allRestaurants.map(r => [r.id, r]));

      for (const page of indexableSeo) {
        const dish = (page as any).dishes;
        const canonicalSlug = dish?.canonical_slug || dish?.slug;
        if (!canonicalSlug) continue;
        const dishIds = dishIdsByCanonical.get(canonicalSlug) || [];
        if (dishIds.length === 0) continue;

        const restIds = new Set<string>();
        for (const did of dishIds) {
          const rids = restaurantIdsByDish.get(did) || [];
          for (const rid of rids) restIds.add(rid);
        }
        // Filter to city + active with facet fields
        const cityRestaurants: RestFacetFields[] = [];
        for (const rid of restIds) {
          const r = restaurantById.get(rid);
          if (r && r.city_id === (page as any).city_id) cityRestaurants.push(r);
        }
        if (cityRestaurants.length < FACET_INDEX_THRESHOLD) continue;

        for (const f of FACETS) {
          let count = 0;
          for (const r of cityRestaurants) if (matchesFacet(r, f)) count++;
          if (count >= FACET_INDEX_THRESHOLD) {
            addUrl(
              `${SITE_URL}/eten/${(page as any).slug}/${f.slug}`,
              (page as any).updated_at?.split('T')[0] || now,
              'weekly',
              '0.7'
            );
            facetUrlCount++;
          }
        }
      }
    } catch (facetErr) {
      console.error('Facet URL generation failed:', facetErr);
    }

    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>`;

    console.log(`Sitemap generated: ${restaurants.length} restaurants, ${collections.length} collections, ${seoLandingPages.length} SEO pages, ${cities.length} cities, ${dishes.length} dishes, ${facetUrlCount} facet URLs`);

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
