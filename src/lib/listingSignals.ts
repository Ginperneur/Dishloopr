import { supabase } from '@/integrations/supabase/client';
import type { ListingSignals } from '@/lib/browseOrder';

/**
 * Menu and owner signals for ordering a city listing, in chunks of 500 restaurants. Returns an empty
 * map when the database function is missing (published before the migration), so ordering still works.
 */
export async function fetchListingSignals(ids: string[]): Promise<Map<string, ListingSignals>> {
  const out = new Map<string, ListingSignals>();
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += 500) chunks.push(ids.slice(i, i + 500));
  await Promise.all(chunks.map(async (chunk) => {
    const { data, error } = await supabase.rpc('restaurant_listing_signals' as never, { p_ids: chunk } as never);
    if (error || !Array.isArray(data)) return;
    for (const row of data as { restaurant_id: string; food_dishes: number; priced_dishes: number; owner_dishes: number }[]) {
      out.set(row.restaurant_id, { foodDishes: row.food_dishes, pricedDishes: row.priced_dishes, ownerDishes: row.owner_dishes });
    }
  }));
  return out;
}
