import { requireAdminOrInternal, serviceClient } from "../_shared/auth.ts";
import { sendTemplateEmail } from "../_shared/transactional-email-templates/send-email.ts";
import type { EventReportRestaurant } from "../_shared/transactional-email-templates/event-report.tsx";

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

// Monthly mail per owner: per active event how often it was shown ("in beeld")
// and opened ("bekeken"). Runs from pg_cron on the 1st; admins can call it too.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const admin = serviceClient();
    const deny = await requireAdminOrInternal(req, admin, corsHeaders);
    if (deny) return deny;

    const body: Body = await req.json().catch(() => ({}));
    const range = monthRange(body.month);

    // Counters for the month, complete via paginated reads.
    const stats = new Map<string, { impressie: number; bekeken: number; klik: number }>();
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await admin
        .from("restaurant_event_stats_daily")
        .select("event_id, metric, n")
        .gte("dag", range.from).lte("dag", range.to)
        .order("event_id").order("dag").order("metric")
        .range(from, from + PAGE - 1);
      if (error) throw error;
      for (const row of data ?? []) {
        const s = stats.get(row.event_id) ?? { impressie: 0, bekeken: 0, klik: 0 };
        s[row.metric as keyof typeof s] += row.n;
        stats.set(row.event_id, s);
      }
      if (!data || data.length < PAGE) break;
    }

    // Events that are promoted now, plus any that collected numbers during the month.
    const events = new Map<string, any>();
    const select = "id, title, is_active, promotion_status, restaurant:restaurant_id(id, name, is_active, claimed_by_owner_id)";
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await admin.from("restaurant_events").select(select)
        .in("promotion_status", ["paid", "comped"]).eq("is_active", true)
        .order("id").range(from, from + PAGE - 1);
      if (error) throw error;
      for (const e of data ?? []) events.set(e.id, e);
      if (!data || data.length < PAGE) break;
    }
    const missing = [...stats.keys()].filter(id => !events.has(id));
    for (let i = 0; i < missing.length; i += 200) {
      const { data, error } = await admin.from("restaurant_events").select(select).in("id", missing.slice(i, i + 200));
      if (error) throw error;
      for (const e of data ?? []) events.set(e.id, e);
    }

    // Group by owner, then restaurant.
    const byOwner = new Map<string, Map<string, EventReportRestaurant>>();
    for (const e of events.values()) {
      const r = e.restaurant;
      const ownerId: string | null = r?.claimed_by_owner_id ?? null;
      if (!r?.is_active || !ownerId) continue;
      if (body.user_id && ownerId !== body.user_id) continue;
      const restaurants = byOwner.get(ownerId) ?? new Map<string, EventReportRestaurant>();
      const entry: EventReportRestaurant = restaurants.get(r.id) ?? { name: r.name, events: [] };
      const s = stats.get(e.id) ?? { impressie: 0, bekeken: 0, klik: 0 };
      entry.events.push({ title: e.title, impressions: s.impressie, views: s.bekeken, clicks: s.klik, url: `${SITE_URL}/evenementen/${e.id}` });
      restaurants.set(r.id, entry);
      byOwner.set(ownerId, restaurants);
    }

    const ownerIds = [...byOwner.keys()];
    const optedOut = new Set<string>();
    const alreadySent = new Set<string>();
    const profiles = new Map<string, { email: string | null; name: string | null }>();
    for (let i = 0; i < ownerIds.length; i += 200) {
      const slice = ownerIds.slice(i, i + 200);
      const [prefs, logs, profs] = await Promise.all([
        admin.from("owner_email_preferences").select("user_id").eq("event_report", false).in("user_id", slice),
        admin.from("owner_event_report_log").select("user_id").eq("month", range.from).in("user_id", slice),
        admin.from("profiles").select("id, email, name").in("id", slice),
      ]);
      for (const p of prefs.data ?? []) optedOut.add(p.user_id);
      for (const l of logs.data ?? []) alreadySent.add(l.user_id);
      for (const p of profs.data ?? []) profiles.set(p.id, { email: p.email, name: p.name });
    }

    let sent = 0, skipped = 0, suppressed = 0, failed = 0;
    for (const [ownerId, restaurants] of byOwner) {
      const profile = profiles.get(ownerId);
      if (optedOut.has(ownerId) || alreadySent.has(ownerId) || !profile?.email) { skipped++; continue; }
      if (body.dry_run) { sent++; continue; }

      const list = [...restaurants.values()].map(r => ({ ...r, events: r.events.sort((a, b) => b.impressions - a.impressions) }));
      try {
        const result = await sendTemplateEmail("event-report", profile.email, {
          idempotencyKey: `event-report-${ownerId}-${range.key}`,
          templateData: {
            ownerName: profile.name?.split(" ")[0] ?? "",
            monthLabel: range.label,
            restaurants: list,
            dashboardUrl: `${SITE_URL}/owner-dashboard?section=evenementen`,
            preferencesUrl: `${SITE_URL}/owner-dashboard?section=evenementen`,
          },
        });
        if (!result.sent) { suppressed++; continue; }
        // Log only after accepted delivery so a failed send is retried next run.
        await admin.from("owner_event_report_log").insert({ user_id: ownerId, month: range.from });
        sent++;
      } catch (e) {
        console.error("send-monthly-event-report: send failed", ownerId, e);
        failed++;
      }
    }

    return json({ month: range.key, dry_run: !!body.dry_run, owners: ownerIds.length, sent, skipped, suppressed, failed });
  } catch (err) {
    console.error("send-monthly-event-report error:", err);
    return json({ error: err instanceof Error ? err.message : "Unknown error" }, 500);
  }
});
