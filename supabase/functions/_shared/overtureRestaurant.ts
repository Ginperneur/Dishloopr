// Builds the restaurants row for an approved Overture discovery candidate. Overture Places data
// (CDLA Permissive 2.0 / CC0 / Apache 2.0) may be stored with attribution; coordinates and the
// address are replaced by the BAG version from PDOK when that geocode agrees with the postcode.
import type { GeocodeResult } from './pdokGeocode.ts';

export interface OvertureCandidate {
  external_id: string;
  name: string;
  address: string | null;
  postcode: string | null;
  lat: number | null;
  lng: number | null;
  website: string | null;
  phone: string | null;
  city_id: string | null;
}

export function restaurantSlug(name: string, externalId: string): string {
  const base = name
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/'/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    .slice(0, 60).replace(/-$/, '');
  const suffix = externalId.replace(/[^a-z0-9]/gi, '').toLowerCase().slice(-6);
  return `${base || 'restaurant'}-${suffix}`;
}

export function normalizeWebsite(url: string | null): string | null {
  const raw = (url ?? '').trim();
  if (!raw) return null;
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const u = new URL(withScheme);
    return u.hostname.includes('.') ? u.toString() : null;
  } catch {
    return null;
  }
}

export function restaurantFromOverture(c: OvertureCandidate, cityName: string | null, geo: GeocodeResult) {
  if (!c.city_id) throw new Error('Overture-kandidaat zonder stad');
  const composed = [c.address, [c.postcode, cityName].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  return {
    name: c.name,
    slug: restaurantSlug(c.name, c.external_id),
    address: geo.ok ? geo.label : (composed || 'Onbekend'),
    postal_code: c.postcode,
    city_id: c.city_id,
    geo_lat: geo.ok ? geo.lat : c.lat,
    geo_lng: geo.ok ? geo.lng : c.lng,
    website_url: normalizeWebsite(c.website),
    phone: c.phone,
    overture_id: c.external_id,
    is_active: false,
    added_by_source: 'discovery',
  };
}
