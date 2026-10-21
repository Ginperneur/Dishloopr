import { requireAdminOrInternal, serviceClient, escapeHtml } from "../_shared/auth.ts";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface DomainVerificationRequest {
  email: string;
  code: string;
  restaurantName: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    { const __deny = await requireAdminOrInternal(req, serviceClient(), corsHeaders); if (__deny) return __deny; }
    const { email, code, restaurantName }: DomainVerificationRequest = await req.json();

    if (!email || !code || !restaurantName) {
      throw new Error("Missing required fields");
    }

    const emailResponse = await resend.emails.send({
      from: "Dishloopr <noreply@dishloopr.com>",
      to: [email],
      subject: `Verificatiecode voor ${String(restaurantName).replace(/[\r\n]/g, " ").slice(0, 120)} op Dishloopr`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; background-color: #f9fafb;">
          <div style="background: white; border-radius: 12px; padding: 40px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
            <h1 style="font-size: 24px; margin: 0 0 8px 0; color: #111;">Verificatiecode</h1>
            <p style="color: #6b7280; margin: 0 0 24px 0;">
              Gebruik onderstaande code om het eigenaarschap van <strong>${escapeHtml(restaurantName)}</strong> op Dishloopr te bevestigen.
            </p>
            
            <div style="background: #f3f4f6; border-radius: 8px; padding: 24px; text-align: center; margin: 24px 0;">
              <span style="font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #111; font-family: monospace;">${escapeHtml(code)}</span>
            </div>
            
            <p style="color: #6b7280; font-size: 14px; margin: 24px 0 0 0;">
              Deze code is 30 minuten geldig. Als je deze verificatie niet hebt aangevraagd, kun je dit bericht negeren.
            </p>
          </div>
          
          <p style="color: #9ca3af; font-size: 12px; text-align: center; margin-top: 24px;">
            © Dishloopr — Ontdek de beste gerechten bij jou in de buurt
          </p>
        </body>
        </html>
      `,
    });

    console.log("Domain verification email sent:", emailResponse);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error sending domain verification email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
