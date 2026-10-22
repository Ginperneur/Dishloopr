import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useAdminCheck } from '@/hooks/useAdminCheck';
import { summarizeMetrics } from '@/lib/metricRules';
import type { Database } from '@/integrations/supabase/types';

type Restaurant = Database['public']['Tables']['restaurants']['Row'];
type Review = Database['public']['Tables']['reviews']['Row'];

export interface OwnerAnalytics {
  impressions: number;
  routeClicks: number;
  topDishes: { dish: string; count: number }[];
  totalViews: number;
  totalClicks: number;
  websiteClicks: number;
  phoneClicks: number;
  reservationClicks: number;
  viewsByDay: { date: string; count: number }[];
}

export interface ReviewWithProfile extends Review {
  profile?: { name: string | null };
}

export function useOwnerDashboard() {
  const { user } = useAuth();
  const { isAdmin } = useAdminCheck();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null);
  const [reviews, setReviews] = useState<ReviewWithProfile[]>([]);
  const [analytics, setAnalytics] = useState<OwnerAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [cityName, setCityName] = useState<string>('');
  const selectedId = useRef<string>();
  selectedId.current = selectedRestaurant?.id;

  useEffect(() => {
    if (user) {
      fetchOwnerRestaurants();
    }
  }, [user, isAdmin]);

  useEffect(() => {
    if (selectedRestaurant) {
      setAnalytics(null);
      fetchRestaurantData(selectedRestaurant.id);
      fetchCityName(selectedRestaurant.city_id);
    }
  }, [selectedRestaurant]);

  const fetchCityName = async (cityId: string) => {
    const { data } = await supabase
      .from('cities')
      .select('name')
      .eq('id', cityId)
      .single();
    setCityName(data?.name || '');
  };

  const fetchOwnerRestaurants = async () => {
    if (!user) return;

    // Admin can see all restaurants
    if (isAdmin) {
      // Paginate to bypass the 1000 row PostgREST limit (admins may manage 1000+ restaurants).
      const pageSize = 300;
      let from = 0;
      const all: Restaurant[] = [];
      while (true) {
        const { data: batch } = await supabase
          .from('restaurants')
          .select('*')
          .order('name')
          .range(from, from + pageSize - 1);
        if (!batch || batch.length === 0) break;
        all.push(...batch);
        if (batch.length < pageSize) break;
        from += pageSize;
      }
      if (all.length > 0) {
        setRestaurants(all);
        setSelectedRestaurant(all[0]);
      }
      setLoading(false);
      return;
    }

    // Fetch via claimed_by_owner_id
    const { data: claimedData } = await supabase
      .from('restaurants')
      .select('*')
      .eq('claimed_by_owner_id', user.id);

    // Also fetch via restaurant_managers for users with manager roles
    const { data: managerData } = await supabase
      .from('restaurant_managers')
      .select('restaurant_id')
      .eq('user_id', user.id);

    let allRestaurants = claimedData || [];

    // Fetch restaurants from manager assignments that aren't already in the list
    if (managerData && managerData.length > 0) {
      const managerRestaurantIds = managerData
        .map(m => m.restaurant_id)
        .filter(id => !allRestaurants.some(r => r.id === id));

      if (managerRestaurantIds.length > 0) {
        const { data: extraRestaurants } = await supabase
          .from('restaurants')
          .select('*')
          .in('id', managerRestaurantIds);

        if (extraRestaurants) {
          allRestaurants = [...allRestaurants, ...extraRestaurants];
        }
      }
    }

    if (allRestaurants.length > 0) {
      setRestaurants(allRestaurants);
      setSelectedRestaurant(allRestaurants[0]);
    }
    setLoading(false);
  };

  const fetchRestaurantData = async (restaurantId: string) => {
    const statsPromise = Promise.resolve(supabase.rpc('restaurant_stats_summary', { p_restaurant_id: restaurantId, p_days: 30 }))
      .then(({ data, error }) => {
        if (selectedId.current === restaurantId) setAnalytics(!error && data ? summarizeMetrics(data) : null);
      }).catch(() => { if (selectedId.current === restaurantId) setAnalytics(null); });
    // Fetch reviews
    const { data: reviewData } = await supabase
      .from('reviews')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('created_at', { ascending: false });

    if (reviewData) {
      // Fetch profiles using public_profiles view (no RLS restrictions)
      const userIds = [...new Set(reviewData.map(r => r.user_id))];
      const { data: profiles } = await supabase
        .from('public_profiles')
        .select('id, name')
        .in('id', userIds);
      
      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
      
      setReviews(reviewData.map(review => ({
        ...review,
        profile: profileMap.get(review.user_id) as { name: string | null } | undefined
      })));
    }

    await statsPromise;

  };

  const respondToReview = async (reviewId: string, response: string) => {
    const { error } = await supabase
      .from('reviews')
      .update({ 
        owner_response: response,
        owner_response_at: new Date().toISOString()
      })
      .eq('id', reviewId);

    if (error) {
      console.error('Error responding to review:', error);
      return false;
    }

    // Refresh reviews
    if (selectedRestaurant) {
      fetchRestaurantData(selectedRestaurant.id);
    }
    return true;
  };

  return {
    restaurants,
    selectedRestaurant,
    setSelectedRestaurant,
    reviews,
    analytics,
    loading,
    respondToReview,
    cityName
  };
}
