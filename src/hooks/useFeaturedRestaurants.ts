import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type Restaurant = Database['public']['Tables']['restaurants']['Row'];

export function useFeaturedRestaurants(defaultLimit = 3) {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [limit, setLimit] = useState(defaultLimit);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const { data } = await supabase
          .from('app_settings')
          .select('value')
          .eq('key', 'featured_restaurants_count')
          .single();
        
        if (data?.value) {
          const configuredLimit = parseInt(data.value, 10);
          if (!isNaN(configuredLimit) && configuredLimit > 0) {
            setLimit(configuredLimit);
          }
        }
      } catch (error) {
        // Use default if setting not found
        console.log('Using default featured restaurants count');
      }
    };

    fetchSettings();
  }, []);

  useEffect(() => {
    const fetchFeatured = async () => {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('restaurants')
        .select('*')
        .eq('is_active', true)
        .not('images', 'is', null)
        .not('images', 'eq', '{}')
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
