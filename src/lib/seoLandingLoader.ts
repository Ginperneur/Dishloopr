import { supabase } from '@/integrations/supabase/client';
import type { SeoLandingPage } from '@/hooks/useSeoLandingPage';

export interface LandingDish {
  id: string; name: string; slug: string; canonical_slug: string | null;
  dish_group: string | null; vertaling_nl?: string | null;
}
export interface LandingContext {
  page: SeoLandingPage | null;
  redirectTo: string | null;
  synthesized: boolean;
}
export interface LandingRestaurant {
  id: string; name: string; slug: string; address: string; rating: number;
  review_count: number; price_level: number; images: string[] | null;
  cuisines: string[] | null; ambience_tags: string[] | null;
  meal_types: string[] | null; is_featured: boolean; is_top_listing: boolean;
  geo_lat: number | null; geo_lng: number | null;
  signatureDish?: { name: string; price: number | null };
  dishTranslations?: Record<string, string>;
}
export interface LandingMember {
  slug: string; name: string; translation: string | null; count: number; seoSlug: string | null;
}

/** Stable, complete pagination; the caller supplies an ordered range query. */
export async function readAllPages<T>(read: (from: number, to: number) => PromiseLike<{
  data: T[] | null; error: unknown;
}>, pageSize = 1000): Promise<T[]> {
  const first = await read(0, pageSize - 1);
  if (first.error) throw first.error;
  const rows = [...(first.data ?? [])];
  if (rows.length < pageSize) return rows;
  // Two pages at a time: bounded concurrency, no 1,000-row truncation.
  let from = pageSize;
  while (true) {
    const batches = await Promise.all([read(from, from + pageSize - 1), read(from + pageSize, from + 2 * pageSize - 1)]);
    for (const batch of batches) {
      if (batch.error) throw batch.error;
      rows.push(...(batch.data ?? []));
    }
    if (batches.some(b => (b.data?.length ?? 0) < pageSize)) return rows;
    from += 2 * pageSize;
  }
}

export function slugCandidates(slug: string) {
  const parts = slug.split('-');
  return parts.slice(1).map((_, index) => ({
    dish: parts.slice(0, index + 1).join('-'), city: parts.slice(index + 1).join('-'),
  })).filter(c => c.dish !== 'gerecht');
}

const DISH_FIELDS = 'id, name, slug, canonical_slug, dish_group, vertaling_nl';

async function canonicalTarget(dish: LandingDish, cityId: string): Promise<string | null> {
  if (!dish.canonical_slug || dish.canonical_slug === dish.slug) return null;
  const { data, error } = await supabase.from('seo_landing_pages')
    .select('slug, dishes:dish_id!inner(slug)')
    .eq('city_id', cityId).eq('is_active', true).eq('dishes.slug', dish.canonical_slug).maybeSingle();
  if (error) throw error;
  return data?.slug ? `/eten/${data.slug}` : null;
}

