import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type DietaryCounts = Record<string, number>;

/**
 * Returns a match count for each dietary filter option using the SAME sources
 * the actual search filter uses (dish-level flags on restaurant_dishes +
 * restaurant-level "is_fully_*" flags). Used to hide chips whose count is 0.
 */
export function useDietaryCounts() {
  const [counts, setCounts] = useState<DietaryCounts>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Dish-level: count matching restaurant_dishes rows (status != rejected).
      const dishQ = (col: string) =>
        (supabase as any)
          .from('restaurant_dishes')
          .select('restaurant_id', { count: 'exact', head: true })
          .neq('status', 'rejected')
          .eq(col, true);
      // Restaurant-level: matches on is_fully_* fallbacks (vegan/halal only).
      const restQ = (col: string) =>
        (supabase as any)
          .from('restaurants')
          .select('id', { count: 'exact', head: true })
          .eq('is_active', true)
          .eq(col, true);

      const [veganDish, gfDish, halalDish, veganRest, halalRest] =
        await Promise.all([
          dishQ('is_vegan'),
          dishQ('is_gluten_free'),
          dishQ('is_halal'),
          restQ('is_fully_vegan'),
          restQ('is_fully_halal'),
        ]);
      if (cancelled) return;
      setCounts({
        vegan: (veganDish.count ?? 0) + (veganRest.count ?? 0),
        'gluten-free': gfDish.count ?? 0,
        halal: (halalDish.count ?? 0) + (halalRest.count ?? 0),
        // No dedicated lactose-free source — hide chip.
        'lactose-free': 0,
      });
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { counts, loading };
}