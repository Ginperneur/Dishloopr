// Admin actions on outreach replies:
//   send         { reply_id, text }   sends the (edited) answer in the same thread, marks it answered
//   attachments  { reply_id }         fresh download links for the reply's attachments (menus etc.)
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { getCaller, isAdmin, serviceClient } from "../_shared/auth.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });
const FROM = Deno.env.get("OUTREACH_FROM") ?? "Ginuwine Ayanne van Dishloopr <hallo@dishloopr.com>";
const REPLY_DOMAIN = Deno.env.get("OUTREACH_REPLY_DOMAIN") ?? "";
const REPLY_TO = Deno.env.get("OUTREACH_REPLY_TO") ?? "";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const db = serviceClient();
  const user = await getCaller(req);
  if (!user) return json({ error: "Unauthorized" }, 401);
  if (!(await isAdmin(db, user.id))) return json({ error: "Forbidden" }, 403);
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) return json({ error: "RESEND_API_KEY ontbreekt" }, 500);

  const body = await req.json().catch(() => ({}));
  const { data: reply } = await db.from("outreach_replies").select("*").eq("id", String(body.reply_id ?? "")).maybeSingle();
  if (!reply) return json({ error: "Antwoord niet gevonden" }, 404);

  if (body.mode === "attachments") {
    const r = await fetch(`https://api.resend.com/emails/receiving/${reply.provider_email_id}/attachments`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!r.ok) return json({ error: `Resend ${r.status}` }, 502);
    const list = (await r.json()).data ?? [];
    return json({ attachments: list.map((a: Record<string, unknown>) => ({ filename: a.filename, url: a.download_url, content_type: a.content_type })) });
  }

  if (body.mode === "send") {
    const text = String(body.text ?? "").trim();
    if (text.length < 5) return json({ error: "Antwoord is leeg" }, 400);
    if (reply.status === "beantwoord") return json({ error: "Al beantwoord" }, 409);
    const subject = reply.subject && /^re:/i.test(reply.subject) ? reply.subject : `Re: ${reply.subject ?? "Dishloopr"}`;
    const replyTo = REPLY_DOMAIN && reply.restaurant_id ? `antwoord+${reply.restaurant_id}@${REPLY_DOMAIN}` : REPLY_TO || undefined;
    const headers: Record<string, string> = {};
    if (reply.message_id) { headers["In-Reply-To"] = reply.message_id; headers["References"] = reply.message_id; }
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to: [reply.from_email], reply_to: replyTo, subject, text, headers }),
    });
    if (!res.ok) return json({ error: `Versturen mislukt (${res.status})` }, 502);
    await db.from("outreach_replies").update({ status: "beantwoord", answer_text: text, answered_at: new Date().toISOString() }).eq("id", reply.id);
    return json({ ok: true });
  }
  return json({ error: "Onbekende mode" }, 400);
});
