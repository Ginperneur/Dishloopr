// Zenchef adapter.
//
// Verified public facts (help.zenchef.com articles 27690768125597 and 16059778163869,
// sdk.zenchef.com/v1/sdk.min.js):
//  - Widget: SDK script https://sdk.zenchef.com/v1/sdk.min.js with id "zenchef-sdk",
//    a <div class="zc-widget-config" data-restaurant="ID">, custom triggers via
//    data-zc-action="open"; direct link https://bookings.zenchef.com/results?rid=ID.
//  - API: exists (availability, create/modify/cancel bookings, webhooks on create/update),
//    requires the restaurant's Grow plan or a special agreement. Base URL, auth, endpoint
//    paths, payloads and webhook signatures are NOT public; Zenchef shares them on request
//    (help@zenchef.com / api-tech-help@zenchef.com). Limits: max 100 req/min for fast calls,
//    slow calls sequential, pages of 250-500, initial full sync then incremental.
//
// Until that documentation and access exist, every API method fails with
// provider_not_configured. No endpoints are guessed here; see docs/zenchef-integratie.md.
import {
  type Integration, type ProviderCapabilities, type ReservationProvider,
  ReservationError,
} from './types.ts';

export const ZENCHEF_RATE_LIMIT_PER_MINUTE = 100;
export const ZENCHEF_PAGE_SIZE = 250;

export interface ZenchefApiAccess {
  /** True only once Zenchef has issued API access and the methods below are implemented against its docs. */
  implemented: boolean;
}

export class ZenchefProvider implements ReservationProvider {
  readonly name = 'zenchef' as const;
  constructor(private readonly access: ZenchefApiAccess | null = null) {}

  capabilities(integration: Integration): ProviderCapabilities {
    const api = integration.method === 'api' && this.access?.implemented === true;
    return {
      widget: true,
      availability: api,
      createBooking: api,
      getBooking: api,
      modifyBooking: api,
      cancelBooking: api,
      webhooks: api,
      listUpdatedBookings: api,
      sourceAttribution: false,
    };
  }

  private blocked(): never {
    throw new ReservationError('provider_not_configured', 'Zenchef API-toegang is nog niet beschikbaar voor Dishloopr');
  }

  getAvailability(): Promise<never> { return Promise.resolve().then(() => this.blocked()); }
  createBooking(): Promise<never> { return Promise.resolve().then(() => this.blocked()); }
  getBooking(): Promise<never> { return Promise.resolve().then(() => this.blocked()); }
  modifyBooking(): Promise<never> { return Promise.resolve().then(() => this.blocked()); }
  cancelBooking(): Promise<never> { return Promise.resolve().then(() => this.blocked()); }
  listUpdatedBookings(): Promise<never> { return Promise.resolve().then(() => this.blocked()); }

  verifyWebhook(): Promise<{ ok: false; code: 'webhook_spec_missing' }> {
    // Zenchef's webhook authentication scheme is not publicly documented. Reject
    // everything rather than accept unauthenticated status changes.
    return Promise.resolve({ ok: false, code: 'webhook_spec_missing' });
  }

  parseWebhook(): never {
    throw new ReservationError('webhook_spec_missing');
  }
}
