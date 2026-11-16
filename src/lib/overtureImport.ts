// Turns the CSV written by scripts/overture-discovery/discover.py into discovery_results rows.
// Only 'approve' (strong candidate) and 'review' rows are imported; 'reject' and 'duplicate'
// stay out of the queue. Overture data is CDLA Permissive 2.0 / CC0 / Apache 2.0, so storing it
// is allowed with attribution (unlike Google Places, see docs/google-places-compliance.md).

export type OvertureTriage = 'approve' | 'review';

export interface OvertureDiscoveryRow {
  source: 'overture';
  external_id: string;
  place_id: null;
  name: string;
  address: string | null;
  postcode: string | null;
  lat: number;
  lng: number;
  website: string | null;
  phone: string | null;
  category: string | null;
  confidence: number | null;
  triage: OvertureTriage;
  triage_reason: string | null;
  licenses: string[];
  city_id: string;
  venue_category: 'restaurant';
  status: 'pending';
}

export interface OvertureImportSummary {
  rows: OvertureDiscoveryRow[];
  skipped: { reject: number; duplicate: number; invalid: number };
  invalid: string[];
}

export const REQUIRED_COLUMNS = ['status', 'name', 'lat', 'lng', 'overture_id'] as const;

// RFC 4180-style parser: quoted fields, doubled quotes, commas and newlines inside quotes, CRLF.
// Returns the header separately so a header-only file is not mistaken for missing columns.
export function parseCsvTable(text: string): { header: string[]; rows: Record<string, string>[] } {
  const records: string[][] = [];
  let field = '';
  let record: string[] = [];
  let inQuotes = false;
  const src = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { record.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      record.push(field); field = '';
      if (record.some((v) => v !== '')) records.push(record);
      record = [];
    } else field += c;
  }
  record.push(field);
  if (record.some((v) => v !== '')) records.push(record);
  if (records.length === 0) return { header: [], rows: [] };
  const header = records[0].map((h) => h.trim());
  const rows = records.slice(1).map((r) => Object.fromEntries(header.map((h, i) => [h, (r[i] ?? '').trim()])));
  return { header, rows };
}

export function parseCsv(text: string): Record<string, string>[] {
  return parseCsvTable(text).rows;
}

export function missingColumns(header: string[]): string[] {
  return REQUIRED_COLUMNS.filter((c) => !header.includes(c));
}

const orNull = (s: string | undefined) => (s && s.trim() ? s.trim() : null);

export function toDiscoveryRows(csvRows: Record<string, string>[], cityId: string): OvertureImportSummary {
  const summary: OvertureImportSummary = { rows: [], skipped: { reject: 0, duplicate: 0, invalid: 0 }, invalid: [] };
  const seen = new Set<string>();
  for (const r of csvRows) {
    const status = (r.status || '').toLowerCase();
    if (status === 'reject') { summary.skipped.reject++; continue; }
    if (status === 'duplicate') { summary.skipped.duplicate++; continue; }
    const lat = Number(r.lat);
    const lng = Number(r.lng);
    const id = orNull(r.overture_id);
    const name = orNull(r.name);
    const problem =
      status !== 'approve' && status !== 'review' ? `onbekende status "${r.status}"`
      : !id ? 'geen overture_id'
      : !name ? 'geen naam'
      : !Number.isFinite(lat) || !Number.isFinite(lng) || lat < 50.5 || lat > 53.8 || lng < 3.2 || lng > 7.3
        ? 'coördinaten buiten Nederland'
      : seen.has(id) ? 'dubbel in bestand'
      : null;
    if (problem) {
      summary.skipped.invalid++;
      summary.invalid.push(`${name ?? '(zonder naam)'}: ${problem}`);
      continue;
    }
    seen.add(id!);
    const confidence = Number(r.confidence);
    summary.rows.push({
      source: 'overture',
      external_id: id!,
      place_id: null,
      name: name!,
      address: orNull(r.street),
      postcode: orNull(r.postcode)?.replace(/\s+/g, '').toUpperCase() ?? null,
      lat,
      lng,
      website: orNull(r.website),
      phone: orNull(r.phone),
      category: orNull(r.category),
      confidence: Number.isFinite(confidence) && r.confidence !== '' ? confidence : null,
      triage: status as OvertureTriage,
      triage_reason: orNull(r.reason),
      licenses: (r.licenses || '').split('|').map((s) => s.trim()).filter(Boolean),
      city_id: cityId,
      venue_category: 'restaurant',
      status: 'pending',
    });
  }
  return summary;
}

export function citySlug(name: string): string {
  return name
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/'/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
