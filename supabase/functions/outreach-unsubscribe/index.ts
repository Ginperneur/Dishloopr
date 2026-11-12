// RFC 8058 one-click unsubscribe for outreach mails (List-Unsubscribe-Post).
// POST unsubscribes immediately (mail clients). GET only redirects to the confirm page, so link
// scanners that prefetch URLs never unsubscribe anyone by accident.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { serviceClient } from "../_shared/auth.ts";

const SITE = (Deno.env.get("SITE_URL") ?? "https://dishloopr.com").replace(/\/$/, "");

serve(async (req) => {
  const token = new URL(req.url).searchParams.get("t") ?? "";
  if (req.method === "GET") {
    return new Response(null, { status: 302, headers: { Location: `${SITE}/voor-restaurants/afmelden?t=${encodeURIComponent(token)}` } });
  }
  if (req.method !== "POST" || token.length < 16) return new Response("Bad request", { status: 400 });
  const { error } = await serviceClient().rpc("outreach_unsubscribe", { p_token: token });
  if (error) {
    console.error("outreach-unsubscribe", error.message);
    return new Response("Error", { status: 500 });
  }
  return new Response("Afgemeld", { status: 200 });
});
