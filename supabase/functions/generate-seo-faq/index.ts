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
    const { pageId, dishName, cityName, pageType = 'DISH_CITY', language = 'nl' } = await req.json();
    
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

    console.log(`Generating FAQ for ${dishName} in ${cityName} (type: ${pageType}, lang: ${language})...`);

    // Build language-specific instructions
    const languageInstructions: Record<string, string> = {
      nl: 'Schrijf alle FAQ content in het Nederlands.',
      en: 'Write all FAQ content in English.',
      de: 'Schreibe alle FAQ-Inhalte auf Deutsch.',
      fr: 'Rédigez tout le contenu FAQ en français.',
      es: 'Escribe todo el contenido de las FAQ en español.'
    };

    const langInstruction = languageInstructions[language] || languageInstructions.nl;

    // Build page-type specific context
    const pageTypeContext: Record<string, string> = {
      DISH_CITY: `This is a dish-focused page about "${dishName}" restaurants in ${cityName}.`,
      MEAL_CITY: `This is a meal-type page about "${dishName}" (e.g., brunch, lunch, dinner) in ${cityName}.`,
      ATMOSPHERE_CITY: `This is an atmosphere-focused page about "${dishName}" dining experiences (e.g., romantic, casual, family-friendly) in ${cityName}.`
    };

    const typeContext = pageTypeContext[pageType] || pageTypeContext.DISH_CITY;

    const systemPrompt = `You are an SEO expert generating FAQ sections for Dishloopr, a restaurant discovery platform.

${langInstruction}

CONTEXT:
${typeContext}

STRICT RULES:
1. Generate exactly 6 FAQs (never less than 5, never more than 7)
2. NEVER reuse identical questions or answers across different pages
3. FAQs must be context-aware: adapt wording to BOTH "${cityName}" and "${dishName}"
4. Tone must be informative and neutral — never promotional or sales-driven
5. Answers must be fact-based, general knowledge, and platform-explanatory where relevant
6. Do NOT mention specific restaurants by name inside FAQs
7. Use natural language, no keyword stuffing
8. Include "${dishName}" and "${cityName}" organically where relevant
9. Answers should be 2-4 sentences max

FAQ CATEGORY DISTRIBUTION (follow this structure):

A. ENTITY EXPLANATION (1-2 FAQs)
- What is ${dishName}?
- What characterizes ${dishName}?
- What are typical ingredients/features?

B. CITY-SPECIFIC CONTEXT (1-2 FAQs)
- Why is ${dishName} popular in ${cityName}?
- What should you look for when choosing a ${dishName} spot in ${cityName}?
- What makes ${cityName}'s ${dishName} scene unique?

C. CHOICE GUIDANCE (1-2 FAQs)
- Is ${dishName} suitable for vegetarians/vegans?
- What's the average price for ${dishName} in ${cityName}?
- What's the best time to visit for ${dishName}?
- Is ${dishName} suitable for groups/dates/families?

D. DISHLOOPR CONTEXT (1 FAQ)
- How does Dishloopr help find ${dishName} in ${cityName}?
- Can I filter by price, atmosphere, or dietary preferences on Dishloopr?
- How are ${dishName} restaurants ranked on Dishloopr?

IMPORTANT: All content must align with Google's helpful content guidelines and be valid for FAQPage structured data.`;

    const userPrompt = `Generate 6 unique, high-quality FAQs for the "${dishName}" page in "${cityName}".

Remember:
- Mix questions across all 4 categories (A, B, C, D)
- Make answers helpful and specific to ${cityName} where possible
- Keep answers concise (2-4 sentences)
- Never be promotional or mention specific restaurant names`;

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
          { role: 'user', content: userPrompt }
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
                        answer: { type: 'string', description: 'The FAQ answer (2-4 sentences)' },
                        category: { type: 'string', enum: ['entity_explanation', 'city_context', 'choice_guidance', 'platform_context'], description: 'The FAQ category' }
                      },
                      required: ['question', 'answer'],
                      additionalProperties: false
                    },
                    minItems: 5,
                    maxItems: 7
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
