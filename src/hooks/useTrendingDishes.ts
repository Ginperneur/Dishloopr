import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type Dish = Database['public']['Tables']['dishes']['Row'];

export function useTrendingDishes(limit: number = 8) {
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDishes = async () => {
      setLoading(true);
      const { data, error: fetchError } = await supabase
        .from('dishes')
        .select('*')
        .eq('is_active', true)
        .order('search_count', { ascending: false })
        .limit(limit);

      if (fetchError) {
        setError(fetchError.message);
      } else {
        setDishes(data || []);
      }
      setLoading(false);
    };

    fetchDishes();
  }, [limit]);

  return { dishes, loading, error };
}
