import { createClient } from "https://esm.sh/@supabase/supabase-js@2.118.0";
import { geocodeWithPdok } from "../_shared/pdokGeocode.ts";
import { restaurantFromOverture } from "../_shared/overtureRestaurant.ts";

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

    let created = false;
    if (discoveryResultId && !existingRestaurantId) {
      const { data: dr, error: drErr } = await admin
        .from('discovery_results')
        .select('id, source, external_id, name, address, postcode, lat, lng, website, phone, city_id, status')
        .eq('id', discoveryResultId)
        .single();
      if (drErr || !dr) throw new Error('Discovery result niet gevonden');

      // Google rows hold names, addresses, coordinates and ratings copied from Google Places,
      // which the Google Maps Platform EEA terms do not allow us to store, so they cannot
      // become restaurants (docs/google-places-compliance.md). Overture rows can.
      if (dr.source !== 'overture') {
        return new Response(JSON.stringify({
          success: false,
          disabled: true,
          error: 'Goedkeuren uit Google-discovery is gestopt vanwege de Google-voorwaarden. Importeer deze stad via Overture.',
        }), { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      if (!dr.external_id) throw new Error('Overture-kandidaat zonder overture_id');

      const { data: existing } = await admin
        .from('restaurants')
        .select('id')
        .eq('overture_id', dr.external_id)
        .maybeSingle();

      if (existing) {
        restaurantId = existing.id;
        await admin.from('discovery_results').update({
          status: 'duplicate',
          matched_restaurant_id: existing.id,
          reviewed_at: new Date().toISOString(),
          reviewed_by: userRes.user.id,
        }).eq('id', dr.id);
        steps.push({ step: 'create_restaurant', ok: true, detail: 'Bestond al (zelfde Overture-plek)' });
      } else {
        const { data: city } = await admin.from('cities').select('name').eq('id', dr.city_id).maybeSingle();
        const geo = await geocodeWithPdok({ address: dr.address, postalCode: dr.postcode, city: city?.name ?? null })
          .catch((e) => ({ ok: false as const, reason: `pdok_error: ${e?.message ?? e}` }));
        steps.push({ step: 'geocode', ok: geo.ok, detail: geo.ok ? 'PDOK/BAG' : `Overture-coördinaten gebruikt (${geo.reason})` });

        const row = restaurantFromOverture(dr, city?.name ?? null, geo);
        const { data: ins, error: insErr } = await admin.from('restaurants').insert(row).select('id').single();
        if (insErr) throw new Error(`Insert restaurant: ${insErr.message}`);
        restaurantId = ins.id;
        created = true;

        await admin.from('discovery_results').update({
          status: 'approved',
          matched_restaurant_id: ins.id,
          reviewed_at: new Date().toISOString(),
          reviewed_by: userRes.user.id,
        }).eq('id', dr.id);
        steps.push({ step: 'create_restaurant', ok: true, detail: 'Aangemaakt uit Overture' });
      }
    } else {
      if (!existingRestaurantId) throw new Error('discoveryResultId of restaurantId vereist');
      restaurantId = existingRestaurantId;
      steps.push({ step: 'create_restaurant', ok: true, detail: 'Using existing restaurant' });
    }

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
      .select('cuisines, address, geo_lat, city_id')
      .eq('id', restaurantId!)
      .single();

    const hasMinimum = finalRest && finalRest.address && finalRest.address !== 'Onbekend' && finalRest.geo_lat;
    if (hasMinimum) {
      await admin.from('restaurants').update({ is_active: true }).eq('id', restaurantId!);
      // A city created by an Overture import starts inactive so no empty city page goes live;
      // it switches on with its first active restaurant that has dishes (listable restaurants
      // need an approved dish, so a city without any would show an empty page).
      if (finalRest.city_id && dishesAdded > 0) {
        await admin.from('cities').update({ is_active: true }).eq('id', finalRest.city_id).eq('is_active', false);
      }
      steps.push({ step: 'activate', ok: true, detail: 'Geactiveerd' });
    } else {
      steps.push({ step: 'activate', ok: false, detail: 'Onvoldoende data, blijft inactief' });
    }

    return new Response(JSON.stringify({
      success: true,
      restaurantId,
      created,
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