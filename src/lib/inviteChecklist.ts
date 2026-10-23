export interface ChecklistInput {
  dishPrices: (number | null)[];
  opening_hours: unknown;
  images: string[] | null;
  ambience_tags: string[] | null;
  parking_info: unknown;
}

export interface ChecklistItem { key: string; label: string }

function isEmpty(value: unknown): boolean {
  if (value == null) return true;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value as object).length === 0;
  if (typeof value === 'string') return value.trim() === '';
  return false;
}

/** Counts what a restaurant profile is still missing before claiming. */
export function missingItems(input: ChecklistInput): ChecklistItem[] {
  const items: ChecklistItem[] = [];
  const noPrice = input.dishPrices.filter(p => p == null || !Number.isFinite(Number(p))).length;
  if (noPrice > 0) items.push({ key: 'prices', label: `${noPrice} ${noPrice === 1 ? 'gerecht' : 'gerechten'} zonder prijs` });
  if (isEmpty(input.opening_hours)) items.push({ key: 'hours', label: 'Openingstijden' });
  if (isEmpty(input.images)) items.push({ key: 'photos', label: "Foto's" });
  if (isEmpty(input.ambience_tags)) items.push({ key: 'ambience', label: 'Sfeertags' });
  if (input.parking_info == null) items.push({ key: 'parking', label: 'Parkeerinfo' });
  return items;
}

/** Same order as /eten pages and restaurant_positions(): featured, top listing, rating, id. */
export function compareLandingOrder(
  a: { id: string; is_featured: boolean; is_top_listing: boolean; rating: number | null },
  b: { id: string; is_featured: boolean; is_top_listing: boolean; rating: number | null },
): number {
  if (Boolean(a.is_featured) !== Boolean(b.is_featured)) return a.is_featured ? -1 : 1;
  if (Boolean(a.is_top_listing) !== Boolean(b.is_top_listing)) return a.is_top_listing ? -1 : 1;
  const diff = (b.rating || 0) - (a.rating || 0);
  if (diff !== 0) return diff;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}
