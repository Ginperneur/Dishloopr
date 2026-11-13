// Owner input for opening hours, one day at a time. Only two forms are accepted:
//   a time range, optionally split ("11:00 - 22:00", "12:00 - 14:30, 17:00 - 22:00")
//   "gesloten"
// Anything else ("dicht", "open", free text) is refused, so every stored day is something
// isOpenNow() in src/lib/openingHours.ts can read.

export type HoursCheck = { ok: true; value: string } | { ok: false; error: string };

const CLOSED = 'gesloten';
const RANGE = /^(\d{1,2})(?:[:.](\d{2}))?\s*(?:-|–|—|tot)\s*(\d{1,2})(?:[:.](\d{2}))?$/i;

const pad = (n: number) => String(n).padStart(2, '0');

function parseRange(part: string): { text: string; open: number; close: number } | null {
  const m = part.trim().match(RANGE);
  if (!m) return null;
  const [oh, om, ch, cm] = [Number(m[1]), Number(m[2] ?? 0), Number(m[3]), Number(m[4] ?? 0)];
  if (oh > 23 || ch > 24 || om > 59 || cm > 59 || (ch === 24 && cm > 0)) return null;
  const open = oh * 60 + om;
  const close = ch * 60 + cm;
  if (open === close) return null;
  return { text: `${pad(oh)}:${pad(om)} - ${pad(ch)}:${pad(cm)}`, open, close };
}

export function checkHoursInput(raw: string): HoursCheck {
  const input = raw.trim();
  if (!input) return { ok: false, error: 'Vul een tijd in, bijvoorbeeld 11:00 - 22:00, of kies Gesloten.' };
  if (input.toLowerCase() === CLOSED || input.toLowerCase() === 'closed') return { ok: true, value: CLOSED }; // 'closed' comes from Google data

  const parts = input.split(/\s*(?:,|;|\ben\b|&)\s*/i).filter(Boolean);
  if (parts.length > 3) return { ok: false, error: 'Maximaal 3 tijdblokken per dag.' };
  const ranges = parts.map(parseRange);
  if (ranges.some(r => r === null)) {
    return { ok: false, error: 'Gebruik een tijd zoals 11:00 - 22:00 (of 12:00 - 14:30, 17:00 - 22:00), of Gesloten.' };
  }
  // Split shifts must be in order and must not overlap (a last block may run past midnight).
  const list = ranges as { text: string; open: number; close: number }[];
  for (let i = 1; i < list.length; i++) {
    const prevClose = list[i - 1].close <= list[i - 1].open ? list[i - 1].close + 1440 : list[i - 1].close;
    if (list[i].open < prevClose) return { ok: false, error: 'De tijdblokken overlappen of staan niet op volgorde.' };
  }
  return { ok: true, value: list.map(r => r.text).join(', ') };
}
