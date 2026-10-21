import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { enforceRateLimit } from "../_shared/rateLimit.ts";
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface FetchPhotosRequest {
  place_id?: string;
  photo_references?: string[];
  restaurant_id: string;
  max_photos?: number;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const __rl = await enforceRateLimit(req, {
    functionName: "fetch-google-photos",
    isAi: false,
    user: { max: 30, window: 1800 },
    anon: { max: 5, window: 3600 },
  });
  if (!__rl.allowed && __rl.response) return __rl.response;

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const apiKey = Deno.env.get('GOOGLE_PLACES_API_KEY');

    if (!apiKey) {
      console.error('GOOGLE_PLACES_API_KEY not configured');
      throw new Error('Google Places API key not configured');
    }

    // Auth check
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
    const authHeader = req.headers.get('Authorization');
    
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use service role client for storage operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { place_id, photo_references, restaurant_id, max_photos = 5 }: FetchPhotosRequest = await req.json();
    
    if (!restaurant_id) {
      throw new Error('restaurant_id is required');
    }

    // Authorization: allow admins, restaurant managers, or users with a claim request for this restaurant
    const { data: isAdmin } = await supabaseAdmin.rpc('has_role', { _user_id: user.id, _role: 'admin' });
    let allowed = !!isAdmin;
    if (!allowed) {
      const { data: mgr } = await supabaseAdmin
        .from('restaurant_managers')
        .select('id')
        .eq('user_id', user.id)
        .eq('restaurant_id', restaurant_id)
        .maybeSingle();
      if (mgr) allowed = true;
    }
    if (!allowed) {
      // A claimant (not yet verified) may only add the first photos to a restaurant
      // that has none yet and is not owned by someone else — never replace existing photos.
      const { data: claim } = await supabaseAdmin
        .from('claim_requests')
        .select('id')
        .eq('user_id', user.id)
        .eq('restaurant_id', restaurant_id)
        .maybeSingle();
      if (claim) {
        const { data: rest } = await supabaseAdmin
          .from('restaurants')
          .select('images, claimed_by_owner_id')
          .eq('id', restaurant_id)
          .maybeSingle();
        const hasImages = Array.isArray(rest?.images) && rest!.images.length > 0;
        const ownedByOther = !!rest?.claimed_by_owner_id && rest.claimed_by_owner_id !== user.id;
        if (rest && !hasImages && !ownedByOther) allowed = true;
      }
    }
    if (!allowed) {
      return new Response(
        JSON.stringify({ error: 'Forbidden: no access to this restaurant' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let photoRefs: string[] = photo_references || [];

    // If place_id is provided but no photo_references, fetch them from Google Places
    if (place_id && photoRefs.length === 0) {
      console.log('Fetching photo references from Google Places for:', place_id);
      
      const detailsUrl = new URL('https://maps.googleapis.com/maps/api/place/details/json');
      detailsUrl.searchParams.set('place_id', place_id);
      detailsUrl.searchParams.set('fields', 'photos');
      detailsUrl.searchParams.set('key', apiKey);

      const detailsResponse = await fetch(detailsUrl.toString());
      const detailsData = await detailsResponse.json();

      if (detailsData.status === 'OK' && detailsData.result?.photos) {
        photoRefs = detailsData.result.photos
          .slice(0, max_photos)
          .map((photo: { photo_reference: string }) => photo.photo_reference);
      }
    }

    if (photoRefs.length === 0) {
      console.log('No photos found for restaurant:', restaurant_id);
      return new Response(
        JSON.stringify({ success: true, images: [], message: 'No photos found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Fetching ${photoRefs.length} photos for restaurant:`, restaurant_id);

    const uploadedImages: string[] = [];

    for (let i = 0; i < photoRefs.length; i++) {
      const photoRef = photoRefs[i];
      
      try {
        // Fetch the actual photo from Google Places API
        const photoUrl = new URL('https://maps.googleapis.com/maps/api/place/photo');
        photoUrl.searchParams.set('photoreference', photoRef);
        photoUrl.searchParams.set('maxwidth', '1920');
        photoUrl.searchParams.set('maxheight', '1080');
        photoUrl.searchParams.set('key', apiKey);

        console.log(`Downloading photo ${i + 1}/${photoRefs.length}`);
        
        const photoResponse = await fetch(photoUrl.toString());
        
        if (!photoResponse.ok) {
          console.error(`Failed to fetch photo ${i + 1}:`, photoResponse.status);
          continue;
        }

        const photoBlob = await photoResponse.blob();
        const photoBuffer = await photoBlob.arrayBuffer();
        
        // Generate unique filename
        const timestamp = Date.now();
        const fileName = `${restaurant_id}/${timestamp}-${i}.jpg`;

        // Upload to Supabase Storage
        const { error: uploadError } = await supabaseAdmin.storage
          .from('restaurant-images')
          .upload(fileName, photoBuffer, {
            contentType: 'image/jpeg',
            upsert: false
          });

        if (uploadError) {
          console.error(`Failed to upload photo ${i + 1}:`, uploadError.message);
          continue;
        }

        // Get public URL
        const { data: { publicUrl } } = supabaseAdmin.storage
          .from('restaurant-images')
          .getPublicUrl(fileName);

        uploadedImages.push(publicUrl);
        console.log(`Uploaded photo ${i + 1}: ${publicUrl}`);
        
      } catch (photoError) {
        console.error(`Error processing photo ${i + 1}:`, photoError);
        continue;
      }
    }

    // Always mark photos_fetched_at so admins can filter "never fetched"
    await supabaseAdmin
      .from('restaurants')
      .update({ photos_fetched_at: new Date().toISOString() })
      .eq('id', restaurant_id);

    // Update restaurant with new images
    if (uploadedImages.length > 0) {
      // Get existing images
      const { data: restaurant } = await supabaseAdmin
        .from('restaurants')
        .select('images')
        .eq('id', restaurant_id)
        .single();

      const existingImages = restaurant?.images || [];
      const allImages = [...existingImages, ...uploadedImages];

      // Update restaurant
      const { error: updateError } = await supabaseAdmin
        .from('restaurants')
        .update({ images: allImages })
        .eq('id', restaurant_id);

      if (updateError) {
        console.error('Failed to update restaurant images:', updateError);
        throw new Error('Failed to update restaurant with new images');
      }

      console.log(`Successfully added ${uploadedImages.length} images to restaurant ${restaurant_id}`);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        images: uploadedImages,
        count: uploadedImages.length 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in fetch-google-photos:', error);
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
