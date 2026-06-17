import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const googleApiKey = Deno.env.get('GOOGLE_PLACES_API_KEY');
    const supabase = createClient(supabaseUrl, supabaseKey);

    if (!googleApiKey) {
      return new Response(
        JSON.stringify({ error: 'GOOGLE_PLACES_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Admin-only
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const authClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!);
    const { data: { user } } = await authClient.auth.getUser(authHeader.replace('Bearer ', ''));
    if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    const { data: isAdmin } = await supabase.rpc('has_role', { _user_id: user.id, _role: 'admin' });
    if (!isAdmin) return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const body = await req.json().catch(() => ({}));
    const batchSize = body.batchSize || 25;
    const offset = body.offset || 0;
    const forceRefresh = body.forceRefresh || false;
    const mode = body.mode || 'full'; // 'full' | 'opening_hours_only' | 'never_enriched' | 'stale' | 'missing_website_only'
    const staleMonths: number = Math.max(1, Math.min(36, Number(body.staleMonths) || 3));
    const dryRun = body.dryRun === true;

    // Build query based on mode
    let query = supabase
      .from('restaurants')
      .select('id, name, address, city_id, cities(name), google_rating, opening_hours, website_url, google_enriched_at')
      .eq('is_active', true)
      .order('name');

    if (mode === 'opening_hours_only') {
      // Alleen restaurants zonder openingstijden — voorkomt onnodige API-kosten.
      // Sentinel `_no_hours_from_google` markeert eerdere mislukte pogingen zodat we
      // dezelfde restaurants niet eindeloos opnieuw bij Google opvragen.
      query = query.is('opening_hours', null);
    } else if (mode === 'never_enriched') {
      // Only restaurants that have never been touched (rating IS NULL, excludes failed attempts where rating=0)
      query = query.is('google_rating', null);
    } else if (mode === 'stale') {
      const cutoff = new Date(Date.now() - staleMonths * 30 * 24 * 60 * 60 * 1000).toISOString();
      query = query.or(`google_enriched_at.is.null,google_enriched_at.lt.${cutoff}`);
    } else if (mode === 'missing_website_only') {
      query = query.is('website_url', null);
    } else if (!forceRefresh) {
      query = query.is('google_rating', null);
    }

    const { data: restaurants, error: fetchError } = await query
      .range(offset, offset + batchSize - 1);

    if (fetchError) {
      throw new Error(`Failed to fetch restaurants: ${fetchError.message}`);
    }

    if (!restaurants || restaurants.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No restaurants to enrich', enriched: 0, failed: 0, remaining: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Count total remaining
    let countQuery = supabase
      .from('restaurants')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true);

    if (mode === 'opening_hours_only') {
      countQuery = countQuery.is('opening_hours', null);
    } else if (mode === 'never_enriched') {
      countQuery = countQuery.is('google_rating', null);
    } else if (mode === 'stale') {
      const cutoff = new Date(Date.now() - staleMonths * 30 * 24 * 60 * 60 * 1000).toISOString();
      countQuery = countQuery.or(`google_enriched_at.is.null,google_enriched_at.lt.${cutoff}`);
    } else if (mode === 'missing_website_only') {
      countQuery = countQuery.is('website_url', null);
    } else if (!forceRefresh) {
      countQuery = countQuery.is('google_rating', null);
    }
    const { count: totalRemaining } = await countQuery;

    console.log(`[${mode}] Enriching batch of ${restaurants.length} restaurants (offset: ${offset}, total remaining: ${totalRemaining})`);

    // Dry-run: geen Google API calls, alleen tellen + sample teruggeven.
    if (dryRun) {
      // Kostenraming op basis van legacy Places pricing
      const total = totalRemaining || 0;
      const textSearchCost = total * 0.032; // $ per Text Search call
      const detailsCost = total * 0.017;    // $ per Place Details call (alleen bij hit)
      // Conservatieve aanname: ~50% krijgt ook een details-call
      const estimatedUsd = textSearchCost + detailsCost * 0.5;

      return new Response(
        JSON.stringify({
          dryRun: true,
          mode,
          totalToProcess: total,
          sample: restaurants.slice(0, 10).map((r: any) => ({ id: r.id, name: r.name, city: r.cities?.name })),
          estimatedCostUsd: Number(estimatedUsd.toFixed(2)),
          estimatedCostEur: Number((estimatedUsd * 0.93).toFixed(2)),
          note: 'Geen Google API calls gedaan. Dit is een schatting; werkelijke kost hangt af van hit-rate.',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Quick API key validation with a simple test query
    if (offset === 0) {
      const testUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=restaurant+amsterdam&key=${googleApiKey}`;
      const testResp = await fetch(testUrl);
      const testData = await testResp.json();
      console.log(`API key test - status: ${testData.status}, error_message: ${testData.error_message || 'none'}`);
      if (testData.status === 'REQUEST_DENIED') {
        return new Response(
          JSON.stringify({ 
            error: `Google API key rejected: ${testData.error_message || 'REQUEST_DENIED'}. Make sure the Places API is enabled for this key.` 
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    let enriched = 0;
    let failed = 0;
    const results: Array<{ id: string; name: string; status: string; rating?: number; reviews?: number }> = [];

    for (const restaurant of restaurants) {
      try {
        const cityName = (restaurant as any).cities?.name || '';
        const searchQuery = `${restaurant.name} restaurant ${cityName} Netherlands`;

        const searchUrl = new URL('https://maps.googleapis.com/maps/api/place/textsearch/json');
        searchUrl.searchParams.set('query', searchQuery);
        searchUrl.searchParams.set('key', googleApiKey);
        searchUrl.searchParams.set('language', 'nl');
        searchUrl.searchParams.set('region', 'nl');

        const searchResponse = await fetch(searchUrl.toString());
        const searchData = await searchResponse.json();

        if (searchData.status !== 'OK' || !searchData.results?.length) {
          console.log(`No Google result for: ${restaurant.name} (status: ${searchData.status})`);
          if (mode === 'opening_hours_only') {
            // Markeer als geprobeerd zodat we 'm niet eindeloos opnieuw zoeken
            await supabase.from('restaurants')
              .update({ opening_hours: { _no_hours_from_google: true, _tried_at: new Date().toISOString() } })
              .eq('id', restaurant.id);
          } else {
            await supabase.from('restaurants').update({ google_rating: 0, google_reviews_count: 0 }).eq('id', restaurant.id);
          }
          results.push({ id: restaurant.id, name: restaurant.name, status: 'not_found' });
          failed++;
          continue;
        }

        const placeId = searchData.results[0].place_id;

        // For opening_hours_only mode, we only need opening_hours
        const fields = mode === 'opening_hours_only'
          ? 'opening_hours'
          : 'rating,user_ratings_total,opening_hours,price_level,formatted_phone_number,website';

        const detailsUrl = new URL('https://maps.googleapis.com/maps/api/place/details/json');
        detailsUrl.searchParams.set('place_id', placeId);
        detailsUrl.searchParams.set('fields', fields);
        detailsUrl.searchParams.set('key', googleApiKey);
        detailsUrl.searchParams.set('language', 'nl');

        const detailsResponse = await fetch(detailsUrl.toString());
        const detailsData = await detailsResponse.json();

        if (detailsData.status !== 'OK' || !detailsData.result) {
          console.log(`No details for: ${restaurant.name} (status: ${detailsData.status})`);
          if (mode === 'opening_hours_only') {
            await supabase.from('restaurants')
              .update({ opening_hours: { _no_hours_from_google: true, _tried_at: new Date().toISOString() } })
              .eq('id', restaurant.id);
          }
          results.push({ id: restaurant.id, name: restaurant.name, status: 'no_details' });
          failed++;
          continue;
        }

        const place = detailsData.result;
        const updateData: Record<string, unknown> = {};

        if (mode !== 'opening_hours_only') {
          if (place.rating != null) updateData.google_rating = place.rating;
          if (place.user_ratings_total != null) updateData.google_reviews_count = place.user_ratings_total;
          if (place.price_level != null) updateData.price_level = Math.min(Math.max(place.price_level, 1), 4);
          // Fill missing website_url from Google
          if (place.website && !restaurant.website_url) {
            updateData.website_url = place.website;
          }
        }

        if (place.opening_hours?.weekday_text) {
          const hoursObj: Record<string, string> = {};
          for (const line of place.opening_hours.weekday_text) {
            const [day, ...timeParts] = line.split(': ');
            hoursObj[day.toLowerCase()] = timeParts.join(': ');
          }
          updateData.opening_hours = hoursObj;
        }

        if (Object.keys(updateData).length > 0) {
          updateData.google_enriched_at = new Date().toISOString();
          const { error: updateError } = await supabase
            .from('restaurants')
            .update(updateData)
            .eq('id', restaurant.id);

          if (updateError) {
            console.error(`Failed to update ${restaurant.name}:`, updateError.message);
            results.push({ id: restaurant.id, name: restaurant.name, status: 'update_failed' });
            failed++;
          } else {
            console.log(`Enriched: ${restaurant.name} - Hours: ${place.opening_hours ? 'yes' : 'no'}`);
            results.push({
              id: restaurant.id,
              name: restaurant.name,
              status: 'enriched',
              rating: place.rating,
              reviews: place.user_ratings_total,
            });
            enriched++;
          }
        } else {
          // No useful data returned
          if (mode === 'opening_hours_only') {
            // Google had de plek wel, maar geen openingstijden — sentinel zodat we niet
            // elke run dezelfde 25 restaurants blijven opvragen.
            await supabase.from('restaurants')
              .update({ opening_hours: { _no_hours_from_google: true, _tried_at: new Date().toISOString() } })
              .eq('id', restaurant.id);
            results.push({ id: restaurant.id, name: restaurant.name, status: 'no_hours' });
          } else {
            await supabase.from('restaurants').update({ google_rating: 0, google_reviews_count: 0 }).eq('id', restaurant.id);
            results.push({ id: restaurant.id, name: restaurant.name, status: 'no_data' });
          }
          failed++;
        }

        // Rate limit delay
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (err) {
        console.error(`Error enriching ${restaurant.name}:`, err);
        results.push({ id: restaurant.id, name: restaurant.name, status: 'error' });
        failed++;
      }
    }

    const remaining = (totalRemaining || 0) - restaurants.length;

    return new Response(
      JSON.stringify({
        mode,
        enriched,
        failed,
        total: restaurants.length,
        remaining: Math.max(0, remaining),
        nextOffset: offset + batchSize,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Enrich error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
