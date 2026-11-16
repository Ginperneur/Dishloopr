// What an owner set under Faciliteiten, as labels for the restaurant page. Only what is set to yes
// is shown: "no" and "unknown" look the same in the data, so we never claim something is absent.

export interface FacilityFlags {
  is_fully_halal?: boolean | null;
  is_fully_vegetarian?: boolean | null;
  is_fully_vegan?: boolean | null;
  has_terrace?: boolean | null;
  has_delivery?: boolean | null;
  has_takeaway?: boolean | null;
}

export type FacilityKey = 'halal' | 'vegan' | 'vegetarian' | 'terrace' | 'delivery' | 'takeaway';

export function restaurantFacilities(r: FacilityFlags): FacilityKey[] {
  const out: FacilityKey[] = [];
  if (r.is_fully_halal) out.push('halal');
  // Fully vegan already says fully vegetarian; show one.
  if (r.is_fully_vegan) out.push('vegan');
  else if (r.is_fully_vegetarian) out.push('vegetarian');
  if (r.has_terrace) out.push('terrace');
  if (r.has_delivery) out.push('delivery');
  if (r.has_takeaway) out.push('takeaway');
  return out;
}

export const FACILITY_LABELS: Record<FacilityKey, { nl: string; en: string; hint: string }> = {
  halal: { nl: 'Volledig halal', en: 'Fully halal', hint: 'Alle gerechten zijn halal' },
  vegan: { nl: 'Volledig veganistisch', en: 'Fully vegan', hint: 'Alle gerechten zijn veganistisch' },
  vegetarian: { nl: 'Volledig vegetarisch', en: 'Fully vegetarian', hint: 'Alle gerechten zijn vegetarisch' },
  terrace: { nl: 'Terras', en: 'Terrace', hint: 'Je kunt buiten zitten' },
  delivery: { nl: 'Bezorgen', en: 'Delivery', hint: 'Ze bezorgen aan huis' },
  takeaway: { nl: 'Afhalen', en: 'Takeaway', hint: 'Je kunt bestellen om mee te nemen' },
};
