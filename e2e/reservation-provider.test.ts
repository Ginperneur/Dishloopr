import { beforeEach, describe, expect, test } from 'bun:test';
import { MOCK_WEBHOOK_SECRET, MemoryStore, MockProvider } from '../supabase/functions/_shared/reservations/mock';
import {
  cancelReservation, createReservation, getAvailability, getReservationStatus, modifyReservation, testConnection,
} from '../supabase/functions/_shared/reservations/service';
import { processWebhook, reconcileIntegration } from '../supabase/functions/_shared/reservations/sync';
import { ZenchefProvider } from '../supabase/functions/_shared/reservations/zenchef';
import { localToUtc, utcToLocal } from '../supabase/functions/_shared/reservations/validation';
import { type Integration, ReservationError } from '../supabase/functions/_shared/reservations/types';

const R = 'rest-1';
const NOW = new Date('2026-12-01T10:00:00Z'); // 11:00 in Amsterdam
const guest = { firstName: 'Sanne', lastName: 'de Vries', email: 'sanne@example.nl', phone: '+31 6 12345678' };
const key = (n = 1) => `key-0000000000000${n}`;

let store: MemoryStore;
let provider: MockProvider;
let deps: { store: MemoryStore; provider: MockProvider; now: () => Date; timeoutMs: number };
let integration: Integration;

beforeEach(() => {
  store = new MemoryStore();
  provider = new MockProvider();
  integration = { id: 'int-1', restaurant_id: R, provider: 'zenchef', external_restaurant_id: '1001', method: 'api', status: 'connected', enabled: true, config: {}, last_synced_at: null };
  store.integrations.push(integration);
  provider.setSlots('1001', '2026-12-10', 2, ['18:00', '19:30', '21:00']);
  deps = { store, provider, now: () => NOW, timeoutMs: 50 };
});

async function code(p: Promise<unknown>) {
  try { await p; return 'ok'; } catch (e) { return e instanceof ReservationError ? e.code : String(e); }
}

const book = (over: Record<string, unknown> = {}) =>
  createReservation(deps, { restaurantId: R, date: '2026-12-10', time: '19:30', partySize: 2, guest, idempotencyKey: key(), dishContext: 'truffelpasta', ...over });

describe('connection', () => {
  test('establishing: test connection marks a working API integration connected', async () => {
    integration.status = 'testing';
    const r = await testConnection(deps, R);
    expect(r.ok).toBe(true);
    expect(integration.status).toBe('connected');
  });
  test('wrong credentials put the integration in error', async () => {
    provider.validToken = false;
    const r = await testConnection(deps, R);
    expect(r).toMatchObject({ ok: false, code: 'invalid_credentials' });
    expect(integration.status).toBe('error');
  });
  test('an unknown restaurant ID is reported', async () => {
    integration.external_restaurant_id = '999';
    expect((await testConnection(deps, R)).code).toBe('invalid_restaurant');
  });
  test('disconnecting (no integration) means nothing can be booked', async () => {
    store.integrations = [];
    expect((await testConnection(deps, R)).code).toBe('not_connected');
    expect(await code(book())).toBe('not_available');
  });
  test('a disabled integration takes no bookings', async () => {
    integration.enabled = false;
    expect(await code(getAvailability(deps, { restaurantId: R, date: '2026-12-10', partySize: 2 }))).toBe('not_available');
  });
});

