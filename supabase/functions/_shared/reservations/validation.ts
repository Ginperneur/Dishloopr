// Input validation and restaurant-local time handling. Pure TypeScript.
import { type GuestDetails, ReservationError } from './types.ts';

export const DEFAULT_TIMEZONE = 'Europe/Amsterdam';
export const MAX_PARTY_SIZE = 20;
export const MAX_DAYS_AHEAD = 180;

const DATE_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const EMAIL_RE = /^[^\s@<>()]{1,64}@[^\s@<>()]{1,190}\.[a-z]{2,24}$/i;
const PHONE_RE = /^\+?[0-9][0-9 ()-]{6,19}$/;
const NAME_RE = /^[\p{L}\p{M}' .-]{1,60}$/u;

export function isValidDate(value: unknown): value is string {
  if (typeof value !== 'string' || !DATE_RE.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export function isValidTime(value: unknown): value is string {
  return typeof value === 'string' && TIME_RE.test(value);
}

export function isValidTimezone(tz: string): boolean {
  try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return true; } catch { return false; }
}

/** Offset in minutes of a timezone at a given UTC instant (e.g. +60 for CET). */
function offsetMinutes(utcMs: number, tz: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(utcMs));
  const get = (t: string) => Number(parts.find(p => p.type === t)?.value);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return Math.round((asUtc - utcMs) / 60000);
}

/**
 * Converts a restaurant-local date and time to a UTC ISO string. Local times that do
 * not exist (the hour skipped at the spring DST change) are rejected rather than shifted.
 */
export function localToUtc(date: string, time: string, tz = DEFAULT_TIMEZONE): string {
  if (!isValidDate(date) || !isValidTime(time)) throw new ReservationError('invalid_input', 'Ongeldige datum of tijd');
  const [y, mo, d] = date.split('-').map(Number);
  const [h, mi] = time.split(':').map(Number);
  const naive = Date.UTC(y, mo - 1, d, h, mi);
  let utc = naive - offsetMinutes(naive, tz) * 60000;
  utc = naive - offsetMinutes(utc, tz) * 60000;
  if (utcToLocal(new Date(utc).toISOString(), tz).time !== time) {
    throw new ReservationError('invalid_input', 'Dit tijdstip bestaat niet door de overgang naar zomertijd');
  }
  return new Date(utc).toISOString();
}

export function utcToLocal(iso: string, tz = DEFAULT_TIMEZONE): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).formatToParts(new Date(iso));
  const get = (t: string) => parts.find(p => p.type === t)?.value ?? '';
  return { date: `${get('year')}-${get('month')}-${get('day')}`, time: `${get('hour')}:${get('minute')}` };
}

/** Today's date in the restaurant's timezone. */
export function localToday(now: Date, tz = DEFAULT_TIMEZONE): string {
  return utcToLocal(now.toISOString(), tz).date;
}

export function validatePartySize(n: unknown): number {
  if (typeof n !== 'number' || !Number.isInteger(n) || n < 1 || n > MAX_PARTY_SIZE) {
    throw new ReservationError('invalid_input', `Kies 1 tot ${MAX_PARTY_SIZE} personen`);
  }
  return n;
}

/** Date must be today or later (restaurant time) and within the booking horizon. */
export function validateBookingDate(date: unknown, now: Date, tz = DEFAULT_TIMEZONE): string {
  if (!isValidDate(date)) throw new ReservationError('invalid_input', 'Ongeldige datum');
  const today = localToday(now, tz);
  if (date < today) throw new ReservationError('invalid_input', 'Deze datum ligt in het verleden');
  const max = new Date(Date.parse(`${today}T00:00:00Z`) + MAX_DAYS_AHEAD * 86400000).toISOString().slice(0, 10);
  if (date > max) throw new ReservationError('invalid_input', `Reserveren kan tot ${MAX_DAYS_AHEAD} dagen vooruit`);
  return date;
}

export function validateGuest(raw: unknown): GuestDetails {
  const g = (raw ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  const guest: GuestDetails = {
    firstName: str(g.firstName),
    lastName: str(g.lastName),
    email: str(g.email).toLowerCase(),
    phone: str(g.phone),
    comment: str(g.comment).slice(0, 500) || undefined,
  };
  if (!NAME_RE.test(guest.firstName)) throw new ReservationError('invalid_input', 'Vul je voornaam in');
  if (!NAME_RE.test(guest.lastName)) throw new ReservationError('invalid_input', 'Vul je achternaam in');
  if (!EMAIL_RE.test(guest.email)) throw new ReservationError('invalid_input', 'Vul een geldig e-mailadres in');
  if (!PHONE_RE.test(guest.phone)) throw new ReservationError('invalid_input', 'Vul een geldig telefoonnummer in');
  if (guest.comment && /<|>|https?:\/\//i.test(guest.comment)) throw new ReservationError('invalid_input', 'Opmerking mag geen links of HTML bevatten');
  return guest;
}

export function validateIdempotencyKey(key: unknown): string {
  if (typeof key !== 'string' || !/^[A-Za-z0-9-]{16,100}$/.test(key)) {
    throw new ReservationError('invalid_input', 'Ongeldige aanvraagsleutel');
  }
  return key;
}

/** Dish context comes from the metric context (dish slug or normalised search term). */
export function cleanContext(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const v = value.toLowerCase().trim();
  return /^[a-z0-9-]{1,80}$/.test(v) && !['zoek', 'stad', 'collectie'].includes(v) ? v : null;
}
