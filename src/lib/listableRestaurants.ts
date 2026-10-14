import { supabase } from '@/integrations/supabase/client';

/**
 * "Dish-first" listing eligibility.
 *
 * A restaurant is only listable in public browse surfaces (search results,
 * city browse, homepage sections) when it has ≥1 restaurant_dishes row with
 * status = 'approved_by_admin'. This helper returns the set of ACTIVE
 * restaurants that do NOT meet that bar, so callers can exclude them.
 *
 * The result is cached in-memory for a short TTL so page transitions don't
 * re-fetch the world. Call `invalidateListableRestaurantCache()` when
 * approvals change to refresh immediately.
 */

const TTL_MS = 5 * 60 * 1000;
let cache: { empty: Set<string>; ts: number } | null = null;
let inflight: Promise<Set<string>> | null = null;

export async function getEmptyRestaurantIds(force = false): Promise<Set<string>> {
  if (!force && cache && Date.now() - cache.ts < TTL_MS) return cache.empty;
  if (!force && inflight) return inflight;

  inflight = (async () => {
    const { data, error } = await supabase.rpc('get_empty_restaurant_ids' as any);
    if (error) console.error('get_empty_restaurant_ids error:', error);
    const empty = new Set<string>(
      ((data as any[]) || []).map((v: any) =>
        typeof v === 'string' ? v : v?.get_empty_restaurant_ids ?? v?.id
      ).filter(Boolean)
    );
    cache = { empty, ts: Date.now() };
    inflight = null;
    return empty;
  })();

  return inflight;
}

export function invalidateListableRestaurantCache() {
  cache = null;
  inflight = null;
}
