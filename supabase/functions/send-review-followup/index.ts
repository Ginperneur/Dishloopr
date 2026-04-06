import { corsHeaders } from '@supabase/supabase-js/cors'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const resendKey = Deno.env.get('RESEND_API_KEY')!

    const supabase = createClient(supabaseUrl, serviceRoleKey)

    // Find intents from 2 days ago that haven't been followed up
    const twoDaysAgo = new Date()
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2)
    const threeDaysAgo = new Date()
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)

    const { data: intents, error: fetchError } = await supabase
      .from('reservation_intents')
      .select('id, user_id, restaurant_id')
      .is('follow_up_sent_at', null)
      .eq('review_submitted', false)
      .lte('clicked_at', twoDaysAgo.toISOString())
      .gte('clicked_at', threeDaysAgo.toISOString())
      .limit(50)

    if (fetchError) {
      console.error('Error fetching intents:', fetchError)
      return new Response(JSON.stringify({ error: fetchError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!intents || intents.length === 0) {
      return new Response(JSON.stringify({ sent: 0, message: 'No follow-ups to send' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Get unique user+restaurant combos
    const uniqueIntents = new Map<string, typeof intents[0]>()
    for (const intent of intents) {
      const key = `${intent.user_id}-${intent.restaurant_id}`
      if (!uniqueIntents.has(key)) {
        uniqueIntents.set(key, intent)
      }
    }

    let sentCount = 0
    const intentIdsToUpdate: string[] = []

    for (const [, intent] of uniqueIntents) {
      // Get user profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('email, name')
        .eq('id', intent.user_id)
        .maybeSingle()

      if (!profile?.email) continue

      // Get restaurant info
      const { data: restaurant } = await supabase
        .from('restaurants')
        .select('name, slug')
        .eq('id', intent.restaurant_id)
        .maybeSingle()

      if (!restaurant) continue

      // Send email via Resend
      const emailRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${resendKey}`,
        },
        body: JSON.stringify({
          from: 'Dishloopr <noreply@dishloopr.com>',
          to: [profile.email],
          subject: `Hoe was het bij ${restaurant.name}? 🍽️`,
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <h2 style="color: #1a1a1a;">Hoi ${profile.name || 'daar'} 👋</h2>
              <p style="color: #444; font-size: 16px; line-height: 1.6;">
                We zagen dat je een paar dagen geleden een reservering hebt gemaakt bij <strong>${restaurant.name}</strong> via Dishloopr.
              </p>
              <p style="color: #444; font-size: 16px; line-height: 1.6;">
                Hoe was het? Jouw mening helpt andere foodies om de beste plekken te vinden! 🙏
              </p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="https://dishloopr.com/restaurant/${restaurant.slug}#reviews" 
                   style="display: inline-block; background: #f97316; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
                  Schrijf een review ✍️
                </a>
              </div>
              <p style="color: #888; font-size: 13px;">
                Je ontvangt deze e-mail omdat je via Dishloopr hebt gereserveerd. Niet geweest? Negeer dan dit bericht.
              </p>
            </div>
          `,
        }),
      })

      if (emailRes.ok) {
        sentCount++
        intentIdsToUpdate.push(intent.id)
      } else {
        console.error('Resend error:', await emailRes.text())
      }
    }

    // Mark intents as followed up
    if (intentIdsToUpdate.length > 0) {
      await supabase
        .from('reservation_intents')
        .update({ follow_up_sent_at: new Date().toISOString() })
        .in('id', intentIdsToUpdate)
    }

    return new Response(JSON.stringify({ sent: sentCount, total: uniqueIntents.size }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Follow-up error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
