// Booking orchestration on top of a provider adapter and a store.
// Rules: availability always comes from the provider, it is re-checked right before
// creating, a booking only counts as made when the provider returned its id, and the
// same idempotency key never creates a second booking.
import {
  type Integration, LIVE_STATUSES, type ProviderBooking, type ProviderCapabilities, type ProviderName,
  type ReservationProvider, type ReservationStore, type Slot, type StoredReservation,
  ReservationError,
} from './types.ts';
import {
  DEFAULT_TIMEZONE, cleanContext, isValidTime, localToUtc, utcToLocal, validateBookingDate, validateGuest,
  validateIdempotencyKey, validatePartySize,
} from './validation.ts';

export interface ServiceDeps {
  store: ReservationStore;
  provider: ReservationProvider;
  now?: () => Date;
  /** Per provider call. */
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 8000;

export async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      p,
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new ReservationError('provider_timeout', 'Het reserveringssysteem reageert niet', true)), ms); }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function sha256Hex(value: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

export function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
}

function tzOf(i: Integration) { return i.config?.timezone || DEFAULT_TIMEZONE; }

async function liveIntegration(deps: ServiceDeps, restaurantId: string, provider: ProviderName, need: keyof ProviderCapabilities): Promise<Integration> {
  const integration = await deps.store.getIntegration(restaurantId, provider);
  if (!integration || !integration.enabled || !LIVE_STATUSES.includes(integration.status)) {
    throw new ReservationError('not_available', 'Online reserveren is niet beschikbaar voor dit restaurant');
  }
  if (!deps.provider.capabilities(integration)[need]) {
    throw new ReservationError('provider_not_configured', 'Deze functie is nog niet beschikbaar via het reserveringssysteem');
  }
  return integration;
}

