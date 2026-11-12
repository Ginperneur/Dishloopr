// Shared, UI-independent rules for reservation integrations.

export type IntegrationStatus = 'not_connected' | 'config_required' | 'testing' | 'connected' | 'limited' | 'error';

export interface IntegrationRow {
  id: string;
  restaurant_id: string;
  provider: 'zenchef';
  external_restaurant_id: string;
  method: 'widget' | 'api';
  status: Exclude<IntegrationStatus, 'not_connected'>;
  enabled: boolean;
  config: { lang?: string; timezone?: string } | null;
  verified_at: string | null;
  last_synced_at: string | null;
  last_error_code: string | null;
  last_error_at: string | null;
  updated_at: string;
}

export const STATUS_LABELS: Record<IntegrationStatus, string> = {
  not_connected: 'Niet gekoppeld',
  config_required: 'Configuratie vereist',
  testing: 'Verbinding wordt getest',
  connected: 'Verbonden',
  limited: 'Beperkte functionaliteit',
  error: 'Verbindingsfout',
};

export function integrationStatus(row: Pick<IntegrationRow, 'status'> | null | undefined): IntegrationStatus {
  return row?.status ?? 'not_connected';
}

export const ERROR_LABELS: Record<string, string> = {
  provider_not_configured: 'API-toegang bij Zenchef ontbreekt nog. De widget werkt wel.',
  invalid_credentials: 'Zenchef weigert de inloggegevens.',
  invalid_restaurant: 'Zenchef kent dit restaurant-ID niet.',
  provider_timeout: 'Zenchef reageerde niet op tijd.',
  provider_rate_limited: 'Te veel verzoeken naar Zenchef; probeer het later opnieuw.',
  provider_error: 'Zenchef gaf een onverwachte fout.',
};

export interface PublicReservationOption {
  provider: 'zenchef';
  method: 'widget' | 'api';
  external_restaurant_id: string;
  lang: string | null;
  timezone: string;
}

export type ReservationMode = 'native' | 'widget' | 'link' | 'none';

/**
 * Native flow only when the provider API integration is live; otherwise the official
 * widget; otherwise the restaurant's own reservation link.
 */
export function reservationMode(input: { option?: PublicReservationOption | null; zenchefId?: string | null; reservationUrl?: string | null; nativeEnabled?: boolean }): ReservationMode {
  if (input.option?.method === 'api' && input.nativeEnabled) return 'native';
  if (input.option || (input.zenchefId && /^[0-9]{1,10}$/.test(input.zenchefId))) return 'widget';
  if (input.reservationUrl) return 'link';
  return 'none';
}

export interface ReservationStatsRow { metric: string; context: string; n: number | string }

export interface ReservationStats {
  clicks: number;
  flowsStarted: number;
  widgetOpened: number;
  widgetReported: number;
  confirmed: number;
  cancelled: number;
  /** Confirmed bookings divided by reserve-button clicks, or null without clicks. */
  conversionRate: number | null;
  confirmedByDish: { dish: string; count: number }[];
}

export function summarizeReservationStats(rows: ReservationStatsRow[]): ReservationStats {
  const sum = (m: string) => rows.filter(r => r.metric === m).reduce((n, r) => n + Number(r.n), 0);
  const clicks = sum('clicks');
  const confirmed = sum('confirmed');
  const byDish = new Map<string, number>();
  for (const r of rows) {
    if (r.metric === 'confirmed' && r.context && !['zoek', 'stad', 'collectie'].includes(r.context)) {
      byDish.set(r.context, (byDish.get(r.context) ?? 0) + Number(r.n));
    }
  }
  return {
    clicks,
    flowsStarted: sum('flow_started'),
    widgetOpened: sum('widget_opened'),
    widgetReported: sum('widget_booking_reported'),
    confirmed,
    cancelled: sum('cancelled'),
    conversionRate: clicks > 0 ? Math.round((confirmed / clicks) * 1000) / 10 : null,
    confirmedByDish: [...byDish].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([dish, count]) => ({ dish, count })),
  };
}

/** Native booking flow: user-facing error text per server error code. */
export const BOOKING_ERROR_TEXT: Record<string, string> = {
  slot_unavailable: 'Dit tijdslot is net bezet geraakt. Kies een ander tijdstip.',
  in_progress: 'Je reservering wordt nog verwerkt. Even geduld.',
  provider_timeout: 'Het reserveringssysteem reageert niet. We weten nog niet of je reservering is gelukt; reserveer niet opnieuw en controleer je e-mail.',
  provider_not_configured: 'Online reserveren is tijdelijk niet beschikbaar.',
  not_available: 'Online reserveren is niet beschikbaar voor dit restaurant.',
  provider_rate_limited: 'Het is erg druk. Probeer het over een minuut opnieuw.',
};
