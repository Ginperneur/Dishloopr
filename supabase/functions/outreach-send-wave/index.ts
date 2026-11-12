// Outreach agent, sending side. Modes:
//   preview  { restaurant_id }                  rendered mail, nothing sent
//   test     { restaurant_id, test_email }      sends that restaurant's mail to test_email only
//   run      { limit? }                         admin: send the next batch now (ignores `enabled`)
//   cron     {}                                 scheduled: sends only while outreach_settings.enabled
// Each restaurant gets at most one mail per wave (UNIQUE restaurant_id, wave), and every run
// respects the daily cap so the sending domain warms up instead of landing in spam.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.57.2";
import { getCaller, isAdmin, isInternalCaller, serviceClient } from "../_shared/auth.ts";
import { type OutreachSegment, renderOutreach } from "../_shared/outreach/templates.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const SITE = (Deno.env.get("SITE_URL") ?? "https://dishloopr.com").replace(/\/$/, "");
const FROM = Deno.env.get("OUTREACH_FROM") ?? "Ginuwine Ayanne van Dishloopr <hallo@dishloopr.com>";
const SENDER_NAME = Deno.env.get("OUTREACH_SENDER_NAME") ?? "Ginuwine Ayanne";
// Inbound domain routed to Resend (MX). Replies to antwoord+<restaurant id>@domain reach outreach-inbound.
const REPLY_DOMAIN = Deno.env.get("OUTREACH_REPLY_DOMAIN") ?? "";
const REPLY_TO = Deno.env.get("OUTREACH_REPLY_TO") ?? "";
// Owner flyer in the private "marketing" bucket (uploaded in Admin > Outreach); the workspace blocks
// public buckets, so every batch signs a fresh link. OUTREACH_FLYER_URL overrides it with a fixed URL.
const FLYER_URL_OVERRIDE = Deno.env.get("OUTREACH_FLYER_URL") || "";
const FLYER_PATH = "outreach/dishloopr-flyer.pdf";
// Attachments are fetched by Resend while sending; a link in a mail must keep working for months.
const SIGNED_TTL = { attachment: 60 * 60 * 6, link: 60 * 60 * 24 * 365 };
const FLYER_NAME = "Dishloopr flyer voor restauranteigenaren.pdf";
type Flyer = { mode: "attachment" | "link"; url: string } | null;

/**
 * Decides how this batch handles the flyer. When it cannot be fetched the mails still go out,
 * just without the flyer sentence, and the admin screen shows the warning.
 */
async function resolveFlyer(db: SupabaseClient, mode: string): Promise<{ flyer: Flyer; warning: string | null }> {
  let warning: string | null = null;
  let flyer: Flyer = null;
  if (mode !== "uit") {
    const flyerMode = mode === "link" ? "link" : "attachment";
    try {
      let url = FLYER_URL_OVERRIDE;
      if (!url) {
        const { data, error } = await db.storage.from("marketing").createSignedUrl(FLYER_PATH, SIGNED_TTL[flyerMode]);
        if (error || !data?.signedUrl) throw new Error(error?.message ?? "geen flyer gevonden, upload hem in Admin > Outreach");
        url = data.signedUrl;
      }
      const r = await fetch(url, { method: "HEAD" });
      if (r.ok && (r.headers.get("content-type") ?? "").includes("pdf")) {
        flyer = { mode: flyerMode, url };
      } else {
        warning = `Flyer niet bereikbaar (${r.status}); mails gaan zonder flyer. Upload de flyer opnieuw.`;
      }
    } catch (e) {
      warning = `Flyer niet bereikbaar (${e instanceof Error ? e.message : "netwerkfout"}); mails gaan zonder flyer.`;
    }
  }
  await db.from("outreach_settings").update({ flyer_warning: warning, flyer_checked_at: new Date().toISOString() }).eq("id", true);
  return { flyer, warning };
}

interface Target {
  restaurant_id: string; name: string; slug: string; stad: string | null; email: string;
  segment: OutreachSegment; goedgekeurde_gerechten: number; is_active: boolean;
}

