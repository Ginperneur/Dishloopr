/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify webhook secret
    const webhookSecret = req.headers.get('x-webhook-secret');
    const expectedSecret = Deno.env.get('N8N_WEBHOOK_SECRET');
    
    if (!expectedSecret || webhookSecret !== expectedSecret) {
      console.error('Invalid webhook secret');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { restaurantId, menuText, menuUrl, source = 'n8n' } = await req.json();

    if (!restaurantId) {
      return new Response(
        JSON.stringify({ error: 'restaurantId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!menuText && !menuUrl) {
      return new Response(
        JSON.stringify({ error: 'Either menuText or menuUrl is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing menu for restaurant: ${restaurantId}, source: ${source}`);

    // Create Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get menu text from URL if provided
    let textToProcess = menuText;
    if (menuUrl && !menuText) {
      try {
        const response = await fetch(menuUrl);
        textToProcess = await response.text();
      } catch (error) {
        console.error('Error fetching menu from URL:', error);
        return new Response(
          JSON.stringify({ error: 'Failed to fetch menu from URL' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Verify restaurant exists
    const { data: restaurant, error: restaurantError } = await supabase
      .from('restaurants')
      .select('id, name')
      .eq('id', restaurantId)
      .single();

    if (restaurantError || !restaurant) {
      console.error('Restaurant not found:', restaurantError);
      return new Response(
        JSON.stringify({ error: 'Restaurant not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use AI to extract dishes from menu text
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `Je bent een expert in het analyseren van restaurantmenu's. Extract alle gerechten uit de menutekst.
            
Geef ALLEEN een JSON array terug met objecten die deze structuur hebben:
{
  "name": "Naam van het gerecht (Nederlands)",
  "name_en": "English name if obvious, otherwise null",
  "confidence": 0.0-1.0 (hoe zeker je bent dat dit een echt gerecht is)
}

Regels:
- Focus op hoofdgerechten, voorgerechten, en bekende gerechten
- Negeer drankjes, desserts tenzij specifiek gevraagd
- Gebruik de Nederlandse naam als primaire naam
- Confidence 0.9+ voor duidelijke gerechten (pizza, pasta, sushi, etc.)
- Confidence 0.7-0.9 voor waarschijnlijke gerechten
- Confidence <0.7 voor onzekere items`
          },
          {
            role: 'user',
            content: `Analyseer dit menu en extract alle gerechten:\n\n${textToProcess}`
          }
        ],
        temperature: 0.3,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to analyze menu' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || '';
    
    // Parse AI response
    let extractedDishes: Array<{ name: string; name_en?: string; confidence: number }> = [];
    try {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        extractedDishes = JSON.parse(jsonMatch[0]);
      }
    } catch (parseError) {
      console.error('Error parsing AI response:', parseError);
      return new Response(
        JSON.stringify({ error: 'Failed to parse extracted dishes', raw: content }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Extracted ${extractedDishes.length} dishes from menu`);

    // Process each dish
    const results = {
      added: [] as string[],
      existing: [] as string[],
      errors: [] as string[],
    };

    for (const dish of extractedDishes) {
      try {
        // Create slug from dish name
        const slug = dish.name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '');

        // Check if dish exists in canonical dishes table
        let { data: existingDish } = await supabase
          .from('dishes')
          .select('id, name')
          .eq('slug', slug)
          .single();

        // If not found by slug, try by name
        if (!existingDish) {
          const { data: dishByName } = await supabase
            .from('dishes')
            .select('id, name')
            .ilike('name', dish.name)
            .single();
          existingDish = dishByName;
        }

        let dishId: string;

        if (existingDish) {
          dishId = existingDish.id;
        } else {
          // Create new dish in canonical table
          const { data: newDish, error: createError } = await supabase
            .from('dishes')
            .insert({
              name: dish.name,
              name_en: dish.name_en || null,
              slug: slug,
              is_active: true,
            })
            .select('id')
            .single();

          if (createError) {
            console.error('Error creating dish:', createError);
            results.errors.push(dish.name);
            continue;
          }
          dishId = newDish.id;
        }

        // Check if restaurant already has this dish
        const { data: existingLink } = await supabase
          .from('restaurant_dishes')
          .select('id')
          .eq('restaurant_id', restaurantId)
          .eq('dish_id', dishId)
          .single();

        if (existingLink) {
          results.existing.push(dish.name);
          continue;
        }

        // Add dish to restaurant with 'suggested' status (requires approval)
        const { error: linkError } = await supabase
          .from('restaurant_dishes')
          .insert({
            restaurant_id: restaurantId,
            dish_id: dishId,
            status: 'suggested', // Requires admin approval
            confidence_score: dish.confidence,
            source: source,
          });

        if (linkError) {
          console.error('Error linking dish to restaurant:', linkError);
          results.errors.push(dish.name);
        } else {
          results.added.push(dish.name);
        }
      } catch (error) {
        console.error(`Error processing dish ${dish.name}:`, error);
        results.errors.push(dish.name);
      }
    }

    console.log('Processing complete:', results);

    return new Response(
      JSON.stringify({
        success: true,
        restaurant: restaurant.name,
        results: {
          added: results.added.length,
          existing: results.existing.length,
          errors: results.errors.length,
          addedDishes: results.added,
          existingDishes: results.existing,
          errorDishes: results.errors,
        },
        message: `${results.added.length} gerechten toegevoegd voor goedkeuring. Bekijk ze in het Admin Panel → Dish Approval.`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Webhook error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
