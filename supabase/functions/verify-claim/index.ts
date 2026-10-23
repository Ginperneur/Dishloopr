import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { enforceRateLimit } from "../_shared/rateLimit.ts";
import { escapeHtml } from "../_shared/auth.ts";
import { sendTemplateEmail } from "../_shared/transactional-email-templates/send-email.ts";
import { deliverDomainCode } from "./domainDelivery.ts";
import {
  extractDomain, domainMatches, codeExpiry, isExpired, attemptsExhausted, canSendAnotherCode, canStartClaim,
  OPEN_CLAIM_STATUSES,
} from "./rules.ts";

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
    user: { max: 60, window: 60 * 30 }, // 60 calls / 30 min per user
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
    const now = Date.now();

    const isAdminUser = async () => {
      const { data } = await admin.rpc("has_role", { _user_id: user.id, _role: "admin" });
      return data === true;
    };

    const log = (restaurantId: string, claimId: string | null, actionType: string, after: unknown, role = "user") =>
      admin.from("claim_activity_logs").insert({
        actor_id: user.id, actor_role: role, restaurant_id: restaurantId, claim_id: claimId,
        action_type: actionType, action_category: "verification", after_data: after,
      });

    const sendMail = async (to: string, subject: string, html: string) => {
      const key = Deno.env.get("RESEND_API_KEY");
      if (!key) return false;
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: "Dishloopr <noreply@dishloopr.com>", to: [to], subject, html }),
      });
      if (!r.ok) console.error("[verify-claim] mail failed", await r.text());
      return r.ok;
    };
    const mailShell = (title: string, inner: string) =>
      `<div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:32px"><h2 style="margin:0 0 12px;color:#F26522">${title}</h2>${inner}<p style="color:#999;font-size:12px;margin-top:24px">Dishloopr</p></div>`;

    /** Grants ownership: claim verified, restaurant verified_owner, manager + team member + role, log. */
    const promote = async (claim: { id: string; user_id: string; restaurant_id: string }, method: string, proof: Record<string, unknown>, actorRole: string) => {
      const ts = new Date().toISOString();
      await admin.from("restaurant_claims").update({
        status: "verified", verification_method: method, verification_completed_at: ts,
        verification_proof: { ...proof, method, verified_at: ts }, is_primary: true,
        reviewed_by: actorRole === "admin" ? user.id : null, reviewed_at: actorRole === "admin" ? ts : null,
      }).eq("id", claim.id);
      await admin.from("restaurants").update({
        claim_status: "verified_owner", claimed_by_owner_id: claim.user_id, updated_at: ts,
      }).eq("id", claim.restaurant_id);
      await admin.from("restaurant_managers").upsert(
        { restaurant_id: claim.restaurant_id, user_id: claim.user_id, role: "primary_owner", accepted_at: ts },
        { onConflict: "restaurant_id,user_id" },
      );
      const { data: owner } = await admin.auth.admin.getUserById(claim.user_id);
      const ownerEmail = owner?.user?.email ?? null;
      const { data: tm } = await admin.from("restaurant_team_members").select("id")
        .eq("restaurant_id", claim.restaurant_id).eq("user_id", claim.user_id).maybeSingle();
      if (tm) {
        await admin.from("restaurant_team_members").update({ role: "owner", status: "accepted", accepted_at: ts }).eq("id", tm.id);
      } else {
        await admin.from("restaurant_team_members").insert({
          restaurant_id: claim.restaurant_id, user_id: claim.user_id, invited_email: ownerEmail ?? `${claim.user_id}@owner.local`,
          role: "owner", status: "accepted", invited_by: user.id, accepted_at: ts,
        });
      }
      const { data: pendingReq } = await admin.from("claim_requests").select("id")
        .eq("restaurant_id", claim.restaurant_id).eq("user_id", claim.user_id).eq("status", "pending").maybeSingle();
      if (pendingReq) {
        await admin.from("claim_requests").update({ status: "approved", reviewed_by: user.id, reviewed_at: ts, updated_at: ts }).eq("id", pendingReq.id);
      } else {
        await admin.from("claim_requests").insert({
          restaurant_id: claim.restaurant_id, user_id: claim.user_id, status: "approved",
          notes: `Geverifieerd via ${method}`, reviewed_by: user.id, reviewed_at: ts,
        });
      }
      const { data: role } = await admin.from("user_roles").select("id").eq("user_id", claim.user_id).eq("role", "owner").maybeSingle();
      if (!role) await admin.from("user_roles").insert({ user_id: claim.user_id, role: "owner" });
      await admin.from("restaurant_claims").update({ status: "superseded" })
        .eq("restaurant_id", claim.restaurant_id).neq("id", claim.id).in("status", OPEN_CLAIM_STATUSES);
      await log(claim.restaurant_id, claim.id, actorRole === "admin" ? "ADMIN_APPROVED" : "VERIFICATION_COMPLETED", { method, ...proof }, actorRole);
      await admin.from("claim_verification_secrets").delete().eq("claim_id", claim.id);
      return ownerEmail;
    };

    // -------- STATUS (no claim needed) --------
    if (action === "status" || action === "start_claim") {
      const restaurantId = String(body.restaurantId || "");
      if (!/^[0-9a-f-]{36}$/i.test(restaurantId)) return json({ error: "restaurantId vereist" }, 400);
      const { data: r } = await admin.from("restaurants").select("id, name, website_url, claim_status, claimed_by_owner_id").eq("id", restaurantId).maybeSingle();
      if (!r) return json({ error: "Restaurant niet gevonden" }, 404);
      const { data: open } = await admin.from("restaurant_claims")
        .select("id, restaurant_id, status, verification_method, verification_proof")
        .eq("restaurant_id", restaurantId).eq("user_id", user.id).in("status", OPEN_CLAIM_STATUSES)
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      const isOwner = r.claim_status === "verified_owner" && r.claimed_by_owner_id === user.id;
      const domain = extractDomain(r.website_url);

      if (action === "status") {
        return json({
          claimStatus: r.claim_status, isOwner, websiteDomain: domain,
          openClaim: open ? { id: open.id, status: open.status, method: open.verification_method,
            manualSubmitted: (open.verification_proof as any)?.method === "manual_proof" } : null,
        });
      }

      if (open?.restaurant_id === restaurantId) return json({ claimId: open.id, existing: true });
      const check = canStartClaim(r.claim_status, false);
      if (!check.ok) return json({ error: check.reason === "already_claimed" ? "Dit restaurant is al geclaimd." : "Dit restaurant kan nu niet geclaimd worden.", reason: check.reason }, 409);
      const { data: allowed } = await admin.rpc("can_create_claim", { _user_id: user.id });
      if (allowed === false) return json({ error: "Je hebt te veel openstaande claims. Wacht tot die zijn beoordeeld." }, 429);
      const { data: created, error: insErr } = await admin.from("restaurant_claims")
        .insert({ restaurant_id: restaurantId, user_id: user.id, status: "pending", email_verified: !!user.email_confirmed_at })
        .select("id, restaurant_id").single();
      if (insErr || !created?.id || created.restaurant_id !== restaurantId) return json({ error: "Claim aanmaken mislukt. Probeer opnieuw; er is geen code verstuurd." }, 500);
      if (r.claim_status === "unclaimed" || !r.claim_status) {
        await admin.from("restaurants").update({ claim_status: "claimed_unverified" }).eq("id", restaurantId);
      }
      await log(restaurantId, created.id, "CLAIM_STARTED", { status: "pending" });
      return json({ claimId: created.id });
    }

    // -------- ADMIN: approve / reject --------
    if (action === "admin_approve" || action === "admin_reject") {
      if (!(await isAdminUser())) return json({ error: "Alleen beheerders" }, 403);
      const claimId = String(body.claimId || "");
      const { data: c } = await admin.from("restaurant_claims").select("id, user_id, restaurant_id, status, verification_proof").eq("id", claimId).maybeSingle();
      if (!c) return json({ error: "Claim niet gevonden" }, 404);
      if (!OPEN_CLAIM_STATUSES.includes(c.status)) return json({ error: "Claim is al afgehandeld" }, 400);
      const { data: r } = await admin.from("restaurants").select("name, slug, claim_status").eq("id", c.restaurant_id).maybeSingle();
      const name = escapeHtml(r?.name ?? "je restaurant");
      const site = "https://dishloopr.com";

      if (action === "admin_approve") {
        if (r?.claim_status === "verified_owner") return json({ error: "Restaurant heeft al een eigenaar" }, 409);
        const email = await promote(c, "manual_proof", { ...(c.verification_proof as object), approved_by: user.id }, "admin");
        if (email) await sendMail(email, `Je claim voor ${r?.name ?? "je restaurant"} is goedgekeurd`,
          mailShell("Claim goedgekeurd", `<p>Goed nieuws: je bent nu de geverifieerde eigenaar van <b>${name}</b> op Dishloopr.</p><p><a href="${site}/owner-dashboard?welcome=1" style="color:#F26522">Ga naar je dashboard</a></p>`));
        return json({ success: true });
      }
      const reason = String(body.reason || "").trim().slice(0, 1000);
      if (!reason) return json({ error: "Geef een reden op" }, 400);
      const ts = new Date().toISOString();
      await admin.from("restaurant_claims").update({ status: "rejected", admin_notes: reason, reviewed_by: user.id, reviewed_at: ts }).eq("id", c.id);
      await admin.from("claim_requests").update({ status: "rejected", admin_notes: reason, reviewed_by: user.id, reviewed_at: ts, updated_at: ts })
        .eq("restaurant_id", c.restaurant_id).eq("user_id", c.user_id).eq("status", "pending");
      const { count } = await admin.from("restaurant_claims").select("id", { count: "exact", head: true })
        .eq("restaurant_id", c.restaurant_id).in("status", OPEN_CLAIM_STATUSES);
      if (!count && r?.claim_status === "claimed_unverified") {
        await admin.from("restaurants").update({ claim_status: "unclaimed" }).eq("id", c.restaurant_id);
      }
      await log(c.restaurant_id, c.id, "ADMIN_REJECTED", { reason }, "admin");
      const { data: u } = await admin.auth.admin.getUserById(c.user_id);
      if (u?.user?.email) await sendMail(u.user.email, `Je claim voor ${r?.name ?? "je restaurant"} is afgewezen`,
        mailShell("Claim afgewezen", `<p>We konden je claim voor <b>${name}</b> niet goedkeuren.</p><p><b>Reden:</b> ${escapeHtml(reason)}</p><p>Vragen? <a href="${site}/contact" style="color:#F26522">Neem contact op</a>.</p>`));
      return json({ success: true });
    }

    const claimId = String(body.claimId || "");
    if (!claimId) return json({ error: "claimId vereist" }, 400);

    // Load claim + restaurant, verify ownership
    const { data: claim, error: claimErr } = await admin
      .from("restaurant_claims")
      .select("id, user_id, status, restaurant_id")
      .eq("id", claimId)
      .maybeSingle();
    if (claimErr || !claim?.restaurant_id) return json({ error: "Claim niet gevonden. Start de claim opnieuw; er is geen code verstuurd." }, 404);
    if (claim.user_id !== user.id) return json({ error: "Geen toegang tot deze claim" }, 403);
    if (!OPEN_CLAIM_STATUSES.includes(claim.status)) {
      return json({ error: "Claim kan niet meer geverifieerd worden" }, 400);
    }

    const { data: restaurant } = await admin
      .from("restaurants")
      .select("id, name, website_url, claim_status")
      .eq("id", claim.restaurant_id)
      .maybeSingle();
    if (!restaurant) return json({ error: "Restaurant niet gevonden" }, 404);
    if (restaurant.claim_status === "verified_owner") return json({ error: "Dit restaurant is al geclaimd." }, 409);

    // -------- MANUAL PROOF --------
    if (action === "submit_manual") {
      const files = Array.isArray(body.files) ? body.files.map(String) : [];
      const fullName = String(body.fullName || "").trim().slice(0, 120);
      const jobTitle = String(body.jobTitle || "").trim().slice(0, 120);
      const phone = String(body.phone || "").replace(/\s+/g, "").slice(0, 20);
      if (!fullName || !jobTitle) return json({ error: "Naam en functie zijn verplicht" }, 400);
      if (!/^\+?[0-9]{8,15}$/.test(phone)) return json({ error: "Vul een geldig telefoonnummer in" }, 400);
      if (files.length < 1 || files.length > 5 || files.some((f: string) => !f.startsWith(`${user.id}/`) || f.includes(".."))) {
        return json({ error: "Upload 1 tot 5 bewijsstukken" }, 400);
      }
      const ts = new Date().toISOString();
      const proof = { method: "manual_proof", files, full_name: fullName, job_title: jobTitle, phone, submitted_at: ts };
      await admin.from("restaurant_claims").update({
        status: "pending", verification_method: "manual_proof", verification_started_at: ts,
        verification_proof: proof, phone_number: phone,
      }).eq("id", claimId);
      const { data: existingReq } = await admin.from("claim_requests").select("id")
        .eq("restaurant_id", restaurant.id).eq("user_id", user.id).eq("status", "pending").maybeSingle();
      const reqRow = { proof_documents: files, notes: `${fullName} — ${jobTitle} — ${phone}`, updated_at: ts };
      if (existingReq) await admin.from("claim_requests").update(reqRow).eq("id", existingReq.id);
      else await admin.from("claim_requests").insert({ ...reqRow, restaurant_id: restaurant.id, user_id: user.id, status: "pending" });
      await admin.from("restaurants").update({ claim_status: "claimed_unverified" }).eq("id", restaurant.id);
      await log(restaurant.id, claimId, "MANUAL_PROOF_SUBMITTED", { files: files.length, job_title: jobTitle });
      return json({ success: true, status: "pending_admin_review" });
    }

    // -------- DOMAIN EMAIL: send code --------
    if (action === "send_domain_code") {
      const email = String(body.email || "").trim().toLowerCase();
      const restaurantDomain = extractDomain(restaurant.website_url);
      if (!restaurantDomain) {
        return json({ error: "Dit restaurant heeft geen website. Kies handmatige verificatie." }, 400);
      }
      if (!domainMatches(email, restaurantDomain)) {
        return json({ error: `E-mailadres moet eindigen op @${restaurantDomain}` }, 400);
      }
      const { count: sentLastHour } = await admin.from("claim_activity_logs")
        .select("id", { count: "exact", head: true })
        .eq("claim_id", claimId).eq("action_type", "DOMAIN_CODE_SENT")
        .gte("created_at", new Date(now - 60 * 60 * 1000).toISOString());
      if (!canSendAnotherCode(sentLastHour ?? 0)) {
        return json({ error: "Je hebt al 3 codes aangevraagd in het afgelopen uur. Probeer het later opnieuw." }, 429);
      }

      const code = randomCode(6);
      const codeHash = await sha256(`${claimId}:${code}`);
      try {
        await deliverDomainCode({
          persist: async () => {
            const { error } = await admin.from("claim_verification_secrets").upsert({
              claim_id: claimId, method: "domain_email", code_hash: codeHash, email, attempts: 0,
              expires_at: codeExpiry(now).toISOString(), updated_at: new Date().toISOString(),
            });
            if (error) throw new Error("Verificatiecode opslaan mislukt");
          },
          send: () => sendTemplateEmail('claim-code', email, {
            templateData: { restaurantName: restaurant.name, code },
            idempotencyKey: `claim-code-${claimId}-${codeHash}`,
          }),
          recordSent: async () => {
            const ts = new Date().toISOString();
            const { error: updateError } = await admin.from("restaurant_claims").update({
              verification_method: "domain_email", verification_started_at: ts,
              verification_proof: { method: "domain_email", email, sent_at: ts },
            }).eq("id", claimId).eq("restaurant_id", restaurant.id);
            if (updateError) throw new Error("Verificatie bijwerken mislukt");
            const { error: logError } = await log(restaurant.id, claimId, "DOMAIN_CODE_SENT", { method: "domain_email" });
            if (logError) throw new Error("Verzending registreren mislukt");
          },
        });
      } catch (error) {
        // Never log recipients or codes. Keep claim intact so the visitor can retry.
        console.error("[verify-claim] domain delivery failed", { claimId, restaurantId: restaurant.id, code: (error as { code?: string }).code || "delivery_failed" });
        return json({ error: "De verificatiemail kon niet worden verstuurd. Je claim is bewaard, maar nog niet bevestigd. Probeer later opnieuw of neem contact op via info@dishloopr.com." }, 502);
      }
      return json({ success: true });
    }

    // -------- DOMAIN EMAIL: verify code & promote --------
    if (action === "verify_domain_code") {
      const code = String(body.code || "").trim();
      if (!/^\d{6}$/.test(code)) return json({ error: "Ongeldige code" }, 400);
      const { data: secret } = await admin.from("claim_verification_secrets").select("*").eq("claim_id", claimId).maybeSingle();
      if (!secret || secret.method !== "domain_email") {
        return json({ error: "Geen actieve verificatie. Vraag eerst een nieuwe code aan." }, 400);
      }
      if (isExpired(secret.expires_at, now)) return json({ error: "Code is verlopen. Vraag een nieuwe aan." }, 400);
      if (attemptsExhausted(secret.attempts ?? 0)) return json({ error: "Te veel pogingen. Vraag een nieuwe code aan." }, 429);
      const submittedHash = await sha256(`${claimId}:${code}`);
      if (submittedHash !== secret.code_hash) {
        await admin.from("claim_verification_secrets")
          .update({ attempts: (secret.attempts ?? 0) + 1, updated_at: new Date().toISOString() })
          .eq("claim_id", claimId);
        return json({ error: "Onjuiste code" }, 400);
      }
      await promote(claim, "domain_email", { email: secret.email }, "user");
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