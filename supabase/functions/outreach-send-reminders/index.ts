// Claim reminders, sending side. Who is due comes from admin_claim_followup() (opvolg_status
// 'herinnering_klaar'), the same source the admin screen shows. Modes:
//   preview  { restaurant_id }                  rendered next reminder, nothing sent
//   test     { restaurant_id, test_email }      sends that reminder to test_email only
//   run      { limit? }                         admin: send due reminders now (ignores reminders_enabled)
//   cron     {}                                 scheduled: sends only while outreach_settings.reminders_enabled
// One row per restaurant per step (UNIQUE restaurant_id, step); reminders share the golf's daily cap.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.118.0";
import { getCaller, isAdmin, isInternalCaller, serviceClient } from "../_shared/auth.ts";
import { mentionsViews, renderReminder } from "../_shared/outreach/reminders.ts";
import type { OutreachSegment } from "../_shared/outreach/templates.ts";
import { outreachSentToday, SENDER_NAME, sendOutreachMail, SITE, unsubscribeToken } from "../_shared/outreach/mailer.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

// Public launch (Amsterdam midnight); before it the copy says "gaat live", after it "is live".
const LAUNCH_AT = Date.parse(Deno.env.get("LAUNCH_AT") ?? "2026-12-01T00:00:00+01:00");
const STALE_SENDING_MS = 60 * 60 * 1000;

interface Row {
  restaurant_id: string; name: string; slug: string; stad: string | null; email: string | null;
  segment: OutreachSegment; herinneringen: number; views_sinds_mail: number;
  laatst_gemaild_op: string | null; opvolg_status: string;
}
interface Settings {
  reminders_enabled: boolean; reminder_interval_days: number; reminder_max: number;
  batch_size: number; daily_cap: number; menu_minimum: number;
}

async function settings(db: SupabaseClient): Promise<Settings> {
  const { data, error } = await db.from("outreach_settings").select("*").eq("id", true).single();
  if (error) throw error;
  return data as Settings;
}

async function followup(db: SupabaseClient): Promise<Row[]> {
  const out: Row[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.rpc("admin_claim_followup").order("restaurant_id").range(from, from + 999);
    if (error) throw error;
    out.push(...((data ?? []) as Row[]));
    if (!data || data.length < 1000) return out;
  }
}

async function render(db: SupabaseClient, r: Row, s: Settings) {
  const token = await unsubscribeToken(db, r.restaurant_id);
  const step = Math.min(r.herinneringen + 1, s.reminder_max);
  const q = new URLSearchParams({ t: token, slug: r.slug, naam: r.name });
  const utm = `utm_source=outreach&utm_medium=email&utm_campaign=herinnering_${step}`;
  const mail = renderReminder(r.segment, {
    name: r.name,
    city: r.stad,
    dishCount: 0,
    inviteUrl: `${SITE}/voor-restaurants/${encodeURIComponent(r.slug)}?${utm}`,
    claimUrl: `${SITE}/claim/${encodeURIComponent(r.slug)}?${utm}`,
    unsubscribeUrl: `${SITE}/voor-restaurants/afmelden?${q}`,
    optoutUrl: `${SITE}/voor-restaurants/afmelden?${new URLSearchParams({ slug: r.slug, naam: r.name })}`,
    menuMinimum: s.menu_minimum,
    senderName: SENDER_NAME,
    step,
    maxSteps: s.reminder_max,
    views: r.views_sinds_mail,
    launched: Date.now() >= LAUNCH_AT,
  });
  return { mail, token, step };
}

/** Takes the (restaurant, step) slot; a failed or stuck earlier attempt at the same step is retried. */
async function claimSlot(db: SupabaseClient, r: Row, step: number, subject: string, views: number | null) {
  const fields = { segment: r.segment, to_email: r.email!, subject, views_mentioned: views, status: "sending", error: null };
  const { data } = await db.from("outreach_reminders").insert({ restaurant_id: r.restaurant_id, step, ...fields }).select("id").maybeSingle();
  if (data) return data.id as string;
  const stale = new Date(Date.now() - STALE_SENDING_MS).toISOString();
  const { data: retry } = await db.from("outreach_reminders")
    .update({ ...fields, created_at: new Date().toISOString() })
    .eq("restaurant_id", r.restaurant_id).eq("step", step)
    .or(`status.eq.failed,and(status.eq.sending,created_at.lt.${stale})`)
    .select("id").maybeSingle();
  return (retry?.id as string) ?? null;
}