async function settings(db: SupabaseClient) {
  const { data } = await db.from("outreach_settings").select("*").eq("id", true).single();
  return data as { enabled: boolean; wave: number; batch_size: number; daily_cap: number; menu_minimum: number; flyer_mode: string };
}

async function unsubscribeToken(db: SupabaseClient, restaurantId: string): Promise<string> {
  const { data } = await db.from("restaurant_contacts").select("afmeld_token").eq("restaurant_id", restaurantId).maybeSingle();
  if (data?.afmeld_token) return String(data.afmeld_token);
  const token = crypto.randomUUID();
  await db.from("restaurant_contacts").update({ afmeld_token: token }).eq("restaurant_id", restaurantId);
  return token;
}

async function topDish(db: SupabaseClient, t: Target) {
  if (!t.is_active) return null;
  const { data } = await db.rpc("restaurant_positions", { p_slug: t.slug });
  const rows = ((data as { dish_name: string; position: number; total: number }[]) ?? [])
    .filter((r) => r.position && r.total >= 3)
    .sort((a, b) => a.position - b.position || b.total - a.total);
  return rows[0] ? { dish: rows[0].dish_name, position: rows[0].position, total: rows[0].total } : null;
}

async function render(db: SupabaseClient, t: Target, menuMinimum: number, flyer: Flyer) {
  const token = await unsubscribeToken(db, t.restaurant_id);
  const q = new URLSearchParams({ t: token, slug: t.slug, naam: t.name });
  const utm = "utm_source=outreach&utm_medium=email&utm_campaign=mail_golf";
  const mail = renderOutreach(t.segment, {
    name: t.name,
    city: t.stad,
    dishCount: t.goedgekeurde_gerechten,
    topDish: await topDish(db, t),
    inviteUrl: `${SITE}/voor-restaurants/${encodeURIComponent(t.slug)}?${utm}`,
    claimUrl: `${SITE}/claim/${encodeURIComponent(t.slug)}?${utm}`,
    pricingUrl: `${SITE}/voor-restaurants/pakketten?${utm}`,
    unsubscribeUrl: `${SITE}/voor-restaurants/afmelden?${q}`,
    optoutUrl: `${SITE}/voor-restaurants/afmelden?${new URLSearchParams({ slug: t.slug, naam: t.name })}`,
    menuMinimum,
    senderName: SENDER_NAME,
    flyer,
  });
  return { mail, token };
}

