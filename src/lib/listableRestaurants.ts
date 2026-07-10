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

async function fetchAllIds(
  builder: () => any,
  extract: (row: any) => string
): Promise<Set<string>> {
  const ids = new Set<string>();
  const pageSize = 1000;
  let from = 0;
  while (true) {
    const { data, error } = await builder().range(from, from + pageSize - 1);
    if (error || !data) break;
    data.forEach((r: any) => ids.add(extract(r)));
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return ids;
}

export async function getEmptyRestaurantIds(force = false): Promise<Set<string>> {
  if (!force && cache && Date.now() - cache.ts < TTL_MS) return cache.empty;
  if (!force && inflight) return inflight;

  inflight = (async () => {
    const [activeIds, approvedIds] = await Promise.all([
      fetchAllIds(
        () => supabase.from('restaurants').select('id').eq('is_active', true),
        (r) => r.id
      ),
      fetchAllIds(
        () =>
          supabase
            .from('restaurant_dishes')
            .select('restaurant_id')
            .eq('status', 'approved_by_admin'),
        (r) => r.restaurant_id
      ),
    ]);
    const empty = new Set<string>();
    activeIds.forEach((id) => {
      if (!approvedIds.has(id)) empty.add(id);
    });
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
