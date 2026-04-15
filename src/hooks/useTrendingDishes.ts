import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface TrendingDish {
  id: string;
  name: string;
  slug: string;
  search_count: number;
  seasonal_tags: string[];
  restaurant_count: number;
}

export function useTrendingDishes(limit: number = 8) {
  const [dishes, setDishes] = useState<TrendingDish[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDishes = async () => {
      setLoading(true);
      const { data, error: fetchError } = await supabase
        .rpc('get_trending_dishes', { dish_limit: limit });

      if (fetchError) {
        setError(fetchError.message);
      } else {
        setDishes((data || []).map((d: any) => ({
          ...d,
          seasonal_tags: d.seasonal_tags || [],
          restaurant_count: Number(d.restaurant_count) || 0,
        })));
      }
      setLoading(false);
    };

    fetchDishes();
  }, [limit]);

  return { dishes, loading, error };
}