describe('availability', () => {
  test('returns the provider slots', async () => {
    const r = await getAvailability(deps, { restaurantId: R, date: '2026-12-10', partySize: 2 });
    expect(r.slots.map(s => s.time)).toEqual(['18:00', '19:30', '21:00']);
  });
  test('no availability is an empty list, never invented slots', async () => {
    const r = await getAvailability(deps, { restaurantId: R, date: '2026-12-11', partySize: 2 });
    expect(r.slots).toEqual([]);
  });
  test('slots that already passed today (restaurant time) are hidden', async () => {
    provider.setSlots('1001', '2026-12-01', 2, ['10:30', '11:30', '19:00']);
    const r = await getAvailability(deps, { restaurantId: R, date: '2026-12-01', partySize: 2 });
    expect(r.slots.map(s => s.time)).toEqual(['11:30', '19:00']);
  });
  test('past dates and invalid party sizes are rejected', async () => {
    expect(await code(getAvailability(deps, { restaurantId: R, date: '2026-11-30', partySize: 2 }))).toBe('invalid_input');
    expect(await code(getAvailability(deps, { restaurantId: R, date: '2026-12-10', partySize: 0 }))).toBe('invalid_input');
    expect(await code(getAvailability(deps, { restaurantId: R, date: '2026-02-30', partySize: 2 }))).toBe('invalid_input');
  });
});

describe('booking', () => {
  test('success: stored with provider evidence and no guest data', async () => {
    const r = await book();
    expect(r.status).toBe('confirmed');
    expect(r.manageToken).toBeTruthy();
    const row = store.reservations[0];
    expect(row).toMatchObject({ external_reservation_id: 'zc-1', evidence: 'provider_confirmed', dish_context: 'truffelpasta', starts_at: '2026-12-10T18:30:00.000Z' });
    expect(JSON.stringify(row)).not.toContain('sanne');
    expect(row.manage_token_hash).not.toBe(r.manageToken);
  });
  test('availability is re-checked before creating', async () => {
    await book();
    expect(provider.calls).toEqual(['availability', 'create']);
  });
  test('slot taken in the meantime: rejected, never confirmed', async () => {
    provider.bookings.set('other', { externalReservationId: 'other', status: 'confirmed', rid: '1001', date: '2026-12-10', time: '19:30' });
    expect(await code(book())).toBe('slot_unavailable');
    expect(store.reservations[0]).toMatchObject({ status: 'rejected', evidence: null });
  });
  test('failed provider call: failed, no evidence', async () => {
    provider.failNext.create = new ReservationError('provider_error');
    expect(await code(book())).toBe('provider_error');
    expect(store.reservations[0]).toMatchObject({ status: 'failed', evidence: null, external_reservation_id: null });
  });
  test('duplicate request with the same key never books twice', async () => {
    const first = await book();
    const again = await book();
    expect(again.replayed).toBe(true);
    expect(again.reservationId).toBe(first.reservationId);
    expect(again.manageToken).toBeUndefined();
    expect(provider.bookings.size).toBe(1);
    expect(store.reservations.length).toBe(1);
  });
  test('a key whose first attempt failed cannot be reused to book', async () => {
    provider.failNext.create = new ReservationError('provider_error');
    await code(book());
    expect(await code(book())).toBe('provider_error');
    expect(provider.bookings.size).toBe(0);
  });
  test('provider timeout: status stays unknown, nothing counted as confirmed', async () => {
    provider.failNext.create = 'hang';
    expect(await code(book())).toBe('provider_timeout');
    expect(store.reservations[0]).toMatchObject({ status: 'pending', evidence: null, error_code: 'provider_timeout' });
    const replay = await book();
    expect(replay.status).toBe('pending');
  });
  test('provider rate limiting is passed through as a retryable error', async () => {
    provider.failNext.availability = new ReservationError('provider_rate_limited', 'slow down', true);
    expect(await code(book())).toBe('provider_rate_limited');
  });
  test('pending provider status is not shown as confirmed', async () => {
    provider.bookingStatus = 'pending';
    expect((await book()).status).toBe('pending');
  });
  test('invalid guest data is rejected before any provider call', async () => {
    expect(await code(book({ guest: { ...guest, email: 'nope' } }))).toBe('invalid_input');
    expect(await code(book({ guest: { ...guest, comment: 'kijk op https://spam.example' } }))).toBe('invalid_input');
    expect(provider.calls).toEqual([]);
  });
});

