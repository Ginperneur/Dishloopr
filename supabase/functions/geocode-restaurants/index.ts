import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.118.0";
import { geocodeWithPdok } from "../_shared/pdokGeocode.ts";

// Geocodes via PDOK Locatieserver (BAG). The Google Geocoding API was dropped because its
// coordinates may not be stored longer than 30 days (docs/google-places-compliance.md).

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
    const { restaurantId: singleId, restaurant_ids, all } = await req.json();
    const restaurantId = singleId ?? (Array.isArray(restaurant_ids) ? restaurant_ids[0] : undefined);

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
      console.log(`Geocoding: ${restaurant.name}`);

      try {
        const geo = await geocodeWithPdok({
          address: restaurant.address,
          postalCode: restaurant.postal_code,
          city: cityName,
        });

        if (geo.ok) {
          const { lat, lng } = geo;
          const { error: updateError } = await adminClient
            .from("restaurants")
            .update({ geo_lat: lat, geo_lng: lng })
            .eq("id", restaurant.id);

          if (updateError) {
            console.error(`Failed to update ${restaurant.name}:`, updateError);
            results.push({ id: restaurant.id, name: restaurant.name, status: "update_failed" });
          } else {
            results.push({ id: restaurant.id, name: restaurant.name, status: "success", lat, lng });
          }
        } else {
          console.warn(`No PDOK match for ${restaurant.name}: ${geo.reason}`);
          results.push({ id: restaurant.id, name: restaurant.name, status: `geocode_failed: ${geo.reason}` });
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
        geocoded: successCount,
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
