import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { menuText, restaurantId } = await req.json();
    
    if (!menuText || !restaurantId) {
      return new Response(
        JSON.stringify({ error: 'menuText and restaurantId are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Parsing menu for restaurant ${restaurantId}, text length: ${menuText.length}`);

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'AI service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Call AI to extract dishes from menu
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
            content: `Je bent een expert in het analyseren van restaurantmenu's. 
Extraheer alle gerechtnamen uit de menutekst. 
Geef voor elk gerecht ook synoniemen waar mensen op zouden kunnen zoeken.
Focus op hoofdgerechten, voorgerechten en populaire items.
Negeer drankjes, wijnen en bijgerechten tenzij ze heel specifiek zijn.

Retourneer een JSON array met objecten in dit formaat:
[
  {"name": "Ossenhaas", "synonyms": ["steak", "biefstuk", "beef"]},
  {"name": "Spaghetti Carbonara", "synonyms": ["pasta", "carbonara"]},
  ...
]

Houd de gerechtnamen in het Nederlands waar mogelijk, maar gebruik de originele naam als het een bekend internationaal gerecht is.`
          },
          {
            role: 'user',
            content: `Analyseer dit menu en extraheer alle gerechten met synoniemen:\n\n${menuText.substring(0, 15000)}`
          }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'extract_dishes',
              description: 'Extract dishes from menu with synonyms',
              parameters: {
                type: 'object',
                properties: {
                  dishes: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        name: { type: 'string', description: 'The dish name' },
                        synonyms: { 
                          type: 'array', 
                          items: { type: 'string' },
                          description: 'Search synonyms for this dish'
                        }
                      },
                      required: ['name', 'synonyms']
                    }
                  }
                },
                required: ['dishes']
              }
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'extract_dishes' } }
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        console.error('Rate limit exceeded');
        return new Response(
          JSON.stringify({ error: 'Te veel verzoeken, probeer het later opnieuw' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (aiResponse.status === 402) {
        console.error('Payment required');
        return new Response(
          JSON.stringify({ error: 'AI credits op, voeg credits toe aan je Lovable workspace' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errorText = await aiResponse.text();
      console.error('AI API error:', aiResponse.status, errorText);
      return new Response(
        JSON.stringify({ error: 'AI service fout' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiData = await aiResponse.json();
    console.log('AI response received');

    // Extract dishes from tool call response
    let extractedDishes: { name: string; synonyms: string[] }[] = [];
    
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      try {
        const parsed = JSON.parse(toolCall.function.arguments);
        extractedDishes = parsed.dishes || [];
      } catch (e) {
        console.error('Failed to parse tool call response:', e);
      }
    }

    // Fallback: try to parse from content
    if (extractedDishes.length === 0) {
      const content = aiData.choices?.[0]?.message?.content;
      if (content) {
        try {
          const jsonMatch = content.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            extractedDishes = JSON.parse(jsonMatch[0]);
          }
        } catch (e) {
          console.error('Failed to parse content as JSON:', e);
        }
      }
    }

    console.log(`Extracted ${extractedDishes.length} dishes`);

    // Now save dishes to database
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const addedDishes: string[] = [];
    const existingDishes: string[] = [];

    for (const dish of extractedDishes) {
      const dishName = dish.name.trim();
      const dishSlug = dishName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      
      if (!dishName || dishName.length < 2) continue;

      // Check if dish already exists
      const { data: existingDish } = await supabase
        .from('dishes')
        .select('id, synonyms')
        .or(`slug.eq.${dishSlug},name.ilike.${dishName}`)
        .maybeSingle();

      let dishId: string;

      if (existingDish) {
        dishId = existingDish.id;
        existingDishes.push(dishName);
        
        // Merge synonyms
        const currentSynonyms = existingDish.synonyms || [];
        const newSynonyms = dish.synonyms.filter(s => 
          !currentSynonyms.some((cs: string) => cs.toLowerCase() === s.toLowerCase())
        );
        
        if (newSynonyms.length > 0) {
          await supabase
            .from('dishes')
            .update({ synonyms: [...currentSynonyms, ...newSynonyms] })
            .eq('id', dishId);
        }
      } else {
        // Create new dish
        const { data: newDish, error: createError } = await supabase
          .from('dishes')
          .insert({
            name: dishName,
            slug: dishSlug,
            synonyms: dish.synonyms.map(s => s.toLowerCase()),
            is_active: true
          })
          .select('id')
          .single();

        if (createError) {
          console.error(`Failed to create dish ${dishName}:`, createError);
          continue;
        }
        
        dishId = newDish.id;
        addedDishes.push(dishName);
      }

      // Link dish to restaurant (if not already linked)
      const { data: existingLink } = await supabase
        .from('restaurant_dishes')
        .select('id')
        .eq('restaurant_id', restaurantId)
        .eq('dish_id', dishId)
        .maybeSingle();

      if (!existingLink) {
        const { error: linkError } = await supabase
          .from('restaurant_dishes')
          .insert({
            restaurant_id: restaurantId,
            dish_id: dishId,
            confidence_score: 0.9
          });

        if (linkError) {
          console.error(`Failed to link dish ${dishName}:`, linkError);
        }
      }
    }

    console.log(`Added ${addedDishes.length} new dishes, linked ${existingDishes.length} existing`);

    return new Response(
      JSON.stringify({
        success: true,
        addedDishes,
        existingDishes,
        totalProcessed: extractedDishes.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in parse-menu function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Onbekende fout' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
