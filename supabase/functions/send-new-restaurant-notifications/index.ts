import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotificationQueueItem {
  id: string;
  user_id: string;
  restaurant_id: string;
  notification_type: string;
}

interface Restaurant {
  name: string;
  slug: string;
  cuisines: string[];
  ambience_tags: string[];
  images: string[];
  address: string;
  city: { name: string; slug: string };
}

interface Profile {
  email: string;
  name: string;
}

async function sendEmailWithResend(
  apiKey: string,
  to: string,
  subject: string,
  html: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Dishloopr <notifications@resend.dev>",
        to: [to],
        subject,
        html,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error("Resend API error:", errorData);
      return { success: false, error: errorData };
    }

    return { success: true };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    return { success: false, error: errorMsg };
  }
}

const handler = async (req: Request): Promise<Response> => {
  console.log("Starting notification processing...");
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    
    if (!resendApiKey) {
      console.log("RESEND_API_KEY not configured - notifications will be queued but not sent");
      return new Response(
        JSON.stringify({ message: "Email notifications disabled - API key not configured", processed: 0 }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
    
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get pending notifications
    const { data: notifications, error: notifError } = await supabase
      .from("notification_queue")
      .select("*")
      .is("sent_at", null)
      .limit(50);

    if (notifError) {
      console.error("Error fetching notifications:", notifError);
      throw notifError;
    }

    if (!notifications || notifications.length === 0) {
      console.log("No pending notifications");
      return new Response(
        JSON.stringify({ message: "No pending notifications", processed: 0 }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`Processing ${notifications.length} notifications`);
    
    let successCount = 0;
    const errors: string[] = [];

    for (const notification of notifications as NotificationQueueItem[]) {
      try {
        // Get user profile
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("email, name")
          .eq("id", notification.user_id)
          .single();

        if (profileError || !profile?.email) {
          console.log(`No email for user ${notification.user_id}`);
          continue;
        }

        // Get restaurant details
        const { data: restaurant, error: restaurantError } = await supabase
          .from("restaurants")
          .select("name, slug, cuisines, ambience_tags, images, address, city:cities(name, slug)")
          .eq("id", notification.restaurant_id)
          .single();

        if (restaurantError || !restaurant) {
          console.log(`Restaurant not found: ${notification.restaurant_id}`);
          continue;
        }

        const typedProfile = profile as Profile;
        const typedRestaurant = restaurant as unknown as Restaurant;
        const cityData = typedRestaurant.city;
        const cuisinesList = typedRestaurant.cuisines?.join(", ") || "Various";
        const ambienceList = typedRestaurant.ambience_tags?.join(", ") || "";
        const restaurantImage = typedRestaurant.images?.[0] || "";
        
        const baseUrl = Deno.env.get("SITE_URL") || "https://dishloopr.com";
        const restaurantUrl = `${baseUrl}/restaurant/${typedRestaurant.slug}`;

        // Send email using Resend API
        const emailHtml = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5;">
            <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
              ${restaurantImage ? `<img src="${restaurantImage}" alt="${typedRestaurant.name}" style="width: 100%; height: 200px; object-fit: cover;">` : ''}
              <div style="padding: 24px;">
                <h1 style="color: #1a1a1a; font-size: 24px; margin: 0 0 8px;">Hoi ${typedProfile.name || 'foodie'}! 👋</h1>
                <p style="color: #666; font-size: 16px; margin: 0 0 20px;">Er is een nieuw restaurant dat perfect bij je smaak past!</p>
                
                <div style="background: #f8f8f8; border-radius: 12px; padding: 20px; margin-bottom: 20px;">
                  <h2 style="color: #1a1a1a; font-size: 20px; margin: 0 0 8px;">${typedRestaurant.name}</h2>
                  <p style="color: #666; margin: 0 0 4px;">📍 ${typedRestaurant.address}${cityData ? `, ${cityData.name}` : ''}</p>
                  <p style="color: #666; margin: 0 0 4px;">🍴 ${cuisinesList}</p>
                  ${ambienceList ? `<p style="color: #666; margin: 0;">✨ ${ambienceList}</p>` : ''}
                </div>
                
                <a href="${restaurantUrl}" style="display: inline-block; background: linear-gradient(135deg, #ff6b35, #ff8c5a); color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                  Bekijk restaurant →
                </a>
              </div>
              <div style="background: #f8f8f8; padding: 16px 24px; text-align: center;">
                <p style="color: #999; font-size: 12px; margin: 0;">
                  Je ontvangt deze email omdat je interesse hebt in ${cuisinesList} gerechten.<br>
                  <a href="${baseUrl}/profile" style="color: #ff6b35;">Beheer je voorkeuren</a>
                </p>
              </div>
            </div>
          </body>
          </html>
        `;

        const emailResult = await sendEmailWithResend(
          resendApiKey,
          typedProfile.email,
          `🍽️ Nieuw restaurant voor jou: ${typedRestaurant.name}`,
          emailHtml
        );

        if (emailResult.success) {
          console.log(`Email sent to ${typedProfile.email}`);

          // Mark as sent
          await supabase
            .from("notification_queue")
            .update({ sent_at: new Date().toISOString() })
            .eq("id", notification.id);

          successCount++;
        } else {
          console.error(`Failed to send email: ${emailResult.error}`);
          errors.push(emailResult.error || "Unknown error");
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error(`Error processing notification ${notification.id}:`, errorMsg);
        errors.push(errorMsg);
      }
    }

    console.log(`Processed ${successCount}/${notifications.length} notifications`);

    return new Response(
      JSON.stringify({ 
        message: `Sent ${successCount} notifications`,
        processed: successCount,
        total: notifications.length,
        errors: errors.length > 0 ? errors : undefined
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("Error in notification handler:", errorMsg);
    return new Response(
      JSON.stringify({ error: errorMsg }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