describe('managing a booking', () => {
  test('cancel with the guest token', async () => {
    const r = await book();
    expect((await cancelReservation(deps, r.reservationId, r.manageToken)).status).toBe('cancelled');
    expect(provider.bookings.get('zc-1')?.status).toBe('cancelled');
  });
  test('modify re-checks availability', async () => {
    const r = await book();
    const m = await modifyReservation(deps, r.reservationId, r.manageToken, { date: '2026-12-10', time: '21:00', partySize: 2 });
    expect(m.startsAt).toBe('2026-12-10T20:00:00.000Z');
    expect(await code(modifyReservation(deps, r.reservationId, r.manageToken, { date: '2026-12-10', time: '17:00', partySize: 2 }))).toBe('slot_unavailable');
  });
  test('unauthorized: wrong token or unknown id gives the same not_found', async () => {
    const r = await book();
    expect(await code(cancelReservation(deps, r.reservationId, 'wrong'))).toBe('not_found');
    expect(await code(getReservationStatus(deps, 'res-404', r.manageToken))).toBe('not_found');
    expect(provider.bookings.get('zc-1')?.status).toBe('confirmed');
  });
});

describe('webhooks', () => {
  const headers = new Headers({ 'x-mock-signature': MOCK_WEBHOOK_SECRET });
  const event = (over: Record<string, unknown> = {}) => JSON.stringify({ eventId: 'ev-1', type: 'reservation.cancelled', externalRestaurantId: '1001', occurredAt: '2026-12-02T10:00:00Z', booking: { externalReservationId: 'zc-1', status: 'cancelled' }, ...over });

  test('unsigned calls are rejected', async () => {
    const r = await processWebhook({ store, provider }, new Headers(), event());
    expect(r.httpStatus).toBe(401);
  });
  test('a status update is applied once; a replay is a no-op', async () => {
    await book();
    const first = await processWebhook({ store, provider }, headers, event());
    expect(first.results[0].result).toBe('processed');
    expect(store.reservations[0].status).toBe('cancelled');
    store.reservations[0].status = 'confirmed';
    const replay = await processWebhook({ store, provider }, headers, event());
    expect(replay).toMatchObject({ httpStatus: 200, results: [{ result: 'duplicate' }] });
    expect(store.reservations[0].status).toBe('confirmed');
  });
  test('an older update never overwrites a newer one', async () => {
    await book();
    await processWebhook({ store, provider }, headers, event({ eventId: 'ev-2', occurredAt: '2026-12-03T10:00:00Z', booking: { externalReservationId: 'zc-1', status: 'completed' } }));
    const stale = await processWebhook({ store, provider }, headers, event({ eventId: 'ev-3', occurredAt: '2026-12-02T09:00:00Z' }));
    expect(stale.results[0].result).toBe('ignored:stale');
    expect(store.reservations[0].status).toBe('completed');
  });
  test('bookings not made via Dishloopr and other restaurants are never touched', async () => {
    await book();
    const other = await processWebhook({ store, provider }, headers, event({ eventId: 'ev-4', booking: { externalReservationId: 'zc-999', status: 'cancelled' } }));
    expect(other.results[0].result).toBe('ignored:not_dishloopr');
    store.integrations.push({ ...integration, id: 'int-2', restaurant_id: 'rest-2', external_restaurant_id: '2002' });
    const mismatch = await processWebhook({ store, provider }, headers, event({ eventId: 'ev-5', externalRestaurantId: '2002' }));
    expect(mismatch.results[0].result).toBe('ignored:restaurant_mismatch');
    expect(store.reservations[0].status).toBe('confirmed');
  });
  test('a failed event returns 500 and is processed on the provider retry', async () => {
    await book();
    const original = store.updateReservation.bind(store);
    store.updateReservation = async () => { throw new Error('db down'); };
    expect((await processWebhook({ store, provider }, headers, event({ eventId: 'ev-6' }))).httpStatus).toBe(500);
    store.updateReservation = original;
    const retry = await processWebhook({ store, provider }, headers, event({ eventId: 'ev-6' }));
    expect(retry.results[0].result).toBe('processed');
    expect(store.events.get('zenchef|ev-6')?.attempts).toBe(2);
  });
});

