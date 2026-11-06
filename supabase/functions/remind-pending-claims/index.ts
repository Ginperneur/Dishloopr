import { Resend } from "https://esm.sh/resend@2.0.0";
import { escapeHtml, requireAdminOrInternal, serviceClient } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

/** The moment `days` working days (Mon to Fri) before now. */
function workingDaysAgo(days: number): Date {
  const d = new Date();
  let left = days;
  while (left > 0) {
    d.setUTCDate(d.getUTCDate() - 1);
    if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6) left--;
  }
  return d;
}

// Owners are promised a decision on document claims (Route B) within 2 working
// days. After 1 working day without a decision the admin gets one digest mail per
// claim batch; each claim is reminded once (verification_proof.reminded_at).
// Runs on weekday mornings from pg_cron.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const admin = serviceClient();
    const deny = await requireAdminOrInternal(req, admin, corsHeaders);
    if (deny) return deny;

    const { data: claims, error } = await admin.from("restaurant_claims")
      .select("id, verification_proof, verification_started_at, restaurant:restaurant_id(name)")
      .eq("status", "pending").eq("verification_method", "manual_proof")
      .lt("verification_started_at", workingDaysAgo(1).toISOString())
      .is("verification_proof->>reminded_at", null)
      .order("verification_started_at");
    if (error) throw error;
    if (!claims?.length) return json({ reminded: 0 });

    const deadline = workingDaysAgo(2).getTime();
    const rows = claims.map((c: any) => {
      const late = Date.parse(c.verification_started_at) < deadline;
      const ai = c.verification_proof?.ai_screening;
      const aiText = ai ? ` · AI: ${ai.reasons?.length ? escapeHtml(ai.reasons.join(", ")) : "alles klopt"}` : "";
      return `<li><b>${escapeHtml(c.restaurant?.name ?? "Restaurant")}</b> · ingediend ${new Date(c.verification_started_at).toLocaleDateString("nl-NL")}${late ? ' · <span style="color:#c0392b">over de termijn</span>' : ""}${aiText}</li>`;
    }).join("");

    const { data: setting } = await admin.from("app_settings").select("value").eq("key", "admin_email").maybeSingle();
    await new Resend(Deno.env.get("RESEND_API_KEY")).emails.send({
      from: "Dishloopr <noreply@resend.dev>",
      to: [setting?.value || "admin@dishloopr.com"],
      subject: `${claims.length} claim(s) wachten op beoordeling (belofte: binnen 2 werkdagen)`,
      html: `<div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px"><h2 style="color:#F26522;margin:0 0 12px">Claims wachten op je</h2><p>Deze claims met documenten staan langer dan 1 werkdag open. Eigenaren rekenen op een beslissing binnen 2 werkdagen.</p><ul>${rows}</ul><p>Beoordeel ze in Admin, Claims.</p></div>`,
    });

    const ts = new Date().toISOString();
    for (const c of claims) {
      await admin.from("restaurant_claims").update({ verification_proof: { ...(c.verification_proof ?? {}), reminded_at: ts } }).eq("id", c.id);
    }
    return json({ reminded: claims.length });
  } catch (err) {
    console.error("remind-pending-claims error:", err);
    return json({ error: err instanceof Error ? err.message : "Unknown error" }, 500);
  }
});
