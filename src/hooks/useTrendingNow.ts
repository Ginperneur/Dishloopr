import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface TrendingDish {
  id: string;
  name: string;
  slug: string;
  search_count: number;
  seasonal_tags: string[];
  restaurant_count: number;
}

export function useTrendingNow(cityId?: string) {
  const [trendingDishes, setTrendingDishes] = useState<TrendingDish[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTrending = async () => {
      setLoading(true);
      try {
        const { data } = await supabase
          .rpc('get_trending_dishes', { dish_limit: 8 });

        setTrendingDishes((data || []).map((d: any) => ({
          ...d,
          seasonal_tags: d.seasonal_tags || [],
          restaurant_count: Number(d.restaurant_count) || 0,
        })));
      } catch (err) {
        console.error('Failed to fetch trending dishes:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchTrending();
  }, [cityId]);

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
