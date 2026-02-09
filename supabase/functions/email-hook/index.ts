import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface EmailHookPayload {
  user: {
    id: string;
    email: string;
    user_metadata?: {
      name?: string;
    };
  };
  email_data: {
    token: string;
    token_hash: string;
    redirect_to: string;
    email_action_type: string;
    site_url: string;
    token_new?: string;
    token_hash_new?: string;
  };
}

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload: EmailHookPayload = await req.json();
    
    console.log("Email hook received:", {
      email: payload.user.email,
      action: payload.email_data.email_action_type,
    });

    const { user, email_data } = payload;
    const userName = user.user_metadata?.name || user.email.split('@')[0];
    
    let subject: string;
    let htmlContent: string;
    
    // Build confirmation URL
    const confirmationUrl = `${email_data.site_url}/auth/v1/verify?token=${email_data.token_hash}&type=${email_data.email_action_type}&redirect_to=${encodeURIComponent(email_data.redirect_to)}`;

    switch (email_data.email_action_type) {
      case "signup":
      case "email_confirmation":
        subject = "Bevestig je e-mailadres - Dishloopr";
        htmlContent = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f8f9fa;">
            <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
              <div style="background-color: #ffffff; border-radius: 16px; padding: 40px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                <div style="text-align: center; margin-bottom: 32px;">
                  <h1 style="color: #f97316; font-size: 28px; margin: 0;">Dishloopr</h1>
                </div>
                
                <h2 style="color: #1a1a1a; font-size: 24px; margin: 0 0 16px 0; text-align: center;">
                  Welkom, ${userName}! 🎉
                </h2>
                
                <p style="color: #666666; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0; text-align: center;">
                  Bedankt voor je registratie bij Dishloopr. Klik op de onderstaande knop om je e-mailadres te bevestigen.
                </p>
                
                <div style="text-align: center; margin: 32px 0;">
                  <a href="${confirmationUrl}" 
                     style="display: inline-block; background-color: #f97316; color: #ffffff; text-decoration: none; padding: 16px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                    E-mailadres bevestigen
                  </a>
                </div>
                
                <p style="color: #999999; font-size: 14px; line-height: 1.6; margin: 24px 0 0 0; text-align: center;">
                  Of kopieer deze link naar je browser:<br>
                  <a href="${confirmationUrl}" style="color: #f97316; word-break: break-all;">${confirmationUrl}</a>
                </p>
                
                <hr style="border: none; border-top: 1px solid #eeeeee; margin: 32px 0;">
                
                <p style="color: #999999; font-size: 12px; text-align: center; margin: 0;">
                  Als je dit account niet hebt aangemaakt, kun je deze email negeren.
                </p>
              </div>
              
              <p style="color: #999999; font-size: 12px; text-align: center; margin-top: 24px;">
                © ${new Date().getFullYear()} Dishloopr. Alle rechten voorbehouden.
              </p>
            </div>
          </body>
          </html>
        `;
        break;

      case "recovery":
      case "password_recovery":
        subject = "Wachtwoord herstellen - Dishloopr";
        htmlContent = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f8f9fa;">
            <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
              <div style="background-color: #ffffff; border-radius: 16px; padding: 40px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                <div style="text-align: center; margin-bottom: 32px;">
                  <h1 style="color: #f97316; font-size: 28px; margin: 0;">Dishloopr</h1>
                </div>
                
                <h2 style="color: #1a1a1a; font-size: 24px; margin: 0 0 16px 0; text-align: center;">
                  Wachtwoord herstellen 🔐
                </h2>
                
                <p style="color: #666666; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0; text-align: center;">
                  Je hebt een verzoek ingediend om je wachtwoord te herstellen. Klik op de onderstaande knop om een nieuw wachtwoord in te stellen.
                </p>
                
                <div style="text-align: center; margin: 32px 0;">
                  <a href="${confirmationUrl}" 
                     style="display: inline-block; background-color: #f97316; color: #ffffff; text-decoration: none; padding: 16px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                    Nieuw wachtwoord instellen
                  </a>
                </div>
                
                <p style="color: #999999; font-size: 14px; line-height: 1.6; margin: 24px 0 0 0; text-align: center;">
                  Deze link is 1 uur geldig.
                </p>
                
                <hr style="border: none; border-top: 1px solid #eeeeee; margin: 32px 0;">
                
                <p style="color: #999999; font-size: 12px; text-align: center; margin: 0;">
                  Als je dit verzoek niet hebt ingediend, kun je deze email negeren.
                </p>
              </div>
            </div>
          </body>
          </html>
        `;
        break;

      case "email_change":
        subject = "Bevestig je nieuwe e-mailadres - Dishloopr";
        htmlContent = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f8f9fa;">
            <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
              <div style="background-color: #ffffff; border-radius: 16px; padding: 40px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                <div style="text-align: center; margin-bottom: 32px;">
                  <h1 style="color: #f97316; font-size: 28px; margin: 0;">Dishloopr</h1>
                </div>
                
                <h2 style="color: #1a1a1a; font-size: 24px; margin: 0 0 16px 0; text-align: center;">
                  Bevestig je nieuwe e-mailadres 📧
                </h2>
                
                <p style="color: #666666; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0; text-align: center;">
                  Klik op de onderstaande knop om je nieuwe e-mailadres te bevestigen.
                </p>
                
                <div style="text-align: center; margin: 32px 0;">
                  <a href="${confirmationUrl}" 
                     style="display: inline-block; background-color: #f97316; color: #ffffff; text-decoration: none; padding: 16px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                    E-mailadres bevestigen
                  </a>
                </div>
                
                <hr style="border: none; border-top: 1px solid #eeeeee; margin: 32px 0;">
                
                <p style="color: #999999; font-size: 12px; text-align: center; margin: 0;">
                  Als je deze wijziging niet hebt aangevraagd, neem dan contact met ons op.
                </p>
              </div>
            </div>
          </body>
          </html>
        `;
        break;

      default:
        console.log("Unknown email action type:", email_data.email_action_type);
        return new Response(
          JSON.stringify({ error: "Unknown email action type" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    // Send email via Resend
    const emailResponse = await resend.emails.send({
      from: "Dishloopr <noreply@dishloopr.com>",
      to: [user.email],
      subject,
      html: htmlContent,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(
      JSON.stringify({ success: true, id: emailResponse.data?.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in email-hook function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
