// Pure helpers for the Overture bulk route (supabase/functions/overture-bulk). Kept free of
// Supabase calls so supabase/tests/overture-bulk.ts can check them without a database.

// restaurants_verborgen.reden for restaurants created in bulk. It must match hidden_for_menu()
// (reden ~* 'menu|gerecht|kaart|dish'), so the restaurant_dishes trigger switches the restaurant
// on by itself once it has visibility_menu_minimum() (default 5) approved non-drink dishes.
export const BULK_HIDDEN_REASON = 'menu: Overture-import, wacht op 5 gerechten';

export const TRIAGES = ['verified', 'approve'] as const;

// PostgreSQL text/jsonb rejects U+0000, even though JSON permits it. Strip only the
// actual NUL character, not the printable six-character sequence "\u0000".
export function postgresSafeJson<T>(value: T): T {
  if (typeof value === 'string') return value.replace(/\u0000/g, '') as T;
  if (Array.isArray(value)) return value.map((item) => postgresSafeJson(item)) as T;
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [
      postgresSafeJson(key), postgresSafeJson(item),
    ])) as T;
  }
  return value;
}

// Discovery rows use discovered_at, not created_at; id breaks timestamp ties.
// deno-lint-ignore no-explicit-any
export function pendingOvertureBatch(admin: any, triage: string, limit: number) {
  return admin.from('discovery_results')
    .select('id, external_id, name, address, postcode, lat, lng, website, phone, city_id')
    .eq('source', 'overture').eq('status', 'pending').eq('triage', triage)
    .order('discovered_at').order('id').limit(limit);
}

export function bulkErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return error.message;
  }
  return String(error);
}

export interface DishImportRow {
  overture_id: string;
  dish_slug: string;
  dish_name: string;
  canonical_slug?: string;
  course?: string;
  tier?: string;
  price?: string;
  description?: string;
  menu_section?: string;
  sort_order?: string;
}

export const DISH_IMPORT_COLUMNS = ['overture_id', 'dish_slug', 'dish_name', 'canonical_slug', 'course', 'tier', 'price'];

// "12,50", "€ 12.50", "12.5" → 12.5; anything else (ranges, text, absurd values) → null.
export function parsePrice(raw: string | undefined | null): number | null {
  const s = (raw ?? '').replace(/€|eur/gi, '').trim().replace(',', '.');
  if (!/^\d{1,4}(\.\d{1,2})?$/.test(s)) return null;
  const n = Number(s);
  return n > 0 && n < 1000 ? n : null;
}

export function cleanDishRows(rows: DishImportRow[]): DishImportRow[] {
  const seen = new Set<string>();
  const out: DishImportRow[] = [];
  for (const input of rows) {
    const r = postgresSafeJson(input);
    const overture = (r.overture_id ?? '').trim();
    const slug = (r.dish_slug ?? '').trim();
    const name = (r.dish_name ?? '').trim();
    if (!overture || !slug || !name || name.length > 160) continue;
    const key = `${overture}|${slug}`;
    if (seen.has(key)) continue; // first occurrence wins, like the earlier imports
    seen.add(key);
    out.push({ ...r, overture_id: overture, dish_slug: slug, dish_name: name });
  }
  return out;
}

// New dishes: only canonical-tier rows carry a canonical_slug, so a loose menu item never gets
// its own /eten/{gerecht}-{stad} page (same rule as import_v5.sql block 5).
export function newDishRecord(r: DishImportRow) {
  const canonical = (r.canonical_slug ?? '').trim();
  return {
    slug: r.dish_slug,
    name: r.dish_name,
    canonical_slug: r.tier === 'canonical' && canonical ? canonical : null,
    course: (r.course ?? '').trim() || null,
    is_active: true,
  };
}

// Screening course → restaurant_dishes.course_type (voorgerecht, hoofdgerecht, dessert, bijgerecht,
// drank). Drinks must be 'drank': menu_dish_count() leaves them out of the 5-dish minimum.
const COURSE_TYPE: Record<string, string> = {
  voorgerecht: 'voorgerecht', hoofdgerecht: 'hoofdgerecht', bijgerecht: 'bijgerecht',
  nagerecht: 'dessert', dessert: 'dessert', drank: 'drank',
};

export function courseType(course: string | undefined): string {
  return COURSE_TYPE[(course ?? '').trim().toLowerCase()] ?? 'hoofdgerecht';
}

export function linkRecord(r: DishImportRow, restaurantId: string, dishId: string, nowIso: string) {
  const sort = Number.parseInt(r.sort_order ?? '', 10);
  return {
    restaurant_id: restaurantId,
    dish_id: dishId,
    price: parsePrice(r.price),
    status: 'approved_by_admin',
    approved_at: nowIso,
    description: (r.description ?? '').trim() || null,
    menu_section: (r.menu_section ?? '').trim() || null,
    tier: (r.tier ?? '').trim() || null,
    sort_order: Number.isFinite(sort) ? sort : null,
    course_type: courseType(r.course),
    source: 'menu_scraper_v5',
  };
}

export function chunks<T>(xs: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += size) out.push(xs.slice(i, i + size));
  return out;
}
