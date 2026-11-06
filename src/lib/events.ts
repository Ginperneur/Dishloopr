import { format } from 'date-fns';
import { nl } from 'date-fns/locale';

/** Must match the whitelist in save_restaurant_event(). */
export const EVENT_TYPES = [
  { value: 'ladies_night', label: 'Ladies night' },
  { value: 'all_you_can_eat', label: 'Onbeperkt eten' },
  { value: 'happy_hour', label: 'Happy hour' },
  { value: 'pubquiz', label: 'Pubquiz' },
  { value: 'live_music', label: 'Livemuziek' },
  { value: 'tasting', label: 'Proeverij' },
  { value: 'special_menu', label: 'Speciaal menu' },
  { value: 'chefs_table', label: "Chef's table" },
  { value: 'workshop', label: 'Workshop' },
  { value: 'discount', label: 'Korting of actie' },
  { value: 'other', label: 'Overig' },
] as const;

export type EventType = (typeof EVENT_TYPES)[number]['value'];

export function eventTypeLabel(type: string): string {
  return EVENT_TYPES.find(t => t.value === type)?.label ?? 'Special';
}

/** ISO weekdays, 1 = maandag. */
export const WEEKDAYS = [
  { value: 1, short: 'ma', long: 'maandag' },
  { value: 2, short: 'di', long: 'dinsdag' },
  { value: 3, short: 'wo', long: 'woensdag' },
  { value: 4, short: 'do', long: 'donderdag' },
  { value: 5, short: 'vr', long: 'vrijdag' },
  { value: 6, short: 'za', long: 'zaterdag' },
  { value: 7, short: 'zo', long: 'zondag' },
] as const;

export const EVENT_PRICE_LABEL = '€5 per maand per evenement';

export interface EventSchedule {
  recurrence: string;
  weekdays: number[] | null;
  event_date: string;
  end_date: string | null;
  start_time: string | null;
  end_time: string | null;
}

export interface PublicEvent extends EventSchedule {
  id: string;
  restaurant_id: string;
  title: string;
  description: string | null;
  event_type: string;
  price: number | null;
  offer: string | null;
  image_url: string | null;
  restaurant: {
    name: string;
    slug: string;
    images: string[] | null;
    reservation_url?: string | null;
    website_url?: string | null;
    city: { name: string; slug: string } | null;
  } | null;
}

export const PUBLIC_EVENT_SELECT =
  'id, restaurant_id, title, description, event_type, recurrence, weekdays, event_date, end_date, start_time, end_time, price, offer, image_url, restaurant:restaurant_id(name, slug, images, city:city_id(name, slug))';

export const PUBLIC_EVENT_DETAIL_SELECT =
  'id, restaurant_id, title, description, event_type, recurrence, weekdays, event_date, end_date, start_time, end_time, price, offer, image_url, restaurant:restaurant_id(name, slug, images, reservation_url, website_url, city:city_id(name, slug))';

const hhmm = (t: string | null) => (t ? t.slice(0, 5) : '');

export function timeRange(e: Pick<EventSchedule, 'start_time' | 'end_time'>): string {
  if (e.start_time && e.end_time) return `${hhmm(e.start_time)} tot ${hhmm(e.end_time)}`;
  if (e.start_time) return `vanaf ${hhmm(e.start_time)}`;
  return '';
}

function joinDays(days: string[]): string {
  if (days.length <= 1) return days[0] ?? '';
  return `${days.slice(0, -1).join(', ')} en ${days[days.length - 1]}`;
}

/** "Elke donderdag, 20:00 tot 23:00" or "vrijdag 12 december, vanaf 19:00". */
export function formatSchedule(e: EventSchedule): string {
  const time = timeRange(e);
  if (e.recurrence === 'weekly') {
    const days = (e.weekdays ?? []).slice().sort().map(d => WEEKDAYS.find(w => w.value === d)?.long ?? '');
    const label = days.length === 7 ? 'Elke dag' : `Elke ${joinDays(days)}`;
    return time ? `${label}, ${time}` : label;
  }
  const day = format(new Date(e.event_date), 'EEEE d MMMM', { locale: nl });
  return time ? `${day}, ${time}` : day;
}

/** Next date (local) this event happens, used for sorting and the date badge. */
export function nextOccurrence(e: EventSchedule, now = new Date()): Date {
  const start = new Date(e.event_date);
  if (e.recurrence !== 'weekly' || !e.weekdays?.length) return start;
  const from = start > now ? start : now;
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  for (let i = 0; i < 7; i++) {
    const iso = ((d.getDay() + 6) % 7) + 1;
    if (e.weekdays.includes(iso)) return d;
    d.setDate(d.getDate() + 1);
  }
  return d;
}

export function shortDate(d: Date): string {
  return format(d, 'EEE d MMM', { locale: nl });
}

export function compareByNextOccurrence(a: EventSchedule, b: EventSchedule): number {
  return nextOccurrence(a).getTime() - nextOccurrence(b).getTime();
}

export function formatEventPrice(price: number | null): string | null {
  if (price == null) return null;
  if (price === 0) return 'Gratis';
  return `€${Number.isInteger(price) ? price : price.toFixed(2).replace('.', ',')}`;
}