async function runBatch(db: SupabaseClient, apiKey: string, limitOverride?: number) {
  const s = await settings(db);
  const room = Math.max(0, s.daily_cap - (await outreachSentToday(db)));
  const limit = Math.min(room, limitOverride ?? s.batch_size, 100);
  if (limit === 0) return { sent: 0, failed: 0, skipped: "daglimiet bereikt", remaining_today: 0 };

  const due = (await followup(db))
    .filter((r) => r.opvolg_status === "herinnering_klaar" && r.email)
    .sort((a, b) => (a.laatst_gemaild_op ?? "").localeCompare(b.laatst_gemaild_op ?? ""))
    .slice(0, limit);

  let sent = 0, failed = 0;
  for (const r of due) {
    const { mail, token, step } = await render(db, r, s);
    const id = await claimSlot(db, r, step, mail.subject, mentionsViews(r.views_sinds_mail) ? r.views_sinds_mail : null);
    if (!id) continue;
    const res = await sendOutreachMail({ apiKey, to: r.email!, restaurantId: r.restaurant_id, segment: r.segment, campaign: `herinnering_${step}`, mail, token });
    const now = new Date().toISOString();
    if (res.ok) {
      sent++;
      await db.from("outreach_reminders").update({ status: "sent", provider_id: res.id, sent_at: now }).eq("id", id);
      await db.from("restaurant_contacts").update({ laatst_gemaild_op: now }).eq("restaurant_id", r.restaurant_id);
    } else {
      failed++;
      await db.from("outreach_reminders").update({ status: "failed", error: res.error }).eq("id", id);
    }
    await new Promise((ok) => setTimeout(ok, 250)); // stay well under Resend's rate limit
  }
  return { sent, failed, due: due.length, remaining_today: room - sent };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const db = serviceClient();
    const internal = await isInternalCaller(req, db);
    if (!internal) {
      const user = await getCaller(req);
      if (!user) return json({ error: "Unauthorized" }, 401);
      if (!(await isAdmin(db, user.id))) return json({ error: "Forbidden" }, 403);
    }
    const body = await req.json().catch(() => ({}));
    const mode = String(body.mode ?? "");
    const apiKey = Deno.env.get("RESEND_API_KEY");

    if (mode === "preview" || mode === "test") {
      const id = String(body.restaurant_id ?? "");
      const r = (await followup(db)).find((x) => x.restaurant_id === id);
      if (!r) return json({ error: "Restaurant niet gevonden" }, 404);
      if (!r.email) return json({ error: "Geen mailadres bekend" }, 400);
      const s = await settings(db);
      const { mail, token, step } = await render(db, r, s);
      if (mode === "preview") return json({ ...mail, to: r.email, step, views: r.views_sinds_mail, opvolg_status: r.opvolg_status });
      const to = String(body.test_email ?? "");
      if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(to)) return json({ error: "Geldig testadres nodig" }, 400);
      if (!apiKey) return json({ error: "RESEND_API_KEY ontbreekt" }, 500);
      const res = await sendOutreachMail({
        apiKey, to, restaurantId: r.restaurant_id, segment: r.segment, campaign: "herinnering_test",
        mail: { ...mail, subject: `[TEST] ${mail.subject}` }, token,
      });
      return json(res, res.ok ? 200 : 502);
    }

    if (mode === "run" || mode === "cron") {
      if (!apiKey) return json({ error: "RESEND_API_KEY ontbreekt" }, 500);
      if (mode === "cron") {
        if (!internal) return json({ error: "Forbidden" }, 403);
        if (!(await settings(db)).reminders_enabled) return json({ skipped: "uitgeschakeld" });
      }
      const limit = Number.isFinite(Number(body.limit)) && Number(body.limit) > 0 ? Number(body.limit) : undefined;
      return json(await runBatch(db, apiKey, limit));
    }
    return json({ error: "Onbekende mode" }, 400);
  } catch (e) {
    console.error("outreach-send-reminders", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
