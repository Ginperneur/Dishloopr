import { Resend } from "https://esm.sh/resend@2.0.0";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.118.0";
import { escapeHtml } from "../_shared/auth.ts";

export const toBase64 = (bytes: Uint8Array) => {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};

/** Tells the owner the translated menu is ready to check and publish. */
export async function sendMenuReadyMail(
  admin: SupabaseClient,
  restaurant: { name: string; claimed_by_owner_id: string | null },
  count: number,
) {
  if (!restaurant.claimed_by_owner_id) return;
  const { data: profile } = await admin.from("profiles").select("email, name").eq("id", restaurant.claimed_by_owner_id).maybeSingle();
  if (!profile?.email) return;
  const first = profile.name?.split(" ")[0];
  await new Resend(Deno.env.get("RESEND_API_KEY")).emails.send({
    from: "Dishloopr <noreply@resend.dev>",
    to: [profile.email],
    subject: `Je menukaart voor ${restaurant.name} staat klaar`,
    html: `<div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:24px">
      <h2 style="color:#F26522;margin:0 0 12px">Je menukaart staat klaar</h2>
      <p>${first ? `Hoi ${escapeHtml(first)},` : "Hoi,"}</p>
      <p>We hebben ${count} gerechten van <b>${escapeHtml(restaurant.name)}</b> online gezet en vertaald naar het Engels, Duits en Frans.
      Kijk even of alles klopt en zet hem dan live. Daarna kun je de QR-code printen en de widget op je eigen website zetten.</p>
      <p><a href="https://dishloopr.com/owner-dashboard?section=promotions" style="display:inline-block;background:#F26522;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:bold">Controleer je menukaart</a></p>
      <p style="color:#999;font-size:12px">Dishloopr</p></div>`,
  });
}
