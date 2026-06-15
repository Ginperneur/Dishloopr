import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const UA =
  "Mozilla/5.0 (compatible; DishlooprLinkChecker/1.0; +https://dishloopr.com)";

interface RestaurantRow {
  id: string;
  name: string;
  website_url: string;
}

type Status = "ok" | "redirect" | "broken" | "timeout";

async function checkUrl(
  url: string,
  timeoutMs = 10000,
): Promise<{ status: Status; code: number | null; finalUrl?: string }> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    // Try HEAD first
    let res: Response;
    try {
      res = await fetch(url, {
        method: "HEAD",
        redirect: "follow",
        signal: ctrl.signal,
        headers: { "User-Agent": UA, Accept: "*/*" },
      });
    } catch {
      // Some servers don't allow HEAD — try GET
      res = await fetch(url, {
        method: "GET",
        redirect: "follow",
        signal: ctrl.signal,
        headers: { "User-Agent": UA, Accept: "*/*" },
      });
    }
    // If HEAD returned 405/403, fall back to GET
    if (res.status === 405 || res.status === 403) {
      try {
        res = await fetch(url, {
          method: "GET",
          redirect: "follow",
          signal: ctrl.signal,
          headers: { "User-Agent": UA, Accept: "*/*" },
        });
      } catch (_) { /* keep original */ }
    }
    // Consume body to avoid leaks
    try { await res.body?.cancel(); } catch { /* noop */ }

    const code = res.status;
    let status: Status;
    if (code >= 200 && code < 300) status = "ok";
    else if (code >= 300 && code < 400) status = "redirect";
    else status = "broken";
    return { status, code, finalUrl: res.url };
  } catch (e) {
    const msg = (e as Error)?.name || "";
    if (msg === "AbortError") return { status: "timeout", code: null };
    return { status: "broken", code: null };
  } finally {
    clearTimeout(t);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    // Auth: admin only
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.replace("Bearer ", "");
    const { data: userData } = await admin.auth.getUser(token);
    if (!userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: isAdmin } = await admin.rpc("has_role", {
      _user_id: userData.user.id,
      _role: "admin",
    });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Admin role required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const batchSize: number = Math.min(Math.max(body.batchSize ?? 50, 1), 100);
    const recheckOlderThanDays: number = body.recheckOlderThanDays ?? 30;
    const forceRecheck: boolean = !!body.forceRecheck;

    // Build query: never-checked first, then stale
    let query = admin
      .from("restaurants")
      .select("id, name, website_url")
      .not("website_url", "is", null)
      .eq("is_active", true)
      .order("website_checked_at", { ascending: true, nullsFirst: true })
      .limit(batchSize);

    if (!forceRecheck) {
      const cutoff = new Date(
        Date.now() - recheckOlderThanDays * 24 * 60 * 60 * 1000,
      ).toISOString();
      query = query.or(
        `website_checked_at.is.null,website_checked_at.lt.${cutoff}`,
      );
    }

    const { data: rows, error } = await query;
    if (error) throw error;
    const restaurants = (rows ?? []) as RestaurantRow[];

    // Count remaining (after this batch will be processed)
    const { count: remainingTotal } = await admin
      .from("restaurants")
      .select("id", { count: "exact", head: true })
      .not("website_url", "is", null)
      .eq("is_active", true)
      .or(
        forceRecheck
          ? "website_checked_at.is.null,website_checked_at.not.is.null"
          : `website_checked_at.is.null,website_checked_at.lt.${new Date(Date.now() - recheckOlderThanDays * 24 * 60 * 60 * 1000).toISOString()}`,
      );

    const summary = {
      processed: 0,
      ok: 0,
      redirect: 0,
      broken: 0,
      timeout: 0,
    };
    const results: Array<{
      id: string;
      name: string;
      url: string;
      status: Status;
      code: number | null;
    }> = [];

    // Process in parallel chunks of 10
    const chunkSize = 10;
    for (let i = 0; i < restaurants.length; i += chunkSize) {
      const chunk = restaurants.slice(i, i + chunkSize);
      await Promise.all(
        chunk.map(async (r) => {
          const { status, code } = await checkUrl(r.website_url);
          summary.processed++;
          summary[status]++;
          results.push({
            id: r.id,
            name: r.name,
            url: r.website_url,
            status,
            code,
          });
          await admin
            .from("restaurants")
            .update({
              website_status: status,
              website_status_code: code,
              website_checked_at: new Date().toISOString(),
            })
            .eq("id", r.id);
        }),
      );
    }

    return new Response(
      JSON.stringify({
        summary: {
          ...summary,
          remaining: Math.max((remainingTotal ?? 0) - summary.processed, 0),
        },
        results,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (e) {
    console.error("[link-health-checker] error", e);
    return new Response(
      JSON.stringify({ error: (e as Error)?.message ?? "unknown" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});