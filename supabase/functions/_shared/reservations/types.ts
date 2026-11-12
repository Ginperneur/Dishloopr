// Provider-agnostic reservation contracts. Pure TypeScript (no Deno or npm imports)
// so the same code runs in edge functions and in the bun unit tests.

export type ProviderName = 'zenchef';
export type IntegrationMethod = 'widget' | 'api';
export type IntegrationStatus = 'config_required' | 'testing' | 'connected' | 'limited' | 'error';
export type ReservationStatus = 'pending' | 'confirmed' | 'cancelled' | 'rejected' | 'failed' | 'no_show' | 'completed';

export interface Integration {
  id: string;
  restaurant_id: string;
  provider: ProviderName;
  external_restaurant_id: string;
  method: IntegrationMethod;
  status: IntegrationStatus;
  enabled: boolean;
  config: { lang?: string; timezone?: string };
  last_synced_at: string | null;
}

/** What a provider adapter can actually do with the access Dishloopr has today. */
export interface ProviderCapabilities {
  widget: boolean;
  availability: boolean;
  createBooking: boolean;
  getBooking: boolean;
  modifyBooking: boolean;
  cancelBooking: boolean;
  webhooks: boolean;
  listUpdatedBookings: boolean;
  /** Provider records Dishloopr as the booking source (tag/partner field). */
  sourceAttribution: boolean;
}

export interface Slot {
  /** Local restaurant time HH:MM. */
  time: string;
  /** Provider-specific identifier, opaque to Dishloopr. */
  ref?: string;
}

export interface AvailabilityQuery {
  externalRestaurantId: string;
  /** Local restaurant date YYYY-MM-DD. */
  date: string;
  partySize: number;
}

export interface GuestDetails {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  comment?: string;
}

export interface CreateBookingInput extends AvailabilityQuery {
  time: string;
  slotRef?: string;
  guest: GuestDetails;
  /** Our own reference, passed to the provider when it supports one. */
  reference: string;
}

export interface ProviderBooking {
  externalReservationId: string;
  status: ReservationStatus;
  /** UTC ISO timestamp of the booking start, when the provider returns it. */
  startsAt?: string;
  partySize?: number;
  /** When the provider last changed this booking (UTC ISO). */
  updatedAt?: string;
}

export interface WebhookEvent {
  eventId: string;
  type: 'reservation.created' | 'reservation.updated' | 'reservation.cancelled' | 'other';
  externalRestaurantId: string;
  booking?: ProviderBooking;
  occurredAt: string;
}

export interface ReservationProvider {
  readonly name: ProviderName;
  capabilities(integration: Integration): ProviderCapabilities;
  getAvailability(integration: Integration, q: AvailabilityQuery): Promise<Slot[]>;
  createBooking(integration: Integration, input: CreateBookingInput): Promise<ProviderBooking>;
  getBooking(integration: Integration, externalReservationId: string): Promise<ProviderBooking>;
  modifyBooking(integration: Integration, externalReservationId: string, change: { date: string; time: string; partySize: number }): Promise<ProviderBooking>;
  cancelBooking(integration: Integration, externalReservationId: string): Promise<ProviderBooking>;
  /** Pages through bookings changed since a moment; null cursor = done. */
  listUpdatedBookings(integration: Integration, since: string, cursor: string | null): Promise<{ bookings: ProviderBooking[]; next: string | null }>;
  verifyWebhook(headers: Headers, rawBody: string): Promise<{ ok: true } | { ok: false; code: ReservationErrorCode }>;
  parseWebhook(rawBody: string): WebhookEvent[];
}

export type ReservationErrorCode =
  | 'invalid_input'
  | 'not_available'            // restaurant has no active integration for this action
  | 'provider_not_configured'  // API access for this provider is missing
  | 'webhook_spec_missing'     // provider webhook verification is not documented/available
  | 'invalid_credentials'
  | 'invalid_restaurant'
  | 'slot_unavailable'
  | 'in_progress'
  | 'not_found'
  | 'not_allowed'
  | 'provider_timeout'
  | 'provider_rate_limited'
  | 'provider_error'
  | 'invalid_signature';

export class ReservationError extends Error {
  constructor(public code: ReservationErrorCode, message?: string, public retryable = false) {
    super(message ?? code);
    this.name = 'ReservationError';
  }
}

/** Rows Dishloopr stores for a native booking. Never contains guest data. */
export interface StoredReservation {
  id: string;
  restaurant_id: string;
  provider: ProviderName;
  external_reservation_id: string | null;
  status: ReservationStatus;
  starts_at: string;
  party_size: number;
  evidence: 'provider_confirmed' | null;
  dish_context: string | null;
  campaign_id: string | null;
  idempotency_key: string;
  manage_token_hash: string | null;
  provider_updated_at: string | null;
  error_code: string | null;
}

export type NewReservation = Omit<StoredReservation, 'id' | 'external_reservation_id' | 'evidence' | 'provider_updated_at' | 'error_code'>;

export type EventStatus = 'received' | 'processed' | 'ignored' | 'failed';

/** Persistence used by the services; Supabase in production, in-memory in tests. */
export interface ReservationStore {
  getIntegration(restaurantId: string, provider: ProviderName): Promise<Integration | null>;
  findIntegrationByExternal(provider: ProviderName, externalRestaurantId: string): Promise<Integration | null>;
  updateIntegration(id: string, patch: Partial<Pick<Integration, 'status' | 'last_synced_at'>> & { last_error_code?: string | null }): Promise<void>;
  /** Inserts or returns the existing row for this idempotency key. */
  insertReservation(row: NewReservation): Promise<{ row: StoredReservation; created: boolean }>;
  getReservation(id: string): Promise<StoredReservation | null>;
  findReservationByExternal(provider: ProviderName, externalReservationId: string): Promise<StoredReservation | null>;
  updateReservation(id: string, patch: Partial<StoredReservation>): Promise<StoredReservation>;
  /** Records an event; returns the earlier status when the event id was seen before. */
  recordEvent(e: { provider: ProviderName; eventId: string; type: string; restaurantId: string | null }): Promise<{ duplicate: boolean; previousStatus?: EventStatus }>;
  finishEvent(provider: ProviderName, eventId: string, status: EventStatus, errorCode?: string | null, restaurantId?: string | null): Promise<void>;
}

export const LIVE_STATUSES: IntegrationStatus[] = ['connected', 'limited'];