export async function getAvailability(deps: ServiceDeps, input: { restaurantId: string; date: unknown; partySize: unknown }) {
  const integration = await liveIntegration(deps, input.restaurantId, deps.provider.name, 'availability');
  const now = deps.now?.() ?? new Date();
  const tz = tzOf(integration);
  const date = validateBookingDate(input.date, now, tz);
  const partySize = validatePartySize(input.partySize);
  const slots = await withTimeout(deps.provider.getAvailability(integration, { externalRestaurantId: integration.external_restaurant_id, date, partySize }), deps.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  // Hide slots that already passed today in the restaurant's own timezone.
  const local = utcToLocal(now.toISOString(), tz);
  const upcoming = slots.filter((s: Slot) => isValidTime(s.time) && (date > local.date || s.time > local.time));
  return { date, partySize, timezone: tz, slots: upcoming };
}

export interface CreateInput {
  restaurantId: string;
  date: unknown;
  time: unknown;
  partySize: unknown;
  guest: unknown;
  idempotencyKey: unknown;
  dishContext?: unknown;
  campaignId?: unknown;
}

export interface CreateResult {
  reservationId: string;
  status: StoredReservation['status'];
  /** Only present the first time; lets the guest cancel or change later. */
  manageToken?: string;
  startsAt: string;
  partySize: number;
  replayed: boolean;
}

export async function createReservation(deps: ServiceDeps, input: CreateInput): Promise<CreateResult> {
  const integration = await liveIntegration(deps, input.restaurantId, deps.provider.name, 'createBooking');
  const now = deps.now?.() ?? new Date();
  const tz = tzOf(integration);
  const key = validateIdempotencyKey(input.idempotencyKey);
  const date = validateBookingDate(input.date, now, tz);
  const partySize = validatePartySize(input.partySize);
  if (!isValidTime(input.time)) throw new ReservationError('invalid_input', 'Ongeldige tijd');
  const time = input.time;
  const guest = validateGuest(input.guest);
  const startsAt = localToUtc(date, time, tz);
  if (Date.parse(startsAt) <= now.getTime()) throw new ReservationError('invalid_input', 'Dit tijdstip ligt in het verleden');
  const campaignId = typeof input.campaignId === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(input.campaignId) ? input.campaignId : null;

  const token = randomToken();
  const { row, created } = await deps.store.insertReservation({
    restaurant_id: integration.restaurant_id,
    provider: integration.provider,
    status: 'pending',
    starts_at: startsAt,
    party_size: partySize,
    dish_context: cleanContext(input.dishContext),
    campaign_id: campaignId,
    idempotency_key: key,
    manage_token_hash: await sha256Hex(token),
  });

  if (!created) {
    // Same request again (double click, retry after a network error): never book twice.
    if (row.restaurant_id !== integration.restaurant_id) throw new ReservationError('invalid_input', 'Ongeldige aanvraagsleutel');
    if (row.status === 'pending' && !row.external_reservation_id && !row.error_code) {
      throw new ReservationError('in_progress', 'Je reservering wordt nog verwerkt', true);
    }
    if (row.status === 'failed' || row.status === 'rejected') {
      throw new ReservationError((row.error_code as 'slot_unavailable') || 'provider_error', 'Deze aanvraag is eerder mislukt; start een nieuwe reservering');
    }
    return { reservationId: row.id, status: row.status, startsAt: row.starts_at, partySize: row.party_size, replayed: true };
  }

  const timeout = deps.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  try {
    const free = await withTimeout(deps.provider.getAvailability(integration, { externalRestaurantId: integration.external_restaurant_id, date, partySize }), timeout);
    const slot = free.find(s => s.time === time);
    if (!slot) throw new ReservationError('slot_unavailable', 'Dit tijdslot is net bezet geraakt');
    const booking: ProviderBooking = await withTimeout(deps.provider.createBooking(integration, {
      externalRestaurantId: integration.external_restaurant_id, date, time, partySize, slotRef: slot.ref, guest, reference: row.id,
    }), timeout);
    if (!booking.externalReservationId) throw new ReservationError('provider_error', 'Geen bevestiging ontvangen');
    const saved = await deps.store.updateReservation(row.id, {
      external_reservation_id: booking.externalReservationId,
      status: booking.status === 'pending' ? 'pending' : booking.status,
      evidence: 'provider_confirmed',
      provider_updated_at: booking.updatedAt ?? now.toISOString(),
      error_code: null,
    });
    return { reservationId: saved.id, status: saved.status, manageToken: token, startsAt, partySize, replayed: false };
  } catch (e) {
    const err = e instanceof ReservationError ? e : new ReservationError('provider_error', 'Er ging iets mis bij het reserveringssysteem', true);
    if (err.code === 'provider_timeout') {
      // The provider may still have created the booking: keep it pending (unknown),
      // never show success, and let the guest know not to book twice.
      await deps.store.updateReservation(row.id, { error_code: 'provider_timeout' });
    } else {
      await deps.store.updateReservation(row.id, { status: err.code === 'slot_unavailable' ? 'rejected' : 'failed', error_code: err.code, manage_token_hash: null });
    }
    throw err;
  }
}

async function authorizedReservation(deps: ServiceDeps, reservationId: string, token: unknown): Promise<StoredReservation> {
  const row = await deps.store.getReservation(reservationId);
  if (!row || typeof token !== 'string' || !row.manage_token_hash || (await sha256Hex(token)) !== row.manage_token_hash) {
    // Same answer for unknown id and wrong token: no reservation enumeration.
    throw new ReservationError('not_found', 'Reservering niet gevonden');
  }
  return row;
}

export async function getReservationStatus(deps: ServiceDeps, reservationId: string, token: unknown) {
  const row = await authorizedReservation(deps, reservationId, token);
  return { reservationId: row.id, status: row.status, startsAt: row.starts_at, partySize: row.party_size, unconfirmed: row.error_code === 'provider_timeout' };
}

export async function cancelReservation(deps: ServiceDeps, reservationId: string, token: unknown) {
  const row = await authorizedReservation(deps, reservationId, token);
  if (row.status === 'cancelled') return { reservationId: row.id, status: row.status };
  if (!row.external_reservation_id || !['pending', 'confirmed'].includes(row.status)) throw new ReservationError('not_allowed', 'Deze reservering kan niet geannuleerd worden');
  const integration = await liveIntegration(deps, row.restaurant_id, row.provider, 'cancelBooking');
  const b = await withTimeout(deps.provider.cancelBooking(integration, row.external_reservation_id), deps.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const saved = await deps.store.updateReservation(row.id, { status: b.status, provider_updated_at: b.updatedAt ?? (deps.now?.() ?? new Date()).toISOString() });
  return { reservationId: saved.id, status: saved.status };
}

export async function modifyReservation(deps: ServiceDeps, reservationId: string, token: unknown, change: { date: unknown; time: unknown; partySize: unknown }) {
  const row = await authorizedReservation(deps, reservationId, token);
  if (!row.external_reservation_id || !['pending', 'confirmed'].includes(row.status)) throw new ReservationError('not_allowed', 'Deze reservering kan niet gewijzigd worden');
  const integration = await liveIntegration(deps, row.restaurant_id, row.provider, 'modifyBooking');
  const now = deps.now?.() ?? new Date();
  const tz = tzOf(integration);
  const date = validateBookingDate(change.date, now, tz);
  const partySize = validatePartySize(change.partySize);
  if (!isValidTime(change.time)) throw new ReservationError('invalid_input', 'Ongeldige tijd');
  const startsAt = localToUtc(date, change.time, tz);
  if (Date.parse(startsAt) <= now.getTime()) throw new ReservationError('invalid_input', 'Dit tijdstip ligt in het verleden');
  const b = await withTimeout(deps.provider.modifyBooking(integration, row.external_reservation_id, { date, time: change.time, partySize }), deps.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const saved = await deps.store.updateReservation(row.id, { starts_at: b.startsAt ?? startsAt, party_size: b.partySize ?? partySize, status: b.status, provider_updated_at: b.updatedAt ?? now.toISOString() });
  return { reservationId: saved.id, status: saved.status, startsAt: saved.starts_at, partySize: saved.party_size };
}

/** Owner "test connection": reports what works with today's access, without side effects. */
export async function testConnection(deps: ServiceDeps, restaurantId: string) {
  const integration = await deps.store.getIntegration(restaurantId, deps.provider.name);
  if (!integration) return { ok: false, code: 'not_connected' as const, capabilities: null };
  const caps = deps.provider.capabilities(integration);
  if (integration.method === 'widget') return { ok: true, code: 'widget_only' as const, capabilities: caps };
  if (!caps.availability) {
    await deps.store.updateIntegration(integration.id, { status: 'config_required', last_error_code: 'provider_not_configured' });
    return { ok: false, code: 'provider_not_configured' as const, capabilities: caps };
  }
  try {
    const today = utcToLocal((deps.now?.() ?? new Date()).toISOString(), tzOf(integration)).date;
    await withTimeout(deps.provider.getAvailability(integration, { externalRestaurantId: integration.external_restaurant_id, date: today, partySize: 2 }), deps.timeoutMs ?? DEFAULT_TIMEOUT_MS);
    await deps.store.updateIntegration(integration.id, { status: caps.createBooking && caps.webhooks ? 'connected' : 'limited', last_error_code: null });
    return { ok: true, code: 'api_ok' as const, capabilities: caps };
  } catch (e) {
    const code = e instanceof ReservationError ? e.code : 'provider_error';
    await deps.store.updateIntegration(integration.id, { status: 'error', last_error_code: code });
    return { ok: false, code, capabilities: caps };
  }
}
