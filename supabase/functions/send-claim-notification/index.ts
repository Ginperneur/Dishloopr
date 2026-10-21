import { escapeHtml } from "../_shared/auth.ts";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ClaimNotificationRequest {
  claimId: string;
  restaurantName: string;
  restaurantAddress: string;
  userName: string;
  userEmail: string;
  role: string;
  notes: string;
}

async function getAdminEmail(): Promise<string> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  const { data, error } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "admin_email")
    .single();
  
  if (error || !data) {
    console.warn("Could not fetch admin email, using default:", error?.message);
    return "admin@dishloopr.com";
  }
  
  return data.value;
}

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: claims, error: authError } = await authClient.auth.getUser(token);
    
    if (authError || !claims?.user) {
      console.error("Auth error:", authError?.message);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: ClaimNotificationRequest = await req.json();
    // Confirmation always goes to the signed-in user's own address, never a caller-chosen one.
    const userEmail = claims.user.email;
    if (!userEmail) {
      return new Response(JSON.stringify({ error: 'No email on account' }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const clip = (v: unknown, n: number) => String(v ?? '').slice(0, n);
    const restaurantNameRaw = clip(body.restaurantName, 200).replace(/[\r\n]/g, ' ');
    const claimId = escapeHtml(clip(body.claimId, 64));
    const restaurantName = escapeHtml(restaurantNameRaw);
    const restaurantAddress = escapeHtml(clip(body.restaurantAddress, 300));
    const userName = escapeHtml(clip(body.userName, 120));
    const role = escapeHtml(clip(body.role, 60));
    const notes = escapeHtml(clip(body.notes, 2000));
    const userEmailHtml = escapeHtml(userEmail);

    console.log("Sending claim notification");

    // Get admin email from database
    const adminEmail = await getAdminEmail();

    // Send notification to admin
    const adminEmailResponse = await resend.emails.send({
      from: "Dishloopr <noreply@resend.dev>",
      to: [adminEmail],
      subject: `Nieuwe claim aanvraag: ${restaurantNameRaw}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #1a1a1a; font-size: 24px; margin-bottom: 20px;">🔔 Nieuwe Claim Aanvraag</h1>
          
          <div style="background-color: #f8f9fa; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
            <h2 style="color: #1a1a1a; font-size: 18px; margin: 0 0 15px 0;">${restaurantName}</h2>
            <p style="color: #666; margin: 5px 0;">📍 ${restaurantAddress}</p>
          </div>
          
          <div style="border-left: 4px solid #f97316; padding-left: 15px; margin-bottom: 20px;">
            <h3 style="color: #1a1a1a; font-size: 16px; margin: 0 0 10px 0;">Aanvrager</h3>
            <p style="color: #666; margin: 5px 0;"><strong>Naam:</strong> ${userName}</p>
            <p style="color: #666; margin: 5px 0;"><strong>Email:</strong> ${userEmailHtml}</p>
            <p style="color: #666; margin: 5px 0;"><strong>Rol:</strong> ${role}</p>
          </div>
          
          ${notes ? `
          <div style="background-color: #fff3cd; border-radius: 8px; padding: 15px; margin-bottom: 20px;">
            <h3 style="color: #856404; font-size: 14px; margin: 0 0 10px 0;">Extra opmerkingen</h3>
            <p style="color: #856404; margin: 0; white-space: pre-wrap;">${notes}</p>
          </div>
          ` : ''}
          
          <p style="color: #666; font-size: 14px;">
            Claim ID: <code style="background: #eee; padding: 2px 6px; border-radius: 4px;">${claimId}</code>
          </p>
          
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          
          <p style="color: #999; font-size: 12px;">
            Bekijk de claim in het Admin Panel om deze te beoordelen.
          </p>
        </div>
      `,
    });

    console.log("Admin email sent:", adminEmailResponse);

    // Send confirmation to user
    const userEmailResponse = await resend.emails.send({
      from: "Dishloopr <noreply@resend.dev>",
      to: [userEmail],
      subject: `Claim aanvraag ontvangen voor ${restaurantNameRaw}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #1a1a1a; font-size: 24px; margin-bottom: 20px;">✅ Claim Aanvraag Ontvangen</h1>
          
          <p style="color: #666; font-size: 16px; line-height: 1.6;">
            Beste ${userName},
          </p>
          
          <p style="color: #666; font-size: 16px; line-height: 1.6;">
            Bedankt voor je claim aanvraag voor <strong>${restaurantName}</strong>. 
            We hebben je aanvraag ontvangen en zullen deze zo snel mogelijk beoordelen.
          </p>
          
          <div style="background-color: #f0f9ff; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <h2 style="color: #0369a1; font-size: 16px; margin: 0 0 10px 0;">📍 Restaurant details</h2>
            <p style="color: #0369a1; margin: 5px 0;"><strong>${restaurantName}</strong></p>
            <p style="color: #0369a1; margin: 5px 0;">${restaurantAddress}</p>
          </div>
          
          <div style="background-color: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <h3 style="color: #1a1a1a; font-size: 14px; margin: 0 0 10px 0;">⏱️ Wat kun je verwachten?</h3>
            <ul style="color: #666; margin: 0; padding-left: 20px;">
              <li style="margin-bottom: 8px;">We beoordelen je aanvraag binnen 2 werkdagen</li>
              <li style="margin-bottom: 8px;">Bij goedkeuring krijg je toegang tot je restaurant dashboard</li>
              <li style="margin-bottom: 8px;">Je kunt dan menu's beheren, op reviews reageren en analytics bekijken</li>
            </ul>
          </div>
          
          <p style="color: #666; font-size: 16px; line-height: 1.6;">
            Heb je vragen? Neem gerust contact met ons op.
          </p>
          
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          
          <p style="color: #999; font-size: 12px; text-align: center;">
            Met vriendelijke groet,<br>
            Het Dishloopr Team
          </p>
        </div>
      `,
    });

    console.log("User confirmation email sent:", userEmailResponse);

    return new Response(
      JSON.stringify({ 
        success: true,
        adminEmailId: adminEmailResponse.data?.id ?? null,
        userEmailId: userEmailResponse.data?.id ?? null
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error sending claim notification:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
