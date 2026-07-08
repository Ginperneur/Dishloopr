// Regenerates public/sitemap.xml: base URLs + facet URLs (>=3 matches). Never emits /eten/gerecht/*.
// Reads from Supabase using the anon key (all queried tables are public-read).
import { createClient } from '@supabase/supabase-js';
import { writeFileSync } from 'fs';
import { resolve } from 'path';

const SITE_URL = 'https://dishloopr.com';
const FACET_THRESHOLD = 3;

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY');
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Facet whitelist — keep in sync with src/lib/dishCityFacets.ts.
const FACETS = [
  { slug: 'ontbijt', kind: 'meal', dbValues: ['breakfast'] },
  { slug: 'lunch',   kind: 'meal', dbValues: ['lunch'] },
  { slug: 'diner',   kind: 'meal', dbValues: ['dinner'] },
  { slug: 'romantisch',      kind: 'ambience', dbValues: ['Romantisch'] },
  { slug: 'casual',          kind: 'ambience', dbValues: ['Casual'] },
  { slug: 'gezellig',        kind: 'ambience', dbValues: ['Gezellig'] },
  { slug: 'trendy',          kind: 'ambience', dbValues: ['Trendy'] },
  { slug: 'zakelijk',        kind: 'ambience', dbValues: ['Zakelijk'] },
  { slug: 'luxe',            kind: 'ambience', dbValues: ['Luxe', 'High-end'] },
  { slug: 'modern',          kind: 'ambience', dbValues: ['Modern'] },
  { slug: 'industrieel',     kind: 'ambience', dbValues: ['Industrieel'] },
  { slug: 'klassiek',        kind: 'ambience', dbValues: ['Klassiek'] },
  { slug: 'traditioneel',    kind: 'ambience', dbValues: ['Traditioneel'] },
  { slug: 'levendig',        kind: 'ambience', dbValues: ['Levendig'] },
  { slug: 'kindvriendelijk', kind: 'ambience', dbValues: ['Kindvriendelijk', 'Gezinsvriendelijk'] },
  { slug: 'warm',            kind: 'ambience', dbValues: ['Warm'] },
  { slug: 'fine-dining',     kind: 'ambience', dbValues: ['Fine Dining'] },
  { slug: 'intiem',          kind: 'ambience', dbValues: ['Intiem'] },
  { slug: 'minimalistisch',  kind: 'ambience', dbValues: ['Minimalistisch'] },
  { slug: 'bruisend',        kind: 'ambience', dbValues: ['Bruisend'] },
  { slug: 'bohemian',        kind: 'ambience', dbValues: ['Bohemian'] },
  { slug: 'goedkoop', kind: 'price', dbValues: ['1'] },
  { slug: 'chic',     kind: 'price', dbValues: ['3', '4'] },
];

function matchesFacet(r, f) {
  if (f.kind === 'meal') return (r.meal_types || []).some(v => f.dbValues.includes(v));
  if (f.kind === 'ambience') return (r.ambience_tags || []).some(v => f.dbValues.includes(v));
  if (r.price_level === null || r.price_level === undefined) return false;
  return f.dbValues.includes(String(r.price_level));
}

