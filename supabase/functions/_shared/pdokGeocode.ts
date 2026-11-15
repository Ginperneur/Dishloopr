// Geocoding via PDOK Locatieserver (BAG addresses, open data, no key). Replaces the Google
// Geocoding API, whose coordinates may not be stored longer than 30 days under the Google
// Maps Platform EEA terms. See docs/google-places-compliance.md.
export const PDOK_FREE_URL = 'https://api.pdok.nl/bzk/locatieserver/search/v3_1/free';

export interface PdokDoc {
  weergavenaam?: string;
  centroide_ll?: string;
  postcode?: string;
  woonplaatsnaam?: string;
  gemeentenaam?: string;
  huisnummer?: number;
  score?: number;
}

export interface GeocodeInput {
  address: string | null;
  postalCode?: string | null;
  city?: string | null;
}

export type GeocodeResult =
  | { ok: true; lat: number; lng: number; label: string }
  | { ok: false; reason: string };

const normPostcode = (s?: string | null) => (s ?? '').replace(/\s+/g, '').toUpperCase();
const normCity = (s?: string | null) => (s ?? '').trim().toLowerCase();

// First house number in the street part of the address ("Dam 1-3" -> 1, "Oudegracht 40C" -> 40).
export function houseNumber(address?: string | null): number | null {
  const street = (address ?? '').split(',')[0];
  const m = /\b(\d{1,5})(?:\s*[a-zA-Z]{0,2})?(?:\s*[-/]\s*\w+)?\s*$/.exec(street.trim());
  return m ? Number(m[1]) : null;
}

export function buildPdokQuery(input: GeocodeInput): string {
  const address = (input.address ?? '')
    .replace(/,?\s*(Nederland|Netherlands|NL)\s*$/i, '')
    .trim();
  return [address, normPostcode(input.postalCode), input.city?.trim() ?? '']
    .filter(Boolean).join(' ');
}

export function parsePoint(wkt?: string): { lat: number; lng: number } | null {
  const m = /^POINT\(\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s*\)$/.exec(wkt ?? '');
  if (!m) return null;
  const lng = Number(m[1]);
  const lat = Number(m[2]);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}

// The free endpoint always returns a best guess, so only accept a document that agrees with
// what we know: the house number, and the postcode when we have one, otherwise the city.
export function pickPdokResult(docs: PdokDoc[], input: GeocodeInput): GeocodeResult {
  const doc = docs[0];
  if (!doc) return { ok: false, reason: 'not_found' };
  const wantPostcode = normPostcode(input.postalCode);
  if (wantPostcode && normPostcode(doc.postcode) !== wantPostcode) {
    return { ok: false, reason: 'postcode_mismatch' };
  }
  const city = normCity(input.city);
  if (!wantPostcode && city && normCity(doc.woonplaatsnaam) !== city && normCity(doc.gemeentenaam) !== city) {
    return { ok: false, reason: 'city_mismatch' };
  }
  const wantNumber = houseNumber(input.address);
  if (wantNumber !== null && doc.huisnummer !== undefined && Number(doc.huisnummer) !== wantNumber) {
    return { ok: false, reason: 'house_number_mismatch' };
  }
  const point = parsePoint(doc.centroide_ll);
  if (!point) return { ok: false, reason: 'no_point' };
  return { ok: true, ...point, label: doc.weergavenaam ?? '' };
}

export async function geocodeWithPdok(input: GeocodeInput, fetchFn: typeof fetch = fetch): Promise<GeocodeResult> {
  const q = buildPdokQuery(input);
  if (!q) return { ok: false, reason: 'no_address' };
  const url = new URL(PDOK_FREE_URL);
  url.searchParams.set('q', q);
  url.searchParams.append('fq', 'type:adres');
  const city = input.city?.trim().replace(/"/g, '');
  if (city) url.searchParams.append('fq', `woonplaatsnaam:"${city}" OR gemeentenaam:"${city}"`);
  url.searchParams.set('rows', '1');
  url.searchParams.set('fl', 'weergavenaam,centroide_ll,postcode,woonplaatsnaam,gemeentenaam,huisnummer,score');
  const res = await fetchFn(url.toString());
  if (!res.ok) return { ok: false, reason: `http_${res.status}` };
  const data = await res.json();
  return pickPdokResult(data?.response?.docs ?? [], input);
}
