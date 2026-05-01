import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function formatDishName(name: string): string {
  if (!name || typeof name !== 'string') return '';
  const trimmed = name.trim();
  if (trimmed.length === 0) return '';
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
}

async function tryScrape(url: string, firecrawlKey: string): Promise<{ ok: boolean; markdown?: string; status?: number; error?: string }> {
  try {
    const scrapeResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${firecrawlKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        formats: ['markdown'],
        onlyMainContent: true,
        waitFor: 3000,
      }),
    });

    if (!scrapeResponse.ok) {
      const errText = await scrapeResponse.text();
      return { ok: false, status: scrapeResponse.status, error: errText };
    }

    const scrapeData = await scrapeResponse.json();
    const markdown = scrapeData.data?.markdown || scrapeData.markdown || '';
    return { ok: true, markdown };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'fetch failed' };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  let parsedRestaurantId: string | null = null;
  let adminSupabase: any = null;
  let runStartedAt = new Date().toISOString();
  let scrapedUrlForLog: string | null = null;

  const logRun = async ({
    status,
    dishesExtracted = 0,
    dishesAdded = 0,
    dishesExisting = 0,
    errorMessage = null,
    scrapedUrl = null,
  }: {
    status: string;
    dishesExtracted?: number;
    dishesAdded?: number;
    dishesExisting?: number;
    errorMessage?: string | null;
    scrapedUrl?: string | null;
  }) => {
    if (!adminSupabase || !parsedRestaurantId) return;
    try {
      await adminSupabase.from('menu_scrape_runs').insert({
        restaurant_id: parsedRestaurantId,
        status,
        source: 'firecrawl_ai',
        scraped_url: scrapedUrl,
        dishes_extracted: dishesExtracted,
        dishes_added: dishesAdded,
        dishes_existing: dishesExisting,
        error_message: errorMessage,
        started_at: runStartedAt,
        completed_at: new Date().toISOString(),
      });
    } catch (logErr) {
      console.error('Failed to log scrape run:', logErr);
    }
  };

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const isInternalWorker = token === supabaseServiceKey;

    if (!isInternalWorker) {
      const authClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } }
      });

      const { data: claims, error: authError } = await authClient.auth.getUser(token);
      if (authError || !claims?.user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const { data: hasAdminRole } = await authClient.rpc('has_role', {
        _user_id: claims.user.id, _role: 'admin'
      });
      if (!hasAdminRole) {
        return new Response(JSON.stringify({ error: 'Admin access required' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    const { restaurantId, websiteUrl } = await req.json();
    parsedRestaurantId = restaurantId;
    runStartedAt = new Date().toISOString();

    if (!restaurantId || !websiteUrl) {
      return new Response(JSON.stringify({ error: 'restaurantId and websiteUrl are required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    adminSupabase = createClient(supabaseUrl, supabaseServiceKey);

    const firecrawlKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (!firecrawlKey) {
      await logRun({ status: 'firecrawl_not_configured', errorMessage: 'Firecrawl not configured' });
      return new Response(JSON.stringify({ error: 'Firecrawl not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    let formattedUrl = websiteUrl.trim();
    if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
      formattedUrl = `https://${formattedUrl}`;
    }

    console.log(`Scraping menu from: ${formattedUrl}`);

    // Step 1: Try to find menu-related pages via map
    let menuUrl: string | null = null;
    try {
      const mapResponse = await fetch('https://api.firecrawl.dev/v1/map', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${firecrawlKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: formattedUrl,
          search: 'menu kaart gerechten dishes food',
          limit: 20,
        }),
      });

      if (mapResponse.ok) {
        const mapData = await mapResponse.json();
        const menuLinks = (mapData.links || []).filter((link: string) =>
          /menu|kaart|gerecht|dish|food|eten/i.test(link)
        );
        if (menuLinks.length > 0) {
          menuUrl = menuLinks[0];
          console.log(`Found menu page: ${menuUrl}`);
        }
      } else {
        // Consume body to prevent resource leak
        await mapResponse.text();
      }
    } catch (mapErr) {
      console.warn('Map request failed, continuing with original URL:', mapErr);
    }

    // Step 2: Scrape - try menu URL first, fallback to original
    let markdown = '';
    let urlToScrape = menuUrl || formattedUrl;
    scrapedUrlForLog = urlToScrape;

    let scrapeResult = await tryScrape(urlToScrape, firecrawlKey);

    // If menu URL failed and it's different from original, try original URL as fallback
    if (!scrapeResult.ok && menuUrl && menuUrl !== formattedUrl) {
      console.log(`Menu URL failed, trying original: ${formattedUrl}`);
      urlToScrape = formattedUrl;
      scrapedUrlForLog = urlToScrape;
      scrapeResult = await tryScrape(formattedUrl, firecrawlKey);
    }

    if (!scrapeResult.ok) {
      if (scrapeResult.status === 402) {
        await logRun({ status: 'firecrawl_credits_exhausted', errorMessage: 'Firecrawl credits op', scrapedUrl: urlToScrape });
        return new Response(JSON.stringify({ error: 'Firecrawl credits op' }), {
          status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      await logRun({
        status: 'scrape_failed',
        errorMessage: `Website niet bereikbaar of geblokkeerd (${scrapeResult.status || 'network'})`,
        scrapedUrl: urlToScrape,
      });
      return new Response(JSON.stringify({
        success: false,
        error: 'Website niet bereikbaar of geblokkeerd voor scraping',
        scrapedUrl: urlToScrape,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    markdown = scrapeResult.markdown || '';

    if (!markdown || markdown.length < 50) {
      await logRun({ status: 'no_menu_content', errorMessage: 'Geen menu content gevonden', scrapedUrl: urlToScrape });
      return new Response(JSON.stringify({
        success: false,
        error: 'Geen menu content gevonden op deze website',
        scrapedUrl: urlToScrape,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log(`Scraped ${markdown.length} chars from ${urlToScrape}`);

    // Step 3: AI extraction
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      await logRun({ status: 'ai_not_configured', errorMessage: 'AI service niet geconfigureerd', scrapedUrl: urlToScrape });
      return new Response(JSON.stringify({ error: 'AI service niet geconfigureerd' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `Je bent een expert in het analyseren van restaurantmenu's. Extract alle gerechten uit de website content.

Geef ALLEEN een JSON array terug met objecten:
{"name": "Gerechtnaam", "name_en": "English name or null", "synonyms": ["zoekterm1", "zoekterm2"], "confidence": 0.0-1.0}

Regels:
- Focus op hoofdgerechten, voorgerechten en bekende gerechten
- Negeer drankjes tenzij het signature cocktails zijn
- Nederlandse naam als primair, originele naam als het internationaal is
- Confidence 0.9+ voor duidelijke gerechten
- Voeg relevante zoektermen toe als synoniemen`
          },
          {
            role: 'user',
            content: `Extract alle gerechten uit deze website content:\n\n${markdown.substring(0, 15000)}`
          }
        ],
        temperature: 0.3,
      }),
    });

    if (!aiResponse.ok) {
      const aiErrorText = await aiResponse.text();
      console.error('AI error:', aiResponse.status, aiErrorText);

      const statusMap: Record<number, { status: string; msg: string }> = {
        429: { status: 'ai_rate_limited', msg: 'Te veel AI-verzoeken, probeer het zo opnieuw.' },
        402: { status: 'ai_credits_exhausted', msg: 'AI credits op.' },
        401: { status: 'ai_auth_failed', msg: 'AI authenticatie mislukt.' },
      };

      const mapped = statusMap[aiResponse.status];
      if (mapped) {
        await logRun({ status: mapped.status, errorMessage: mapped.msg, scrapedUrl: urlToScrape });
        return new Response(JSON.stringify({ error: mapped.msg }), {
          status: aiResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      await logRun({ status: 'ai_failed', errorMessage: `${aiResponse.status}: ${aiErrorText.slice(0, 500)}`, scrapedUrl: urlToScrape });
      return new Response(JSON.stringify({
        success: false,
        error: `AI analyse mislukt (${aiResponse.status})`,
        details: aiErrorText.slice(0, 300),
        scrapedUrl: urlToScrape,
      }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || '';

    let extractedDishes: Array<{ name: string; name_en?: string; synonyms?: string[]; confidence: number }> = [];
    try {
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) extractedDishes = JSON.parse(jsonMatch[0]);
    } catch (e) {
      console.error('Parse error:', e);
      await logRun({ status: 'ai_parse_failed', errorMessage: 'Kon gerechten niet parsen', scrapedUrl: urlToScrape });
      return new Response(JSON.stringify({ error: 'Kon gerechten niet parsen' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`AI extracted ${extractedDishes.length} dishes`);

    // Step 4: Save to database
    const results = { added: [] as string[], existing: [] as string[], errors: [] as string[] };

    for (const dish of extractedDishes) {
      try {
        const formattedName = formatDishName(dish.name);
        if (!formattedName || formattedName.length < 2) continue;

        const slug = formattedName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

        let { data: existingDish } = await adminSupabase
          .from('dishes').select('id, synonyms').eq('slug', slug).maybeSingle();

        if (!existingDish) {
          const { data: byName } = await adminSupabase
            .from('dishes').select('id, synonyms').ilike('name', formattedName).maybeSingle();
          existingDish = byName;
        }

        let dishId: string;

        if (existingDish) {
          dishId = existingDish.id;
          results.existing.push(formattedName);

          const currentSynonyms = existingDish.synonyms || [];
          const newSynonyms = (dish.synonyms || []).filter((s: string) =>
            !currentSynonyms.some((cs: string) => cs.toLowerCase() === s.toLowerCase())
          );
          if (newSynonyms.length > 0) {
            await adminSupabase.from('dishes').update({
              synonyms: [...currentSynonyms, ...newSynonyms.map((s: string) => s.toLowerCase())]
            }).eq('id', dishId);
          }
        } else {
          const { data: newDish, error: createError } = await adminSupabase
            .from('dishes').insert({
              name: formattedName,
              name_en: dish.name_en ? formatDishName(dish.name_en) : null,
              slug,
              synonyms: (dish.synonyms || []).map((s: string) => s.toLowerCase()),
              is_active: true,
            }).select('id').single();

          if (createError) { results.errors.push(formattedName); continue; }
          dishId = newDish.id;
          results.added.push(formattedName);
        }

        const { data: existingLink } = await adminSupabase
          .from('restaurant_dishes').select('id')
          .eq('restaurant_id', restaurantId).eq('dish_id', dishId).maybeSingle();

        if (!existingLink) {
          await adminSupabase.from('restaurant_dishes').insert({
            restaurant_id: restaurantId,
            dish_id: dishId,
            status: 'suggested',
            confidence_score: dish.confidence,
            source: 'firecrawl',
          });
        }
      } catch (err) {
        console.error(`Error processing ${dish.name}:`, err);
        results.errors.push(dish.name);
      }
    }

    await logRun({
      status: 'success',
      dishesExtracted: extractedDishes.length,
      dishesAdded: results.added.length,
      dishesExisting: results.existing.length,
      scrapedUrl: urlToScrape,
    });

    return new Response(JSON.stringify({
      success: true,
      scrapedUrl: urlToScrape,
      results: {
        added: results.added.length,
        existing: results.existing.length,
        errors: results.errors.length,
        addedDishes: results.added,
        existingDishes: results.existing,
      },
      message: `${results.added.length} nieuwe gerechten gevonden, ${results.existing.length} al bekend.`
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('Scrape error:', error);
    await logRun({
      status: 'internal_error',
      errorMessage: error instanceof Error ? error.message : 'Unknown',
      scrapedUrl: scrapedUrlForLog,
    });
    return new Response(JSON.stringify({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown'
    }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
