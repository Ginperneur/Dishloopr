import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface DishAnalyticsData {
  dishId: string;
  dishName: string;
  totalClicks: number;
  searchVolume: number;
  trend: 'up' | 'down' | 'stable';
  trendPercentage: number;
  clicksByPeriod: { date: string; clicks: number }[];
  position: number;
  conversionRate: number;
}

export interface DishInsight {
  type: 'strength' | 'opportunity' | 'warning';
  message: string;
  dishName?: string;
}

export function useDishAnalytics(restaurantId: string) {
  const [dishAnalytics, setDishAnalytics] = useState<DishAnalyticsData[]>([]);
  const [insights, setInsights] = useState<DishInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'7d' | '30d' | '90d'>('30d');

  const fetchDishAnalytics = useCallback(async () => {
    if (!restaurantId) return;

    setLoading(true);

    try {
      // Get period start date
      const periodDays = period === '7d' ? 7 : period === '30d' ? 30 : 90;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - periodDays);
      
      const previousStartDate = new Date(startDate);
      previousStartDate.setDate(previousStartDate.getDate() - periodDays);

      // Fetch restaurant dishes with their dish info
      const { data: restaurantDishes } = await supabase
        .from('restaurant_dishes')
        .select(`
          dish_id,
          clicks,
          confidence_score,
          dishes:dish_id (
            id,
            name,
            search_count
          )
        `)
        .eq('restaurant_id', restaurantId);

      if (!restaurantDishes || restaurantDishes.length === 0) {
        setDishAnalytics([]);
        setInsights([{
          type: 'opportunity',
          message: 'Voeg gerechten toe aan je menu om analytics te zien'
        }]);
        setLoading(false);
        return;
      }

      // Fetch analytics events for this restaurant's dishes
      const dishIds = restaurantDishes.map(rd => rd.dish_id);
      
      const { data: currentEvents } = await supabase
        .from('analytics_events')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .in('dish_id', dishIds)
        .gte('created_at', startDate.toISOString());

      const { data: previousEvents } = await supabase
        .from('analytics_events')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .in('dish_id', dishIds)
        .gte('created_at', previousStartDate.toISOString())
        .lt('created_at', startDate.toISOString());

      // Also get all dish clicks (search-based)
      const { data: allDishEvents } = await supabase
        .from('analytics_events')
        .select('dish_id, event_type, created_at')
        .in('dish_id', dishIds)
        .gte('created_at', startDate.toISOString());

      // Process data per dish
      const analytics: DishAnalyticsData[] = restaurantDishes.map((rd, index) => {
        const dish = rd.dishes as unknown as { id: string; name: string; search_count: number } | null;
        if (!dish) {
          return null;
        }

        // Count clicks for this dish (from analytics events + stored clicks)
        const dishCurrentEvents = (currentEvents || []).filter(e => e.dish_id === rd.dish_id);
        const dishPreviousEvents = (previousEvents || []).filter(e => e.dish_id === rd.dish_id);
        
        const currentClicks = dishCurrentEvents.filter(e => e.event_type === 'click').length + (rd.clicks || 0);
        const previousClicks = dishPreviousEvents.filter(e => e.event_type === 'click').length;

        // Calculate trend
        let trend: 'up' | 'down' | 'stable' = 'stable';
        let trendPercentage = 0;
        if (previousClicks > 0) {
          const change = ((currentClicks - previousClicks) / previousClicks) * 100;
          trendPercentage = Math.round(change);
          trend = change > 5 ? 'up' : change < -5 ? 'down' : 'stable';
        } else if (currentClicks > 0) {
          trend = 'up';
          trendPercentage = 100;
        }

        // Group clicks by day
        const clicksByDay: { [date: string]: number } = {};
        dishCurrentEvents
          .filter(e => e.event_type === 'click')
          .forEach(e => {
            const date = e.created_at.split('T')[0];
            clicksByDay[date] = (clicksByDay[date] || 0) + 1;
          });

        // Fill in missing days
        const clicksByPeriod: { date: string; clicks: number }[] = [];
        for (let i = periodDays - 1; i >= 0; i--) {
          const date = new Date();
          date.setDate(date.getDate() - i);
          const dateStr = date.toISOString().split('T')[0];
          clicksByPeriod.push({
            date: dateStr,
            clicks: clicksByDay[dateStr] || 0
          });
        }

        // Get total search volume for this dish across all restaurants
        const totalDishClicks = (allDishEvents || []).filter(e => 
          e.dish_id === rd.dish_id && e.event_type === 'click'
        ).length;

        // Calculate conversion rate (clicks on this restaurant / total dish searches)
        const conversionRate = dish.search_count > 0 
          ? (currentClicks / dish.search_count) * 100 
          : 0;

        return {
          dishId: rd.dish_id,
          dishName: dish.name,
          totalClicks: currentClicks,
          searchVolume: dish.search_count || 0,
          trend,
          trendPercentage,
          clicksByPeriod,
          position: index + 1, // Simplified - in real app would calculate from search results
          conversionRate: Math.min(conversionRate, 100)
        };
      }).filter(Boolean) as DishAnalyticsData[];

      // Sort by total clicks
      analytics.sort((a, b) => b.totalClicks - a.totalClicks);

      // Generate insights
      const newInsights: DishInsight[] = [];

      // Top performing dish
      if (analytics.length > 0 && analytics[0].totalClicks > 0) {
        newInsights.push({
          type: 'strength',
          message: `Je wordt het meest gevonden op "${analytics[0].dishName}" met ${analytics[0].totalClicks} clicks`,
          dishName: analytics[0].dishName
        });
      }

      // Underperforming dishes (high search volume, low clicks)
      const underperformers = analytics.filter(d => 
        d.searchVolume > 50 && d.totalClicks < 5
      );
      if (underperformers.length > 0) {
        newInsights.push({
          type: 'opportunity',
          message: `"${underperformers[0].dishName}" heeft ${underperformers[0].searchVolume} zoekopdrachten maar weinig clicks - verbeter je content`,
          dishName: underperformers[0].dishName
        });
      }

      // Trending up
      const trending = analytics.filter(d => d.trend === 'up' && d.trendPercentage > 20);
      if (trending.length > 0) {
        newInsights.push({
          type: 'strength',
          message: `"${trending[0].dishName}" is trending met +${trending[0].trendPercentage}% deze periode`,
          dishName: trending[0].dishName
        });
      }

      // Declining dishes
      const declining = analytics.filter(d => d.trend === 'down' && d.trendPercentage < -20);
      if (declining.length > 0) {
        newInsights.push({
          type: 'warning',
          message: `"${declining[0].dishName}" verliest ${Math.abs(declining[0].trendPercentage)}% aan clicks - check je concurrentie`,
          dishName: declining[0].dishName
        });
      }

      // Missing popular dishes
      const { data: popularDishes } = await supabase
        .from('dishes')
        .select('id, name, search_count')
        .order('search_count', { ascending: false })
        .limit(10);

      if (popularDishes) {
        const missingPopular = popularDishes.filter(
          pd => !dishIds.includes(pd.id) && pd.search_count > 100
        );
        if (missingPopular.length > 0) {
          newInsights.push({
            type: 'opportunity',
            message: `"${missingPopular[0].name}" is populair (${missingPopular[0].search_count} zoekopdrachten) maar staat niet op je menu`,
            dishName: missingPopular[0].name
          });
        }
      }

      setDishAnalytics(analytics);
      setInsights(newInsights);
    } catch (error) {
      console.error('Error fetching dish analytics:', error);
    } finally {
      setLoading(false);
    }
  }, [restaurantId, period]);

  useEffect(() => {
    fetchDishAnalytics();
  }, [fetchDishAnalytics]);

  return {
    dishAnalytics,
    insights,
    loading,
    period,
    setPeriod,
    refetch: fetchDishAnalytics
  };
}
