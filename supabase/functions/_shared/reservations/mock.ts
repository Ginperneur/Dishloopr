// In-memory provider and store for tests and local development. Never used in production.
import type {
  AvailabilityQuery, CreateBookingInput, EventStatus, Integration, NewReservation, ProviderBooking,
  ProviderCapabilities, ProviderName, ReservationProvider, ReservationStore, Slot, StoredReservation, WebhookEvent,
} from './types.ts';
import { ReservationError } from './types.ts';

export const MOCK_WEBHOOK_SECRET = 'mock-secret';

export class MockProvider implements ReservationProvider {
  readonly name = 'zenchef' as const;
  slots = new Map<string, Slot[]>();           // key: rid|date|pax
  bookings = new Map<string, ProviderBooking & { rid: string; date: string; time: string }>();
  calls: string[] = [];
  /** Optional fault injection: throw this error (or hang) on the next matching call. */
  failNext: Partial<Record<'availability' | 'create' | 'cancel' | 'modify' | 'list', ReservationError | 'hang'>> = {};
  validRestaurants = new Set<string>(['1001']);
  validToken = true;
  bookingStatus: 'confirmed' | 'pending' = 'confirmed';
  private seq = 0;

  capabilities(): ProviderCapabilities {
    return { widget: true, availability: true, createBooking: true, getBooking: true, modifyBooking: true, cancelBooking: true, webhooks: true, listUpdatedBookings: true, sourceAttribution: true };
  }

  setSlots(rid: string, date: string, pax: number, times: string[]) {
    this.slots.set(`${rid}|${date}|${pax}`, times.map(t => ({ time: t, ref: `${rid}-${date}-${t}` })));
  }

  private async fault(kind: keyof MockProvider['failNext']) {
    const f = this.failNext[kind];
    if (!f) return;
    delete this.failNext[kind];
    if (f === 'hang') await new Promise(() => {});
    throw f;
  }

  private check(i: Integration) {
    if (!this.validToken) throw new ReservationError('invalid_credentials');
    if (!this.validRestaurants.has(i.external_restaurant_id)) throw new ReservationError('invalid_restaurant');
  }

  async getAvailability(i: Integration, q: AvailabilityQuery): Promise<Slot[]> {
    this.calls.push('availability');
    await this.fault('availability');
    this.check(i);
    const taken = new Set([...this.bookings.values()].filter(b => b.rid === q.externalRestaurantId && b.date === q.date && b.status !== 'cancelled').map(b => b.time));
    return (this.slots.get(`${q.externalRestaurantId}|${q.date}|${q.partySize}`) ?? []).filter(s => !taken.has(s.time));
  }

  async createBooking(i: Integration, input: CreateBookingInput): Promise<ProviderBooking> {
    this.calls.push('create');
    await this.fault('create');
    this.check(i);
    const free = await this.getAvailability(i, input);
    this.calls.pop();
    if (!free.some(s => s.time === input.time)) throw new ReservationError('slot_unavailable');
    const id = `zc-${++this.seq}`;
    const b = { externalReservationId: id, status: this.bookingStatus, partySize: input.partySize, updatedAt: new Date().toISOString(), rid: input.externalRestaurantId, date: input.date, time: input.time };
    this.bookings.set(id, b);
    return b;
  }

  async getBooking(_i: Integration, id: string): Promise<ProviderBooking> {
    const b = this.bookings.get(id);
    if (!b) throw new ReservationError('not_found');
    return b;
  }

  async modifyBooking(i: Integration, id: string, change: { date: string; time: string; partySize: number }): Promise<ProviderBooking> {
    this.calls.push('modify');
    await this.fault('modify');
    const b = this.bookings.get(id);
    if (!b) throw new ReservationError('not_found');
    const free = await this.getAvailability(i, { externalRestaurantId: b.rid, date: change.date, partySize: change.partySize });
    this.calls.pop();
    if (!free.some(s => s.time === change.time)) throw new ReservationError('slot_unavailable');
    Object.assign(b, { date: change.date, time: change.time, partySize: change.partySize, updatedAt: new Date().toISOString() });
    return b;
  }

