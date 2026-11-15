// Daily 06:00 UTC: mails every admin what waits for a person (admin_digest) and what the
// hourly admin-automation handled in the last 24 hours. Sends nothing to nobody if no admin has an email.
import { isInternalCaller, getCaller, isAdmin } from "../_shared/auth.ts";
import { sendTemplateEmail } from "../_shared/transactional-email-templates/send-email.ts";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.118.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const AUTO_LABELS: Record<string, string> = {
  auto_edit_applied: "Naam of beschrijving doorgevoerd",
  auto_placement_approved: "Nieuwsbriefplaatsingen goedgekeurd",
  auto_suggestion_duplicate: "Dubbele restaurantsuggesties afgewezen",
  auto_dishes_approved: "Gerechten goedgekeurd",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const db = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "") as unknown as SupabaseClient;
  try {
    let caller: { id: string; email?: string } | null = null;
    if (!(await isInternalCaller(req, db))) {
      caller = await getCaller(req);
      if (!caller || !(await isAdmin(db, caller.id))) return json({ error: "Forbidden" }, 403);
    }
    const body = await req.json().catch(() => ({}));
    const onlyMe = body.only_me === true && !!caller?.email;
    const { data: rows, error } = await db.rpc("admin_digest");
    if (error) throw error;
    const now = Date.now();
    const queues = ((rows ?? []) as { label: string; section: string; open_count: number; new_24h: number; oldest_at: string | null }[])
      .map(r => ({ label: r.label, section: r.section, open_count: r.open_count, new_24h: r.new_24h,
        oldest_days: r.oldest_at ? Math.floor((now - new Date(r.oldest_at).getTime()) / 86400000) : 0 }))
      .sort((a, b) => b.new_24h - a.new_24h || b.open_count - a.open_count);

    const since = new Date(now - 86400000).toISOString();
    const { data: logs } = await db.from("admin_activity_logs").select("action_type, details")
      .in("action_type", Object.keys(AUTO_LABELS)).gte("created_at", since).limit(5000);
    const counts: Record<string, number> = {};
    for (const l of (logs ?? []) as { action_type: string; details: { count?: number } | null }[])
      counts[l.action_type] = (counts[l.action_type] ?? 0) + (l.action_type === "auto_dishes_approved" ? Number(l.details?.count ?? 0) : 1);
    const automated = Object.entries(AUTO_LABELS).map(([k, label]) => ({ label, count: counts[k] ?? 0 }));

    const { data: admins } = await db.from("user_roles").select("user_id").eq("role", "admin");
    const ids = (admins ?? []).map((a: { user_id: string }) => a.user_id);
    const { data: profiles } = ids.length ? await db.from("profiles").select("email").in("id", ids) : { data: [] };
    const emails = onlyMe ? [caller!.email!] : [...new Set(((profiles ?? []) as { email: string | null }[]).map(p => p.email).filter((e): e is string => !!e))];

    const date = new Date().toLocaleDateString("nl-NL", { day: "numeric", month: "long", timeZone: "Europe/Amsterdam" });
    const day = new Date().toISOString().slice(0, 10);
    let sent = 0;
    for (const email of emails) {
      try {
        await sendTemplateEmail("admin-digest", email, { templateData: { date, queues, automated }, idempotencyKey: onlyMe ? `admin-digest-test-${Date.now()}` : `admin-digest-${day}-${email}` });
        sent++;
      } catch (e) {
        console.error("admin-daily-digest send", e);
      }
    }
    return json({ sent, queues: queues.length, automated });
  } catch (e) {
    console.error("admin-daily-digest", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
