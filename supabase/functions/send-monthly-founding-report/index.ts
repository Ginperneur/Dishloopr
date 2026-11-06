import { requireAdminOrInternal, serviceClient } from "../_shared/auth.ts";
import { sendTemplateEmail } from "../_shared/transactional-email-templates/send-email.ts";
import type { FoundingReportRow } from "../_shared/transactional-email-templates/founding-report.tsx";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const SITE_URL = "https://dishloopr.com";
const PAGE = 1000;
const MONTHS = ["januari", "februari", "maart", "april", "mei", "juni", "juli", "augustus", "september", "oktober", "november", "december"];

interface Body {
  /** "YYYY-MM"; defaults to the previous calendar month. */
  month?: string;
  /** Only report what would be sent. */
  dry_run?: boolean;
  /** Limit the run to one owner (for testing). */
  user_id?: string;
}

function monthRange(month?: string) {
  let y: number, m: number;
  if (month && /^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    [y, m] = month.split("-").map(Number);
  } else {
    const now = new Date();
    y = now.getUTCFullYear();
    m = now.getUTCMonth(); // previous month, 1-based
    if (m === 0) { y -= 1; m = 12; }
  }
  const pad = (n: number) => String(n).padStart(2, "0");
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { key: `${y}-${pad(m)}`, from: `${y}-${pad(m)}-01`, to: `${y}-${pad(m)}-${pad(lastDay)}`, label: `${MONTHS[m - 1]} ${y}` };
}

// Monthly mail per Founding Partner: how often the "Uitgelicht" card was shown
// and clicked on each dish×city page. Runs from pg_cron on the 1st.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const admin = serviceClient();
    const deny = await requireAdminOrInternal(req, admin, corsHeaders);
    if (deny) return deny;

    const body: Body = await req.json().catch(() => ({}));
    const range = monthRange(body.month);

    const stats = new Map<string, { impressie: number; klik: number }>();
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await admin.from("founding_stats_daily")
        .select("restaurant_id, page_slug, metric, n")
        .gte("dag", range.from).lte("dag", range.to)
        .order("restaurant_id").order("page_slug").order("dag").order("metric")
        .range(from, from + PAGE - 1);
      if (error) throw error;
      for (const r of data ?? []) {
        const key = `${r.restaurant_id}|${r.page_slug}`;
        const s = stats.get(key) ?? { impressie: 0, klik: 0 };
        s[r.metric as keyof typeof s] += r.n;
        stats.set(key, s);
      }
      if (!data || data.length < PAGE) break;
    }

    // Live Founding Partners, plus any order that collected numbers this month.
    const orders: any[] = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await admin.from("package_orders")
        .select("restaurant_id, page_slug, status, restaurant:restaurant_id(name, is_active, claimed_by_owner_id)")
        .eq("package", "founding_partner").order("id").range(from, from + PAGE - 1);
      if (error) throw error;
      orders.push(...(data ?? []));
      if (!data || data.length < PAGE) break;
    }

    const byOwner = new Map<string, FoundingReportRow[]>();
    const seen = new Set<string>();
    for (const o of orders) {
      const key = `${o.restaurant_id}|${o.page_slug}`;
      const live = ["active", "trialing", "past_due"].includes(o.status);
      if (seen.has(key) || (!live && !stats.has(key))) continue;
      // During the free period before launch there is nothing to report yet.
      if (o.status === "trialing" && !stats.has(key)) continue;
      seen.add(key);
      const ownerId: string | null = o.restaurant?.claimed_by_owner_id ?? null;
      if (!o.restaurant?.is_active || !ownerId) continue;
      if (body.user_id && ownerId !== body.user_id) continue;
      const s = stats.get(key) ?? { impressie: 0, klik: 0 };
      const rows = byOwner.get(ownerId) ?? [];
      rows.push({ restaurant: o.restaurant.name, page: o.page_slug, impressions: s.impressie, clicks: s.klik, url: `${SITE_URL}/eten/${o.page_slug}` });
      byOwner.set(ownerId, rows);
    }

    const ownerIds = [...byOwner.keys()];
    const optedOut = new Set<string>();
    const alreadySent = new Set<string>();
    const profiles = new Map<string, { email: string | null; name: string | null }>();
    for (let i = 0; i < ownerIds.length; i += 200) {
      const slice = ownerIds.slice(i, i + 200);
      const [prefs, logs, profs] = await Promise.all([
        admin.from("owner_email_preferences").select("user_id").eq("founding_report", false).in("user_id", slice),
        admin.from("owner_founding_report_log").select("user_id").eq("month", range.from).in("user_id", slice),
        admin.from("profiles").select("id, email, name").in("id", slice),
      ]);
      for (const p of prefs.data ?? []) optedOut.add(p.user_id);
      for (const l of logs.data ?? []) alreadySent.add(l.user_id);
      for (const p of profs.data ?? []) profiles.set(p.id, { email: p.email, name: p.name });
    }

    let sent = 0, skipped = 0, suppressed = 0, failed = 0;
    for (const [ownerId, rows] of byOwner) {
      const profile = profiles.get(ownerId);
      if (optedOut.has(ownerId) || alreadySent.has(ownerId) || !profile?.email) { skipped++; continue; }
      if (body.dry_run) { sent++; continue; }
      try {
        const result = await sendTemplateEmail("founding-report", profile.email, {
          idempotencyKey: `founding-report-${ownerId}-${range.key}`,
          templateData: {
            ownerName: profile.name?.split(" ")[0] ?? "",
            monthLabel: range.label,
            rows: rows.sort((a, b) => b.impressions - a.impressions),
            dashboardUrl: `${SITE_URL}/owner-dashboard?section=promotions`,
            preferencesUrl: `${SITE_URL}/owner-dashboard?section=promotions`,
          },
        });
        if (!result.sent) { suppressed++; continue; }
        // Log only after accepted delivery so a failed send is retried next run.
        await admin.from("owner_founding_report_log").insert({ user_id: ownerId, month: range.from });
        sent++;
      } catch (e) {
        console.error("send-monthly-founding-report: send failed", ownerId, e);
        failed++;
      }
    }

    return json({ month: range.key, dry_run: !!body.dry_run, owners: ownerIds.length, sent, skipped, suppressed, failed });
  } catch (err) {
    console.error("send-monthly-founding-report error:", err);
    return json({ error: err instanceof Error ? err.message : "Unknown error" }, 500);
  }
});