export async function loadLandingContext(slug: string): Promise<LandingContext> {
  if (slug.startsWith('gerecht-')) return { page: null, redirectTo: null, synthesized: false };
  const { data, error } = await supabase.from('seo_landing_pages')
    .select(`*, dishes:dish_id (${DISH_FIELDS}), cities:city_id (id, name, slug)`)
    .eq('slug', slug).eq('is_active', true).maybeSingle();
  if (error) throw error;
  if (data) {
    const dish = data.dishes;
    const city = data.cities;
    const redirectTo = dish && city ? await canonicalTarget(dish, city.id) : null;
    return {
      page: { ...data, faq_content: Array.isArray(data.faq_content) ? data.faq_content as unknown as SeoLandingPage['faq_content'] : [],
        dish: dish ?? undefined, city: city ?? undefined },
      synthesized: false, redirectTo,
    };
  }
  const candidates = slugCandidates(slug);
  if (!candidates.length) return { page: null, redirectTo: null, synthesized: false };
  const { data: cities, error: cityError } = await supabase.from('cities')
    .select('id, name, slug').in('slug', candidates.map(c => c.city));
  if (cityError) throw cityError;
  // Candidates are ordered longest city suffix first, including hyphenated cities.
  for (const candidate of candidates) {
    const city = cities?.find(c => c.slug === candidate.city);
    if (!city) continue;
    const { data: exact, error: dishError } = await supabase.from('dishes').select(DISH_FIELDS)
      .eq('slug', candidate.dish).maybeSingle();
    if (dishError) throw dishError;
    let dish: LandingDish | null = exact;
    if (dish?.canonical_slug && dish.canonical_slug !== dish.slug) {
      const redirectTo = await canonicalTarget(dish, city.id);
      if (redirectTo) return { page: null, redirectTo, synthesized: false };
      continue;
    }
    if (!dish) {
      const { data: representative, error: repError } = await supabase.from('dishes').select(DISH_FIELDS)
        .eq('canonical_slug', candidate.dish).order('id').limit(1).maybeSingle();
      if (repError) throw repError;
      if (!representative) continue;
      dish = { ...representative, slug: candidate.dish, canonical_slug: candidate.dish,
        name: candidate.dish.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') };
    }
    const now = new Date().toISOString();
    return { synthesized: true, redirectTo: null, page: {
      id: `synth-${dish.id}-${city.id}`, slug, dish_id: dish.id, city_id: city.id,
      meta_title: `Beste ${dish.name} in ${city.name} | Dishloopr`,
      meta_description: `Ontdek de beste restaurants voor ${dish.name.toLowerCase()} in ${city.name}. Vergelijk, filter en vind jouw favoriet.`,
      h1_title: `Beste ${dish.name} in ${city.name}`, intro_text: null, extended_description: null,
      faq_content: [], keywords: null, canonical_url: null, is_active: true, is_auto_generated: true,
      created_at: now, updated_at: now, dish, city,
    } };
  }
  return { page: null, redirectTo: null, synthesized: false };
}

export function landingIdentity(page: SeoLandingPage) {
  const canonical = page.dish?.canonical_slug || page.dish?.slug || '';
  return { canonical, isHub: Boolean(canonical && canonical === page.dish?.dish_group) };
}

export async function loadLandingRestaurants(page: SeoLandingPage) {
  const { canonical, isHub } = landingIdentity(page);
  if (!canonical || !page.city_id) return { restaurants: [] as LandingRestaurant[], members: [] as LandingMember[] };
  const cityId = page.city_id;
  const [cityRestaurants, matches] = await Promise.all([
    readAllPages<LandingRestaurant>((from, to) => supabase.from('restaurants').select('*')
      .eq('city_id', cityId).eq('is_active', true).order('id').range(from, to)),
    readAllPages((from, to) => {
      const query = supabase.from('restaurant_dishes')
        .select(`id, restaurant_id, price, is_signature, dishes:dish_id!inner(${DISH_FIELDS}), restaurants:restaurant_id!inner(city_id, is_active)`)
        .in('status', ['approved_by_admin', 'verified_by_owner'])
        .eq('restaurants.city_id', cityId).eq('restaurants.is_active', true)
        .order('id').range(from, to);
      return isHub ? query.eq('dishes.dish_group', canonical) : query.eq('dishes.canonical_slug', canonical);
    }),
  ]);
  const best = new Map<string, { name: string; price: number | null; is_signature: boolean }>();
  const matchedMembers = new Map<string, Set<string>>();
  const representatives = new Map<string, LandingDish>();
  const translations: Record<string, string> = {};
  for (const match of matches) {
    const dish = match.dishes;
    if (!dish) continue;
    if (dish.vertaling_nl) translations[dish.name] = dish.vertaling_nl;
    const member = dish.canonical_slug || dish.slug;
    const existingRep = representatives.get(member);
    if (!existingRep || dish.slug === member) representatives.set(member, dish);
    const set = matchedMembers.get(match.restaurant_id) ?? new Set<string>();
    set.add(member); matchedMembers.set(match.restaurant_id, set);
    const price = match.price != null && Number.isFinite(Number(match.price)) ? Number(match.price) : null;
    const candidate = { name: dish.name, price, is_signature: Boolean(match.is_signature) };
    const existing = best.get(match.restaurant_id);
    if (!existing || (!existing.is_signature && candidate.is_signature)
      || (existing.price === null && price !== null && existing.is_signature === candidate.is_signature)) {
      best.set(match.restaurant_id, candidate);
    }
  }
  const restaurants = cityRestaurants.filter(r => best.has(r.id)).map(r => {
    const match = best.get(r.id);
    return { ...r, signatureDish: match ? { name: match.name, price: match.price } : undefined,
      dishTranslations: Object.keys(translations).length ? translations : undefined };
  });
  restaurants.sort((a, b) => {
    if (a.is_featured !== b.is_featured) return a.is_featured ? -1 : 1;
    if (a.is_top_listing !== b.is_top_listing) return a.is_top_listing ? -1 : 1;
    return (b.rating || 0) - (a.rating || 0);
  });
  const counts = new Map<string, number>();
  if (isHub) for (const restaurant of restaurants) {
    for (const member of matchedMembers.get(restaurant.id) ?? []) {
      if (member !== canonical) counts.set(member, (counts.get(member) ?? 0) + 1);
    }
  }
  const members: LandingMember[] = [...counts].map(([slug, count]) => ({
    slug, count, name: representatives.get(slug)?.name || slug,
    translation: representatives.get(slug)?.vertaling_nl ?? null, seoSlug: null,
  })).sort((a, b) => b.count - a.count);
  return { restaurants, members };
}

/** Optional navigation is independent of the first text and restaurant selection. */
export async function loadLandingNavigation(page: SeoLandingPage) {
  const group = page.dish?.dish_group;
  if (!group || !page.city_id) return { seoByCanonical: {} as Record<string, string>, parentHub: null };
  const [seoRows, hub] = await Promise.all([
    readAllPages((from, to) => supabase.from('seo_landing_pages')
      .select('slug, dishes:dish_id!inner(slug)').eq('city_id', page.city_id)
      .eq('is_active', true).eq('dishes.dish_group', group).order('id').range(from, to)),
    supabase.from('dishes').select('id, name, slug').eq('slug', group).maybeSingle(),
  ]);
  if (hub.error) throw hub.error;
  const seoByCanonical: Record<string, string> = {};
  for (const row of seoRows) if (row.dishes) seoByCanonical[row.dishes.slug] = row.slug;
  const { isHub } = landingIdentity(page);
  return { seoByCanonical, parentHub: !isHub && hub.data ? {
    slug: seoByCanonical[hub.data.slug] ?? null, name: hub.data.name, dishSlug: hub.data.slug,
  } : null };
}