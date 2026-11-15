import { createClient } from "https://esm.sh/@supabase/supabase-js@2.118.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Step {
  step: string;
  ok: boolean;
  detail?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const steps: Step[] = [];
  let restaurantId: string | null = null;

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const admin = createClient(supabaseUrl, serviceKey);
    const userClient = createClient(supabaseUrl, anonKey);

    // Auth: must be admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Authorization required' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: userRes } = await userClient.auth.getUser(token);
    if (!userRes.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    const { data: roleRow } = await admin
      .from('user_roles')
      .select('role')
      .eq('user_id', userRes.user.id)
      .eq('role', 'admin')
      .maybeSingle();
    if (!roleRow) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const body = await req.json().catch(() => ({}));
    const { discoveryResultId, restaurantId: existingRestaurantId } = body;

    // Creating restaurants from discovery_results is stopped: those rows hold names,
    // addresses, coordinates and ratings copied from Google Places, which the Google Maps
    // Platform EEA terms do not allow us to store (docs/google-places-compliance.md).
    // The pipeline still runs for existing restaurants without calling Google.
    if (discoveryResultId && !existingRestaurantId) {
      return new Response(JSON.stringify({
        success: false,
        disabled: true,
        error: 'Goedkeuren uit Google-discovery is gestopt vanwege de Google-voorwaarden. Discovery komt terug op Overture Maps.',
      }), { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (!existingRestaurantId) throw new Error('restaurantId vereist');
    restaurantId = existingRestaurantId;
    steps.push({ step: 'create_restaurant', ok: true, detail: 'Using existing restaurant' });

    const { data: rest } = await admin
      .from('restaurants')
      .select('website_url')
      .eq('id', restaurantId!)
      .single();
    const websiteUrl: string | null = rest?.website_url || null;

    // ============================================
    // STEP 3: AI classify (cuisines/ambiance)
    // ============================================
    try {
      const classifyRes = await fetch(`${supabaseUrl}/functions/v1/classify-restaurants`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${serviceKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ batch_size: 5 }),
      });
      const classifyData = await classifyRes.json().catch(() => ({}));
      steps.push({
        step: 'classify',
        ok: classifyRes.ok,
        detail: classifyRes.ok ? `Classified` : `${classifyRes.status}: ${JSON.stringify(classifyData).slice(0, 150)}`,
      });
    } catch (e: any) {
      steps.push({ step: 'classify', ok: false, detail: e.message });
    }

    // ============================================
    // STEP 4: Scrape menu (only if website found)
    // ============================================
    let dishesAdded = 0;
    if (websiteUrl) {
      try {
        const scrapeRes = await fetch(`${supabaseUrl}/functions/v1/scrape-menu`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${serviceKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ restaurantId, websiteUrl }),
        });
        const scrapeData = await scrapeRes.json().catch(() => ({}));
        dishesAdded = scrapeData?.results?.added ?? scrapeData?.added ?? 0;
        steps.push({
          step: 'scrape_menu',
          ok: scrapeRes.ok && scrapeData?.success !== false,
          detail: `${dishesAdded} gerechten toegevoegd`,
        });
      } catch (e: any) {
        steps.push({ step: 'scrape_menu', ok: false, detail: e.message });
      }
    } else {
      steps.push({ step: 'scrape_menu', ok: false, detail: 'Geen website gevonden' });
    }

    // ============================================
    // STEP 4c: Detect reservation links (Zenchef, TheFork, OpenTable, ...)
    // ============================================
    if (websiteUrl) {
      try {
        const resvRes = await fetch(`${supabaseUrl}/functions/v1/detect-reservation-links`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${serviceKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ restaurantId, forceRefresh: true }),
        });
        const resvData = await resvRes.json().catch(() => ({}));
        const found = resvData?.results?.[0];
        steps.push({
          step: 'detect_reservation',
          ok: resvRes.ok && found?.status === 'found',
          detail: found?.status === 'found' ? `${found.provider}` : (found?.status || 'no_provider'),
        });
      } catch (e: any) {
        steps.push({ step: 'detect_reservation', ok: false, detail: e.message });
      }
    }

    // ============================================
    // STEP 5: Activate if enriched + classified
    // ============================================
    const { data: finalRest } = await admin
      .from('restaurants')
      .select('cuisines, address, geo_lat')
      .eq('id', restaurantId!)
      .single();

    const hasMinimum = finalRest && finalRest.address && finalRest.address !== 'Onbekend' && finalRest.geo_lat;
    if (hasMinimum) {
      await admin.from('restaurants').update({ is_active: true }).eq('id', restaurantId!);
      steps.push({ step: 'activate', ok: true, detail: 'Geactiveerd' });
    } else {
      steps.push({ step: 'activate', ok: false, detail: 'Onvoldoende data, blijft inactief' });
    }

    return new Response(JSON.stringify({
      success: true,
      restaurantId,
      created: false,
      dishesAdded,
      steps,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    console.error('approve-discovery-restaurant error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Unknown error',
      restaurantId,
      steps,
    }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});