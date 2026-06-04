import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { enforceRateLimit } from "../_shared/rateLimit.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PlaceSearchRequest {
  query: string;
  city?: string;
  includeLocal?: boolean; // Whether to also search local database
}

interface PlaceDetailsResult {
  place_id: string;
  name: string;
  formatted_address: string;
  geometry?: {
    location: {
      lat: number;
      lng: number;
    };
  };
  opening_hours?: {
    weekday_text?: string[];
    periods?: Array<{
      open: { day: number; time: string };
      close?: { day: number; time: string };
    }>;
  };
  formatted_phone_number?: string;
  website?: string;
  rating?: number;
  user_ratings_total?: number;
  price_level?: number;
  photos?: Array<{
    photo_reference: string;
  }>;
}

interface LocalRestaurant {
  id: string;
  name: string;
  address: string;
  geo_lat: number | null;
  geo_lng: number | null;
  phone: string | null;
  website_url: string | null;
  rating: number;
  review_count: number;
  price_level: number;
  claim_status: string;
  is_local: boolean;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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

    const { query, city, includeLocal = true }: PlaceSearchRequest = await req.json();
    
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
          opening_hours: null,
          photo_references: [],
          is_local: true,
          restaurant_id: r.id,
          claim_status: r.claim_status,
        }));
      }
    }

    // If we found local results, return them first
    // We still search Google to provide additional options
    const apiKey = Deno.env.get('GOOGLE_PLACES_API_KEY');
    
    // If no API key, only return local results
    if (!apiKey) {
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
        detailsUrl.searchParams.set('fields', 'place_id,name,formatted_address,geometry,opening_hours,formatted_phone_number,website,rating,user_ratings_total,price_level,photos');
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
      geo_lat: place.geometry?.location?.lat,
      geo_lng: place.geometry?.location?.lng,
      phone: place.formatted_phone_number,
      website: place.website,
      rating: place.rating,
      review_count: place.user_ratings_total,
      price_level: place.price_level ? Math.min(place.price_level, 4) : 2,
      opening_hours: place.opening_hours?.weekday_text || null,
      opening_hours_periods: place.opening_hours?.periods || null,
      photo_reference: place.photos?.[0]?.photo_reference || null,
      photo_references: place.photos?.map(p => p.photo_reference) || [],
      is_local: false,
    }));

    // Merge results: local results first, then Google results (avoiding duplicates)
    const allResults = [...localResults];
    
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
