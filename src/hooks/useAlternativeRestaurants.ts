import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { calculateDistance } from '@/hooks/useGeolocation';

type Restaurant = Database['public']['Tables']['restaurants']['Row'];

interface AlternativeRestaurant extends Restaurant {
  matchScore: number;
  matchReasons: string[];
  cityName?: string;
  isSponsoredPick?: boolean;
}

export type RoutingReason = 'closed' | 'busy' | 'fully_booked' | 'low_availability' | 'similar';

interface UseAlternativeRestaurantsReturn {
  alternatives: AlternativeRestaurant[];
  loading: boolean;
  error: string | null;
  findAlternatives: (params: {
    sourceRestaurantId: string;
    reason: RoutingReason;
    /** City of the restaurant the guest is looking at: alternatives stay in that city. */
    cityId?: string | null;
    dishIds?: string[];
    priceLevel?: number;
    cuisines?: string[];
    ambienceTags?: string[];
    userLat?: number;
    userLng?: number;
  }) => Promise<void>;
  trackClick: (sourceId: string, targetId: string, dishId?: string, reason?: RoutingReason) => Promise<string | null>;
  trackConversion: (eventId: string) => Promise<void>;
}

export function useAlternativeRestaurants(): UseAlternativeRestaurantsReturn {
  const [alternatives, setAlternatives] = useState<AlternativeRestaurant[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const findAlternatives = useCallback(async ({
    sourceRestaurantId,
    reason,
    cityId,
    dishIds = [],
    priceLevel,
    cuisines = [],
    ambienceTags = [],
    userLat,
    userLng,
  }: {
    sourceRestaurantId: string;
    reason: RoutingReason;
    /** City of the restaurant the guest is looking at: alternatives stay in that city. */
    cityId?: string | null;
    dishIds?: string[];
    priceLevel?: number;
    cuisines?: string[];
    ambienceTags?: string[];
    userLat?: number;
    userLng?: number;
  }) => {
    setLoading(true);
    setError(null);

    try {
      // 1. Paid routing (Vraag doorsturen): restaurants that bought a slot for one of these dishes in
      //    this city. When there are any, only they are shown (at most 3, marked as sponsored).
      if (cityId && dishIds.length > 0) {
        const { data: sponsors } = await supabase.rpc('routing_sponsors' as never, { p_city: cityId, p_dish_ids: dishIds } as never);
        const sponsorIds = [...new Set(((sponsors ?? []) as { restaurant_id: string }[]).map(s => s.restaurant_id))]
          .filter(id => id !== sourceRestaurantId);
        if (sponsorIds.length > 0) {
          const { data: paid } = await supabase
            .from('restaurants')
            .select('*, cities!inner(name)')
            .eq('is_active', true)
            .in('id', sponsorIds);
          if (paid && paid.length > 0) {
            const scored = await scoreRestaurants(paid, dishIds, priceLevel, cuisines, ambienceTags, userLat, userLng, true);
            setAlternatives(scored.slice(0, 3).map(r => ({ ...r, isSponsoredPick: true })));
            return;
          }
        }
      }

      // 2. No paying restaurant: the best free matches in the same city.
      let query = supabase
        .from('restaurants')
        .select('*, cities!inner(name)')
        .eq('is_active', true)
        .neq('id', sourceRestaurantId)
        .limit(40);
      if (cityId) query = query.eq('city_id', cityId);
      const { data: candidates, error: fetchError } = await query;
      if (fetchError) throw fetchError;
      if (!candidates || candidates.length === 0) {
        setAlternatives([]);
        return;
      }
      const scored = await scoreRestaurants(candidates, dishIds, priceLevel, cuisines, ambienceTags, userLat, userLng);
      setAlternatives(scored.slice(0, 5));
    } catch (err) {
      console.error('Error finding alternatives:', err);
      setError('Kon geen alternatieven vinden');
    } finally {
      setLoading(false);
    }
  }, []);

  const scoreRestaurants = async (
    restaurants: any[],
    dishIds: string[],
    priceLevel: number | undefined,
    cuisines: string[],
    ambienceTags: string[],
    userLat?: number,
    userLng?: number,
    keepAll = false
  ): Promise<AlternativeRestaurant[]> => {
    // Get dish matches if we have dish IDs
    let dishMatches: Record<string, string[]> = {};
    
    if (dishIds.length > 0) {
      const { data: restaurantDishes } = await supabase
        .from('restaurant_dishes')
        .select('restaurant_id, dish_id')
        .in('dish_id', dishIds);

      if (restaurantDishes) {
        restaurantDishes.forEach(rd => {
          if (!dishMatches[rd.restaurant_id]) {
            dishMatches[rd.restaurant_id] = [];
          }
          dishMatches[rd.restaurant_id].push(rd.dish_id);
        });
      }
    }

    const scored = restaurants.map(restaurant => {
      let score = 0;
      const matchReasons: string[] = [];
      const cityData = restaurant.cities as { name: string } | null;

      // Dish match (40 points max)
      const matchedDishes = dishMatches[restaurant.id] || [];
      if (matchedDishes.length > 0) {
        score += Math.min(matchedDishes.length * 20, 40);
        matchReasons.push('alternatives.sameDish');
      }

      // Price level match (20 points)
      if (priceLevel !== undefined) {
        const priceDiff = Math.abs(restaurant.price_level - priceLevel);
        if (priceDiff === 0) {
          score += 20;
          matchReasons.push('alternatives.samePrice');
        } else if (priceDiff === 1) {
          score += 10;
          matchReasons.push('alternatives.similarPrice');
        }
      }

      // Cuisine match (20 points max)
      const restaurantCuisines = restaurant.cuisines || [];
      const cuisineMatches = cuisines.filter(c => restaurantCuisines.includes(c));
      if (cuisineMatches.length > 0) {
        score += Math.min(cuisineMatches.length * 10, 20);
        matchReasons.push('alternatives.similarCuisine');
      }

      // Ambience match (10 points max)
      const restaurantAmbience = restaurant.ambience_tags || [];
      const ambienceMatches = ambienceTags.filter(t => restaurantAmbience.includes(t));
      if (ambienceMatches.length > 0) {
        score += Math.min(ambienceMatches.length * 5, 10);
        matchReasons.push('alternatives.similarAmbience');
      }

      // Proximity (10 points max)
      if (userLat && userLng && restaurant.geo_lat && restaurant.geo_lng) {
        const distance = calculateDistance(
          userLat,
          userLng,
          Number(restaurant.geo_lat),
          Number(restaurant.geo_lng)
        );
        if (distance <= 2) {
          score += 10;
          matchReasons.push('alternatives.nearby');
        } else if (distance <= 5) {
          score += 5;
          matchReasons.push('alternatives.inArea');
        }
      }

      // Rating bonus (5 points max)
      if (restaurant.rating >= 4.5) {
        score += 5;
      } else if (restaurant.rating >= 4.0) {
        score += 3;
      }

      // Check if restaurant is currently open
      const isOpen = checkIfOpen(restaurant.opening_hours);
      if (!isOpen) {
        score -= 20; // Penalize closed restaurants
      } else {
        matchReasons.push('alternatives.openNow');
      }

      return {
        ...restaurant,
        matchScore: score,
        matchReasons,
        cityName: cityData?.name,
      };
    });

    // Sort by score descending
    // Paid slots are always shown (they bought the dish in this city); free ones need a real match.
    return scored
      .filter(r => keepAll || r.matchScore > 0)
      .sort((a, b) => b.matchScore - a.matchScore);
  };

  const checkIfOpen = (openingHours: any): boolean => {
    if (!openingHours) return true; // Assume open if no hours set
    const now = new Date();
    const day = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][now.getDay()];
    const hours = openingHours[day];
    if (!hours || hours === 'closed') return false;
    return true;
  };

  const trackClick = useCallback(async (
    sourceId: string,
    targetId: string,
    dishId?: string,
    reason: RoutingReason = 'closed'
  ): Promise<string | null> => {
    try {
      const alternative = alternatives.find(a => a.id === targetId);
      const { data, error } = await supabase
        .from('demand_routing_events')
        .insert({
          source_restaurant_id: sourceId,
          target_restaurant_id: targetId,
          dish_id: dishId || null,
          routing_reason: reason,
          was_clicked: true,
          match_score: alternative?.matchScore || 0,
        })
        .select('id')
        .single();

      if (error) throw error;
      return data?.id || null;
    } catch (err) {
      console.error('Error tracking routing click:', err);
      return null;
    }
  }, [alternatives]);

  const trackConversion = useCallback(async (eventId: string) => {
    try {
      await supabase
        .from('demand_routing_events')
        .update({ was_converted: true })
        .eq('id', eventId);
    } catch (err) {
      console.error('Error tracking routing conversion:', err);
    }
  }, []);

  return {
    alternatives,
    loading,
    error,
    findAlternatives,
    trackClick,
    trackConversion,
  };
}
