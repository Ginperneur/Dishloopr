import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface DishPreviewItem { name: string; price: number | null }

const PER_RESTAURANT = 3;
type PreviewRow = { restaurant_id: string; price: number | null; dishes: { name: string } | null };

const cache = new Map<string, DishPreviewItem[]>();
const listeners = new Map<string, Set<() => void>>();
let pending = new Set<string>();
let timer: ReturnType<typeof setTimeout> | null = null;

async function flush() {
  timer = null;
  const ids = [...pending];
  pending = new Set();
  for (let i = 0; i < ids.length; i += 20) {
    const chunk = ids.slice(i, i + 20);
    // Menu order: imported menus number their dishes, so the first ones per restaurant are enough.
    const { data } = await supabase
      .from('restaurant_dishes')
      .select('restaurant_id, price, sort_order, dishes(name)')
      .in('restaurant_id', chunk)
      .in('status', ['approved_by_admin', 'verified_by_owner'])
      .neq('course_type', 'drank')
      .or('sort_order.lte.12,sort_order.is.null')
      .order('sort_order', { ascending: true, nullsFirst: false })
      .limit(1000);
    const byRestaurant = new Map<string, DishPreviewItem[]>();
    for (const row of (data ?? []) as unknown as PreviewRow[]) {
      const name = row.dishes?.name;
      if (!name) continue;
      const list = byRestaurant.get(row.restaurant_id) ?? [];
      if (list.length < PER_RESTAURANT && !list.some((d) => d.name === name)) {
        list.push({ name, price: row.price == null ? null : Number(row.price) });
      }
      byRestaurant.set(row.restaurant_id, list);
    }
    for (const id of chunk) {
      cache.set(id, byRestaurant.get(id) ?? []);
      listeners.get(id)?.forEach((fn) => fn());
    }
  }
}

/** A few dishes from the menu, shown on a card in place of a missing photo; requests are batched across cards. */
export function useDishPreview(restaurantId: string | undefined, enabled: boolean): DishPreviewItem[] | undefined {
  const [, force] = useState(0);
  useEffect(() => {
    if (!enabled || !restaurantId || cache.has(restaurantId)) return;
    const fn = () => force((n) => n + 1);
    if (!listeners.has(restaurantId)) listeners.set(restaurantId, new Set());
    listeners.get(restaurantId)!.add(fn);
    pending.add(restaurantId);
    if (!timer) timer = setTimeout(flush, 30);
    return () => { listeners.get(restaurantId)?.delete(fn); };
  }, [restaurantId, enabled]);
  return enabled && restaurantId ? cache.get(restaurantId) : undefined;
}
