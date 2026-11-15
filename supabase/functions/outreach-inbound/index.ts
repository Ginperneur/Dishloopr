// Outreach agent, receiving side. Resend inbound webhook (event "email.received").
// Stores the reply, lets AI qualify it (category, priority, deal chance, recommended action and a
// draft answer) and handles only the safe cases by itself:
//   afmelden     contact is opted out right away
//   automatisch  out of office, bounce, auto reply: archived
// Everything else waits in the admin inbox; nothing is ever answered without a human.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { serviceClient } from "../_shared/auth.ts";

const RESEND = "https://api.resend.com";
const CATEGORIES = [
  "wil_claimen", "interesse_uitgelicht", "interesse_pro", "menu_aangeleverd", "vraag", "terugbellen",
  "niet_geinteresseerd", "afmelden", "gegevens_onjuist", "verwijderen", "verkeerde_persoon",
  "klacht", "automatisch", "overig",
] as const;

// --- Svix signature check (Resend webhooks) ----------------------------------
async function verify(req: Request, raw: string): Promise<boolean> {
  const secret = Deno.env.get("OUTREACH_INBOUND_SECRET");
  if (!secret) return false;
  const id = req.headers.get("svix-id"), ts = req.headers.get("svix-timestamp"), sigs = req.headers.get("svix-signature");
  if (!id || !ts || !sigs) return false;
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false;
  const key = Uint8Array.from(atob(secret.replace(/^whsec_/, "")), (c) => c.charCodeAt(0));
  const k = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(`${id}.${ts}.${raw}`)));
  const expected = btoa(String.fromCharCode(...mac));
  return sigs.split(" ").some((s) => s.split(",")[1] === expected);
}

function parseFrom(from: string): { email: string; name: string | null } {
  const m = from.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  return m ? { email: m[2].trim().toLowerCase(), name: m[1].trim() || null } : { email: from.trim().toLowerCase(), name: null };
}

/** Drops the quoted original mail so the classifier only reads what the owner wrote. */
function stripQuoted(text: string): string {
  const lines = text.replace(/\r/g, "").split("\n");
  const out: string[] = [];
  for (const l of lines) {
    if (/^\s*>/.test(l)) continue;
    if (/^(Op .+ schreef .+:|On .+ wrote:|Van: |From: |-----Original Message-----|Verzonden vanaf)/i.test(l.trim())) break;
    out.push(l);
  }
  return out.join("\n").trim().slice(0, 6000);
}

interface Triage {
  categorie: string; prioriteit: "hoog" | "normaal" | "laag"; deal_kans: number;
  samenvatting: string; aanbevolen_actie: string; concept_antwoord: string;
}

