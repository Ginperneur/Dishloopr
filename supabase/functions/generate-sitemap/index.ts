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

    // Get all active restaurants
    const { data: restaurants } = await supabase
      .from('restaurants')
      .select('slug, updated_at')
      .eq('is_active', true)
      .order('updated_at', { ascending: false });

    // Get all active cities
    const { data: cities } = await supabase
      .from('cities')
      .select('slug, updated_at')
      .eq('is_active', true);

    // Get all active dishes
    const { data: dishes } = await supabase
      .from('dishes')
      .select('slug, updated_at')
      .eq('is_active', true)
      .order('search_count', { ascending: false })
      .limit(100);

    const now = new Date().toISOString().split('T')[0];

    // Build sitemap XML
    let sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
  
  <!-- Homepage -->
  <url>
    <loc>${SITE_URL}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>

  <!-- Static pages -->
  <url>
    <loc>${SITE_URL}/search</loc>
    <lastmod>${now}</lastmod>
    <changefreq>hourly</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>${SITE_URL}/about</loc>
    <lastmod>${now}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>
  <url>
    <loc>${SITE_URL}/contact</loc>
    <lastmod>${now}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>
  <url>
    <loc>${SITE_URL}/privacy</loc>
    <lastmod>${now}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.3</priority>
  </url>
  <url>
    <loc>${SITE_URL}/terms</loc>
    <lastmod>${now}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.3</priority>
  </url>
`;

    // Restaurant pages
    if (restaurants) {
      for (const restaurant of restaurants) {
        const lastmod = restaurant.updated_at?.split('T')[0] || now;
        sitemap += `
  <url>
    <loc>${SITE_URL}/restaurant/${restaurant.slug}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`;
      }
    }

    // Search pages per city (these are valuable for SEO)
    if (cities) {
      for (const city of cities) {
        sitemap += `
  <url>
    <loc>${SITE_URL}/search?city=${city.slug}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.7</priority>
  </url>`;
      }
    }

    // Search pages per popular dish
    if (dishes) {
      for (const dish of dishes) {
        sitemap += `
  <url>
    <loc>${SITE_URL}/search?dish=${encodeURIComponent(dish.slug)}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.7</priority>
  </url>`;
      }
    }

    // City + dish combinations (most valuable for SEO)
    if (cities && dishes) {
      for (const city of cities) {
        for (const dish of dishes.slice(0, 20)) { // Top 20 dishes per city
          sitemap += `
  <url>
    <loc>${SITE_URL}/search?city=${city.slug}&amp;dish=${encodeURIComponent(dish.slug)}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.6</priority>
  </url>`;
        }
      }
    }

    sitemap += `
</urlset>`;

    return new Response(sitemap, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      },
    });
  } catch (error: unknown) {
    console.error('Sitemap generation error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
