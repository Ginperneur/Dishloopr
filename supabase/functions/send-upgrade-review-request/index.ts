import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const TRUSTPILOT_URL = "https://www.trustpilot.com/evaluate/dishloopr.com";
const FEEDBACK_URL = "https://dishloopr.com/internal-feedback";

type UpgradeKind = "featured" | "sponsored_dish" | "newsletter" | "owner_pro";

interface UpgradeRow {
  id: string;
  kind: UpgradeKind;
  table: string;
  restaurant_id: string | null;
  user_id: string | null;
  ended_at: string;
}

function labelFor(kind: UpgradeKind): string {
  switch (kind) {
    case "featured": return "Featured listing";
    case "sponsored_dish": return "Gepushte gerecht (Sponsored)";
    case "newsletter": return "Nieuwsbrief plaatsing";
    case "owner_pro": return "Owner Pro abonnement";
  }
}

function buildEmailHtml(opts: {
  ownerName: string | null;
  restaurantName: string | null;
  kindLabel: string;
}): string {
  const greeting = opts.ownerName ? `Hi ${opts.ownerName}` : "Hi";
  const ctx = opts.restaurantName
    ? `je <strong>${opts.kindLabel}</strong> voor <strong>${opts.restaurantName}</strong> is afgelopen`
    : `je <strong>${opts.kindLabel}</strong> is afgelopen`;

  return `
  <div style="font-family: 'DM Sans', system-ui, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; color:#1a1a1a;">
    <h2 style="font-family:'Bricolage Grotesque', serif; color:#F26522; margin:0 0 12px;">Bedankt voor je upgrade 🍽️</h2>
    <p style="font-size:15px; line-height:1.5;">${greeting},</p>
    <p style="font-size:15px; line-height:1.5;">
      ${ctx}. We hopen dat je goede resultaten hebt gezien op Dishloopr.
    </p>
    <p style="font-size:15px; line-height:1.5;">
      Je feedback helpt ons enorm — en helpt ook andere restauranthouders de juiste keuze te maken.
    </p>

    <div style="background:#FFF4EC; border-radius:14px; padding:18px; margin:20px 0;">
      <p style="margin:0 0 12px; font-weight:600;">Zou je 30 seconden willen besteden aan een review?</p>
      <div style="display:block; margin:8px 0;">
        <a href="${TRUSTPILOT_URL}" style="display:inline-block; background:#F26522; color:#fff; text-decoration:none; padding:10px 18px; border-radius:10px; font-weight:600;">
          ⭐ Review op Trustpilot
        </a>
      </div>
      <div style="display:block; margin:12px 0 0;">
        <a href="${FEEDBACK_URL}" style="display:inline-block; background:#fff; color:#F26522; border:1px solid #F26522; text-decoration:none; padding:10px 18px; border-radius:10px; font-weight:600;">
          💬 Deel interne feedback
        </a>
      </div>
    </div>

    <p style="font-size:13px; color:#666; line-height:1.5;">
      Liever niet? Geen probleem — je kunt deze mail gewoon negeren.
    </p>
    <p style="font-size:13px; color:#888; margin-top:24px;">— Team Dishloopr</p>
  </div>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: "Missing RESEND_API_KEY" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = new URL(req.url);
    const dryRun = url.searchParams.get("dry_run") === "1";
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "50", 10), 200);
    const nowIso = new Date().toISOString();

    const candidates: UpgradeRow[] = [];

    // Featured subscriptions (expired)
    const { data: feats } = await supabase
      .from("featured_subscriptions")
      .select("id, restaurant_id, expires_at")
      .lte("expires_at", nowIso)
      .is("review_request_sent_at", null)
      .limit(limit);
    for (const r of feats ?? []) candidates.push({
      id: r.id, kind: "featured", table: "featured_subscriptions",
      restaurant_id: r.restaurant_id, user_id: null, ended_at: r.expires_at,
    });

    // Sponsored dish purchases (expired)
    const { data: sponsored } = await supabase
      .from("sponsored_purchases")
      .select("id, restaurant_id, purchased_by, expires_at")
      .lte("expires_at", nowIso)
      .is("review_request_sent_at", null)
      .limit(limit);
    for (const r of sponsored ?? []) candidates.push({
      id: r.id, kind: "sponsored_dish", table: "sponsored_purchases",
      restaurant_id: r.restaurant_id, user_id: r.purchased_by, ended_at: r.expires_at,
    });

    // Newsletter placements (sent edition)
    const { data: news } = await supabase
      .from("newsletter_placements")
      .select("id, restaurant_id, user_id, status, updated_at, edition_id, newsletter_editions!inner(sent_at)")
      .eq("status", "sent")
      .is("review_request_sent_at", null)
      .not("newsletter_editions.sent_at", "is", null)
      .lte("newsletter_editions.sent_at", nowIso)
      .limit(limit);
    for (const r of (news ?? []) as any[]) candidates.push({
      id: r.id, kind: "newsletter", table: "newsletter_placements",
      restaurant_id: r.restaurant_id, user_id: r.user_id,
      ended_at: r.newsletter_editions?.sent_at ?? r.updated_at,
    });

    // Owner Pro subscriptions (canceled or period ended without renewal)
    const { data: pro } = await supabase
      .from("owner_pro_subscriptions")
      .select("id, user_id, status, current_period_end")
      .in("status", ["canceled", "incomplete_expired"])
      .is("review_request_sent_at", null)
      .limit(limit);
    for (const r of pro ?? []) candidates.push({
      id: r.id, kind: "owner_pro", table: "owner_pro_subscriptions",
      restaurant_id: null, user_id: r.user_id,
      ended_at: r.current_period_end ?? new Date().toISOString(),
    });

    const stats = { found: candidates.length, sent: 0, skipped: 0, errors: 0 };

    if (dryRun) {
      return new Response(JSON.stringify({ dryRun: true, stats, candidates }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Resolve owner email per restaurant or per user
    const restaurantIds = [...new Set(candidates.map(c => c.restaurant_id).filter(Boolean))] as string[];
    const restMap = new Map<string, { name: string; owner_id: string | null }>();
    if (restaurantIds.length) {
      const { data: rests } = await supabase
        .from("restaurants")
        .select("id, name, claimed_by_owner_id")
        .in("id", restaurantIds);
      for (const r of rests ?? []) restMap.set(r.id, { name: r.name, owner_id: r.claimed_by_owner_id });
    }

    const userIds = new Set<string>();
    for (const c of candidates) {
      const restOwner = c.restaurant_id ? restMap.get(c.restaurant_id)?.owner_id : null;
      const uid = restOwner ?? c.user_id;
      if (uid) userIds.add(uid);
    }
    const profileMap = new Map<string, { email: string | null; name: string | null }>();
    if (userIds.size) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, email, name")
        .in("id", [...userIds]);
      for (const p of profs ?? []) profileMap.set(p.id, { email: p.email, name: p.name });
    }

    for (const c of candidates) {
      try {
        const restOwner = c.restaurant_id ? restMap.get(c.restaurant_id)?.owner_id : null;
        const uid = restOwner ?? c.user_id;
        const prof = uid ? profileMap.get(uid) : null;
        const email = prof?.email;
        const restName = c.restaurant_id ? restMap.get(c.restaurant_id)?.name ?? null : null;

        if (!email) {
          // mark as sent to avoid loop; nothing to do
          await supabase.from(c.table).update({ review_request_sent_at: nowIso }).eq("id", c.id);
          stats.skipped++;
          continue;
        }

        const html = buildEmailHtml({
          ownerName: prof?.name ?? null,
          restaurantName: restName,
          kindLabel: labelFor(c.kind),
        });

        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: "Dishloopr <noreply@dishloopr.com>",
            to: [email],
            subject: `Hoe was je ${labelFor(c.kind)} op Dishloopr?`,
            html,
          }),
        });

        if (!res.ok) {
          stats.errors++;
          continue;
        }

        await supabase.from(c.table).update({ review_request_sent_at: nowIso }).eq("id", c.id);
        stats.sent++;
      } catch (_e) {
        stats.errors++;
      }
    }

    return new Response(JSON.stringify({ stats }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});