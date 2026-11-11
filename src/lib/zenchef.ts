// Zenchef widget helpers. Only the official SDK script and booking host are ever used;
// owners provide an ID (or paste a snippet/link we extract the ID from), never a script.
// Verified against https://sdk.zenchef.com/v1/sdk.min.js and the Zenchef help center.

export const ZENCHEF_SDK_SRC = 'https://sdk.zenchef.com/v1/sdk.min.js';
export const ZENCHEF_SDK_ID = 'zenchef-sdk';
export const ZENCHEF_BOOKING_BASE = 'https://bookings.zenchef.com/results';
export const ZENCHEF_LANGS = ['nl', 'en', 'de', 'fr', 'es', 'it', 'pt'] as const;
export type ZenchefLang = (typeof ZENCHEF_LANGS)[number];

const ID_RE = /^[0-9]{1,10}$/;
const ALLOWED_HOSTS = ['bookings.zenchef.com', 'sdk.zenchef.com', 'module.zenchef.com', 'widget.zenchef.com'];

export function isZenchefId(value: unknown): value is string {
  return typeof value === 'string' && ID_RE.test(value);
}

/**
 * Accepts a bare ID, a Zenchef booking/configurator link (rid= or restaurant=), or the
 * official embed snippet (data-restaurant="..."). Returns the numeric ID or null.
 */
export function parseZenchefRestaurantId(input: string): string | null {
  const raw = (input ?? '').trim();
  if (!raw) return null;
  if (ID_RE.test(raw)) return raw;
  const attr = raw.match(/data-restaurant\s*=\s*["']?([0-9]{1,10})["'\s>]/i);
  if (attr) return attr[1];
  try {
    const url = new URL(raw.startsWith('http') ? raw : `https://${raw}`);
    if (url.protocol !== 'https:' || !ALLOWED_HOSTS.includes(url.hostname.toLowerCase())) return null;
    const id = url.searchParams.get('rid') ?? url.searchParams.get('restaurant') ?? url.searchParams.get('restaurantId');
    return id && ID_RE.test(id) ? id : null;
  } catch {
    return null;
  }
}

export interface BookingLinkOptions {
  pax?: number;
  day?: string;
  lang?: string | null;
  partnerId?: string | null;
}

/** Official direct booking link (documented on sdk.zenchef.com). */
export function zenchefBookingUrl(id: string, opts: BookingLinkOptions = {}): string {
  if (!isZenchefId(id)) throw new Error('Invalid Zenchef ID');
  const p = new URLSearchParams({ rid: id });
  if (opts.pax && Number.isInteger(opts.pax) && opts.pax > 0 && opts.pax <= 50) p.set('pax', String(opts.pax));
  if (opts.day && /^\d{4}-\d{2}-\d{2}$/.test(opts.day)) p.set('day', opts.day);
  if (opts.lang && (ZENCHEF_LANGS as readonly string[]).includes(opts.lang)) p.set('lang', opts.lang);
  // The SDK passes data-partner-id to the booking page as "pid".
  if (opts.partnerId && ID_RE.test(opts.partnerId)) p.set('pid', opts.partnerId);
  return `${ZENCHEF_BOOKING_BASE}?${p.toString()}`;
}

/** Attributes for the single .zc-widget-config element the SDK reads at load time. */
export function zenchefConfigAttributes(id: string, opts: { lang?: string | null; partnerId?: string | null } = {}): Record<string, string> {
  if (!isZenchefId(id)) throw new Error('Invalid Zenchef ID');
  const attrs: Record<string, string> = {
    'data-restaurant': id,
    // Dishloopr shows its own button; the SDK's floating button stays hidden.
    'data-hide-default-button': 'true',
    // Analytics only run through Dishloopr's consent module, not the widget's own GTM/GA4.
    'data-disable-gtm': 'true',
    'data-disable-ga4': 'true',
    'data-send-page-views': 'false',
  };
  if (opts.lang && (ZENCHEF_LANGS as readonly string[]).includes(opts.lang)) attrs['data-lang'] = opts.lang;
  if (opts.partnerId && ID_RE.test(opts.partnerId)) attrs['data-partner-id'] = opts.partnerId;
  return attrs;
}

/** Partner ID issued by Zenchef to Dishloopr (public; it ends up in the booking URL). */
export function zenchefPartnerId(): string | null {
  const v = (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_ZENCHEF_PARTNER_ID;
  return v && ID_RE.test(v) ? v : null;
}

/**
 * The SDK forwards "booking created" from its iframe as a window event. That message
 * is not authenticated, so it is only ever counted as "reported by the widget".
 */
export function widgetBookingId(detail: unknown): string | null {
  if (!detail || typeof detail !== 'object') return null;
  const id = (detail as Record<string, unknown>).bookingId;
  return typeof id === 'string' || typeof id === 'number' ? String(id).slice(0, 64) : null;
}
