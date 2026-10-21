import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface OwnReviewStats { count: number; average: number }

const cache = new Map<string, OwnReviewStats>();
const listeners = new Map<string, Set<() => void>>();
let pending = new Set<string>();
let timer: ReturnType<typeof setTimeout> | null = null;

async function flush() {
  timer = null;
  const ids = [...pending];
  pending = new Set();
  for (let i = 0; i < ids.length; i += 150) {
    const chunk = ids.slice(i, i + 150);
    const { data } = await supabase
      .from('reviews')
      .select('restaurant_id, rating')
      .eq('status', 'published')
      .in('restaurant_id', chunk);
    const agg = new Map<string, { s: number; c: number }>();
    for (const r of data ?? []) {
      const a = agg.get(r.restaurant_id) ?? { s: 0, c: 0 };
      a.s += Number(r.rating) || 0; a.c += 1;
      agg.set(r.restaurant_id, a);
    }
    for (const id of chunk) {
      const a = agg.get(id);
      cache.set(id, a ? { count: a.c, average: a.s / a.c } : { count: 0, average: 0 });
      listeners.get(id)?.forEach((fn) => fn());
    }
  }
}

/** Published own-review count + average for one restaurant; requests are batched across cards. */
export function useOwnReviewStats(restaurantId?: string): OwnReviewStats | undefined {
  const [, force] = useState(0);
  useEffect(() => {
    if (!restaurantId || cache.has(restaurantId)) return;
    const fn = () => force((n) => n + 1);
    if (!listeners.has(restaurantId)) listeners.set(restaurantId, new Set());
    listeners.get(restaurantId)!.add(fn);
    pending.add(restaurantId);
    if (!timer) timer = setTimeout(flush, 30);
    return () => { listeners.get(restaurantId)?.delete(fn); };
  }, [restaurantId]);
  return restaurantId ? cache.get(restaurantId) : undefined;
}
