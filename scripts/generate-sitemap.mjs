// Regenerates public/sitemap.xml. Never emits /eten/gerecht/*.
// Only dish×city pages Google is likely to index are listed: drinks never, landing pages
// (seo_landing_pages) from 3 restaurants, generated dish×city pages from 5, facets from 5 matches
// on a listed landing page. Thin pages stay reachable through links; they are just not submitted.
// Reads from Supabase using the anon key (all queried tables are public-read).
import { createClient } from '@supabase/supabase-js';
import { writeFileSync } from 'fs';
import { resolve } from 'path';

const SITE_URL = 'https://dishloopr.com';
const FACET_THRESHOLD = 5;     // stricter than the page (indexable from 3): only facets with real choice are submitted
const LANDING_THRESHOLD = 3;   // same as the page's own noindex rule in DishCityPage
const GENERATED_THRESHOLD = 5;
// A dish counts as a drink when at least half of its menu rows are course_type 'drank'
// (the same marker menu_dish_count uses to leave drinks out).
const DRINK_SHARE = 0.5;

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
  { slug: 'romantisch',      kind: 'ambience', dbValues: ['Romantisch', 'Intiem'] },
  { slug: 'gezellig',        kind: 'ambience', dbValues: ['Gezellig', 'Warm', 'Traditioneel', 'Klassiek'] },
  { slug: 'trendy',          kind: 'ambience', dbValues: ['Trendy', 'Modern', 'Industrieel', 'Minimalistisch', 'Bohemian', 'Levendig', 'Bruisend'] },
  { slug: 'casual',          kind: 'ambience', dbValues: ['Casual'] },
  { slug: 'luxe',            kind: 'ambience', dbValues: ['Luxe', 'Fine Dining', 'High-end'] },
  { slug: 'zakelijk',        kind: 'ambience', dbValues: ['Zakelijk'] },
  { slug: 'kindvriendelijk', kind: 'ambience', dbValues: ['Kindvriendelijk', 'Gezinsvriendelijk'] },
  { slug: 'budget',   kind: 'price', dbValues: ['1'] },
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

async function fetchKeyset(table, cols, filter = (q) => q) {
  const out = [];
  let last = null;
  while (true) {
    let q = filter(supabase.from(table).select(`id, ${cols}`)).order('id').limit(1000);
    if (last) q = q.gt('id', last);
    const { data, error } = await q;
    if (error) throw error;
    for (const d of data) out.push(d);
    if (data.length < 1000) break;
    last = data[data.length - 1].id;
  }
  return out;
}

