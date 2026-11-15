// Supabase-backed ReservationStore (service role, server-side only).
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.118.0";
import type { EventStatus, Integration, NewReservation, ProviderName, ReservationStore, StoredReservation } from "./types.ts";
import { ReservationError } from "./types.ts";
import { ZenchefProvider } from "./zenchef.ts";
import type { ReservationProvider } from "./types.ts";

const INTEGRATION_COLS = "id, restaurant_id, provider, external_restaurant_id, method, status, enabled, config, last_synced_at";

function fail(context: string, error: { message: string; code?: string } | null): never {
  console.error(`[reservations] ${context}:`, error?.code ?? "", error?.message ?? "");
  throw new ReservationError("provider_error", "Opslaan mislukt", true);
}

export function supabaseStore(db: SupabaseClient): ReservationStore {
  return {
    async getIntegration(restaurantId, provider) {
      const { data, error } = await db.from("restaurant_integrations").select(INTEGRATION_COLS).eq("restaurant_id", restaurantId).eq("provider", provider).maybeSingle();
      if (error) fail("getIntegration", error);
      return (data as Integration | null) ?? null;
    },
    async findIntegrationByExternal(provider, ext) {
      const { data, error } = await db.from("restaurant_integrations").select(INTEGRATION_COLS).eq("provider", provider).eq("external_restaurant_id", ext).maybeSingle();
      if (error) fail("findIntegrationByExternal", error);
      return (data as Integration | null) ?? null;
    },
    async updateIntegration(id, patch) {
      const { error } = await db.from("restaurant_integrations").update({
        ...patch,
        ...(patch.last_error_code ? { last_error_at: new Date().toISOString() } : {}),
        updated_at: new Date().toISOString(),
      }).eq("id", id);
      if (error) fail("updateIntegration", error);
    },
    async insertReservation(row: NewReservation) {
      const { data, error } = await db.from("reservations").insert(row).select("*").single();
      if (!error) return { row: data as StoredReservation, created: true };
      if (error.code !== "23505") fail("insertReservation", error);
      const { data: existing, error: e2 } = await db.from("reservations").select("*").eq("idempotency_key", row.idempotency_key).single();
      if (e2) fail("insertReservation.existing", e2);
      return { row: existing as StoredReservation, created: false };
    },
    async getReservation(id) {
      if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
      const { data, error } = await db.from("reservations").select("*").eq("id", id).maybeSingle();
      if (error) fail("getReservation", error);
      return (data as StoredReservation | null) ?? null;
    },
    async findReservationByExternal(provider, ext) {
      const { data, error } = await db.from("reservations").select("*").eq("provider", provider).eq("external_reservation_id", ext).maybeSingle();
      if (error) fail("findReservationByExternal", error);
      return (data as StoredReservation | null) ?? null;
    },
    async updateReservation(id, patch: Partial<StoredReservation>) {
      const { data, error } = await db.from("reservations").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id).select("*").single();
      if (error) fail("updateReservation", error);
      return data as StoredReservation;
    },
    async recordEvent(e) {
      const { error } = await db.from("integration_events").insert({ provider: e.provider, event_id: e.eventId, event_type: e.type.slice(0, 60), restaurant_id: e.restaurantId });
      if (!error) return { duplicate: false };
      if (error.code !== "23505") fail("recordEvent", error);
      const { data } = await db.from("integration_events").select("processing_status, attempts").eq("provider", e.provider).eq("event_id", e.eventId).single();
      await db.from("integration_events").update({ attempts: ((data as { attempts?: number } | null)?.attempts ?? 1) + 1 }).eq("provider", e.provider).eq("event_id", e.eventId);
      return { duplicate: true, previousStatus: (data as { processing_status?: EventStatus } | null)?.processing_status };
    },
    async finishEvent(provider: ProviderName, eventId: string, status: EventStatus, errorCode?: string | null, restaurantId?: string | null) {
      const { error } = await db.from("integration_events").update({
        processing_status: status, error_code: errorCode ?? null, processed_at: new Date().toISOString(),
        ...(restaurantId ? { restaurant_id: restaurantId } : {}),
      }).eq("provider", provider).eq("event_id", eventId);
      if (error) fail("finishEvent", error);
    },
  };
}

export function providerFor(name: string): ReservationProvider | null {
  // API access for Zenchef is not available yet, so the adapter runs without it.
  if (name === "zenchef") return new ZenchefProvider(null);
  return null;
}
