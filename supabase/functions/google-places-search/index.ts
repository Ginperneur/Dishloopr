import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PlaceSearchRequest {
  query: string;
  city?: string;
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

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authentication check - require admin role
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

    // Check if user has admin role using the has_role function
    const { data: hasAdminRole, error: roleError } = await supabaseClient
      .rpc('has_role', { _user_id: user.id, _role: 'admin' });

    if (roleError) {
      console.error('Role check failed:', roleError.message);
      return new Response(
        JSON.stringify({ error: 'Authorization check failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!hasAdminRole) {
      console.error('User is not admin:', user.id);
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Admin user authenticated:', user.id);

    const apiKey = Deno.env.get('GOOGLE_PLACES_API_KEY');
    if (!apiKey) {
      console.error('GOOGLE_PLACES_API_KEY not configured');
      throw new Error('Google Places API key not configured');
    }

    const { query, city }: PlaceSearchRequest = await req.json();
    
    if (!query) {
      throw new Error('Query is required');
    }

    const searchQuery = city ? `${query} restaurant ${city} Netherlands` : `${query} restaurant Netherlands`;
    console.log('Searching for:', searchQuery);

    // Step 1: Text Search to find places
    const searchUrl = new URL('https://maps.googleapis.com/maps/api/place/textsearch/json');
    searchUrl.searchParams.set('query', searchQuery);
    searchUrl.searchParams.set('type', 'restaurant');
    searchUrl.searchParams.set('key', apiKey);
    searchUrl.searchParams.set('language', 'nl');
    searchUrl.searchParams.set('region', 'nl');

    const searchResponse = await fetch(searchUrl.toString());
    const searchData = await searchResponse.json();

    console.log('Search response status:', searchData.status);

    if (searchData.status !== 'OK' && searchData.status !== 'ZERO_RESULTS') {
      console.error('Google Places Search error:', searchData);
      throw new Error(`Google Places API error: ${searchData.status}`);
    }

    if (!searchData.results || searchData.results.length === 0) {
      return new Response(
        JSON.stringify({ results: [], message: 'No restaurants found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 2: Get details for top 5 results
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

    console.log(`Found ${detailedResults.length} detailed results`);

    // Transform results to our format - include ALL photo references
    const transformedResults = detailedResults.map((place) => ({
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
    }));

    return new Response(
      JSON.stringify({ results: transformedResults }),
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
