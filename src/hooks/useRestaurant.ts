import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type Restaurant = Database['public']['Tables']['restaurants']['Row'];
type City = Database['public']['Tables']['cities']['Row'];
type Dish = Database['public']['Tables']['dishes']['Row'];
type Chain = Database['public']['Tables']['restaurant_chains']['Row'];

export interface RestaurantWithDetails extends Restaurant {
  city?: City;
  dishes?: Dish[];
  chain?: Chain;
  chainLocationsCount?: number;
}

export function useRestaurant(slug: string | undefined) {
  const [restaurant, setRestaurant] = useState<RestaurantWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (slug) {
      fetchRestaurant();
    }
  }, [slug]);

  const fetchRestaurant = async () => {
    if (!slug) return;

    setLoading(true);
    setError(null);

    // Fetch restaurant by slug
    const { data: restaurantData, error: restaurantError } = await supabase
      .from('restaurants')
      .select('*')
      .eq('slug', slug)
      .eq('is_active', true)
      .maybeSingle();

    if (restaurantError) {
      console.error('Error fetching restaurant:', restaurantError);
      setError('Restaurant niet gevonden');
      setLoading(false);
      return;
    }

    if (!restaurantData) {
      setError('Restaurant niet gevonden');
      setLoading(false);
      return;
    }

    const chainId = restaurantData.chain_id;

    // Fetch city + restaurant dishes + chain info (parallel)
    const [cityRes, restaurantDishesRes, chainRes, chainCountRes] = await Promise.all([
      supabase
        .from('cities')
        .select('*')
        .eq('id', restaurantData.city_id)
        .maybeSingle(),
      supabase
        .from('restaurant_dishes')
        .select('dish_id')
        .eq('restaurant_id', restaurantData.id),
      chainId
        ? supabase.from('restaurant_chains').select('*').eq('id', chainId).maybeSingle()
        : Promise.resolve({ data: null as Chain | null }),
      chainId
        ? supabase
            .from('restaurants')
            .select('id', { count: 'exact', head: true })
            .eq('is_active', true)
            .eq('chain_id', chainId)
        : Promise.resolve({ count: null as number | null }),
    ]);

    // Fetch dishes linked to this restaurant
    const restaurantDishes = restaurantDishesRes.data || [];

    let dishes: Dish[] = [];
    if (restaurantDishes.length > 0) {
      const dishIds = restaurantDishes.map(rd => rd.dish_id);
      const { data: dishData } = await supabase
        .from('dishes')
        .select('*')
        .in('id', dishIds);
      dishes = dishData || [];
    }

    setRestaurant({
      ...restaurantData,
      city: cityRes.data || undefined,
      dishes,
      chain: chainRes.data || undefined,
      chainLocationsCount: chainCountRes.count ?? undefined,
    });
    setLoading(false);
  };

  return { restaurant, loading, error, refetch: fetchRestaurant };
}
