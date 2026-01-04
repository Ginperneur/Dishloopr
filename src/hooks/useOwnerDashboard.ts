import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Database } from '@/integrations/supabase/types';

type Restaurant = Database['public']['Tables']['restaurants']['Row'];
type Review = Database['public']['Tables']['reviews']['Row'];

export interface OwnerAnalytics {
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
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null);
  const [reviews, setReviews] = useState<ReviewWithProfile[]>([]);
  const [analytics, setAnalytics] = useState<OwnerAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchOwnerRestaurants();
    }
  }, [user]);

  useEffect(() => {
    if (selectedRestaurant) {
      fetchRestaurantData(selectedRestaurant.id);
    }
  }, [selectedRestaurant]);

  const fetchOwnerRestaurants = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('restaurants')
      .select('*')
      .eq('claimed_by_owner_id', user.id);

    if (error) {
      console.error('Error fetching owner restaurants:', error);
    } else if (data && data.length > 0) {
      setRestaurants(data);
      setSelectedRestaurant(data[0]);
    }
    setLoading(false);
  };

  const fetchRestaurantData = async (restaurantId: string) => {
    // Fetch reviews
    const { data: reviewData } = await supabase
      .from('reviews')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('created_at', { ascending: false });

    if (reviewData) {
      // Fetch profiles for reviews
      const userIds = [...new Set(reviewData.map(r => r.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name')
        .in('id', userIds);
      
      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
      
      setReviews(reviewData.map(review => ({
        ...review,
        profile: profileMap.get(review.user_id) as { name: string | null } | undefined
      })));
    }

    // Fetch analytics
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: analyticsData } = await supabase
      .from('analytics_events')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .gte('created_at', thirtyDaysAgo.toISOString());

    if (analyticsData) {
      const viewsByDay: { [date: string]: number } = {};
      let totalViews = 0;
      let totalClicks = 0;
      let websiteClicks = 0;
      let phoneClicks = 0;
      let reservationClicks = 0;

      analyticsData.forEach(event => {
        const date = event.created_at.split('T')[0];
        
        if (event.event_type === 'view') {
          totalViews++;
          viewsByDay[date] = (viewsByDay[date] || 0) + 1;
        } else if (event.event_type === 'click') {
          totalClicks++;
          const metadata = event.metadata as { type?: string } | null;
          if (metadata?.type === 'website') websiteClicks++;
          if (metadata?.type === 'phone') phoneClicks++;
          if (metadata?.type === 'reservation') reservationClicks++;
        }
      });

      setAnalytics({
        totalViews,
        totalClicks,
        websiteClicks,
        phoneClicks,
        reservationClicks,
        viewsByDay: Object.entries(viewsByDay)
          .map(([date, count]) => ({ date, count }))
          .sort((a, b) => a.date.localeCompare(b.date))
      });
    }
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
    respondToReview
  };
}
