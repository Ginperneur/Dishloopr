import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface NeighborhoodCompetitor {
  id: string;
  name: string;
  slug: string;
  rating: number;
  review_count: number;
  cuisines: string[];
  price_level: number;
}

export interface PeakHourData {
  hour: number;
  views: number;
  clicks: number;
}

export interface PeakDayData {
  day: number; // 0=Sun, 6=Sat
  dayLabel: string;
  views: number;
  clicks: number;
}

export interface PromotionROIData {
  type: 'featured' | 'sponsored';
  label: string;
  totalSpent: number;
  totalViews: number;
  totalClicks: number;
  ctr: number;
  costPerClick: number;
  status: string;
  startDate: string;
  endDate: string;
}

const DAY_LABELS = ['Zo', 'Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za'];

export function useMarketInsights(restaurantId?: string, cityId?: string, cuisines?: string[]) {
  const [competitors, setCompetitors] = useState<NeighborhoodCompetitor[]>([]);
  const [peakHours, setPeakHours] = useState<PeakHourData[]>([]);
  const [peakDays, setPeakDays] = useState<PeakDayData[]>([]);
  const [promotionROI, setPromotionROI] = useState<PromotionROIData[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCompetitors = useCallback(async () => {
    if (!cityId || !restaurantId) return;

    const { data } = await supabase
      .from('restaurants')
      .select('id, name, slug, rating, review_count, cuisines, price_level')
      .eq('city_id', cityId)
      .eq('is_active', true)
      .neq('id', restaurantId)
      .order('rating', { ascending: false })
      .limit(20);

    if (data) {
      // Sort by cuisine overlap then rating
      const withOverlap = data.map(r => {
        const overlap = (r.cuisines || []).filter((c: string) => (cuisines || []).includes(c)).length;
        return { ...r, overlap };
      });
      withOverlap.sort((a, b) => b.overlap - a.overlap || b.rating - a.rating);
      setCompetitors(withOverlap.slice(0, 10) as NeighborhoodCompetitor[]);
    }
  }, [restaurantId, cityId, cuisines]);

  const fetchPeakHours = useCallback(async () => {
    if (!restaurantId) return;

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data } = await supabase
      .from('analytics_events')
      .select('event_type, created_at')
      .eq('restaurant_id', restaurantId)
      .in('event_type', ['view', 'click'])
      .gte('created_at', thirtyDaysAgo.toISOString());

    if (data) {
      // Group by hour
      const hourMap: Record<number, { views: number; clicks: number }> = {};
      const dayMap: Record<number, { views: number; clicks: number }> = {};

      for (let h = 0; h < 24; h++) hourMap[h] = { views: 0, clicks: 0 };
      for (let d = 0; d < 7; d++) dayMap[d] = { views: 0, clicks: 0 };

      data.forEach(event => {
        const date = new Date(event.created_at);
        const hour = date.getHours();
        const day = date.getDay();
        const isView = event.event_type === 'view';

        if (isView) {
          hourMap[hour].views++;
          dayMap[day].views++;
        } else {
          hourMap[hour].clicks++;
          dayMap[day].clicks++;
        }
      });

      setPeakHours(
        Object.entries(hourMap).map(([h, d]) => ({ hour: Number(h), ...d }))
      );
      setPeakDays(
        Object.entries(dayMap).map(([d, v]) => ({
          day: Number(d),
          dayLabel: DAY_LABELS[Number(d)],
          ...v,
        }))
      );
    }
  }, [restaurantId]);

  const fetchPromotionROI = useCallback(async () => {
    if (!restaurantId) return;
    const results: PromotionROIData[] = [];

    // Featured subscriptions
    const { data: featured } = await supabase
      .from('featured_subscriptions')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('created_at', { ascending: false })
      .limit(5);

    if (featured) {
      featured.forEach(sub => {
        const months = sub.consecutive_months || 1;
        const totalSpent = (sub.total_monthly_price || 0) * months;
        const ctr = sub.total_views > 0 ? (sub.total_clicks / sub.total_views) * 100 : 0;
        const costPerClick = sub.total_clicks > 0 ? totalSpent / sub.total_clicks : 0;

        results.push({
          type: 'featured',
          label: 'Uitgelichte Plek',
          totalSpent,
          totalViews: sub.total_views || 0,
          totalClicks: sub.total_clicks || 0,
          ctr: Math.round(ctr * 10) / 10,
          costPerClick: Math.round(costPerClick * 100) / 100,
          status: sub.status,
          startDate: sub.starts_at,
          endDate: sub.expires_at,
        });
      });
    }

    // Sponsored purchases
    const { data: sponsored } = await supabase
      .from('sponsored_purchases')
      .select('*, product:product_id(dish_id(name))')
      .eq('restaurant_id', restaurantId)
      .order('created_at', { ascending: false })
      .limit(5);

    if (sponsored && sponsored.length > 0) {
      // Approximate ROI: count restaurant views/clicks within the sponsored window
      const sponsoredWithStats = await Promise.all(
        sponsored.map(async (purchase: any) => {
          const dishName = purchase.product?.dish_id?.name || 'Gerecht';
          const startsAt = purchase.starts_at || purchase.created_at;
          const expiresAt = purchase.expires_at || new Date().toISOString();

          const [viewsRes, clicksRes] = await Promise.all([
            supabase
              .from('analytics_events')
              .select('id', { count: 'exact', head: true })
              .eq('restaurant_id', restaurantId)
              .eq('event_type', 'view')
              .gte('created_at', startsAt)
              .lte('created_at', expiresAt),
            supabase
              .from('analytics_events')
              .select('id', { count: 'exact', head: true })
              .eq('restaurant_id', restaurantId)
              .eq('event_type', 'click')
              .gte('created_at', startsAt)
              .lte('created_at', expiresAt),
          ]);

          const totalViews = viewsRes.count || 0;
          const totalClicks = clicksRes.count || 0;
          const ctr = totalViews > 0 ? (totalClicks / totalViews) * 100 : 0;
          const totalSpent = purchase.price_paid || 0;
          const costPerClick = totalClicks > 0 ? totalSpent / totalClicks : 0;

          return {
            type: 'sponsored' as const,
            label: `Gesponsord: ${dishName}`,
            totalSpent,
            totalViews,
            totalClicks,
            ctr: Math.round(ctr * 10) / 10,
            costPerClick: Math.round(costPerClick * 100) / 100,
            status: purchase.is_active ? 'active' : 'expired',
            startDate: purchase.starts_at,
            endDate: purchase.expires_at,
          };
        })
      );
      results.push(...sponsoredWithStats);
    }

    setPromotionROI(results);
  }, [restaurantId]);

  useEffect(() => {
    if (!restaurantId) return;
    setLoading(true);
    Promise.all([fetchCompetitors(), fetchPeakHours(), fetchPromotionROI()])
      .finally(() => setLoading(false));
  }, [restaurantId, fetchCompetitors, fetchPeakHours, fetchPromotionROI]);

  return { competitors, peakHours, peakDays, promotionROI, loading };
}