describe('reconciliation', () => {
  test('incremental, paged, and advances the sync marker only when complete', async () => {
    await book();
    await book({ idempotencyKey: key(2), time: '18:00' });
    await book({ idempotencyKey: key(3), time: '21:00' });
    for (const b of provider.bookings.values()) { b.status = 'completed'; b.updatedAt = '2026-12-11T00:00:00Z'; }
    const r = await reconcileIntegration({ store, provider }, integration, { now: () => new Date('2026-12-11T01:00:00Z') });
    expect(r).toMatchObject({ status: 'ok', applied: 3 });
    expect(provider.calls.filter(c => c === 'list').length).toBe(2);
    expect(integration.last_synced_at).toBe('2026-12-11T01:00:00.000Z');
  });
  test('a page cap stops early without moving the marker', async () => {
    for (const k of [1, 2, 3]) await book({ idempotencyKey: key(k), time: ['18:00', '19:30', '21:00'][k - 1] });
    const r = await reconcileIntegration({ store, provider }, integration, { maxPages: 1 });
    expect(r.status).toBe('partial');
    expect(integration.last_synced_at).toBeNull();
  });
  test('provider errors are recorded on the integration', async () => {
    provider.failNext.list = new ReservationError('provider_rate_limited');
    expect((await reconcileIntegration({ store, provider }, integration)).status).toBe('error');
  });
});

describe('time zones', () => {
  test('restaurant-local times convert across winter and summer time', () => {
    expect(localToUtc('2026-12-10', '19:30')).toBe('2026-12-10T18:30:00.000Z');
    expect(localToUtc('2026-07-10', '19:30')).toBe('2026-07-10T17:30:00.000Z');
    expect(utcToLocal('2026-03-29T01:30:00Z')).toEqual({ date: '2026-03-29', time: '03:30' });
  });
  test('a non-existent local time at the DST switch is rejected', () => {
    expect(() => localToUtc('2026-03-29', '02:30')).toThrow(ReservationError);
  });
  test('date boundaries use the restaurant timezone, not UTC', async () => {
    // 23:30 UTC on 30 Nov is already 1 Dec in Amsterdam.
    deps.now = () => new Date('2026-11-30T23:30:00Z');
    provider.setSlots('1001', '2026-12-01', 2, ['19:00']);
    const r = await getAvailability(deps, { restaurantId: R, date: '2026-12-01', partySize: 2 });
    expect(r.slots.length).toBe(1);
    integration.config = { timezone: 'America/New_York' };
    expect(await code(getAvailability(deps, { restaurantId: R, date: '2026-12-01', partySize: 2 }))).toBe('ok');
  });
});

describe('Zenchef without API access (widget only)', () => {
  const zc = new ZenchefProvider(null);
  test('widget works, every API capability is off', () => {
    const caps = zc.capabilities({ ...integration, method: 'widget' });
    expect(caps.widget).toBe(true);
    expect(Object.entries(caps).filter(([k, v]) => k !== 'widget' && v)).toEqual([]);
  });
  test('API calls fail clearly instead of guessing endpoints', async () => {
    const d = { store, provider: zc, now: () => NOW };
    expect(await code(getAvailability(d, { restaurantId: R, date: '2026-12-10', partySize: 2 }))).toBe('provider_not_configured');
    expect((await testConnection(d, R)).code).toBe('provider_not_configured');
    expect(integration.status).toBe('config_required');
  });
  test('webhooks are refused until Zenchef documents verification', async () => {
    const r = await processWebhook({ store, provider: zc }, new Headers(), '{}');
    expect(r).toMatchObject({ httpStatus: 501, error: 'webhook_spec_missing' });
  });
});
