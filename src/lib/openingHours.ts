/**
 * Lightweight helper to determine if a restaurant is currently open.
 * Mirrors the parsing logic in OpeningHoursDisplay so we can show an
 * "Open Now" badge on cards without rendering the full schedule.
 */

const DAY_ORDER = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

const DAY_NAME_TO_KEY: Record<string, string> = {
  maandag: 'mon', monday: 'mon',
  dinsdag: 'tue', tuesday: 'tue',
  woensdag: 'wed', wednesday: 'wed',
  donderdag: 'thu', thursday: 'thu',
  vrijdag: 'fri', friday: 'fri',
  zaterdag: 'sat', saturday: 'sat',
  zondag: 'sun', sunday: 'sun',
};

function parseWeekdayText(weekdayText: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of weekdayText) {
    const colon = line.indexOf(':');
    if (colon === -1) continue;
    const dayName = line.substring(0, colon).toLowerCase().trim();
    let hours = line.substring(colon + 1).trim();
    const dayKey = DAY_NAME_TO_KEY[dayName];
    if (!dayKey) continue;
    hours = hours.replace(/–/g, ' - ').replace(/-/g, ' - ').replace(/\s+/g, ' ').trim();
    if (hours.toLowerCase().includes('gesloten') || hours.toLowerCase().includes('closed')) {
      result[dayKey] = 'closed';
    } else {
      result[dayKey] = hours;
    }
  }
  return result;
}

function normalize(openingHours: any): Record<string, string> {
  if (!openingHours || typeof openingHours !== 'object') return {};
  if (Array.isArray(openingHours.weekday_text)) {
    return parseWeekdayText(openingHours.weekday_text);
  }
  const out: Record<string, string> = {};
  for (const key of DAY_ORDER) {
    const value = openingHours[key];
    if (typeof value === 'string') out[key] = value;
  }
  return out;
}

/**
 * Returns true if the restaurant is currently open based on its opening hours.
 * Returns null if we cannot determine (no data / unparsable).
 * Supports a single range like "12:00 - 22:00" — multi-range slots fall back to true.
 */
export function isOpenNow(openingHours: any, now: Date = new Date()): boolean | null {
  const hours = normalize(openingHours);
  if (Object.keys(hours).length === 0) return null;

  const dayKey = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][now.getDay()];
  const today = hours[dayKey];
  if (!today || today === 'closed') return false;

  const match = today.match(/(\d{1,2}):?(\d{2})?\s*[-–]\s*(\d{1,2}):?(\d{2})?/);
  if (!match) return null;

  const openMin = parseInt(match[1]) * 60 + parseInt(match[2] || '0');
  let closeMin = parseInt(match[3]) * 60 + parseInt(match[4] || '0');
  // Handle past-midnight (e.g. 18:00 - 02:00)
  if (closeMin <= openMin) closeMin += 24 * 60;
  const current = now.getHours() * 60 + now.getMinutes();
  const currentAdjusted = current < openMin ? current + 24 * 60 : current;

  return current >= openMin && current < closeMin
    || currentAdjusted >= openMin && currentAdjusted < closeMin;
}