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
        const rows = (data || []) as Restaurant[];
        // Batch-fetch signature dish per restaurant (strict: approved_by_admin only)
        const ids = rows.map(r => r.id);
        if (ids.length > 0) {
          const { data: rdBatch } = await supabase
            .from('restaurant_dishes')
            .select('restaurant_id, dish_id, price, is_signature, dish:dishes(name)')
            .eq('status', 'approved_by_admin')
            .in('restaurant_id', ids);
          const map = new Map<string, { name: string; price: number | null; is_signature: boolean }>();
          for (const rd of (rdBatch || []) as any[]) {
            const name = rd.dish?.name;
            if (!name) continue;
            const priceRaw = rd.price;
            const price = priceRaw !== null && priceRaw !== undefined && !isNaN(Number(priceRaw))
              ? Number(priceRaw) : null;
            const cand = { name, price, is_signature: !!rd.is_signature };
            const cur = map.get(rd.restaurant_id);
            if (!cur
                || (!cur.is_signature && cand.is_signature)
                || (cur.price === null && cand.price !== null && cur.is_signature === cand.is_signature)) {
              map.set(rd.restaurant_id, cand);
            }
          }
          for (const r of rows) {
            const m = map.get(r.id);
            if (m) (r as any).signatureDish = { name: m.name, price: m.price };
          }
        }
        setRestaurants(rows);
      }
      
      setLoading(false);
    };

    fetchFeatured();
  }, [limit]);

  return { restaurants, loading };
}
