import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Body {
  preview_only?: boolean;
  resend_after_days?: number; // skip restaurants reminded in last N days
  max?: number; // safety cap per run
}

function buildEmail(ownerName: string | null, restaurantName: string): { subject: string; html: string } {
  const subject = `Koppel je reserveringslink voor ${restaurantName} op Dishloopr`;
  const greeting = ownerName ? `Hi ${ownerName},` : 'Hi,';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #1a1a1a;">
      <div style="padding: 24px 0; border-bottom: 3px solid #F26522;">
        <h1 style="margin: 0; font-size: 22px; color: #F26522;">Dishloopr</h1>
      </div>
      <div style="padding: 24px 0;">
        <p style="font-size: 16px;">${greeting}</p>
        <p>Gasten die <strong>${restaurantName}</strong> via Dishloopr vinden willen vaak meteen een tafel reserveren. Op dit moment hebben we nog géén reserveringslink van jullie staan.</p>
        <p>Wat je kunt doen (kost 30 seconden):</p>
        <ul>
          <li>Plak je <strong>Zenchef / TheFork / OpenTable / eigen reserveringslink</strong> in je dashboard.</li>
          <li>Of klik op <em>"Auto-detecteer via website"</em> en wij vinden 'm zelf.</li>
        </ul>
        <p style="text-align: center; margin: 32px 0;">
          <a href="https://dishloopr.com/dashboard/owner?tab=info" style="background: #F26522; color: #fff; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600;">
            Koppel je reserveringslink
          </a>
        </p>
        <p style="color: #666; font-size: 13px;">Restaurants met een actieve reserveringslink converteren tot 4× meer bezoekers naar daadwerkelijke gasten.</p>
      </div>
      <div style="padding: 16px 0; border-top: 1px solid #eee; font-size: 12px; color: #888;">
        Je krijgt deze mail omdat je restaurant geclaimd is op Dishloopr.
      </div>
    </div>
  `;
  return { subject, html };
}

async function sendEmail(apiKey: string, to: string, subject: string, html: string): Promise<boolean> {
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: "Dishloopr <noreply@dishloopr.com>", to: [to], subject, html }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Admin-only
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const token = authHeader.replace("Bearer ", "");
    const authClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user } } = await authClient.auth.getUser(token);
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!isAdmin) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const body: Body = await req.json().catch(() => ({}));
    const previewOnly = !!body.preview_only;
    const resendAfterDays = body.resend_after_days ?? 30;
    const maxPerRun = Math.min(body.max ?? 500, 1000);

    const cutoff = new Date(Date.now() - resendAfterDays * 86400 * 1000).toISOString();

    // Build candidate list: active, claimed, no reservation_url, has website, not reminded recently
    let q = supabase
      .from("restaurants")
      .select("id, name, claimed_by_owner_id, reservation_reminder_sent_at", { count: "exact" })
      .eq("is_active", true)
      .is("reservation_url", null)
      .not("website_url", "is", null)
      .not("claimed_by_owner_id", "is", null)
      .or(`reservation_reminder_sent_at.is.null,reservation_reminder_sent_at.lt.${cutoff}`)
      .order("reservation_reminder_sent_at", { ascending: true, nullsFirst: true })
      .limit(maxPerRun);

    const { data: candidates, error, count } = await q;
    if (error) throw error;

    if (previewOnly) {
      return new Response(JSON.stringify({ preview: true, candidates: count ?? candidates?.length ?? 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) {
      return new Response(JSON.stringify({ error: "RESEND_API_KEY not configured" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Resolve owner emails
    const ownerIds = Array.from(new Set((candidates || []).map(c => c.claimed_by_owner_id).filter(Boolean)));
    const ownerInfo = new Map<string, { email: string | null; name: string | null }>();
    for (let i = 0; i < ownerIds.length; i += 500) {
      const slice = ownerIds.slice(i, i + 500);
      const { data: profs } = await supabase.from("profiles").select("id, email, name").in("id", slice);
      for (const p of profs || []) ownerInfo.set(p.id, { email: p.email, name: p.name });
    }

    let sent = 0;
    let skipped = 0;
    const sentRestaurantIds: string[] = [];

    for (const r of candidates || []) {
      const owner = ownerInfo.get(r.claimed_by_owner_id);
      if (!owner?.email) { skipped++; continue; }
      const { subject, html } = buildEmail(owner.name, r.name);
      const ok = await sendEmail(resendKey, owner.email, subject, html);
      if (ok) { sent++; sentRestaurantIds.push(r.id); } else { skipped++; }
    }

    // Mark sent restaurants
    if (sentRestaurantIds.length) {
      for (let i = 0; i < sentRestaurantIds.length; i += 500) {
        const slice = sentRestaurantIds.slice(i, i + 500);
        await supabase
          .from("restaurants")
          .update({ reservation_reminder_sent_at: new Date().toISOString() })
          .in("id", slice);
      }
    }

    return new Response(JSON.stringify({ sent, skipped, total_candidates: candidates?.length ?? 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("notify-owners-missing-reservation error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});