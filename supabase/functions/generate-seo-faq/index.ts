import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { pageId, dishName, cityName } = await req.json();
    
    if (!pageId || !dishName || !cityName) {
      return new Response(
        JSON.stringify({ error: 'pageId, dishName and cityName are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    console.log(`Generating FAQ for ${dishName} in ${cityName}...`);

    const systemPrompt = `Je bent een SEO-expert voor een restaurant discovery platform in Nederland. 
Genereer 5 relevante, natuurlijke FAQ vragen en antwoorden over ${dishName} in ${cityName}.

De FAQ's moeten:
- Praktisch en informatief zijn voor bezoekers
- Natuurlijk klinken (geen keyword stuffing)
- Lokale context bevatten waar mogelijk
- Variëren in vraagtype (waar, wat, wanneer, hoeveel, tips)

Voorbeelden van goede vragen:
- Waar vind ik de beste [gerecht] in [stad]?
- Wat kost gemiddeld een [gerecht] in [stad]?
- Welke restaurants serveren authentieke [gerecht] in [stad]?
- Is er een [gerecht] restaurant open op zondag in [stad]?
- Welke [gerecht] restaurants in [stad] hebben een terras?`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Genereer 5 FAQ's voor "${dishName}" restaurants in "${cityName}".` }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'generate_faqs',
              description: 'Generate FAQ questions and answers for SEO landing page',
              parameters: {
                type: 'object',
                properties: {
                  faqs: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        question: { type: 'string', description: 'The FAQ question' },
                        answer: { type: 'string', description: 'The FAQ answer (2-4 sentences)' }
                      },
                      required: ['question', 'answer'],
                      additionalProperties: false
                    }
                  }
                },
                required: ['faqs'],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'generate_faqs' } }
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit bereikt, probeer het later opnieuw.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI credits op, voeg credits toe aan je workspace.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiResponse = await response.json();
    console.log('AI response:', JSON.stringify(aiResponse, null, 2));

    // Extract FAQs from tool call response
    let faqs: { question: string; answer: string }[] = [];
    
    const toolCall = aiResponse.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      try {
        const args = JSON.parse(toolCall.function.arguments);
        faqs = args.faqs || [];
      } catch (e) {
        console.error('Failed to parse tool call arguments:', e);
      }
    }

    if (faqs.length === 0) {
      throw new Error('No FAQs generated');
    }

    console.log(`Generated ${faqs.length} FAQs`);

    // Update the page in database
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { error: updateError } = await supabase
      .from('seo_landing_pages')
      .update({ 
        faq_content: faqs,
        updated_at: new Date().toISOString()
      })
      .eq('id', pageId);

    if (updateError) {
      console.error('Database update error:', updateError);
      throw new Error('Failed to save FAQs to database');
    }

    return new Response(
      JSON.stringify({ success: true, faqs }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('generate-seo-faq error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
