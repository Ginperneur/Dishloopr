// Webhook processing and reconciliation. Both apply provider changes only to
// reservations Dishloopr itself created (data minimisation: other bookings of the
// restaurant are never imported) and never let an older update overwrite a newer one.
import type { Integration, ProviderBooking, ReservationProvider, ReservationStore } from './types.ts';
import { ReservationError } from './types.ts';
import { withTimeout } from './service.ts';

type ApplyResult = 'processed' | 'ignored:not_dishloopr' | 'ignored:restaurant_mismatch' | 'ignored:stale';

async function applyBooking(store: ReservationStore, integration: Integration, b: ProviderBooking, changedAt: string): Promise<ApplyResult> {
  const row = await store.findReservationByExternal(integration.provider, b.externalReservationId);
  if (!row) return 'ignored:not_dishloopr';
  if (row.restaurant_id !== integration.restaurant_id) return 'ignored:restaurant_mismatch';
  if (row.provider_updated_at && Date.parse(changedAt) <= Date.parse(row.provider_updated_at)) return 'ignored:stale';
  await store.updateReservation(row.id, {
    status: b.status,
    ...(b.startsAt ? { starts_at: b.startsAt } : {}),
    ...(b.partySize ? { party_size: b.partySize } : {}),
    provider_updated_at: changedAt,
    error_code: null,
  });
  return 'processed';
}

export interface WebhookOutcome {
  /** HTTP status to return: 2xx = do not retry, 5xx = provider should retry. */
  httpStatus: number;
  results: { eventId: string; result: string }[];
  error?: string;
}

export async function processWebhook(deps: { store: ReservationStore; provider: ReservationProvider }, headers: Headers, rawBody: string): Promise<WebhookOutcome> {
  const verified = await deps.provider.verifyWebhook(headers, rawBody);
  if (!verified.ok) {
    return { httpStatus: verified.code === 'webhook_spec_missing' ? 501 : 401, results: [], error: verified.code };
  }
  let events;
  try { events = deps.provider.parseWebhook(rawBody); } catch { return { httpStatus: 400, results: [], error: 'invalid_payload' }; }

  const results: WebhookOutcome['results'] = [];
  let failed = false;
  for (const ev of events) {
    if (!ev?.eventId || typeof ev.eventId !== 'string') { results.push({ eventId: '', result: 'ignored:invalid' }); continue; }
    const integration = await deps.store.findIntegrationByExternal(deps.provider.name, String(ev.externalRestaurantId ?? ''));
    const seen = await deps.store.recordEvent({ provider: deps.provider.name, eventId: ev.eventId, type: ev.type, restaurantId: integration?.restaurant_id ?? null });
    if (seen.duplicate && seen.previousStatus !== 'failed' && seen.previousStatus !== 'received') {
      results.push({ eventId: ev.eventId, result: 'duplicate' });
      continue;
    }
    try {
      if (!integration) {
        await deps.store.finishEvent(deps.provider.name, ev.eventId, 'ignored', 'unknown_restaurant');
        results.push({ eventId: ev.eventId, result: 'ignored:unknown_restaurant' });
        continue;
      }
      if (!ev.booking) {
        await deps.store.finishEvent(deps.provider.name, ev.eventId, 'ignored', 'no_booking', integration.restaurant_id);
        results.push({ eventId: ev.eventId, result: 'ignored:no_booking' });
        continue;
      }
      const r = await applyBooking(deps.store, integration, ev.booking, ev.occurredAt);
      await deps.store.finishEvent(deps.provider.name, ev.eventId, r === 'processed' ? 'processed' : 'ignored', r === 'processed' ? null : r.split(':')[1], integration.restaurant_id);
      results.push({ eventId: ev.eventId, result: r });
    } catch (e) {
      failed = true;
      const code = e instanceof ReservationError ? e.code : 'processing_error';
      await deps.store.finishEvent(deps.provider.name, ev.eventId, 'failed', code, integration?.restaurant_id ?? null);
      results.push({ eventId: ev.eventId, result: `failed:${code}` });
    }
  }
  return { httpStatus: failed ? 500 : 200, results };
}

export interface ReconcileOptions {
  now?: () => Date;
  /** Hard cap on pages per run so one restaurant can never hog the provider's rate limit. */
  maxPages?: number;
  /** First run looks back this far instead of a full import. */
  initialLookbackDays?: number;
  timeoutMs?: number;
}

/**
 * Incremental fallback for missed webhooks: walks bookings changed since the last
 * successful sync, sequentially (one request at a time), and advances last_synced_at only
 * when every page was read.
 */
export async function reconcileIntegration(deps: { store: ReservationStore; provider: ReservationProvider }, integration: Integration, opts: ReconcileOptions = {}) {
  if (!deps.provider.capabilities(integration).listUpdatedBookings) return { status: 'skipped' as const, reason: 'not_supported', applied: 0 };
  const now = opts.now?.() ?? new Date();
  const since = integration.last_synced_at ?? new Date(now.getTime() - (opts.initialLookbackDays ?? 7) * 86400000).toISOString();
  let cursor: string | null = null;
  let pages = 0;
  let applied = 0;
  try {
    do {
      const page: { bookings: ProviderBooking[]; next: string | null } = await withTimeout(deps.provider.listUpdatedBookings(integration, since, cursor), opts.timeoutMs ?? 15000);
      for (const b of page.bookings) {
        if ((await applyBooking(deps.store, integration, b, b.updatedAt ?? now.toISOString())) === 'processed') applied++;
      }
      cursor = page.next;
      pages++;
    } while (cursor && pages < (opts.maxPages ?? 20));
    if (cursor) return { status: 'partial' as const, reason: 'page_cap', applied };
    await deps.store.updateIntegration(integration.id, { last_synced_at: now.toISOString(), last_error_code: null });
    return { status: 'ok' as const, applied };
  } catch (e) {
    const code = e instanceof ReservationError ? e.code : 'provider_error';
    await deps.store.updateIntegration(integration.id, { last_error_code: code });
    return { status: 'error' as const, reason: code, applied };
  }
}
