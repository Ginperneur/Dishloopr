import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.118.0";
import { enforceRateLimit } from "../_shared/rateLimit.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Google Maps Platform EEA terms: results may be shown during the search, but only place_id
// may be stored. We therefore request only the fields an owner needs to recognise and confirm
// their restaurant, and no ratings, opening hours, photos or coordinates
// (docs/google-places-compliance.md).
interface PlaceSearchRequest {
  query: string;
  city?: string;
  includeLocal?: boolean; // Whether to also search local database
  includeGoogle?: boolean; // false = local database only
}

interface PlaceDetailsResult {
  place_id: string;
  name: string;
  formatted_address: string;
  formatted_phone_number?: string;
  website?: string;
}

interface LocalRestaurant {
  place_id: string;
  name: string;
  address: string;
  geo_lat: number | null | undefined;
  geo_lng: number | null | undefined;
  phone: string | null | undefined;
  website: string | null | undefined;
  rating: number | null | undefined;
  review_count: number | null | undefined;
  price_level: number;
  is_local: boolean;
  restaurant_id?: string;
  claim_status?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Rate limit: betaalde Google API
    const rl = await enforceRateLimit(req, {
      functionName: "google-places-search",
      user: { max: 60, window: 3600 },
      anon: { max: 15, window: 3600 },
    });
    if (!rl.allowed && rl.response) return rl.response;

    // Create Supabase client with service role for database access
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Create Supabase client for auth
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('No authorization header provided');
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    
    if (authError || !user) {
      console.error('Authentication failed:', authError?.message);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Authenticated user:', user.id);

    const { query, city, includeLocal = true, includeGoogle = true }: PlaceSearchRequest = await req.json();
    
    if (!query) {
      throw new Error('Query is required');
    }

    console.log('Searching for:', query, 'in city:', city || 'all');

    // Step 1: FIRST search local database for existing restaurants
    let localResults: LocalRestaurant[] = [];
    
    if (includeLocal) {
      console.log('Searching local database first...');
      
      // Build query for local restaurants
      let dbQuery = supabaseAdmin
        .from('restaurants')
        .select(`
          id,
          name,
          address,
          geo_lat,
          geo_lng,
          phone,
          website_url,
          rating,
          review_count,
          price_level,
          claim_status,
          city_id,
          cities!inner(name)
        `)
        .eq('is_active', true)
        .ilike('name', `%${query}%`);

      // Filter by city if provided
      if (city) {
        dbQuery = dbQuery.ilike('cities.name', `%${city}%`);
      }

      const { data: localData, error: localError } = await dbQuery.limit(10);

      if (localError) {
        console.error('Error searching local database:', localError);
      } else if (localData && localData.length > 0) {
        console.log(`Found ${localData.length} local results`);
        localResults = localData.map((r: any) => ({
          place_id: `local_${r.id}`,
          name: r.name,
          address: r.address,
          geo_lat: r.geo_lat,
          geo_lng: r.geo_lng,
          phone: r.phone,
          website: r.website_url,
          rating: r.rating,
          review_count: r.review_count,
          price_level: r.price_level,
          is_local: true,
          restaurant_id: r.id,
          claim_status: r.claim_status,
        }));
      }
    }

    // If we found local results, return them first
    // We still search Google to provide additional options
    const apiKey = Deno.env.get('GOOGLE_PLACES_API_KEY');
    
    // If no API key or the caller wants local results only
    if (!apiKey || !includeGoogle) {
      console.log('No Google Places API key, returning only local results');
      return new Response(
        JSON.stringify({ results: localResults }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const searchQuery = city ? `${query} restaurant ${city} Netherlands` : `${query} restaurant Netherlands`;
    console.log('Searching Google Places for:', searchQuery);

    // Step 2: Text Search to find places
    const searchUrl = new URL('https://maps.googleapis.com/maps/api/place/textsearch/json');
    searchUrl.searchParams.set('query', searchQuery);
    searchUrl.searchParams.set('type', 'restaurant');
    searchUrl.searchParams.set('key', apiKey);
    searchUrl.searchParams.set('language', 'nl');
    searchUrl.searchParams.set('region', 'nl');

    const searchResponse = await fetch(searchUrl.toString());
    const searchData = await searchResponse.json();

    console.log('Google Search response status:', searchData.status);

    if (searchData.status !== 'OK' && searchData.status !== 'ZERO_RESULTS') {
      console.error('Google Places Search error:', searchData);
      // Return local results only if Google fails
      if (localResults.length > 0) {
        return new Response(
          JSON.stringify({ results: localResults }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw new Error(`Google Places API error: ${searchData.status}`);
    }

    if (!searchData.results || searchData.results.length === 0) {
      // Return local results only
      return new Response(
        JSON.stringify({ results: localResults, message: localResults.length > 0 ? 'Found in local database' : 'No restaurants found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 3: Get details for top 5 Google results
    const topResults = searchData.results.slice(0, 5);
    const detailedResults: PlaceDetailsResult[] = [];

    for (const place of topResults) {
      try {
        const detailsUrl = new URL('https://maps.googleapis.com/maps/api/place/details/json');
        detailsUrl.searchParams.set('place_id', place.place_id);
        detailsUrl.searchParams.set('fields', 'place_id,name,formatted_address,formatted_phone_number,website');
        detailsUrl.searchParams.set('key', apiKey);
        detailsUrl.searchParams.set('language', 'nl');

        const detailsResponse = await fetch(detailsUrl.toString());
        const detailsData = await detailsResponse.json();

        if (detailsData.status === 'OK' && detailsData.result) {
          detailedResults.push(detailsData.result);
        }
      } catch (detailError) {
        console.error('Error fetching details for place:', place.place_id, detailError);
        // Continue with other results
      }
    }

    console.log(`Found ${detailedResults.length} Google detailed results`);

    // Transform Google results to our format
    const googleResults = detailedResults.map((place) => ({
      place_id: place.place_id,
      name: place.name,
      address: place.formatted_address,
      phone: place.formatted_phone_number ?? null,
      website: place.website ?? null,
      is_local: false,
    }));

    // Merge results: local results first, then Google results (avoiding duplicates)
    const allResults: Array<LocalRestaurant | (typeof googleResults)[number]> = [...localResults];
    
    for (const googleResult of googleResults) {
      // Check if this Google result matches any local result by name similarity
      const isDuplicate = localResults.some(local => 
        local.name.toLowerCase().includes(googleResult.name.toLowerCase()) ||
        googleResult.name.toLowerCase().includes(local.name.toLowerCase())
      );
      
      if (!isDuplicate) {
        allResults.push(googleResult);
      }
    }

    return new Response(
      JSON.stringify({ results: allResults }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in google-places-search:', error);
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
