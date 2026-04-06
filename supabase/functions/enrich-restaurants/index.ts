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

    const body = await req.json().catch(() => ({}));
    const batchSize = body.batchSize || 25;
    const offset = body.offset || 0;
    const forceRefresh = body.forceRefresh || false;

    // Fetch restaurants that need enrichment (google_rating IS NULL, not 0)
    let query = supabase
      .from('restaurants')
      .select('id, name, address, city_id, cities(name), google_rating, opening_hours')
      .eq('is_active', true)
      .order('name');

    if (!forceRefresh) {
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
    if (!forceRefresh) {
      countQuery = countQuery.is('google_rating', null);
    }
    const { count: totalRemaining } = await countQuery;

    console.log(`Enriching batch of ${restaurants.length} restaurants (offset: ${offset}, total remaining: ${totalRemaining})`);

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

        // Use Text Search
        const searchUrl = new URL('https://maps.googleapis.com/maps/api/place/textsearch/json');
        searchUrl.searchParams.set('query', searchQuery);
        searchUrl.searchParams.set('key', googleApiKey);
        searchUrl.searchParams.set('language', 'nl');
        searchUrl.searchParams.set('region', 'nl');

        const searchResponse = await fetch(searchUrl.toString());
        const searchData = await searchResponse.json();

        if (searchData.status !== 'OK' || !searchData.results?.length) {
          console.log(`No Google result for: ${restaurant.name} (status: ${searchData.status}, error: ${searchData.error_message || 'none'})`);
          // Mark as attempted so we skip next time
          await supabase
            .from('restaurants')
            .update({ google_rating: 0, google_reviews_count: 0 })
            .eq('id', restaurant.id);
          results.push({ id: restaurant.id, name: restaurant.name, status: 'not_found' });
          failed++;
          continue;
        }

        const placeId = searchData.results[0].place_id;
        const detailsUrl = new URL('https://maps.googleapis.com/maps/api/place/details/json');
        detailsUrl.searchParams.set('place_id', placeId);
        detailsUrl.searchParams.set('fields', 'rating,user_ratings_total,opening_hours,price_level,formatted_phone_number,website');
        detailsUrl.searchParams.set('key', googleApiKey);
        detailsUrl.searchParams.set('language', 'nl');

        const detailsResponse = await fetch(detailsUrl.toString());
        const detailsData = await detailsResponse.json();

        if (detailsData.status !== 'OK' || !detailsData.result) {
          console.log(`No details for: ${restaurant.name} (status: ${detailsData.status})`);
          await supabase
            .from('restaurants')
            .update({ google_rating: 0, google_reviews_count: 0 })
            .eq('id', restaurant.id);
          results.push({ id: restaurant.id, name: restaurant.name, status: 'no_details' });
          failed++;
          continue;
        }

        const place = detailsData.result;
        const updateData: Record<string, unknown> = {};

        if (place.rating != null) {
          updateData.google_rating = place.rating;
        }
        if (place.user_ratings_total != null) {
          updateData.google_reviews_count = place.user_ratings_total;
        }
        if (place.opening_hours?.weekday_text && !restaurant.opening_hours) {
          const hoursObj: Record<string, string> = {};
          for (const line of place.opening_hours.weekday_text) {
            const [day, ...timeParts] = line.split(': ');
            hoursObj[day.toLowerCase()] = timeParts.join(': ');
          }
          updateData.opening_hours = hoursObj;
        }
        if (place.price_level != null) {
          updateData.price_level = Math.min(Math.max(place.price_level, 1), 4);
        }

        if (Object.keys(updateData).length > 0) {
          const { error: updateError } = await supabase
            .from('restaurants')
            .update(updateData)
            .eq('id', restaurant.id);

          if (updateError) {
            console.error(`Failed to update ${restaurant.name}:`, updateError.message);
            results.push({ id: restaurant.id, name: restaurant.name, status: 'update_failed' });
            failed++;
          } else {
            console.log(`Enriched: ${restaurant.name} - Rating: ${place.rating}, Reviews: ${place.user_ratings_total}`);
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
          // No data returned even though place was found
          await supabase
            .from('restaurants')
            .update({ google_rating: 0, google_reviews_count: 0 })
            .eq('id', restaurant.id);
          results.push({ id: restaurant.id, name: restaurant.name, status: 'no_data' });
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
