import type { SupabaseClient } from "npm:@supabase/supabase-js@2.118.0";
import { escapeHtml } from "../_shared/auth.ts";

// Mails the admin the moment a claim waits for a human decision (documents or Google Business profile),
// so owners are not left waiting until the daily digest or the 1-working-day reminder.
// Never throws: a failed alert must not fail the owner's claim.

const SITE = "https://dishloopr.com";
const FROM = "Dishloopr <hallo@dishloopr.com>";

export interface ClaimAlert {
  restaurantName: string;
  restaurantSlug: string | null;
  method: "manual_proof" | "google_business";
  ownerName?: string;
  jobTitle?: string;
  /** AI pre-check of the documents, advice only. */
  ai?: { verdict?: string; reasons?: string[]; doc_type?: string } | null;
}

export function claimAlertMail(a: ClaimAlert) {
  const how = a.method === "manual_proof" ? "met documenten" : "via het Google Bedrijfsprofiel";
  const subject = `Nieuwe claim wacht op je: ${a.restaurantName}`;
  const who = a.ownerName ? `${a.ownerName}${a.jobTitle ? ` (${a.jobTitle})` : ""}` : "Een eigenaar";
  const ai = a.ai
    ? `AI-check: ${a.ai.verdict ?? "onbekend"}${a.ai.reasons?.length ? `, ${a.ai.reasons.join(", ")}` : ""}. Dit is alleen advies.`
    : a.method === "manual_proof" ? "De AI-check van de documenten staat zo in de admin." : "";
  const adminUrl = `${SITE}/admin?section=claims`;
  const pageUrl = a.restaurantSlug ? `${SITE}/restaurant/${encodeURIComponent(a.restaurantSlug)}` : null;
  const text = [
    `${who} heeft ${a.restaurantName} geclaimd ${how}. De claim wacht op jouw goedkeuring.`,
    ai,
    `Eigenaren rekenen op een beslissing binnen 2 werkdagen. Beoordeel hem in de admin: ${adminUrl}`,
    pageUrl ? `Restaurantpagina: ${pageUrl}` : "",
  ].filter(Boolean).join("\n\n");
  const html = `<div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#211c18">
<h2 style="color:#F26522;margin:0 0 12px">Nieuwe claim wacht op je</h2>
<p>${escapeHtml(who)} heeft <b>${escapeHtml(a.restaurantName)}</b> geclaimd ${how}. De claim wacht op jouw goedkeuring.</p>
${ai ? `<p>${escapeHtml(ai)}</p>` : ""}
<p>Eigenaren rekenen op een beslissing binnen 2 werkdagen.</p>
<p><a href="${adminUrl}" style="display:inline-block;background:#F26522;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600">Beoordeel de claim</a></p>
${pageUrl ? `<p><a href="${escapeHtml(pageUrl)}" style="color:#e8562a">Bekijk de restaurantpagina</a></p>` : ""}
</div>`;
  return { subject, text, html };
}

export async function notifyAdminOfClaim(admin: SupabaseClient, a: ClaimAlert): Promise<void> {
  try {
    const apiKey = Deno.env.get("RESEND_API_KEY");
    if (!apiKey) return;
    const { data: setting } = await admin.from("app_settings").select("value").eq("key", "admin_email").maybeSingle();
    const to = (setting?.value as string | undefined) || "info@dishloopr.com";
    const mail = claimAlertMail(a);
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to: [to], subject: mail.subject, html: mail.html, text: mail.text }),
    });
    if (!res.ok) console.error("[verify-claim] admin alert failed", res.status, await res.text());
  } catch (e) {
    console.error("[verify-claim] admin alert failed", e);
  }
}
