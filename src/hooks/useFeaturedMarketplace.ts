import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface MarketPricing {
  slot_id?: string;
  base_price: number;
  final_price: number;
  demand_multiplier: number;
  active_count: number;
  max_slots: number;
  occupancy_rate: number;
  restaurant_count?: number;
  price_reason: string;
}

interface AmbiancePricing {
  id: string;
  ambiance_tag: string;
  monthly_price: number;
  display_order: number;
}

interface CuisineSlotInfo {
  cuisine: string;
  slot_id?: string;
  base_price: number;
  final_price: number;
  active_count: number;
  max_slots: number;
  occupancy_rate: number;
  price_reason: string;
}

interface EligibilityResult {
  eligible: boolean;
  inCoolingOff: boolean;
  hasActiveSubscription: boolean;
  existingSubscription?: any;
  isFull: boolean;
  waitlistPosition?: number;
  activeCount: number;
  maxSlots: number;
  slotId: string;
}

interface FeaturedSubscription {
  id: string;
  slot_id: string;
  restaurant_id: string;
  monthly_price: number;
  ambiance_addon_price: number;
  total_monthly_price: number;
  included_ambiance: string | null;
  extra_ambiances: string[];
  starts_at: string;
  expires_at: string;
  consecutive_months: number;
  status: string;
  total_views: number;
  total_clicks: number;
  featured_slots?: {
    cuisine: string;
    cities?: { name: string };
  };
}

export function useFeaturedMarketplace() {
  const [ambiancePricing, setAmbiancePricing] = useState<AmbiancePricing[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchAmbiancePricing();
  }, []);

  const fetchAmbiancePricing = async () => {
    const { data, error } = await supabase
      .from('ambiance_pricing')
      .select('*')
      .eq('is_active', true)
      .order('display_order');

    if (!error && data) {
      setAmbiancePricing(data);
    }
  };

  const getMarketPrice = async (
    cityId: string,
    cuisine: string
  ): Promise<MarketPricing | null> => {
    try {
      const { data, error } = await supabase.rpc('calculate_featured_market_price', {
        p_city_id: cityId,
        p_cuisine: cuisine,
      } as any);

      if (error) throw error;
      return data as unknown as MarketPricing;
    } catch (err) {
      console.error('Error calculating market price:', err);
      return null;
    }
  };

  const getAvailableCuisines = async (cityId: string): Promise<CuisineSlotInfo[]> => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('featured-marketplace', {
        body: { cityId },
        headers: { 'Content-Type': 'application/json' },
      });

      // Parse the action from URL or use body
      const response = await supabase.functions.invoke('featured-marketplace?action=get-available-cuisines', {
        body: { cityId },
      });

      if (response.error) throw response.error;
      return response.data?.cuisines || [];
    } catch (err) {
      console.error('Error fetching cuisines:', err);
      return [];
    } finally {
      setLoading(false);
    }
  };

  const checkEligibility = async (
    restaurantId: string,
    cityId: string,
    cuisine: string
  ): Promise<EligibilityResult | null> => {
    try {
      const { data, error } = await supabase.functions.invoke(
        'featured-marketplace?action=check-eligibility',
        {
          body: { restaurantId, cityId, cuisine },
        }
      );

      if (error) throw error;
      return data as EligibilityResult;
    } catch (err) {
      console.error('Error checking eligibility:', err);
      return null;
    }
  };

  const joinWaitlist = async (
    restaurantId: string,
    slotId: string,
    selectedAmbiances: string[]
  ): Promise<{ success: boolean; position?: number }> => {
    try {
      const { data, error } = await supabase.functions.invoke(
        'featured-marketplace?action=join-waitlist',
        {
          body: { restaurantId, slotId, selectedAmbiances },
        }
      );

      if (error) throw error;
      return data;
    } catch (err) {
      console.error('Error joining waitlist:', err);
      return { success: false };
    }
  };

  const createCheckout = async (
    restaurantId: string,
    slotId: string,
    includedAmbiance: string | null,
    extraAmbiances: string[],
    durationMonths: number
  ): Promise<string | null> => {
    try {
      const { data, error } = await supabase.functions.invoke('create-featured-checkout', {
        body: {
          restaurantId,
          slotId,
          includedAmbiance,
          extraAmbiances,
          durationMonths,
        },
      });

      if (error) throw error;
      return data?.url || null;
    } catch (err) {
      console.error('Error creating checkout:', err);
      return null;
    }
  };

  const calculateTotalPrice = useCallback(
    (
      basePrice: number,
      extraAmbiances: string[],
      durationMonths: number
    ): { monthly: number; total: number; ambianceAddon: number } => {
      const ambianceAddon = extraAmbiances.reduce((sum, tag) => {
        const pricing = ambiancePricing.find((p) => p.ambiance_tag === tag);
        return sum + (pricing?.monthly_price || 0);
      }, 0);

      const monthly = basePrice + ambianceAddon;
      const total = monthly * durationMonths;

      return { monthly, total, ambianceAddon };
    },
    [ambiancePricing]
  );

  return {
    ambiancePricing,
    loading,
    getMarketPrice,
    getAvailableCuisines,
    checkEligibility,
    joinWaitlist,
    createCheckout,
    calculateTotalPrice,
  };
}

export function useFeaturedSubscriptions(restaurantId?: string) {
  const [subscriptions, setSubscriptions] = useState<FeaturedSubscription[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (restaurantId) {
      fetchSubscriptions();
    }
  }, [restaurantId]);

  const fetchSubscriptions = async () => {
    if (!restaurantId) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('featured_subscriptions')
        .select(`
          *,
          featured_slots(
            cuisine,
            cities(name)
          )
        `)
        .eq('restaurant_id', restaurantId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSubscriptions((data as any[]) || []);
    } catch (err) {
      console.error('Error fetching subscriptions:', err);
      setSubscriptions([]);
    } finally {
      setLoading(false);
    }
  };

  return {
    subscriptions,
    loading,
    refetch: fetchSubscriptions,
  };
}
