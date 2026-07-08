// Regenerates public/sitemap.xml with base URLs only (no facet URLs, no /eten/gerecht/*).
// Reads from Supabase using the anon key (all queried tables are public-read).
import { createClient } from '@supabase/supabase-js';
import { writeFileSync } from 'fs';
import { resolve } from 'path';

const SITE_URL = 'https://dishloopr.com';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY');
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

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

  console.log(`Fetched: ${restaurants.length} restaurants, ${cities.length} cities, ${seoRaw.length} SEO pages (${seoCanonical.length} canonical), ${collections.length} collections`);

  // ---- Emit sitemap ----
  const urls = [];
  const add = (loc, lastmod, changefreq, priority) => {
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

  for (const p of seoCanonical) add(`${SITE_URL}/eten/${p.slug}`, (p.updated_at || '').split('T')[0] || now, 'weekly', '0.9');
  for (const c of collections) add(`${SITE_URL}/collection/${c.slug}`, (c.updated_at || '').split('T')[0] || now, 'weekly', '0.8');
  for (const c of cities) add(`${SITE_URL}/steden/${c.slug}`, (c.updated_at || '').split('T')[0] || now, 'weekly', '0.8');
  for (const r of restaurants) add(`${SITE_URL}/restaurant/${r.slug}`, (r.updated_at || '').split('T')[0] || now, 'weekly', '0.8');

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
}

main().catch(err => { console.error(err); process.exit(1); });