  async cancelBooking(_i: Integration, id: string): Promise<ProviderBooking> {
    this.calls.push('cancel');
    await this.fault('cancel');
    const b = this.bookings.get(id);
    if (!b) throw new ReservationError('not_found');
    b.status = 'cancelled';
    b.updatedAt = new Date().toISOString();
    return b;
  }

  async listUpdatedBookings(_i: Integration, since: string, cursor: string | null) {
    this.calls.push('list');
    await this.fault('list');
    const all = [...this.bookings.values()].filter(b => (b.updatedAt ?? '') > since).sort((a, b) => a.externalReservationId.localeCompare(b.externalReservationId));
    const start = cursor ? Number(cursor) : 0;
    const page = all.slice(start, start + 2);
    return { bookings: page, next: start + 2 < all.length ? String(start + 2) : null };
  }

  async verifyWebhook(headers: Headers) {
    return headers.get('x-mock-signature') === MOCK_WEBHOOK_SECRET ? { ok: true as const } : { ok: false as const, code: 'invalid_signature' as const };
  }

  parseWebhook(rawBody: string): WebhookEvent[] {
    const data = JSON.parse(rawBody);
    return (Array.isArray(data) ? data : [data]) as WebhookEvent[];
  }
}

export class MemoryStore implements ReservationStore {
  integrations: Integration[] = [];
  reservations: StoredReservation[] = [];
  events = new Map<string, { status: EventStatus; attempts: number; error?: string | null; restaurantId: string | null }>();
  private seq = 0;

  async getIntegration(restaurantId: string, provider: ProviderName) {
    return this.integrations.find(i => i.restaurant_id === restaurantId && i.provider === provider) ?? null;
  }
  async findIntegrationByExternal(provider: ProviderName, ext: string) {
    return this.integrations.find(i => i.provider === provider && i.external_restaurant_id === ext) ?? null;
  }
  async updateIntegration(id: string, patch: Record<string, unknown>) {
    const i = this.integrations.find(x => x.id === id);
    if (i) Object.assign(i, patch);
  }
  async insertReservation(row: NewReservation) {
    const existing = this.reservations.find(r => r.idempotency_key === row.idempotency_key);
    if (existing) return { row: existing, created: false };
    const r: StoredReservation = { ...row, id: `res-${++this.seq}`, external_reservation_id: null, evidence: null, provider_updated_at: null, error_code: null };
    this.reservations.push(r);
    return { row: r, created: true };
  }
  async getReservation(id: string) { return this.reservations.find(r => r.id === id) ?? null; }
  async findReservationByExternal(provider: ProviderName, ext: string) {
    return this.reservations.find(r => r.provider === provider && r.external_reservation_id === ext) ?? null;
  }
  async updateReservation(id: string, patch: Partial<StoredReservation>) {
    const r = this.reservations.find(x => x.id === id);
    if (!r) throw new ReservationError('not_found');
    Object.assign(r, patch);
    return r;
  }
  async recordEvent(e: { provider: ProviderName; eventId: string; restaurantId: string | null }) {
    const key = `${e.provider}|${e.eventId}`;
    const prev = this.events.get(key);
    if (prev) { prev.attempts++; return { duplicate: true, previousStatus: prev.status }; }
    this.events.set(key, { status: 'received', attempts: 1, restaurantId: e.restaurantId });
    return { duplicate: false };
  }
  async finishEvent(provider: ProviderName, eventId: string, status: EventStatus, error?: string | null, restaurantId?: string | null) {
    const ev = this.events.get(`${provider}|${eventId}`);
    if (ev) Object.assign(ev, { status, error: error ?? null, restaurantId: restaurantId ?? ev.restaurantId });
  }
}