async function classify(ctx: { minimum: number; restaurant: string | null; segment: string | null; subject: string; body: string; attachments: string[] }): Promise<Triage> {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) throw new Error("LOVABLE_API_KEY ontbreekt");
  const prompt = `Je bent de sales assistent van Dishloopr, een Nederlands platform waar gasten restaurants vinden op gerecht ("beste ramen Amsterdam").
We mailden restauranteigenaren. Segment "zichtbaar": hun restaurant staat online, ze kunnen hun pagina gratis claimen. Segment "onzichtbaar_menu": ze staan erin maar zijn onzichtbaar omdat we minder dan ${ctx.minimum} gerechten van hun kaart kennen (drank telt niet mee); ze kunnen hun pagina gratis claimen en het menu zelf aanvullen, of hun menukaart als antwoord terugsturen. Bij ${ctx.minimum} gerechten worden ze automatisch zichtbaar.
Aanbod: claimen en basisprofiel altijd gratis. Uitgelicht: vaste uitgelichte plek, max 5 per gerecht per stad, normaal €99/mnd of €990/jaar; wie nu of uiterlijk 5 januari 2027 instapt wordt Founding Partner en betaalt €59/mnd of €590/jaar t/m 31 december 2027, badge blijft altijd. Kopen kan nu al: de plek staat direct live en er wordt direct bij het afrekenen betaald. Minimale looptijd 6 maanden vanaf aankoop. Afrekenen via dishloopr.com/voor-restaurants/pakketten (eerst de pagina claimen en verifiëren). Owner Pro €29/mnd of €290/jaar (statistieken, zoektermen, AI hulp bij reviews). Evenementen €5/mnd per evenement. Menuservice €79 eenmalig of €19/mnd. Officiële lancering 1 december 2026.

Kwalificeer dit antwoord van een eigenaar.
Restaurant: ${ctx.restaurant ?? "onbekend"}
Segment: ${ctx.segment ?? "onbekend"}
Onderwerp: ${ctx.subject}
Bijlagen: ${ctx.attachments.length ? ctx.attachments.join(", ") : "geen"}
Tekst:
"""
${ctx.body || "(leeg)"}
"""

Geef ALLEEN geldige JSON, zonder uitleg:
{"categorie": één van ${JSON.stringify(CATEGORIES)},
 "prioriteit": "hoog" (wil betalen, prijsvraag, wil gebeld worden, menu aangeleverd, klacht of juridisch) | "normaal" | "laag" (auto reply, nee),
 "deal_kans": 0 tot 100, kans dat dit een betalende klant wordt,
 "samenvatting": max 2 zinnen,
 "aanbevolen_actie": wat de eigenaar van Dishloopr nu concreet moet doen, 1 zin,
 "concept_antwoord": kort, vriendelijk Nederlands antwoord in jij vorm namens Ginuwine Ayanne van Dishloopr, beginnend met "Hoi <naam of restaurantnaam>," en eindigend met "Met vriendelijke groet,\nGinuwine Ayanne\nDishloopr". Beloof niets buiten het aanbod hierboven. Gebruik GEEN gedachtestreepjes (– of —); koppeltekens in samengestelde woorden mogen wel. Leeg bij categorie automatisch of afmelden.}`;
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "google/gemini-2.5-flash", messages: [{ role: "user", content: prompt }] }),
  });
  if (!res.ok) throw new Error(`AI ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const content: string = (await res.json()).choices?.[0]?.message?.content ?? "";
  const parsed = JSON.parse(content.match(/\{[\s\S]*\}/)?.[0] ?? "{}");
  const categorie = (CATEGORIES as readonly string[]).includes(parsed.categorie) ? parsed.categorie : "overig";
  return {
    categorie,
    prioriteit: ["hoog", "normaal", "laag"].includes(parsed.prioriteit) ? parsed.prioriteit : "normaal",
    deal_kans: Math.max(0, Math.min(100, Math.round(Number(parsed.deal_kans) || 0))),
    samenvatting: String(parsed.samenvatting ?? "").slice(0, 500),
    aanbevolen_actie: String(parsed.aanbevolen_actie ?? "").slice(0, 500),
    // House rule: no dashes in outgoing copy.
    concept_antwoord: String(parsed.concept_antwoord ?? "").replace(/\s*[—–]\s*/g, ", ").slice(0, 4000),
  };
}

async function notify(subject: string, text: string) {
  const to = Deno.env.get("OUTREACH_NOTIFY_EMAIL"), key = Deno.env.get("RESEND_API_KEY");
  if (!to || !key) return;
  await fetch(`${RESEND}/emails`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: "Dishloopr Outreach <noreply@dishloopr.com>", to: [to], subject, text }),
  }).catch(() => undefined);
}

serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const raw = await req.text();
  if (!(await verify(req, raw))) return new Response("Invalid signature", { status: 401 });
  const event = JSON.parse(raw);
  if (event.type !== "email.received") return new Response("ignored");
  const d = event.data ?? {};
  const db = serviceClient();
  const apiKey = Deno.env.get("RESEND_API_KEY") ?? "";

  // Idempotent: Resend retries webhooks.
  const { data: existing } = await db.from("outreach_replies").select("id").eq("provider_email_id", d.email_id).maybeSingle();
  if (existing) return new Response("duplicate");

  let text = String(d.text ?? "");
  if (!text && d.email_id && apiKey) {
    const r = await fetch(`${RESEND}/emails/receiving/${d.email_id}`, { headers: { Authorization: `Bearer ${apiKey}` } });
    if (r.ok) {
      const full = await r.json();
      text = String(full.text ?? "") || String(full.html ?? "").replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, " ");
    }
  }
  const body = stripQuoted(text);
  const from = parseFrom(String(d.from ?? ""));
  const attachments = (d.attachments ?? []) as { id: string; filename: string; content_type: string }[];

  // Match the restaurant: plus address first (antwoord+<id>@), then the sender address.
  const plus = ((d.to ?? []) as string[]).join(" ").match(/antwoord\+([0-9a-f-]{36})@/i)?.[1] ?? null;
  let restaurantId: string | null = plus;
  if (!restaurantId) {
    const { data: c } = await db.from("restaurant_contacts").select("restaurant_id").ilike("email", from.email).limit(1).maybeSingle();
    restaurantId = c?.restaurant_id ?? null;
  }
  const { data: target } = restaurantId
    ? await db.from("outreach_targets").select("name,segment").eq("restaurant_id", restaurantId).maybeSingle()
    : { data: null };

  const { data: row, error } = await db.from("outreach_replies").insert({
    provider_email_id: d.email_id ?? null, restaurant_id: restaurantId, from_email: from.email, from_name: from.name,
    subject: d.subject ?? null, body_text: body, message_id: d.message_id ?? null,
    attachments: attachments.map((a) => ({ id: a.id, filename: a.filename, content_type: a.content_type })),
  }).select("id").single();
  if (error || !row) {
    console.error("outreach-inbound insert", error?.message);
    return new Response("Error", { status: 500 });
  }

  try {
    const { data: cfg } = await db.from("outreach_settings").select("menu_minimum").eq("id", true).maybeSingle();
    const t = await classify({
      minimum: cfg?.menu_minimum ?? 5,
      restaurant: target?.name ?? null, segment: target?.segment ?? null, subject: String(d.subject ?? ""),
      body, attachments: attachments.map((a) => `${a.filename} (${a.content_type})`),
    });
    let status = "te_beoordelen";
    if (t.categorie === "afmelden" && restaurantId) {
      await db.from("restaurant_contacts").update({ afgemeld_op: new Date().toISOString() }).eq("restaurant_id", restaurantId).is("afgemeld_op", null);
      status = "automatisch";
    } else if (t.categorie === "automatisch") {
      status = "automatisch";
    }
    await db.from("outreach_replies").update({ ...t, status, classified_at: new Date().toISOString() }).eq("id", row.id);
    if (t.prioriteit === "hoog" && status === "te_beoordelen") {
      await notify(`Hete lead: ${target?.name ?? from.email} (${t.categorie}, ${t.deal_kans}%)`,
        `${t.samenvatting}\n\nActie: ${t.aanbevolen_actie}\n\nOpen Admin > Outreach om te antwoorden.`);
    }
  } catch (e) {
    await db.from("outreach_replies").update({ classify_error: e instanceof Error ? e.message : String(e) }).eq("id", row.id);
  }
  return new Response("ok");
});
