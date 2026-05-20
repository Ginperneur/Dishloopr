import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const CONCURRENT_SENDS = 25;

interface Filters {
  city_ids?: string[];
  cuisines?: string[];
  claim_status?: string | null;
  only_active?: boolean;
  only_claimed?: boolean;
  exclude_unsubscribed?: boolean;
}

interface RequestBody {
  subject: string;
  html: string;
  filters: Filters;
  test_email?: string;
  preview_only?: boolean;
}

async function sendEmail(apiKey: string, to: string, subject: string, html: string): Promise<boolean> {
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

async function resolveRecipients(supabase: any, filters: Filters): Promise<{ emails: string[]; restaurant_count: number }> {
  // 1. Filter restaurants
  let q = supabase.from("restaurants").select("id, claimed_by_owner_id", { count: "exact" });
  if (filters.only_active !== false) q = q.eq("is_active", true);
  if (filters.city_ids && filters.city_ids.length) q = q.in("city_id", filters.city_ids);
  if (filters.cuisines && filters.cuisines.length) q = q.overlaps("cuisines", filters.cuisines);
  if (filters.claim_status) q = q.eq("claim_status", filters.claim_status);
  if (filters.only_claimed) q = q.not("claimed_by_owner_id", "is", null);

  // Page through results (Supabase default 1000 cap)
  const restaurantIds: string[] = [];
  const ownerIds = new Set<string>();
  let from = 0;
  const pageSize = 1000;
  let total = 0;
  while (true) {
    const { data, error, count } = await q.range(from, from + pageSize - 1);
    if (error) throw error;
    if (count !== null) total = count;
    if (!data || data.length === 0) break;
    for (const r of data) {
      restaurantIds.push(r.id);
      if (r.claimed_by_owner_id) ownerIds.add(r.claimed_by_owner_id);
    }
    if (data.length < pageSize) break;
    from += pageSize;
  }

  // 2. Add managers (primary_owner) of those restaurants
  if (restaurantIds.length) {
    for (let i = 0; i < restaurantIds.length; i += 500) {
      const slice = restaurantIds.slice(i, i + 500);
      const { data: mgrs } = await supabase
        .from("restaurant_managers")
        .select("user_id")
        .in("restaurant_id", slice)
        .eq("role", "primary_owner");
      for (const m of mgrs || []) ownerIds.add(m.user_id);
    }
  }

  // 3. Resolve emails from profiles
  const emails = new Set<string>();
  const ownerIdArr = Array.from(ownerIds);
  for (let i = 0; i < ownerIdArr.length; i += 500) {
    const slice = ownerIdArr.slice(i, i + 500);
    const { data: profs } = await supabase
      .from("profiles")
      .select("email")
      .in("id", slice)
      .not("email", "is", null);
    for (const p of profs || []) if (p.email) emails.add(p.email.toLowerCase());
  }

  return { emails: Array.from(emails), restaurant_count: total };
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      return new Response(JSON.stringify({ error: "RESEND_API_KEY not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Admin-only auth
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleData) {
      return new Response(JSON.stringify({ error: "Forbidden: admin role required" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as RequestBody;
    if (!body.filters) {
      return new Response(JSON.stringify({ error: "filters required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { emails, restaurant_count } = await resolveRecipients(supabase, body.filters);

    // Preview-only: count recipients
    if (body.preview_only) {
      return new Response(JSON.stringify({ recipient_count: emails.length, restaurant_count }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!body.subject || !body.html) {
      return new Response(JSON.stringify({ error: "subject and html required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Test email: send only to the provided test address
    if (body.test_email) {
      const ok = await sendEmail(resendApiKey, body.test_email, body.subject, body.html);
      return new Response(JSON.stringify({ test_sent: ok, recipient_count: emails.length }), {
        status: ok ? 200 : 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Actual bulk send
    let sent = 0;
    let failed = 0;
    for (let i = 0; i < emails.length; i += CONCURRENT_SENDS) {
      const chunk = emails.slice(i, i + CONCURRENT_SENDS);
      const results = await Promise.allSettled(
        chunk.map((to) => sendEmail(resendApiKey, to, body.subject, body.html))
      );
      for (const r of results) {
        if (r.status === "fulfilled" && r.value) sent++;
        else failed++;
      }
    }

    return new Response(JSON.stringify({
      sent, failed, restaurant_count, recipient_count: emails.length,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("send-restaurant-bulk-email error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});