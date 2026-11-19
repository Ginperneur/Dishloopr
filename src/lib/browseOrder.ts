// Order of restaurants when browsing a city (no dish searched). Dish searches keep their relevance
// ranking in ranking.ts; paid places stay separate and labelled.
//
// 1. Restaurants in the city itself first, then the villages around it, nearest first (5 km bands).
// 2. Within a group a quality score: photo 25%, full menu 25%, rating 25%, active owner 15%,
//    known opening hours 10%.
// 3. Variety at the top: at most 3 of one cuisine in the first 12, and a small daily shuffle between
//    near-equal scores so new restaurants also get a turn at the top.


export interface ListingSignals {
  foodDishes: number;
  pricedDishes: number;
  ownerDishes: number;
}

export interface BrowseInput {
  id: string;
  address?: string | null;
  images?: string[] | null;
  cuisine_primary?: string | null;
  geo_lat?: number | string | null;
  geo_lng?: number | string | null;
  claimed_by_owner_id?: string | null;
  bayesianRating: number;
  hasHours: boolean;
}

export const BROWSE_WEIGHTS = { photo: 0.25, menu: 0.25, rating: 0.25, owner: 0.15, hours: 0.1 } as const;
const FULL_MENU = 30;          // dishes; more than this no longer adds to the score
const TOP_N = 12;
const MAX_SAME_CUISINE_TOP = 3;
const JITTER = 0.015;          // daily shuffle between near-equal scores
const BAND_KM = 5;

const hasPhoto = (r: { images?: string[] | null }) => !!r.images && r.images.length > 0 && !!r.images[0];

const normalise = (s: string) => s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** The address names the city ("Heuvel 12, 5038 CS Tilburg"). Addresses without a place name count as in the city. */
export function inCity(address: string | null | undefined, cityName: string): boolean {
  if (!address) return true;
  const a = normalise(address);
  const c = normalise(cityName).replace(/^'s-/, '');
  if (a.includes(c)) return true;
  return !/\d{4}\s?[a-z]{2}\s+\S/i.test(address);   // a postcode followed by another place name: elsewhere
}

export function browseScore(r: BrowseInput, s: ListingSignals | undefined): number {
  const food = s?.foodDishes ?? 0;
  const menu = food === 0 ? 0 : 0.7 * Math.min(food, FULL_MENU) / FULL_MENU + 0.3 * Math.min(1, (s?.pricedDishes ?? 0) / food);
  const rating = Math.max(0, Math.min(1, (r.bayesianRating - 3) / 2));
  const owner = r.claimed_by_owner_id || (s?.ownerDishes ?? 0) > 0 ? 1 : 0;
  return BROWSE_WEIGHTS.photo * (hasPhoto(r) ? 1 : 0)
    + BROWSE_WEIGHTS.menu * menu
    + BROWSE_WEIGHTS.rating * rating
    + BROWSE_WEIGHTS.owner * owner
    + BROWSE_WEIGHTS.hours * (r.hasHours ? 1 : 0);
}

/** Stable per restaurant per day, between -1 and 1. */
export function dailyJitter(id: string, day: string): number {
  let h = 2166136261;
  for (const ch of id + day) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return ((h >>> 0) / 0xffffffff) * 2 - 1;
}

function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const r = Math.PI / 180;
  const x = (bLng - aLng) * r * Math.cos(((aLat + bLat) / 2) * r);
  const y = (bLat - aLat) * r;
  return Math.sqrt(x * x + y * y) * 6371;
}

/** At most MAX_SAME_CUISINE_TOP of one cuisine in the first TOP_N; the rest keep their order below. */
export function diversifyTop<T extends { cuisine_primary?: string | null }>(rows: T[]): T[] {
  const top: T[] = [];
  const later: T[] = [];
  const count = new Map<string, number>();
  for (const r of rows) {
    if (top.length >= TOP_N) { later.push(r); continue; }
    const c = (r.cuisine_primary || '').toLowerCase();
    const n = c ? count.get(c) ?? 0 : 0;
    if (c && n >= MAX_SAME_CUISINE_TOP) { later.push(r); continue; }
    if (c) count.set(c, n + 1);
    top.push(r);
  }
  return [...top, ...later];
}

export function orderForBrowse<T extends BrowseInput>(
  rows: T[],
  signals: Map<string, ListingSignals>,
  opts: { cityName?: string | null; day?: string } = {},
): T[] {
  const day = opts.day ?? new Date().toISOString().slice(0, 10);
  const city = opts.cityName || null;
  const local = (r: T) => (city ? inCity(r.address, city) : true);

  // Centre of the city: average position of the restaurants in the city itself.
  const pts = city ? rows.filter(local).filter(r => r.geo_lat != null && r.geo_lng != null) : [];
  const centre = pts.length
    ? { lat: pts.reduce((s, r) => s + Number(r.geo_lat), 0) / pts.length, lng: pts.reduce((s, r) => s + Number(r.geo_lng), 0) / pts.length }
    : null;

  const keyed = rows.map(r => {
    const band = local(r) ? 0
      : centre && r.geo_lat != null && r.geo_lng != null
        ? 1 + Math.floor(distanceKm(centre.lat, centre.lng, Number(r.geo_lat), Number(r.geo_lng)) / BAND_KM)
        : 99;
    return { r, band, score: browseScore(r, signals.get(r.id)) + JITTER * dailyJitter(r.id, day) };
  });
  keyed.sort((a, b) => a.band - b.band || b.score - a.score);

  const firstBand = keyed.filter(k => k.band === keyed[0]?.band).map(k => k.r);
  const rest = keyed.slice(firstBand.length).map(k => k.r);
  return [...diversifyTop(firstBand), ...rest];
}
