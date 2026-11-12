// Incoming reservation webhooks: POST /reservation-webhook?provider=zenchef
//
// Authenticity is checked by the provider adapter. Zenchef's verification scheme is
// not public yet, so the Zenchef adapter rejects every call with 501 until it is
// implemented from Zenchef's documentation. Processing is idempotent per provider
// event id; failures return 500 so the provider retries.
import { serviceClient } from "../_shared/auth.ts";
import { processWebhook } from "../_shared/reservations/sync.ts";
import { providerFor, supabaseStore } from "../_shared/reservations/supabaseStore.ts";

const MAX_BODY_BYTES = 256 * 1024;

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("method_not_allowed", { status: 405 });
  const provider = providerFor(new URL(req.url).searchParams.get("provider") ?? "");
  if (!provider) return new Response("unknown_provider", { status: 404 });

  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) return new Response("payload_too_large", { status: 413 });

  const outcome = await processWebhook({ store: supabaseStore(serviceClient()), provider }, req.headers, raw);
  console.log(`[reservation-webhook] ${provider.name} -> ${outcome.httpStatus}`, outcome.error ?? "", outcome.results.map((r) => r.result).join(","));
  return new Response(JSON.stringify({ ok: outcome.httpStatus < 300, error: outcome.error, results: outcome.results }), {
    status: outcome.httpStatus,
    headers: { "Content-Type": "application/json" },
  });
});
