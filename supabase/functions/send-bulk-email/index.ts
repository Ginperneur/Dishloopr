import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-webhook-secret",
};

const BATCH_SIZE = 500;
const CONCURRENT_SENDS = 50; // Resend supports 100/sec, we stay safe

interface Campaign {
  id: string;
  subject: string;
  html_content: string;
  segment: string;
  custom_filter: any;
  status: string;
  total_recipients: number;
  sent_count: number;
  failed_count: number;
  last_cursor: string | null;
}

async function sendEmail(
  apiKey: string,
  to: string,
  subject: string,
  html: string
): Promise<boolean> {
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Dishloopr <noreply@dishloopr.com>",
        to: [to],
        subject,
        html,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function getRecipients(
  supabase: any,
  segment: string,
  cursor: string | null,
  batchSize: number
): Promise<{ emails: { email: string; id: string }[]; nextCursor: string | null }> {
  let query: any;

  switch (segment) {
    case "subscribers":
      query = supabase
        .from("newsletter_subscribers")
        .select("id, email")
        .eq("is_active", true)
        .order("id")
        .limit(batchSize);
      if (cursor) query = query.gt("id", cursor);
      break;

    case "owners_verified":
      // Users who have verified restaurant claims
      query = supabase
        .from("restaurant_managers")
        .select("user_id, profiles:user_id(email, id)")
        .eq("role", "primary_owner")
        .order("user_id")
        .limit(batchSize);
      if (cursor) query = query.gt("user_id", cursor);
      break;

    case "owners_all":
      // All users with restaurant account type via user_roles or managers
      query = supabase
        .from("restaurant_managers")
        .select("user_id, profiles:user_id(email, id)")
        .order("user_id")
        .limit(batchSize);
      if (cursor) query = query.gt("user_id", cursor);
      break;

    case "all_users":
      query = supabase
        .from("profiles")
        .select("id, email")
        .not("email", "is", null)
        .order("id")
        .limit(batchSize);
      if (cursor) query = query.gt("id", cursor);
      break;

    default:
      return { emails: [], nextCursor: null };
  }

  const { data, error } = await query;
  if (error || !data || data.length === 0) {
    return { emails: [], nextCursor: null };
  }

  let emails: { email: string; id: string }[];

  if (segment === "owners_verified" || segment === "owners_all") {
    // Deduplicate by email and flatten nested profile
    const seen = new Set<string>();
    emails = [];
    for (const row of data) {
      const profile = row.profiles as any;
      if (profile?.email && !seen.has(profile.email)) {
        seen.add(profile.email);
        emails.push({ email: profile.email, id: row.user_id });
      }
    }
    const lastId = data[data.length - 1]?.user_id || null;
    return {
      emails,
      nextCursor: data.length === batchSize ? lastId : null,
    };
  }

  emails = data
    .filter((r: any) => r.email)
    .map((r: any) => ({ email: r.email, id: r.id }));

  const lastId = data[data.length - 1]?.id || null;
  return {
    emails,
    nextCursor: data.length === batchSize ? lastId : null,
  };
}

// Send emails in parallel chunks
async function sendBatch(
  apiKey: string,
  emails: { email: string; id: string }[],
  subject: string,
  html: string
): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;

  // Process in chunks of CONCURRENT_SENDS
  for (let i = 0; i < emails.length; i += CONCURRENT_SENDS) {
    const chunk = emails.slice(i, i + CONCURRENT_SENDS);
    const results = await Promise.allSettled(
      chunk.map((r) => sendEmail(apiKey, r.email, subject, html))
    );
    for (const result of results) {
      if (result.status === "fulfilled" && result.value) {
        sent++;
      } else {
        failed++;
      }
    }
  }

  return { sent, failed };
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      return new Response(
        JSON.stringify({ error: "RESEND_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Auth: either admin JWT or n8n webhook secret
    const webhookSecret = req.headers.get("x-webhook-secret");
    const n8nSecret = Deno.env.get("N8N_WEBHOOK_SECRET");
    const authHeader = req.headers.get("authorization");

    let isAuthorized = false;

    if (webhookSecret && n8nSecret && webhookSecret === n8nSecret) {
      isAuthorized = true;
    } else if (authHeader) {
      // Verify JWT and check admin role
      const token = authHeader.replace("Bearer ", "");
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (!error && user) {
        const { data: roleData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .single();
        if (roleData?.role === "admin") {
          isAuthorized = true;
        }
      }
    }

    if (!isAuthorized) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { campaign_id, action } = body;

    if (!campaign_id) {
      return new Response(
        JSON.stringify({ error: "campaign_id required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get campaign
    const { data: campaign, error: campError } = await supabase
      .from("email_campaigns")
      .select("*")
      .eq("id", campaign_id)
      .single();

    if (campError || !campaign) {
      return new Response(
        JSON.stringify({ error: "Campaign not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const c = campaign as Campaign;

    // Handle pause action
    if (action === "pause") {
      await supabase
        .from("email_campaigns")
        .update({ status: "paused" })
        .eq("id", campaign_id);
      return new Response(
        JSON.stringify({ message: "Campaign paused" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Only process if draft, sending, or paused (resume)
    if (!["draft", "sending", "paused"].includes(c.status)) {
      return new Response(
        JSON.stringify({ error: `Campaign status is '${c.status}', cannot send` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Mark as sending
    if (c.status !== "sending") {
      await supabase
        .from("email_campaigns")
        .update({
          status: "sending",
          started_at: c.status === "draft" ? new Date().toISOString() : c.started_at,
        })
        .eq("id", campaign_id);
    }

    // Get batch of recipients
    const { emails, nextCursor } = await getRecipients(
      supabase,
      c.segment,
      c.last_cursor,
      BATCH_SIZE
    );

    if (emails.length === 0) {
      // No more recipients — mark completed
      await supabase
        .from("email_campaigns")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", campaign_id);

      return new Response(
        JSON.stringify({
          message: "Campaign completed",
          total_sent: c.sent_count,
          total_failed: c.failed_count,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Processing batch of ${emails.length} emails for campaign ${campaign_id}`);

    // Send the batch
    const { sent, failed } = await sendBatch(
      resendApiKey,
      emails,
      c.subject,
      c.html_content
    );

    // Update campaign progress
    const newSentCount = (c.sent_count || 0) + sent;
    const newFailedCount = (c.failed_count || 0) + failed;

    const updateData: Record<string, any> = {
      sent_count: newSentCount,
      failed_count: newFailedCount,
      last_cursor: nextCursor,
    };

    if (!nextCursor) {
      // No more batches
      updateData.status = "completed";
      updateData.completed_at = new Date().toISOString();
    }

    await supabase
      .from("email_campaigns")
      .update(updateData)
      .eq("id", campaign_id);

    return new Response(
      JSON.stringify({
        message: nextCursor ? "Batch processed, more remaining" : "Campaign completed",
        batch_sent: sent,
        batch_failed: failed,
        total_sent: newSentCount,
        total_failed: newFailedCount,
        has_more: !!nextCursor,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Error in send-bulk-email:", msg);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
