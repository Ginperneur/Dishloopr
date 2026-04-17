import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DiscoverRequest {
  grid_point_id: string;
}

interface PlaceResult {
  place_id: string;
  name: string;
  vicinity?: string;
  formatted_address?: string;
  geometry?: { location: { lat: number; lng: number } };
  rating?: number;
  user_ratings_total?: number;
  price_level?: number;
  types?: string[];
  photos?: Array<{ photo_reference: string }>;
}

const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

function nameSimilar(a: string, b: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const na = norm(a);
  const nb = norm(b);
  if (!na || !nb) return false;
  return na === nb || na.includes(nb) || nb.includes(na);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Authorization required' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Verify admin
    const { data: roles } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (!roles) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { grid_point_id }: DiscoverRequest = await req.json();
    if (!grid_point_id) {
      return new Response(JSON.stringify({ error: 'grid_point_id required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const apiKey = Deno.env.get('GOOGLE_PLACES_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Google Places API key not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Load grid point
    const { data: gridPoint, error: gpError } = await supabaseAdmin
      .from('discovery_grid_points')
      .select('*')
      .eq('id', grid_point_id)
      .single();

    if (gpError || !gridPoint) {
      return new Response(JSON.stringify({ error: 'Grid point not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Create run
    const { data: run } = await supabaseAdmin
      .from('discovery_runs')
      .insert({
        grid_point_id: gridPoint.id,
        city_id: gridPoint.city_id,
        status: 'running',
        triggered_by: user.id,
      })
      .select()
      .single();

    let allPlaces: PlaceResult[] = [];
    let apiCalls = 0;

    try {
      if (gridPoint.type === 'grid') {
        // Nearby search with pagination
        let nextPageToken: string | undefined;
        let pages = 0;
        do {
          const url = new URL('https://maps.googleapis.com/maps/api/place/nearbysearch/json');
          if (nextPageToken) {
            url.searchParams.set('pagetoken', nextPageToken);
            await sleep(2000); // Required delay before using next_page_token
          } else {
            url.searchParams.set('location', `${gridPoint.lat},${gridPoint.lng}`);
            url.searchParams.set('radius', String(gridPoint.radius_meters));
            url.searchParams.set('type', 'restaurant');
            url.searchParams.set('language', 'nl');
          }
          url.searchParams.set('key', apiKey);

          const res = await fetch(url.toString());
          const data = await res.json();
          apiCalls++;

          if (data.status === 'OK' || data.status === 'ZERO_RESULTS') {
            allPlaces.push(...(data.results || []));
            nextPageToken = data.next_page_token;
          } else {
            console.error('Nearby search failed:', data.status, data.error_message);
            break;
          }
          pages++;
        } while (nextPageToken && pages < 3); // Max 60 results (3 pages × 20)
      } else {
        // Hotspot mode: text search per term
        const terms = gridPoint.search_terms?.length ? gridPoint.search_terms : ['restaurant'];
        for (const term of terms) {
          const query = `${term} ${gridPoint.name} Amsterdam`;
          const url = new URL('https://maps.googleapis.com/maps/api/place/textsearch/json');
          url.searchParams.set('query', query);
          url.searchParams.set('type', 'restaurant');
          url.searchParams.set('language', 'nl');
          url.searchParams.set('region', 'nl');
          url.searchParams.set('key', apiKey);

          const res = await fetch(url.toString());
          const data = await res.json();
          apiCalls++;

          if (data.status === 'OK' || data.status === 'ZERO_RESULTS') {
            const results = (data.results || []).map((r: any) => ({ ...r, _source_term: term }));
            allPlaces.push(...results);
          }
          await sleep(200);
        }
      }

      // Deduplicate by place_id within this batch
      const uniquePlaces = Array.from(
        new Map(allPlaces.map((p) => [p.place_id, p])).values()
      );

      // Get existing place_ids in restaurants and discovery_results
      const placeIds = uniquePlaces.map((p) => p.place_id);
      const [{ data: existingRestaurants }, { data: existingResults }] = await Promise.all([
        supabaseAdmin.from('restaurants').select('id, name, google_place_id').in('google_place_id', placeIds),
        supabaseAdmin.from('discovery_results').select('place_id').in('place_id', placeIds),
      ]);

      const existingResultPlaceIds = new Set((existingResults || []).map((r) => r.place_id));
      const existingRestaurantsByPlaceId = new Map(
        (existingRestaurants || []).map((r) => [r.google_place_id, r])
      );

      // Get all restaurant names in city for fuzzy match
      const { data: cityRestaurants } = await supabaseAdmin
        .from('restaurants')
        .select('id, name')
        .eq('city_id', gridPoint.city_id);

      let newCount = 0;
      let dupCount = 0;
      const inserts: any[] = [];

      for (const place of uniquePlaces) {
        if (existingResultPlaceIds.has(place.place_id)) {
          dupCount++;
          continue;
        }

        let status = 'pending';
        let matchedRestaurantId: string | null = null;

        // Match by place_id
        const byPlaceId = existingRestaurantsByPlaceId.get(place.place_id);
        if (byPlaceId) {
          status = 'duplicate';
          matchedRestaurantId = byPlaceId.id;
        } else {
          // Fuzzy name match
          const fuzzyMatch = (cityRestaurants || []).find((r) => nameSimilar(r.name, place.name));
          if (fuzzyMatch) {
            status = 'duplicate';
            matchedRestaurantId = fuzzyMatch.id;
          }
        }

        inserts.push({
          place_id: place.place_id,
          name: place.name,
          address: place.formatted_address || place.vicinity || null,
          lat: place.geometry?.location?.lat ?? null,
          lng: place.geometry?.location?.lng ?? null,
          rating: place.rating ?? null,
          user_ratings_total: place.user_ratings_total ?? null,
          price_level: place.price_level ?? null,
          types: place.types || [],
          photo_reference: place.photos?.[0]?.photo_reference || null,
          city_id: gridPoint.city_id,
          source_grid_point_id: gridPoint.id,
          source_search_term: (place as any)._source_term || null,
          status,
          matched_restaurant_id: matchedRestaurantId,
          raw_data: place,
        });

        if (status === 'pending') newCount++;
        else dupCount++;
      }

      // Bulk insert
      if (inserts.length > 0) {
        const { error: insErr } = await supabaseAdmin
          .from('discovery_results')
          .insert(inserts);
        if (insErr) {
          console.error('Insert error:', insErr);
          throw insErr;
        }
      }

      // Update grid point last_scanned
      await supabaseAdmin
        .from('discovery_grid_points')
        .update({ last_scanned_at: new Date().toISOString() })
        .eq('id', gridPoint.id);

      // Complete run
      await supabaseAdmin
        .from('discovery_runs')
        .update({
          completed_at: new Date().toISOString(),
          results_found: uniquePlaces.length,
          new_results: newCount,
          duplicates: dupCount,
          api_calls_used: apiCalls,
          status: 'completed',
        })
        .eq('id', run!.id);

      return new Response(JSON.stringify({
        success: true,
        results_found: uniquePlaces.length,
        new_results: newCount,
        duplicates: dupCount,
        api_calls_used: apiCalls,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    } catch (innerErr) {
      const msg = innerErr instanceof Error ? innerErr.message : 'Unknown error';
      await supabaseAdmin
        .from('discovery_runs')
        .update({
          completed_at: new Date().toISOString(),
          status: 'failed',
          error_message: msg,
          api_calls_used: apiCalls,
        })
        .eq('id', run!.id);
      throw innerErr;
    }
  } catch (error) {
    console.error('discover-restaurants error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
