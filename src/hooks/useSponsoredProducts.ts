import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type SponsoredProduct = Database['public']['Tables']['sponsored_products']['Row'] & {
  dishes: { name: string } | null;
  cities: { name: string } | null;
  available_slots?: number;
};

type SponsoredPurchase = Database['public']['Tables']['sponsored_purchases']['Row'] & {
  sponsored_products: {
    dishes: { name: string } | null;
    cities: { name: string } | null;
  } | null;
};

interface PriceBreakdown {
  price: number;
  breakdown: {
    dishName: string;
    cityName: string;
    durationDays: number;
    popularityTier: string;
    searchCount: number;
    restaurantCount: number;
  };
}

export function useSponsoredProducts() {
  const [products, setProducts] = useState<SponsoredProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    setLoading(true);
    
    const { data, error } = await supabase
      .from('sponsored_products')
      .select(`
        *,
        dishes(name),
        cities(name)
      `)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching sponsored products:', error);
      setProducts([]);
    } else {
      // Fetch available slots for each product
      const productsWithSlots = await Promise.all(
        (data || []).map(async (product) => {
          const { data: slots } = await supabase.rpc('get_available_slots', {
            p_product_id: product.id
          });
          return {
            ...product,
            available_slots: slots ?? product.max_slots
          };
        })
      );
      setProducts(productsWithSlots);
    }
    
    setLoading(false);
  };

  const calculatePrice = async (dishId: string, cityId: string, durationDays: number = 30): Promise<PriceBreakdown | null> => {
    try {
      const { data, error } = await supabase.functions.invoke('calculate-sponsored-price', {
        body: { dishId, cityId, durationDays }
      });

      if (error) throw error;
      return data;
    } catch (err) {
      console.error('Error calculating price:', err);
      return null;
    }
  };

  const purchaseSlot = async (productId: string, restaurantId: string, durationDays: number = 30): Promise<string | null> => {
    try {
      const { data, error } = await supabase.functions.invoke('create-sponsored-checkout', {
        body: { productId, restaurantId, durationDays }
      });

      if (error) throw error;
      return data?.url || null;
    } catch (err) {
      console.error('Error creating checkout:', err);
      return null;
    }
  };

  return {
    products,
    loading,
    fetchProducts,
    calculatePrice,
    purchaseSlot
  };
}

export function useSponsoredPurchases(restaurantId?: string) {
  const [purchases, setPurchases] = useState<SponsoredPurchase[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (restaurantId) {
      fetchPurchases();
    }
  }, [restaurantId]);

  const fetchPurchases = async () => {
    if (!restaurantId) return;
    
    setLoading(true);
    
    const { data, error } = await supabase
      .from('sponsored_purchases')
      .select(`
        *,
        sponsored_products(
          dishes(name),
          cities(name)
        )
      `)
      .eq('restaurant_id', restaurantId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching purchases:', error);
      setPurchases([]);
    } else {
      setPurchases(data || []);
    }
    
    setLoading(false);
  };

  return {
    purchases,
    loading,
    fetchPurchases
  };
}
