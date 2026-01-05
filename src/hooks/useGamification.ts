import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface Badge {
  id: string;
  badge_type: string;
  badge_level: number;
  progress: number;
  target: number;
  earned_at: string | null;
}

interface UserStats {
  id: string;
  cuisines_tried: string[];
  cities_visited: string[];
  total_restaurants_visited: number;
  total_reviews_written: number;
  favorite_cuisine: string | null;
  favorite_price_level: number | null;
  streak_days: number;
  first_review_date: string | null;
}

interface Perk {
  id: string;
  perk_type: string;
  perk_code: string | null;
  discount_percent: number | null;
  valid_until: string | null;
  is_redeemed: boolean;
}

export function useGamification() {
  const { user } = useAuth();
  const [badges, setBadges] = useState<Badge[]>([]);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [perks, setPerks] = useState<Perk[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchGamificationData();
    } else {
      setBadges([]);
      setStats(null);
      setPerks([]);
      setLoading(false);
    }
  }, [user]);

  const fetchGamificationData = async () => {
    if (!user) return;
    
    setLoading(true);

    const [badgesRes, statsRes, perksRes] = await Promise.all([
      supabase.from('user_badges').select('*').eq('user_id', user.id),
      supabase.from('user_stats').select('*').eq('user_id', user.id).maybeSingle(),
      supabase.from('user_perks').select('*').eq('user_id', user.id).eq('is_redeemed', false)
    ]);

    setBadges((badgesRes.data || []) as Badge[]);
    setStats(statsRes.data as UserStats | null);
    setPerks((perksRes.data || []) as Perk[]);
    setLoading(false);
  };

  const getNextBadges = () => {
    return badges.filter(b => !b.earned_at).sort((a, b) => {
      const progressA = a.progress / a.target;
      const progressB = b.progress / b.target;
      return progressB - progressA;
    });
  };

  const getEarnedBadges = () => {
    return badges.filter(b => b.earned_at);
  };

  return {
    badges,
    stats,
    perks,
    loading,
    getNextBadges,
    getEarnedBadges,
    refetch: fetchGamificationData
  };
}
