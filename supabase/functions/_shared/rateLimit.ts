import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

export interface RateLimitOptions {
  /** Logical name shown in logs and used as bucket key. */
  functionName: string;
  /** Limit for authenticated users. */
  user: { max: number; window: number };
  /** Limit for anonymous (IP-based) callers. Use stricter values. */
  anon: { max: number; window: number };
  /** If true, this counts towards the AI kill-switch in app_settings. */
  isAi?: boolean;
}

export interface RateLimitResult {
  allowed: boolean;
  /** When not allowed, a ready-to-return Response (429 / 503). */
  response?: Response;
  identifier?: string;
  isUser?: boolean;
}

function getClientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return (
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

/**
 * Enforces a per-user / per-IP rate limit using the `check_and_log_rate_limit` RPC.
 * Honours the `rate_limiting_enabled` and `ai_features_enabled` flags in `app_settings`.
 * Fails open on infrastructure errors (logs to console) so legitimate users are never blocked
 * by a transient DB hiccup.
 */
export async function enforceRateLimit(
  req: Request,
  opts: RateLimitOptions
): Promise<RateLimitResult> {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) {
      console.warn("[rateLimit] missing env, failing open");
      return { allowed: true };
    }
    const admin = createClient(supabaseUrl, serviceKey);

    // Kill switches
    const { data: settings } = await admin
      .from("app_settings")
      .select("key, value")
      .in("key", ["rate_limiting_enabled", "ai_features_enabled"]);

    const map = new Map<string, unknown>();
    (settings ?? []).forEach((s: any) => map.set(s.key, s.value));

    if (opts.isAi && map.get("ai_features_enabled") === false) {
      return {
        allowed: false,
        response: new Response(
          JSON.stringify({
            error:
              "AI-functionaliteit is tijdelijk uitgeschakeld door de beheerder.",
          }),
          {
            status: 503,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        ),
      };
    }

    if (map.get("rate_limiting_enabled") === false) {
      return { allowed: true };
    }

    // Identify caller (user-id wins, otherwise IP)
    let identifier = "";
    let isUser = false;
    let limit = opts.anon;

    const authHeader = req.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.replace("Bearer ", "");
      // Skip if it's the anon publishable key (no user)
      const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
      if (token && token !== anonKey) {
        try {
          const { data } = await admin.auth.getUser(token);
          if (data?.user) {
            identifier = `user:${data.user.id}`;
            isUser = true;
            limit = opts.user;
          }
        } catch (_) {
          // fall through to IP
        }
      }
    }

    if (!identifier) {
      identifier = `ip:${getClientIp(req)}`;
    }

    const { data, error } = await admin.rpc("check_and_log_rate_limit", {
      p_identifier: identifier,
      p_function: opts.functionName,
      p_max: limit.max,
      p_window_seconds: limit.window,
    });

    if (error) {
      console.error("[rateLimit] RPC error, failing open:", error.message);
      return { allowed: true, identifier, isUser };
    }

    const result = data as {
      allowed: boolean;
      count: number;
      limit: number;
      retry_after?: number;
    };

    if (!result?.allowed) {
      console.warn(
        `[rateLimit] blocked ${identifier} on ${opts.functionName} (${result.count}/${result.limit})`
      );
      return {
        allowed: false,
        identifier,
        isUser,
        response: new Response(
          JSON.stringify({
            error:
              "Te veel verzoeken in korte tijd. Probeer het later opnieuw.",
            limit: result.limit,
            retry_after_seconds: result.retry_after,
          }),
          {
            status: 429,
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json",
              "Retry-After": String(result.retry_after ?? 60),
            },
          }
        ),
      };
    }

    return { allowed: true, identifier, isUser };
  } catch (e) {
    console.error("[rateLimit] unexpected error, failing open:", e);
    return { allowed: true };
  }
}