import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const googleApiKey = Deno.env.get('GOOGLE_PLACES_API_KEY');

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

    let result: any = null;
    let createdRestaurant = false;

    // ============================================
    // STEP 1: Create restaurant from discovery result (or use existing)
    // ============================================
    if (existingRestaurantId) {
      restaurantId = existingRestaurantId;
      steps.push({ step: 'create_restaurant', ok: true, detail: 'Using existing restaurant' });
    } else if (discoveryResultId) {
      const { data: dr, error: drErr } = await admin
        .from('discovery_results')
        .select('*')
        .eq('id', discoveryResultId)
        .single();
      if (drErr || !dr) throw new Error('Discovery result niet gevonden');
      result = dr;

      // Check duplicate by place_id
      const { data: existing } = await admin
        .from('restaurants')
        .select('id')
        .eq('google_place_id', result.place_id)
        .maybeSingle();

      if (existing) {
        restaurantId = existing.id;
        await admin.from('discovery_results').update({
          status: 'duplicate',
          matched_restaurant_id: existing.id,
          reviewed_at: new Date().toISOString(),
        }).eq('id', result.id);
        steps.push({ step: 'create_restaurant', ok: true, detail: 'Already exists, reusing' });
      } else {
        const baseSlug = result.name.toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '')
          .slice(0, 60);
        const slug = `${baseSlug}-${result.place_id.slice(-6)}`;

        const { data: ins, error: insErr } = await admin.from('restaurants').insert({
          name: result.name,
          slug,
          address: result.address || 'Onbekend',
          city_id: result.city_id,
          google_place_id: result.place_id,
          geo_lat: result.lat,
          geo_lng: result.lng,
          google_rating: result.rating,
          google_reviews_count: result.user_ratings_total,
          price_level: result.price_level || 2,
          is_active: false,
          added_by_source: 'discovery',
        }).select('id').single();

        if (insErr) throw new Error(`Insert restaurant: ${insErr.message}`);
        restaurantId = ins.id;
        createdRestaurant = true;

        await admin.from('discovery_results').update({
          status: 'approved',
          matched_restaurant_id: ins.id,
          reviewed_at: new Date().toISOString(),
        }).eq('id', result.id);

        steps.push({ step: 'create_restaurant', ok: true, detail: 'Created' });
      }
    } else {
      throw new Error('discoveryResultId of restaurantId vereist');
    }

    // ============================================
    // STEP 2: Enrich via Google Place Details
    // ============================================
    let websiteUrl: string | null = null;
    if (googleApiKey) {
      try {
        const { data: rest } = await admin
          .from('restaurants')
          .select('google_place_id, website_url, phone, opening_hours')
          .eq('id', restaurantId!)
          .single();

        if (rest?.google_place_id) {
          const fields = 'name,formatted_address,formatted_phone_number,website,opening_hours,photos,price_level,rating,user_ratings_total,geometry,types';
          const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${rest.google_place_id}&fields=${fields}&language=nl&key=${googleApiKey}`;
          const detRes = await fetch(url);
          const detData = await detRes.json();

          if (detData.status === 'OK' && detData.result) {
            const r = detData.result;
            const updates: any = {};
            if (r.website && !rest.website_url) updates.website_url = r.website;
            if (r.formatted_phone_number && !rest.phone) updates.phone = r.formatted_phone_number;
            if (r.opening_hours?.weekday_text && !rest.opening_hours) {
              updates.opening_hours = { weekday_text: r.opening_hours.weekday_text };
            }
            if (r.rating) updates.google_rating = r.rating;
            if (r.user_ratings_total) updates.google_reviews_count = r.user_ratings_total;
            if (r.price_level !== undefined) updates.price_level = r.price_level;
            if (r.geometry?.location) {
              updates.geo_lat = r.geometry.location.lat;
              updates.geo_lng = r.geometry.location.lng;
            }

            if (Object.keys(updates).length > 0) {
              await admin.from('restaurants').update(updates).eq('id', restaurantId!);
            }
            websiteUrl = r.website || rest.website_url || null;
            steps.push({ step: 'enrich', ok: true, detail: `Website: ${websiteUrl ? 'yes' : 'no'}, hours: ${r.opening_hours ? 'yes' : 'no'}` });
          } else {
            steps.push({ step: 'enrich', ok: false, detail: `Google: ${detData.status}` });
          }
        }
      } catch (e: any) {
        steps.push({ step: 'enrich', ok: false, detail: e.message });
      }
    } else {
      steps.push({ step: 'enrich', ok: false, detail: 'No Google API key' });
    }

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
    // STEP 4b: Fetch Google photos (if none yet)
    // ============================================
    try {
      const { data: restPhotos } = await admin
        .from('restaurants')
        .select('images, google_place_id')
        .eq('id', restaurantId!)
        .single();

      const hasImages = Array.isArray(restPhotos?.images) && restPhotos!.images.length > 0;
      if (!hasImages && restPhotos?.google_place_id) {
        const photosRes = await fetch(`${supabaseUrl}/functions/v1/fetch-google-photos`, {
          method: 'POST',
          headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            place_id: restPhotos.google_place_id,
            restaurant_id: restaurantId,
            max_photos: 6,
          }),
        });
        const photosData = await photosRes.json().catch(() => ({}));
        const count = photosData?.count ?? photosData?.images?.length ?? 0;
        steps.push({
          step: 'fetch_photos',
          ok: photosRes.ok && count > 0,
          detail: `${count} foto's toegevoegd`,
        });
      } else {
        steps.push({
          step: 'fetch_photos',
          ok: true,
          detail: hasImages ? 'Heeft al foto\'s' : 'Geen place_id',
        });
      }
    } catch (e: any) {
      steps.push({ step: 'fetch_photos', ok: false, detail: e.message });
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
      created: createdRestaurant,
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