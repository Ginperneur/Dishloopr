import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.57.2";

export function serviceClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );
}

export function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!),
  );
}

function bearer(req: Request): string | null {
  const h = req.headers.get("Authorization") ?? "";
  return h.startsWith("Bearer ") ? h.slice(7).trim() : null;
}

/** Returns the signed-in user for the request, or null. */
export async function getCaller(req: Request) {
  const token = bearer(req);
  if (!token) return null;
  const anon = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    { auth: { persistSession: false } },
  );
  const { data, error } = await anon.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

/** True when the call comes from another server function (service key) or a scheduled job (cron secret). */
export async function isInternalCaller(req: Request, admin: SupabaseClient): Promise<boolean> {
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const token = bearer(req);
  if (serviceKey && token && token === serviceKey) return true;
  const cronSecret = req.headers.get("x-cron-secret");
  if (cronSecret) {
    const { data } = await admin.rpc("verify_cron_secret", { p_secret: cronSecret });
    if (data === true) return true;
  }
  return false;
}

export async function isAdmin(admin: SupabaseClient, userId: string): Promise<boolean> {
  const { data } = await admin.rpc("has_role", { _user_id: userId, _role: "admin" });
  return data === true;
}

/** Allows internal callers or signed-in admins. Returns an error Response when denied. */
export async function requireAdminOrInternal(
  req: Request,
  admin: SupabaseClient,
  corsHeaders: Record<string, string>,
): Promise<Response | null> {
  if (await isInternalCaller(req, admin)) return null;
  const user = await getCaller(req);
  if (user && (await isAdmin(admin, user.id))) return null;
  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: user ? 403 : 401,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const ALLOWED_ORIGINS = [
  "https://dishloopr.com",
  "https://www.dishloopr.com",
  "https://dishloopr.nl",
  "https://www.dishloopr.nl",
  "https://dishloopr.eu",
  "https://dishloopr.lovable.app",
];

/** Returns the request Origin only when it is one of the app's own domains or a Lovable preview. */
export function safeOrigin(req: Request): string {
  const origin = req.headers.get("origin") ?? "";
  if (ALLOWED_ORIGINS.includes(origin)) return origin;
  if (/^https:\/\/[a-z0-9-]+\.lovable\.app$/i.test(origin)) return origin;
  if (/^https:\/\/[a-z0-9-]+\.lovableproject\.com$/i.test(origin)) return origin;
  if (/^http:\/\/localhost:\d+$/.test(origin)) return origin;
  return "https://dishloopr.com";
}

/** Rejects URLs that are not public http(s) addresses (blocks private/loopback/metadata hosts). */
export function isSafePublicUrl(raw: string): boolean {
  let u: URL;
  try { u = new URL(raw); } catch { return false; }
  if (u.protocol !== "https:" && u.protocol !== "http:") return false;
  if (u.username || u.password) return false;
  const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) return false;
  if (/^\d+$/.test(host)) return false;
  const v4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
    if (a === 169 && b === 254) return false;
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 192 && b === 168) return false;
    if (a === 100 && b >= 64 && b <= 127) return false;
  }
  if (host.includes(":")) {
    if (host === "::1" || host === "::" || host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe80") || host.startsWith("::ffff:")) return false;
  }
  return true;
}
