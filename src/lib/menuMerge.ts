// The public menu lists a restaurant's approved dishes (restaurant_dishes). Owners also keep
// prices and descriptions under "Menu Items" (menu_items), which guests never saw. This merges
// the two: a menu item with the same name adds its price and description to the dish, and menu
// items without a matching dish are shown as their own entries.

export type CourseKey = 'borrel' | 'voorgerecht' | 'hoofdgerecht' | 'bijgerecht' | 'nagerecht' | 'drank';

export interface MenuRow {
  id: string;
  name: string;
  description: string | null;
  price: number | null;
  category: string;
  is_vegetarian: boolean | null;
  is_vegan: boolean | null;
  is_gluten_free: boolean | null;
}

export interface MergeableItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
  course_type: CourseKey;
  is_vegetarian: boolean;
  is_vegan: boolean;
  is_gluten_free: boolean;
}

export const normalizeName = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** Course for an owner's free-text category ("Voorgerechten", "Desserts", "Drinks"). */
export function courseFromCategory(category: string): CourseKey {
  const c = normalizeName(category);
  if (/\b(drank|dranken|drink|drinks|drinken|wijn|wijnen|bier|bieren|cocktails?|koffie|thee|frisdrank)\b/.test(c)) return 'drank';
  if (/\b(dessert|desserts|nagerecht|nagerechten|nagerechtjes|zoet|sweets?)\b/.test(c)) return 'nagerecht';
  if (/\b(voorgerecht|voorgerechten|starters?|entrees?|soep|soepen|salades?)\b/.test(c)) return 'voorgerecht';
  if (/\b(bijgerecht|bijgerechten|sides?|extra s?)\b/.test(c)) return 'bijgerecht';
  if (/\b(borrel|bites|snacks|tapas|borrelhapjes)\b/.test(c)) return 'borrel';
  return 'hoofdgerecht';
}

export function mergeMenuRows<T extends MergeableItem>(items: T[], rows: MenuRow[], make: (row: MenuRow, course: CourseKey) => T): T[] {
  const byName = new Map<string, MenuRow>();
  for (const r of rows) {
    const k = normalizeName(r.name);
    if (k && !byName.has(k)) byName.set(k, r);
  }
  const used = new Set<string>();
  const merged = items.map(item => {
    const row = byName.get(normalizeName(item.name));
    if (!row) return item;
    used.add(row.id);
    return {
      ...item,
      price: row.price && row.price > 0 ? Number(row.price) : item.price,
      description: row.description?.trim() || item.description,
      is_vegetarian: item.is_vegetarian || !!row.is_vegetarian,
      is_vegan: item.is_vegan || !!row.is_vegan,
      is_gluten_free: item.is_gluten_free || !!row.is_gluten_free,
    };
  });
  const extra = rows.filter(r => !used.has(r.id) && normalizeName(r.name)).map(r => make(r, courseFromCategory(r.category)));
  return [...merged, ...extra];
}

export const formatPrice = (price: number) =>
  price > 0 ? new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(price) : null;