async function send(apiKey: string, to: string, t: Target, mail: { subject: string; html: string; text: string }, token: string, flyer: Flyer) {
  const replyTo = REPLY_DOMAIN ? `antwoord+${t.restaurant_id}@${REPLY_DOMAIN}` : REPLY_TO || undefined;
  const oneClick = `${Deno.env.get("SUPABASE_URL")}/functions/v1/outreach-unsubscribe?t=${encodeURIComponent(token)}`;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: FROM, to: [to], reply_to: replyTo, subject: mail.subject, html: mail.html, text: mail.text,
      headers: { "List-Unsubscribe": `<${oneClick}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
      tags: [{ name: "campaign", value: "mail_golf" }, { name: "segment", value: t.segment }],
      ...(flyer?.mode === "attachment" ? { attachments: [{ filename: FLYER_NAME, path: flyer.url }] } : {}),
    }),
  });
  const body = await res.json().catch(() => ({}));
  return res.ok ? { ok: true as const, id: String(body.id ?? "") } : { ok: false as const, error: String(body.message ?? res.status) };
}

const TARGET_COLS = "restaurant_id,name,slug,stad,email,segment,goedgekeurde_gerechten,is_active";

async function loadTarget(db: SupabaseClient, restaurantId: string): Promise<Target | null> {
  const { data } = await db.from("outreach_targets").select(TARGET_COLS).eq("restaurant_id", restaurantId).maybeSingle();
  return (data as Target) ?? null;
}

async function runBatch(db: SupabaseClient, apiKey: string, limitOverride?: number) {
  const s = await settings(db);
  const dayStart = new Date(); dayStart.setUTCHours(0, 0, 0, 0);
  const { count: today } = await db.from("outreach_messages").select("id", { count: "exact", head: true })
    .gte("created_at", dayStart.toISOString()).neq("status", "failed");
  const room = Math.max(0, s.daily_cap - (today ?? 0));
  const limit = Math.min(room, limitOverride ?? s.batch_size, 200);
  if (limit === 0) return { sent: 0, failed: 0, skipped: "daglimiet bereikt", wave: s.wave };
  const { flyer, warning } = await resolveFlyer(db, s.flyer_mode);

  const { data: rows, error } = await db.from("outreach_targets").select(TARGET_COLS)
    .eq("mail_status", "mailbaar").in("segment", ["zichtbaar", "onzichtbaar_menu"])
    .or(`mail_golf.is.null,mail_golf.lt.${s.wave}`)
    .order("goedgekeurde_gerechten", { ascending: false }).limit(limit);
  if (error) throw error;

  let sent = 0, failed = 0;
  for (const t of (rows ?? []) as Target[]) {
    // Claim the slot first: the unique key makes a second run skip this restaurant.
    const { mail, token } = await render(db, t, s.menu_minimum, flyer);
    const { data: claim, error: claimErr } = await db.from("outreach_messages")
      .insert({ restaurant_id: t.restaurant_id, wave: s.wave, segment: t.segment, to_email: t.email, subject: mail.subject })
      .select("id").single();
    if (claimErr || !claim) continue;
    const r = await send(apiKey, t.email, t, mail, token, flyer);
    const now = new Date().toISOString();
    if (r.ok) {
      sent++;
      await db.from("outreach_messages").update({ status: "sent", provider_id: r.id, sent_at: now }).eq("id", claim.id);
      await db.from("restaurant_contacts").update({ mail_golf: s.wave, laatst_gemaild_op: now }).eq("restaurant_id", t.restaurant_id);
    } else {
      failed++;
      await db.from("outreach_messages").update({ status: "failed", error: r.error }).eq("id", claim.id);
    }
    await new Promise((res) => setTimeout(res, 250)); // stay well under Resend's rate limit
  }
  return { sent, failed, wave: s.wave, remaining_today: room - sent, flyer_warning: warning };
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
      const t = await loadTarget(db, String(body.restaurant_id ?? ""));
      if (!t) return json({ error: "Restaurant niet gevonden" }, 404);
      if (t.segment !== "zichtbaar" && t.segment !== "onzichtbaar_menu") return json({ error: `Segment ${t.segment} wordt niet gemaild` }, 400);
      const s = await settings(db);
      const { flyer, warning } = await resolveFlyer(db, s.flyer_mode);
      const { mail, token } = await render(db, t, s.menu_minimum, flyer);
      if (mode === "preview") return json({ ...mail, to: t.email, segment: t.segment, flyer_warning: warning });
      const to = String(body.test_email ?? "");
      if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(to)) return json({ error: "Geldig testadres nodig" }, 400);
      if (!apiKey) return json({ error: "RESEND_API_KEY ontbreekt" }, 500);
      const r = await send(apiKey, to, t, { ...mail, subject: `[TEST] ${mail.subject}` }, token, flyer);
      return json({ ...r, flyer_warning: warning }, r.ok ? 200 : 502);
    }

    if (mode === "run" || mode === "cron") {
      if (!apiKey) return json({ error: "RESEND_API_KEY ontbreekt" }, 500);
      if (mode === "cron") {
        if (!internal) return json({ error: "Forbidden" }, 403);
        if (!(await settings(db)).enabled) return json({ skipped: "uitgeschakeld" });
      }
      const limit = Number.isFinite(Number(body.limit)) && Number(body.limit) > 0 ? Number(body.limit) : undefined;
      return json(await runBatch(db, apiKey, limit));
    }
    return json({ error: "Onbekende mode" }, 400);
  } catch (e) {
    console.error("outreach-send-wave", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
