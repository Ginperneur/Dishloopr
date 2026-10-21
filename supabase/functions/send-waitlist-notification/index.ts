import { requireAdminOrInternal, serviceClient, escapeHtml } from "../_shared/auth.ts";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[WAITLIST-NOTIFY] ${step}${detailsStr}`);
};

interface NotificationRequest {
  waitlist_entry_id: string;
  restaurant_id: string;
  slot_id: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    { const __deny = await requireAdminOrInternal(req, serviceClient(), corsHeaders); if (__deny) return __deny; }
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY not configured");
    }

    const resend = new Resend(resendApiKey);

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const { waitlist_entry_id, restaurant_id, slot_id }: NotificationRequest = await req.json();

    logStep("Processing notification", { waitlist_entry_id, restaurant_id, slot_id });

    // Get restaurant details with owner info
    const { data: restaurant, error: restError } = await supabaseAdmin
      .from("restaurants")
      .select(`
        id,
        name,
        claimed_by_owner_id,
        city_id,
        cities:city_id (name)
      `)
      .eq("id", restaurant_id)
      .single();

    if (restError || !restaurant) {
      logStep("Restaurant not found", { error: restError?.message });
      throw new Error("Restaurant not found");
    }

    if (!restaurant.claimed_by_owner_id) {
      logStep("Restaurant has no owner", { restaurant_id });
      return new Response(
        JSON.stringify({ success: false, reason: "no_owner" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // Get owner email from profiles
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("email, name")
      .eq("id", restaurant.claimed_by_owner_id)
      .single();

    if (profileError || !profile?.email) {
      logStep("Owner email not found", { error: profileError?.message });
      return new Response(
        JSON.stringify({ success: false, reason: "no_email" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // Get slot details
    const { data: slot, error: slotError } = await supabaseAdmin
      .from("featured_slots")
      .select("cuisine, base_price")
      .eq("id", slot_id)
      .single();

    if (slotError || !slot) {
      logStep("Slot not found", { error: slotError?.message });
      throw new Error("Slot not found");
    }

    const cityName = (restaurant.cities as any)?.name || "je stad";
    const ownerName = profile.name || "Restauranteigenaar";
    const baseUrl = Deno.env.get("SITE_URL") || "https://dishloopr.com";

    // Send email notification
    const emailResponse = await resend.emails.send({
      from: "Dishloopr <noreply@dishloopr.com>",
      to: [profile.email],
      subject: `🎉 Premium plek beschikbaar voor ${restaurant.name}!`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #f97316; margin: 0;">🍽️ Dishloopr</h1>
          </div>
          
          <h2 style="color: #1a1a1a;">Goed nieuws, ${ownerName}!</h2>
          
          <p>Er is een <strong>premium uitgelichte plek</strong> vrijgekomen voor <strong>${slot.cuisine}</strong> restaurants in <strong>${cityName}</strong>.</p>
          
          <p>Jouw restaurant <strong>${restaurant.name}</strong> stond op de wachtlijst en komt nu in aanmerking voor deze exclusieve zichtbaarheid!</p>
          
          <div style="background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); border-radius: 12px; padding: 24px; margin: 24px 0; text-align: center;">
            <p style="color: white; margin: 0 0 8px 0; font-size: 14px;">Maandelijkse investering vanaf</p>
            <p style="color: white; margin: 0; font-size: 32px; font-weight: bold;">€${slot.base_price}</p>
            <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0; font-size: 12px;">*Prijs kan variëren op basis van vraag</p>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${baseUrl}/owner-dashboard" style="display: inline-block; background-color: #f97316; color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 16px;">
              Claim je plek →
            </a>
          </div>
          
          <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; margin: 24px 0; border-radius: 0 8px 8px 0;">
            <p style="margin: 0; color: #92400e;">
              <strong>⏰ Let op:</strong> Deze uitnodiging is <strong>48 uur</strong> geldig. Daarna gaat de plek naar de volgende op de wachtlijst.
            </p>
          </div>
          
          <h3 style="color: #1a1a1a;">Wat krijg je met een uitgelichte plek?</h3>
          <ul style="padding-left: 20px;">
            <li>✨ Premium zichtbaarheid in zoekresultaten</li>
            <li>🏆 Uitgelicht badge op je restaurantpagina</li>
            <li>📊 Gedetailleerde analytics over views en clicks</li>
            <li>🎯 Prioriteit in jouw categorie (${slot.cuisine})</li>
          </ul>
          
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
          
          <p style="color: #6b7280; font-size: 14px;">
            Je ontvangt deze email omdat je restaurant op de wachtlijst staat voor een premium plek. 
            Heb je vragen? Neem contact op via <a href="mailto:info@dishloopr.com" style="color: #f97316;">info@dishloopr.com</a>
          </p>
          
          <p style="color: #9ca3af; font-size: 12px; text-align: center; margin-top: 30px;">
            © ${new Date().getFullYear()} Dishloopr. Alle rechten voorbehouden.
          </p>
        </body>
        </html>
      `,
    });

    logStep("Email sent successfully", { 
      to: profile.email, 
      restaurant: restaurant.name,
      response: emailResponse 
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        sent_to: profile.email 
      }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200 
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500 
      }
    );
  }
});
