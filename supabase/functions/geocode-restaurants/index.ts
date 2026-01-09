import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authorization
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const googleApiKey = Deno.env.get("GOOGLE_PLACES_API_KEY");

    if (!googleApiKey) {
      return new Response(
        JSON.stringify({ error: "Google Places API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify user is admin
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check admin role
    const { data: roleData } = await supabaseClient
      .rpc("has_role", { _user_id: user.id, _role: "admin" });
    
    if (!roleData) {
      return new Response(
        JSON.stringify({ error: "Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const { restaurantId, all } = await req.json();

    // Use service role for updates
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    let restaurantsToGeocode: any[] = [];

    if (restaurantId) {
      // Geocode specific restaurant
      const { data, error } = await adminClient
        .from("restaurants")
        .select("id, name, address, postal_code, cities(name)")
        .eq("id", restaurantId)
        .single();

      if (error || !data) {
        return new Response(
          JSON.stringify({ error: "Restaurant not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      restaurantsToGeocode = [data];
    } else if (all) {
      // Geocode all restaurants without coordinates
      const { data, error } = await adminClient
        .from("restaurants")
        .select("id, name, address, postal_code, cities(name)")
        .or("geo_lat.is.null,geo_lng.is.null")
        .eq("is_active", true)
        .limit(50); // Process in batches to avoid timeouts

      if (error) {
        console.error("Error fetching restaurants:", error);
        return new Response(
          JSON.stringify({ error: "Failed to fetch restaurants" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      restaurantsToGeocode = data || [];
    } else {
      return new Response(
        JSON.stringify({ error: "Provide restaurantId or set all: true" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Geocoding ${restaurantsToGeocode.length} restaurants`);

    const results: { id: string; name: string; status: string; lat?: number; lng?: number }[] = [];

    for (const restaurant of restaurantsToGeocode) {
      const cityName = restaurant.cities?.name || "";
      const fullAddress = `${restaurant.address}, ${restaurant.postal_code || ""} ${cityName}, Netherlands`;
      
      console.log(`Geocoding: ${restaurant.name} - ${fullAddress}`);

      try {
        // Use Google Geocoding API
        const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(fullAddress)}&key=${googleApiKey}`;
        const geocodeRes = await fetch(geocodeUrl);
        const geocodeData = await geocodeRes.json();

        if (geocodeData.status === "OK" && geocodeData.results.length > 0) {
          const location = geocodeData.results[0].geometry.location;
          const lat = location.lat;
          const lng = location.lng;

          // Update restaurant with coordinates
          const { error: updateError } = await adminClient
            .from("restaurants")
            .update({ geo_lat: lat, geo_lng: lng })
            .eq("id", restaurant.id);

          if (updateError) {
            console.error(`Failed to update ${restaurant.name}:`, updateError);
            results.push({ id: restaurant.id, name: restaurant.name, status: "update_failed" });
          } else {
            console.log(`Updated ${restaurant.name}: ${lat}, ${lng}`);
            results.push({ id: restaurant.id, name: restaurant.name, status: "success", lat, lng });
          }
        } else {
          console.warn(`No results for ${restaurant.name}: ${geocodeData.status}`);
          results.push({ id: restaurant.id, name: restaurant.name, status: `geocode_failed: ${geocodeData.status}` });
        }

        // Small delay to respect rate limits
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (err) {
        console.error(`Error geocoding ${restaurant.name}:`, err);
        results.push({ id: restaurant.id, name: restaurant.name, status: "error" });
      }
    }

    const successCount = results.filter((r) => r.status === "success").length;
    const failedCount = results.length - successCount;

    console.log(`Geocoding complete: ${successCount} success, ${failedCount} failed`);

    return new Response(
      JSON.stringify({
        processed: results.length,
        success: successCount,
        failed: failedCount,
        results,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Geocode function error:", error);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
