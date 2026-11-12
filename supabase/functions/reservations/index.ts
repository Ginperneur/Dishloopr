// Native reservation API for the Dishloopr frontend. All provider calls happen here,
// server-side; the browser never sees provider credentials.
//
// POST { action, ... }
//   availability { restaurantId, date, partySize }
//   create       { restaurantId, date, time, partySize, guest, idempotencyKey, dishContext?, campaignId? }
//   status       { reservationId, token }
//   cancel       { reservationId, token }
//   modify       { reservationId, token, date, time, partySize }
//   test         { restaurantId }   (verified owner or admin)
import { getCaller, isAdmin, serviceClient } from "../_shared/auth.ts";
import { enforceRateLimit } from "../_shared/rateLimit.ts";
import { ReservationError } from "../_shared/reservations/types.ts";
import {
  cancelReservation, createReservation, getAvailability, getReservationStatus, modifyReservation, testConnection,
} from "../_shared/reservations/service.ts";
import { providerFor, supabaseStore } from "../_shared/reservations/supabaseStore.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const STATUS_BY_CODE: Record<string, number> = {
  invalid_input: 400, not_available: 404, not_found: 404, provider_not_configured: 503, slot_unavailable: 409,
  in_progress: 409, not_allowed: 409, provider_timeout: 504, provider_rate_limited: 503, invalid_credentials: 502,
  invalid_restaurant: 502, provider_error: 502,
};

const LIMITS: Record<string, { user: { max: number; window: number }; anon: { max: number; window: number } }> = {
  availability: { user: { max: 60, window: 60 }, anon: { max: 30, window: 60 } },
  create: { user: { max: 6, window: 600 }, anon: { max: 4, window: 600 } },
  status: { user: { max: 30, window: 60 }, anon: { max: 20, window: 60 } },
  cancel: { user: { max: 6, window: 600 }, anon: { max: 4, window: 600 } },
  modify: { user: { max: 6, window: 600 }, anon: { max: 4, window: 600 } },
  test: { user: { max: 10, window: 600 }, anon: { max: 0, window: 600 } },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: "invalid_input", message: "Ongeldige aanvraag" }, 400); }
  const action = String(body.action ?? "");
  if (!LIMITS[action]) return json({ error: "invalid_input", message: "Onbekende actie" }, 400);

  const limited = await enforceRateLimit(req, { functionName: `reservations-${action}`, ...LIMITS[action] });
  if (!limited.allowed) return limited.response!;

  const provider = providerFor("zenchef")!;
  const db = serviceClient();
  const deps = { store: supabaseStore(db), provider };

  try {
    switch (action) {
      case "availability":
        return json(await getAvailability(deps, { restaurantId: String(body.restaurantId ?? ""), date: body.date, partySize: body.partySize }));
      case "create":
        return json(await createReservation(deps, {
          restaurantId: String(body.restaurantId ?? ""), date: body.date, time: body.time, partySize: body.partySize,
          guest: body.guest, idempotencyKey: body.idempotencyKey, dishContext: body.dishContext, campaignId: body.campaignId,
        }));
      case "status":
        return json(await getReservationStatus(deps, String(body.reservationId ?? ""), body.token));
      case "cancel":
        return json(await cancelReservation(deps, String(body.reservationId ?? ""), body.token));
      case "modify":
        return json(await modifyReservation(deps, String(body.reservationId ?? ""), body.token, { date: body.date, time: body.time, partySize: body.partySize }));
      case "test": {
        const user = await getCaller(req);
        if (!user) return json({ error: "unauthorized" }, 401);
        const restaurantId = String(body.restaurantId ?? "");
        const { data: owner } = await db.rpc("is_verified_owner", { _user_id: user.id, _restaurant_id: restaurantId });
        if (owner !== true && !(await isAdmin(db, user.id))) return json({ error: "forbidden" }, 403);
        return json(await testConnection(deps, restaurantId));
      }
    }
    return json({ error: "invalid_input" }, 400);
  } catch (e) {
    if (e instanceof ReservationError) {
      // Log the code only: never guest details.
      console.warn(`[reservations] ${action} -> ${e.code}`);
      return json({ error: e.code, message: e.message, retryable: e.retryable }, STATUS_BY_CODE[e.code] ?? 400);
    }
    console.error(`[reservations] ${action} unexpected`, e instanceof Error ? e.message : "");
    return json({ error: "provider_error", message: "Er ging iets mis. Probeer het later opnieuw.", retryable: true }, 500);
  }
});
