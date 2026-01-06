import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CALCULATE-SPONSORED-PRICE] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: claims, error: authError } = await supabaseClient.auth.getUser(token);
    
    if (authError || !claims?.user) {
      logStep("Auth error", { error: authError?.message });
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    logStep("User authenticated", { userId: claims.user.id });

    const { dishId, cityId, durationDays } = await req.json();
    logStep("Request body", { dishId, cityId, durationDays });

    if (!dishId || !cityId) {
      throw new Error("Missing dishId or cityId");
    }

    const duration = durationDays || 30;

    // Use database function to calculate price
    const { data: price, error } = await supabaseClient.rpc('calculate_sponsored_price', {
      p_dish_id: dishId,
      p_city_id: cityId,
      p_duration_days: duration
    });

    if (error) {
      logStep("RPC Error", { error });
      throw new Error("Could not calculate price");
    }

    // Get additional context for breakdown
    const [dishRes, cityRes, restaurantCountRes] = await Promise.all([
      supabaseClient.from('dishes').select('name, search_count').eq('id', dishId).single(),
      supabaseClient.from('cities').select('name').eq('id', cityId).single(),
      supabaseClient.from('restaurants').select('id', { count: 'exact', head: true }).eq('city_id', cityId).eq('is_active', true)
    ]);

    const dish = dishRes.data;
    const city = cityRes.data;
    const restaurantCount = restaurantCountRes.count || 0;

    // Calculate popularity tier
    const searchCount = dish?.search_count || 0;
    let popularityTier = 'basis';
    if (searchCount > 100 || restaurantCount > 50) {
      popularityTier = 'hoog';
    } else if (searchCount > 50 || restaurantCount > 25) {
      popularityTier = 'gemiddeld';
    }

    const response = {
      price: Number(price),
      breakdown: {
        dishName: dish?.name || 'Onbekend',
        cityName: city?.name || 'Onbekend',
        durationDays: duration,
        popularityTier,
        searchCount,
        restaurantCount,
      }
    };

    logStep("Price calculated", response);

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
