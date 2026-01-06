import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type Restaurant = Database['public']['Tables']['restaurants']['Row'];

export function useFeaturedRestaurants(limit = 3) {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFeatured = async () => {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('restaurants')
        .select('*')
        .eq('is_active', true)
        .or('is_featured.eq.true,is_top_listing.eq.true')
        .order('is_top_listing', { ascending: false })
        .order('rating', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Error fetching featured restaurants:', error);
      } else {
        setRestaurants(data || []);
      }
      
      setLoading(false);
    };

    fetchFeatured();
  }, [limit]);

  return { restaurants, loading };
}