async function fetchAll(build) {
  const out = [];
  const pageSize = 1000;
  let from = 0;
  while (true) {
    const { data, error } = await build(from, from + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    out.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return out;
}

async function main() {
  const now = new Date().toISOString().split('T')[0];

  const [restaurants, cities, seoRaw, collections] = await Promise.all([
    fetchAll((f, t) => supabase.from('restaurants').select('slug, updated_at').eq('is_active', true).order('updated_at', { ascending: false }).range(f, t)),
    fetchAll((f, t) => supabase.from('cities').select('slug, updated_at').eq('is_active', true).range(f, t)),
    fetchAll((f, t) => supabase.from('seo_landing_pages').select('slug, updated_at, city_id, dish_id, dishes:dish_id(slug, canonical_slug)').eq('is_active', true).range(f, t)),
    fetchAll((f, t) => supabase.from('collections').select('slug, updated_at').eq('is_active', true).order('sort_order').range(f, t)),
  ]);

  // Canonical-only SEO pages (dish is its own canonical, or none set)
  const seoCanonical = seoRaw.filter(p => {
    const d = p.dishes;
    if (!d) return true;
    if (!d.canonical_slug) return true;
    return d.canonical_slug === d.slug;
  });
  // Hard-guard: never emit anything with a literal "gerecht" dish-slug segment.
  const seoIndexable = seoCanonical.filter(p => {
    if (!p.slug) return false;
    if (p.slug.startsWith('gerecht-') || p.slug === 'gerecht' || p.slug.includes('/gerecht/')) return false;
    const d = p.dishes;
    if (d?.slug === 'gerecht' || d?.canonical_slug === 'gerecht') return false;
    return true;
  });

  console.log(`Fetched: ${restaurants.length} restaurants, ${cities.length} cities, ${seoRaw.length} SEO pages (${seoIndexable.length} canonical+indexable), ${collections.length} collections`);

  // ---- Facet URL computation ----
  const allDishes = await fetchAll((f, t) => supabase.from('dishes').select('id, slug, canonical_slug').range(f, t));
  const dishIdsByCanonical = new Map();
  for (const d of allDishes) {
    const c = d.canonical_slug || d.slug;
    if (!c || c === 'gerecht') continue;
    const arr = dishIdsByCanonical.get(c) || [];
    arr.push(d.id);
    dishIdsByCanonical.set(c, arr);
  }
  const rdRows = await fetchAll((f, t) => supabase.from('restaurant_dishes').select('restaurant_id, dish_id').eq('status', 'approved_by_admin').range(f, t));
  const restaurantIdsByDish = new Map();
  for (const rd of rdRows) {
    const arr = restaurantIdsByDish.get(rd.dish_id) || [];
    arr.push(rd.restaurant_id);
    restaurantIdsByDish.set(rd.dish_id, arr);
  }
  const allRestaurants = await fetchAll((f, t) => supabase.from('restaurants').select('id, city_id, meal_types, ambience_tags, price_level, is_active').eq('is_active', true).range(f, t));
  const restaurantById = new Map(allRestaurants.map(r => [r.id, r]));

  const facetEntries = [];
  for (const page of seoIndexable) {
    const d = page.dishes;
    const canonicalSlug = d?.canonical_slug || d?.slug;
    if (!canonicalSlug || canonicalSlug === 'gerecht' || !page.city_id) continue;
    const dishIds = dishIdsByCanonical.get(canonicalSlug) || [];
    if (dishIds.length === 0) continue;
    const restIds = new Set();
    for (const did of dishIds) for (const rid of (restaurantIdsByDish.get(did) || [])) restIds.add(rid);
    const cityRestaurants = [];
    for (const rid of restIds) {
      const r = restaurantById.get(rid);
      if (r && r.city_id === page.city_id) cityRestaurants.push(r);
    }
    if (cityRestaurants.length < FACET_THRESHOLD) continue;
    for (const f of FACETS) {
      let count = 0;
      for (const r of cityRestaurants) if (matchesFacet(r, f)) count++;
      if (count >= FACET_THRESHOLD) {
        facetEntries.push({
          loc: `${SITE_URL}/eten/${page.slug}/${f.slug}`,
          lastmod: (page.updated_at || '').split('T')[0] || now,
        });
      }
    }
  }

  // ---- Emit sitemap ----
  const urls = [];
  const add = (loc, lastmod, changefreq, priority) => {
    if (loc.includes('/eten/gerecht/')) return; // final safety net
    urls.push(`  <url>\n    <loc>${loc}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`);
  };

  add(SITE_URL, now, 'daily', '1.0');
  add(`${SITE_URL}/search`, now, 'hourly', '0.9');
  add(`${SITE_URL}/eten`, now, 'daily', '0.9');
  add(`${SITE_URL}/steden`, now, 'daily', '0.9');
  add(`${SITE_URL}/collections`, now, 'weekly', '0.8');
  add(`${SITE_URL}/events`, now, 'daily', '0.8');
  add(`${SITE_URL}/for-restaurants`, now, 'monthly', '0.7');
  add(`${SITE_URL}/about`, now, 'monthly', '0.5');
  add(`${SITE_URL}/contact`, now, 'monthly', '0.5');
  add(`${SITE_URL}/privacy`, now, 'monthly', '0.3');
  add(`${SITE_URL}/terms`, now, 'monthly', '0.3');

  for (const p of seoIndexable) add(`${SITE_URL}/eten/${p.slug}`, (p.updated_at || '').split('T')[0] || now, 'weekly', '0.9');
  for (const c of collections) add(`${SITE_URL}/collection/${c.slug}`, (c.updated_at || '').split('T')[0] || now, 'weekly', '0.8');
  for (const c of cities) add(`${SITE_URL}/steden/${c.slug}`, (c.updated_at || '').split('T')[0] || now, 'weekly', '0.8');
  for (const r of restaurants) add(`${SITE_URL}/restaurant/${r.slug}`, (r.updated_at || '').split('T')[0] || now, 'weekly', '0.8');
  for (const e of facetEntries) add(e.loc, e.lastmod, 'weekly', '0.7');

  // Deduplicate by <loc>
  const seen = new Set();
  const unique = [];
  for (const block of urls) {
    const m = block.match(/<loc>([^<]+)<\/loc>/);
    const loc = m ? m[1] : block;
    if (seen.has(loc)) continue;
    seen.add(loc);
    unique.push(block);
  }

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${unique.join('\n')}\n</urlset>\n`;
  writeFileSync(resolve('public/sitemap.xml'), sitemap);

  console.log(`Wrote public/sitemap.xml — ${unique.length} unique <loc> (${urls.length - unique.length} duplicates removed)`);
  console.log(`Facet URLs emitted: ${facetEntries.length}`);
}

main().catch(err => { console.error(err); process.exit(1); });
