import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { enforceRateLimit } from "../_shared/rateLimit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function extractDomain(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

function domainMatches(email: string, restaurantDomain: string | null): boolean {
  if (!restaurantDomain) return false;
  const parts = email.toLowerCase().split("@");
  if (parts.length !== 2) return false;
  const ed = parts[1];
  return ed === restaurantDomain || ed.endsWith(`.${restaurantDomain}`);
}

function randomCode(len = 6): string {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return (buf[0] % 10 ** len).toString().padStart(len, "0");
}

function randomGbpCode(userIdShort: string): string {
  const t = Date.now().toString(36).toUpperCase().slice(-4);
  return `DISH-${userIdShort.toUpperCase()}-${t}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Rate-limit before any DB work
  const rl = await enforceRateLimit(req, {
    functionName: "verify-claim",
    user: { max: 20, window: 60 * 30 }, // 20 attempts / 30 min per user
    anon: { max: 5, window: 60 * 60 },
  });
  if (!rl.allowed && rl.response) return rl.response;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    // Authenticate
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);
    const user = userData.user;

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "");
    const claimId = String(body.claimId || "");
    if (!claimId) return json({ error: "claimId vereist" }, 400);

    // Load claim + restaurant, verify ownership
    const { data: claim, error: claimErr } = await admin
      .from("restaurant_claims")
      .select("id, user_id, status, restaurant_id")
      .eq("id", claimId)
      .maybeSingle();
    if (claimErr || !claim) return json({ error: "Claim niet gevonden" }, 404);
    if (claim.user_id !== user.id) return json({ error: "Geen toegang tot deze claim" }, 403);
    if (!["pending", "email_verified", "phone_verified"].includes(claim.status)) {
      return json({ error: "Claim kan niet meer geverifieerd worden" }, 400);
    }

    const { data: restaurant } = await admin
      .from("restaurants")
      .select("id, name, website")
      .eq("id", claim.restaurant_id)
      .maybeSingle();
    if (!restaurant) return json({ error: "Restaurant niet gevonden" }, 404);

    // -------- DOMAIN EMAIL: send code --------
    if (action === "send_domain_code") {
      const email = String(body.email || "").trim().toLowerCase();
      const restaurantDomain = extractDomain(restaurant.website);
      if (!restaurantDomain) {
        return json({ error: "Restaurant heeft geen geverifieerd websitedomein" }, 400);
      }
      if (!email.includes("@") || !domainMatches(email, restaurantDomain)) {
        return json({ error: `E-mailadres moet eindigen op @${restaurantDomain}` }, 400);
      }

      const code = randomCode(6);
      const codeHash = await sha256(`${claimId}:${code}`);
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

      const { error: upsertErr } = await admin
        .from("claim_verification_secrets")
        .upsert({
          claim_id: claimId,
          method: "domain_email",
          code_hash: codeHash,
          email,
          attempts: 0,
          expires_at: expiresAt,
          updated_at: new Date().toISOString(),
        });
      if (upsertErr) return json({ error: upsertErr.message }, 500);

      // Mirror lightweight, non-secret metadata to the claim (no code stored!)
      await admin
        .from("restaurant_claims")
        .update({
          verification_method: "domain_email",
          verification_started_at: new Date().toISOString(),
          verification_proof: { method: "domain_email", email, sent_at: new Date().toISOString() },
        })
        .eq("id", claimId);

      // Send email
      const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
      if (!RESEND_API_KEY) return json({ error: "Mailservice niet geconfigureerd" }, 500);
      const mailRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "Dishloopr <noreply@dishloopr.com>",
          to: [email],
          subject: `Verificatiecode voor ${restaurant.name} op Dishloopr`,
          html: `<div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:32px"><h2 style="margin:0 0 8px">Verificatiecode</h2><p style="color:#555;margin:0 0 16px">Gebruik onderstaande code om eigenaarschap van <b>${restaurant.name}</b> te bevestigen.</p><div style="background:#f3f4f6;border-radius:8px;padding:20px;text-align:center;font-size:28px;letter-spacing:8px;font-family:monospace;font-weight:700">${code}</div><p style="color:#777;font-size:13px;margin-top:16px">Code is 30 minuten geldig. Heb je dit niet aangevraagd? Negeer deze e-mail.</p></div>`,
        }),
      });
      if (!mailRes.ok) {
        const t = await mailRes.text();
        console.error("[verify-claim] resend failed", t);
        return json({ error: "Kon e-mail niet versturen" }, 502);
      }
      return json({ success: true });
    }

    // -------- DOMAIN EMAIL: verify code & promote --------
    if (action === "verify_domain_code") {
      const code = String(body.code || "").trim();
      if (!/^\d{6}$/.test(code)) return json({ error: "Ongeldige code" }, 400);

      const { data: secret } = await admin
        .from("claim_verification_secrets")
        .select("*")
        .eq("claim_id", claimId)
        .maybeSingle();
      if (!secret || secret.method !== "domain_email") {
        return json({ error: "Geen actieve verificatie. Vraag eerst een nieuwe code aan." }, 400);
      }
      if (new Date(secret.expires_at).getTime() < Date.now()) {
        return json({ error: "Code is verlopen. Vraag een nieuwe aan." }, 400);
      }
      if (secret.attempts >= 5) {
        return json({ error: "Te veel pogingen. Vraag een nieuwe code aan." }, 429);
      }

      const submittedHash = await sha256(`${claimId}:${code}`);
      if (submittedHash !== secret.code_hash) {
        await admin
          .from("claim_verification_secrets")
          .update({ attempts: (secret.attempts ?? 0) + 1, updated_at: new Date().toISOString() })
          .eq("claim_id", claimId);
        return json({ error: "Onjuiste code" }, 400);
      }

      // Promote claim
      await admin
        .from("restaurant_claims")
        .update({
          status: "verified",
          verification_method: "domain_email",
          verification_completed_at: new Date().toISOString(),
          verification_proof: {
            method: "domain_email",
            email: secret.email,
            verified_at: new Date().toISOString(),
          },
          is_primary: true,
        })
        .eq("id", claimId);

      await admin
        .from("restaurants")
        .update({ claim_status: "verified_owner", updated_at: new Date().toISOString() })
        .eq("id", restaurant.id);

      await admin.from("restaurant_managers").upsert(
        {
          restaurant_id: restaurant.id,
          user_id: user.id,
          role: "primary_owner",
          accepted_at: new Date().toISOString(),
        },
        { onConflict: "restaurant_id,user_id" },
      );

      const { data: existingRole } = await admin
        .from("user_roles")
        .select("id")
        .eq("user_id", user.id)
        .eq("role", "owner")
        .maybeSingle();
      if (!existingRole) {
        await admin.from("user_roles").insert({ user_id: user.id, role: "owner" });
      }

      await admin
        .from("restaurant_claims")
        .update({ status: "superseded" })
        .eq("restaurant_id", restaurant.id)
        .neq("id", claimId);

      await admin.from("claim_activity_logs").insert({
        actor_id: user.id,
        actor_role: "user",
        restaurant_id: restaurant.id,
        claim_id: claimId,
        action_type: "VERIFICATION_COMPLETED",
        action_category: "verification",
        after_data: { method: "domain_email", email: secret.email },
      });

      // Burn the secret
      await admin.from("claim_verification_secrets").delete().eq("claim_id", claimId);

      return json({ success: true });
    }

    // -------- GOOGLE BUSINESS: generate code (manual admin review) --------
    if (action === "start_google_verification") {
      const code = randomGbpCode(user.id.slice(0, 4));
      const codeHash = await sha256(`${claimId}:${code}`);
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      await admin.from("claim_verification_secrets").upsert({
        claim_id: claimId,
        method: "google_business",
        code_hash: codeHash,
        email: null,
        attempts: 0,
        expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      });

      await admin
        .from("restaurant_claims")
        .update({
          verification_method: "google_business",
          verification_started_at: new Date().toISOString(),
          verification_proof: {
            method: "google_business",
            started_at: new Date().toISOString(),
          },
        })
        .eq("id", claimId);

      // Return the code ONCE (it's not stored plaintext anywhere)
      return json({ success: true, code });
    }

    // -------- GOOGLE BUSINESS: submit for admin review --------
    if (action === "submit_google_for_review") {
      const { data: secret } = await admin
        .from("claim_verification_secrets")
        .select("method, expires_at")
        .eq("claim_id", claimId)
        .maybeSingle();
      if (!secret || secret.method !== "google_business") {
        return json({ error: "Start eerst de verificatie om een code te krijgen" }, 400);
      }
      if (new Date(secret.expires_at).getTime() < Date.now()) {
        return json({ error: "Code is verlopen. Start opnieuw." }, 400);
      }

      // Park as pending admin review — DO NOT auto-verify (cannot prove GBP ownership server-side without paid Google APIs).
      await admin
        .from("restaurant_claims")
        .update({
          status: "pending",
          verification_method: "google_business",
          verification_proof: {
            method: "google_business",
            submitted_for_review_at: new Date().toISOString(),
            note: "Awaiting admin verification of Google Business profile description.",
          },
        })
        .eq("id", claimId);

      await admin.from("claim_activity_logs").insert({
        actor_id: user.id,
        actor_role: "user",
        restaurant_id: restaurant.id,
        claim_id: claimId,
        action_type: "VERIFICATION_SUBMITTED",
        action_category: "verification",
        after_data: { method: "google_business" },
      });

      return json({ success: true, status: "pending_admin_review" });
    }

    return json({ error: "Onbekende actie" }, 400);
  } catch (e) {
    console.error("[verify-claim] error", e);
    return json({ error: (e as Error).message }, 500);
  }
});