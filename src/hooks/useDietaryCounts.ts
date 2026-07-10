import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type DietaryCounts = Record<string, number>;

/**
 * Returns a match count for each dietary filter option based on active restaurants.
 * Used to hide chips whose count is 0.
 */
export function useDietaryCounts() {
  const [counts, setCounts] = useState<DietaryCounts>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const q = (col: 'is_vegan' | 'is_gluten_free' | 'is_halal') =>
        supabase
          .from('restaurants')
          .select('id', { count: 'exact', head: true })
          .eq('is_active', true)
          .eq(col, true);
      const [vegan, gf, halal] = await Promise.all([q('is_vegan'), q('is_gluten_free'), q('is_halal')]);
      if (cancelled) return;
      setCounts({
        vegan: vegan.count ?? 0,
        'gluten-free': gf.count ?? 0,
        halal: halal.count ?? 0,
        // No dedicated lactose-free column — treat as 0 (chip hidden)
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