async function main() {
  const day = (v) => (v || '').split('T')[0] || null;

  const [restaurants, cities, seoRaw, collections] = await Promise.all([
    fetchAll((f, t) => supabase.from('restaurants').select('slug, updated_at').eq('is_active', true).order('updated_at', { ascending: false }).range(f, t)),
    fetchAll((f, t) => supabase.from('cities').select('id, slug, updated_at').eq('is_active', true).range(f, t)),
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
  const allDishes = await fetchKeyset('dishes', 'slug, canonical_slug, dish_group', (q) => q.eq('is_active', true));
  const dishIdsByCanonical = new Map();
  const dishIdsByGroup = new Map(); // hub pages (canonical === dish_group) also show the group's dishes
  for (const d of allDishes) {
    if (d.dish_group) dishIdsByGroup.set(d.dish_group, [...(dishIdsByGroup.get(d.dish_group) || []), d.id]);
    const c = d.canonical_slug || d.slug;
    if (!c || c === 'gerecht') continue;
    const arr = dishIdsByCanonical.get(c) || [];
    arr.push(d.id);
    dishIdsByCanonical.set(c, arr);
  }
  const rdRows = [];
  for (const st of ['approved_by_admin', 'verified_by_owner']) { for (const row of await fetchKeyset('restaurant_dishes', 'restaurant_id, dish_id, course_type', (q) => q.eq('status', st))) rdRows.push(row); }
  const restaurantIdsByDish = new Map();
  const drinkRowsByDish = new Map(); // dish_id -> [drink rows, all rows]
  for (const rd of rdRows) {
    const arr = restaurantIdsByDish.get(rd.dish_id) || [];
    arr.push(rd.restaurant_id);
    restaurantIdsByDish.set(rd.dish_id, arr);
    const c = drinkRowsByDish.get(rd.dish_id) || [0, 0];
    if (rd.course_type === 'drank') c[0]++;
    c[1]++;
    drinkRowsByDish.set(rd.dish_id, c);
  }
  const isDrink = (canonicalSlug) => {
    let drink = 0, all = 0;
    for (const did of dishIdsByCanonical.get(canonicalSlug) || []) {
      const c = drinkRowsByDish.get(did);
      if (c) { drink += c[0]; all += c[1]; }
    }
    return all > 0 && drink / all >= DRINK_SHARE;
  };
  const allRestaurants = await fetchAll((f, t) => supabase.from('restaurants').select('id, city_id, meal_types, ambience_tags, price_level, is_active').eq('is_active', true).range(f, t));
  const restaurantById = new Map(allRestaurants.map(r => [r.id, r]));
  const cityRestaurantCount = (canonicalSlug, cityId) => {
    const ids = new Set();
    const dishIds = [...(dishIdsByCanonical.get(canonicalSlug) || []), ...(dishIdsByGroup.get(canonicalSlug) || [])];
    for (const did of dishIds) for (const rid of (restaurantIdsByDish.get(did) || [])) {
      if (restaurantById.get(rid)?.city_id === cityId) ids.add(rid);
    }
    return ids.size;
  };

  const seoListed = seoIndexable.filter(p => {
    // Cuisine and Romantisch pages have no dish; refresh_landing_pages() already decides they exist.
    if (!p.dish_id) return true;
    const canonicalSlug = p.dishes?.canonical_slug || p.dishes?.slug;
    if (!canonicalSlug || !p.city_id) return false;
    return !isDrink(canonicalSlug) && cityRestaurantCount(canonicalSlug, p.city_id) >= LANDING_THRESHOLD;
  });
  console.log(`Landing pages listed: ${seoListed.length} of ${seoIndexable.length} (drinks and pages under ${LANDING_THRESHOLD} restaurants left out)`);

  const facetEntries = [];
  for (const page of seoListed) {
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
          lastmod: day(page.updated_at),
        });
      }
    }
  }

  // ---- Emit sitemap ----
  const urls = [];
  const add = (loc, lastmod, changefreq, priority) => {
    if (loc.includes('/eten/gerecht/')) return; // final safety net
    urls.push(`  <url>\n    <loc>${loc}</loc>\n    ${lastmod ? `<lastmod>${lastmod}</lastmod>\n    ` : ''}<changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`);
  };

  add(SITE_URL, null, 'daily', '1.0');
  add(`${SITE_URL}/eten`, null, 'daily', '0.9');
  add(`${SITE_URL}/steden`, null, 'daily', '0.9');
  add(`${SITE_URL}/collections`, null, 'weekly', '0.8');
  add(`${SITE_URL}/evenementen`, null, 'daily', '0.8');
  add(`${SITE_URL}/for-restaurants`, null, 'monthly', '0.7');
  add(`${SITE_URL}/about`, null, 'monthly', '0.5');
  add(`${SITE_URL}/contact`, null, 'monthly', '0.5');
  add(`${SITE_URL}/privacy`, null, 'monthly', '0.3');
  add(`${SITE_URL}/terms`, null, 'monthly', '0.3');

  for (const p of seoListed) add(`${SITE_URL}/eten/${p.slug}`, (p.updated_at || '').split('T')[0] || null, 'weekly', '0.9');
  for (const c of collections) add(`${SITE_URL}/collection/${c.slug}`, (c.updated_at || '').split('T')[0] || null, 'weekly', '0.8');
  for (const c of cities) add(`${SITE_URL}/steden/${c.slug}`, (c.updated_at || '').split('T')[0] || null, 'weekly', '0.8');
  for (const r of restaurants) add(`${SITE_URL}/restaurant/${r.slug}`, (r.updated_at || '').split('T')[0] || null, 'weekly', '0.8');
  // Dish×city pages without a seo_landing_pages row (hub/fallback): no drinks, >=5 restaurants.
  // knownSlugs holds every landing page, listed or not, so a left-out landing page is not re-added here.
  const cityById = new Map(cities.map(c => [c.id, c.slug]));
  const knownSlugs = new Set(seoIndexable.map(p => p.slug));
  let generatedCount = 0;
  for (const [canonicalSlug, dishIds] of dishIdsByCanonical) {
    if (isDrink(canonicalSlug)) continue;
    const perCity = new Map();
    for (const did of dishIds) for (const rid of (restaurantIdsByDish.get(did) || [])) {
      const r = restaurantById.get(rid);
      if (!r || !cityById.has(r.city_id)) continue;
      const set = perCity.get(r.city_id) || new Set();
      set.add(rid); perCity.set(r.city_id, set);
    }
    for (const [cid, set] of perCity) {
      if (set.size < GENERATED_THRESHOLD) continue;
      const slug = `${canonicalSlug}-${cityById.get(cid)}`;
      if (knownSlugs.has(slug)) continue;
      knownSlugs.add(slug);
      add(`${SITE_URL}/eten/${slug}`, null, 'weekly', '0.8');
      generatedCount++;
    }
  }
  console.log(`Generated dish×city pages listed: ${generatedCount} (drinks and pages under ${GENERATED_THRESHOLD} restaurants left out)`);
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
