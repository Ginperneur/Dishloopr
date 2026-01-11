import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY is not configured');
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // Get authorization header to verify admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with user's token
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Verify user is admin
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check admin role
    const { data: roleData, error: roleError } = await supabase.rpc('has_role', {
      _user_id: user.id,
      _role: 'admin'
    });

    if (roleError || !roleData) {
      console.error('Not admin:', roleError);
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const { restaurantId, imageUrl, imageBase64 } = await req.json();
    
    if (!restaurantId) {
      return new Response(
        JSON.stringify({ error: 'restaurantId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!imageUrl && !imageBase64) {
      return new Response(
        JSON.stringify({ error: 'Either imageUrl or imageBase64 is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing menu image for restaurant: ${restaurantId}`);

    // Build the image content for Gemini
    let imageContent: { type: string; image_url?: { url: string }; text?: string };
    
    if (imageBase64) {
      // Base64 image - ensure proper format
      const base64Data = imageBase64.startsWith('data:') 
        ? imageBase64 
        : `data:image/jpeg;base64,${imageBase64}`;
      imageContent = {
        type: "image_url",
        image_url: { url: base64Data }
      };
    } else {
      // Direct URL
      imageContent = {
        type: "image_url",
        image_url: { url: imageUrl }
      };
    }

    // Call Gemini to extract dishes from the image
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `Je bent een expert in het lezen van menukaarten. Analyseer de afbeelding van de menukaart en extraheer ALLE gerechten die je ziet.

BELANGRIJK:
- Extraheer alleen de NAMEN van gerechten (geen prijzen, beschrijvingen of ingrediënten)
- Negeer categorieën, kopjes en secties
- Negeer drankjes, tenzij het specifieke cocktails of speciale dranken zijn
- Focus op hoofdgerechten, voorgerechten, bijgerechten en desserts
- Geef elk gerecht een confidence score (0.0 tot 1.0) gebaseerd op hoe zeker je bent

Retourneer je antwoord als JSON array met objecten die "name" en "confidence" bevatten.`
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Analyseer deze menukaart en extraheer alle gerechten. Retourneer als JSON array: [{"name": "Gerecht Naam", "confidence": 0.95}, ...]'
              },
              imageContent
            ]
          }
        ],
        max_tokens: 4096,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI credits exhausted. Please add more credits.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const aiContent = aiData.choices?.[0]?.message?.content;
    
    if (!aiContent) {
      console.error('No content from AI:', aiData);
      throw new Error('No response from AI');
    }

    console.log('AI response:', aiContent);

    // Parse the AI response - extract JSON from the content
    let dishes: Array<{ name: string; confidence: number }> = [];
    try {
      // Try to find JSON in the response
      const jsonMatch = aiContent.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        dishes = JSON.parse(jsonMatch[0]);
      } else {
        console.error('Could not find JSON array in AI response');
        throw new Error('Invalid AI response format');
      }
    } catch (parseError) {
      console.error('Error parsing AI response:', parseError);
      throw new Error('Failed to parse AI response');
    }

    console.log(`Found ${dishes.length} dishes in image`);

    // Create service role client for database operations
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Process each dish
    const results = {
      added: [] as string[],
      existing: [] as string[],
      errors: [] as string[],
    };

    for (const dish of dishes) {
      try {
        const dishName = dish.name.trim();
        const confidence = dish.confidence || 0.7;
        
        if (!dishName || dishName.length < 2) continue;

        // Create slug
        const slug = dishName
          .toLowerCase()
          .replace(/[^a-z0-9\s-]/g, '')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-')
          .trim();

        if (!slug) continue;

        // Check if dish exists
        const { data: existingDish } = await supabaseAdmin
          .from('dishes')
          .select('id, name')
          .or(`slug.eq.${slug},name.ilike.${dishName}`)
          .maybeSingle();

        let dishId: string;

        if (existingDish) {
          dishId = existingDish.id;
          results.existing.push(dishName);
        } else {
          // Create new dish
          const { data: newDish, error: insertError } = await supabaseAdmin
            .from('dishes')
            .insert({
              name: dishName,
              slug: slug,
              is_active: true,
            })
            .select('id')
            .single();

          if (insertError) {
            console.error(`Error creating dish ${dishName}:`, insertError);
            results.errors.push(dishName);
            continue;
          }

          dishId = newDish.id;
          results.added.push(dishName);
        }

        // Link dish to restaurant
        const { error: linkError } = await supabaseAdmin
          .from('restaurant_dishes')
          .upsert({
            restaurant_id: restaurantId,
            dish_id: dishId,
            status: 'suggested',
            source: 'menu_image',
            confidence_score: confidence,
          }, {
            onConflict: 'restaurant_id,dish_id',
          });

        if (linkError) {
          console.error(`Error linking dish ${dishName}:`, linkError);
        }
      } catch (dishError) {
        console.error(`Error processing dish:`, dishError);
        results.errors.push(dish.name || 'Unknown');
      }
    }

    console.log('Processing complete:', results);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${dishes.length} dishes from menu image`,
        added: results.added,
        existing: results.existing,
        errors: results.errors,
        totalProcessed: dishes.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in parse-menu-image:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
