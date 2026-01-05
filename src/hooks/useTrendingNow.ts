import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface TrendingDish {
  id: string;
  name: string;
  slug: string;
  search_count: number;
  seasonal_tags: string[];
}

export function useTrendingNow(cityId?: string) {
  const [trendingDishes, setTrendingDishes] = useState<TrendingDish[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTrending = async () => {
      setLoading(true);
      try {
        // Get most searched dishes
        const { data } = await supabase
          .from('dishes')
          .select('id, name, slug, search_count, seasonal_tags')
          .eq('is_active', true)
          .order('search_count', { ascending: false })
          .limit(8);

        setTrendingDishes((data || []).map(d => ({
          ...d,
          seasonal_tags: d.seasonal_tags || [],
        })));
      } catch (err) {
        console.error('Failed to fetch trending dishes:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchTrending();
  }, [cityId]);

  // Get current season
  const getCurrentSeason = (): string => {
    const month = new Date().getMonth();
    if (month >= 2 && month <= 4) return 'spring';
    if (month >= 5 && month <= 7) return 'summer';
    if (month >= 8 && month <= 10) return 'autumn';
    return 'winter';
  };

  const seasonalDishes = trendingDishes.filter(d => 
    d.seasonal_tags.includes(getCurrentSeason())
  );

  return { 
    trendingDishes, 
    seasonalDishes,
    currentSeason: getCurrentSeason(),
    loading 
  };
}
