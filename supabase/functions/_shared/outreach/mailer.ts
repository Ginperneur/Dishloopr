// Sending side shared by outreach-send-wave and outreach-send-reminders: same sender, reply address
// (antwoord+<restaurant id>@domain reaches outreach-inbound) and RFC 8058 one-click unsubscribe.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.118.0";
import type { RenderedMail } from "./templates.ts";

export const SITE = (Deno.env.get("SITE_URL") ?? "https://dishloopr.com").replace(/\/$/, "");
export const FROM = Deno.env.get("OUTREACH_FROM") ?? "Ginuwine Ayanne van Dishloopr <hallo@dishloopr.com>";
export const SENDER_NAME = Deno.env.get("OUTREACH_SENDER_NAME") ?? "Ginuwine Ayanne";
const REPLY_DOMAIN = Deno.env.get("OUTREACH_REPLY_DOMAIN") ?? "";
const REPLY_TO = Deno.env.get("OUTREACH_REPLY_TO") ?? "";

export async function unsubscribeToken(db: SupabaseClient, restaurantId: string): Promise<string> {
  const { data } = await db.from("restaurant_contacts").select("afmeld_token").eq("restaurant_id", restaurantId).maybeSingle();
  if (data?.afmeld_token) return String(data.afmeld_token);
  const token = crypto.randomUUID();
  await db.from("restaurant_contacts").update({ afmeld_token: token }).eq("restaurant_id", restaurantId);
  return token;
}

/** Outreach mails sent today (golf mails plus reminders); both count against outreach_settings.daily_cap. */
export async function outreachSentToday(db: SupabaseClient): Promise<number> {
  const dayStart = new Date(); dayStart.setUTCHours(0, 0, 0, 0);
  const since = dayStart.toISOString();
  const [m, r] = await Promise.all([
    db.from("outreach_messages").select("id", { count: "exact", head: true }).gte("created_at", since).neq("status", "failed"),
    db.from("outreach_reminders").select("id", { count: "exact", head: true }).gte("created_at", since).neq("status", "failed"),
  ]);
  return (m.count ?? 0) + (r.error ? 0 : r.count ?? 0);
}

export interface OutreachSend {
  apiKey: string;
  to: string;
  restaurantId: string;
  segment: string;
  campaign: string;
  mail: RenderedMail;
  token: string;
  attachments?: { filename: string; path: string }[];
}

export async function sendOutreachMail(o: OutreachSend) {
  const replyTo = REPLY_DOMAIN ? `antwoord+${o.restaurantId}@${REPLY_DOMAIN}` : REPLY_TO || undefined;
  const oneClick = `${Deno.env.get("SUPABASE_URL")}/functions/v1/outreach-unsubscribe?t=${encodeURIComponent(o.token)}`;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${o.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: FROM, to: [o.to], reply_to: replyTo, subject: o.mail.subject, html: o.mail.html, text: o.mail.text,
      headers: { "List-Unsubscribe": `<${oneClick}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
      tags: [{ name: "campaign", value: o.campaign }, { name: "segment", value: o.segment }],
      ...(o.attachments?.length ? { attachments: o.attachments } : {}),
    }),
  });
  const body = await res.json().catch(() => ({}));
  return res.ok ? { ok: true as const, id: String(body.id ?? "") } : { ok: false as const, error: String(body.message ?? res.status) };
}
