import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export type DishStatus = 'suggested' | 'approved_by_admin' | 'verified_by_owner' | 'rejected';
export type DishSource = 'cuisine_rules' | 'website_hints' | 'user_review' | 'admin' | 'owner';

export interface RestaurantDish {
  id: string;
  restaurant_id: string;
  dish_id: string;
  status: DishStatus;
  source: DishSource;
  confidence_score: number;
  clicks: number;
  created_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  verified_by: string | null;
  verified_at: string | null;
  rejected_reason: string | null;
  created_at: string;
  updated_at: string;
  dish?: {
    id: string;
    name: string;
    name_en: string | null;
    slug: string;
    cuisine_tags: string[] | null;
  };
  restaurant?: {
    id: string;
    name: string;
  };
}

export interface Dish {
  id: string;
  name: string;
  name_en: string | null;
  slug: string;
  cuisine_tags: string[] | null;
  synonyms: string[] | null;
  is_active: boolean;
}

interface UseRestaurantDishesOptions {
  restaurantId?: string;
  status?: DishStatus | DishStatus[];
  includeAll?: boolean; // For admin view
}

export function useRestaurantDishes(options: UseRestaurantDishesOptions = {}) {
  const { restaurantId, status, includeAll = false } = options;
  const { user } = useAuth();
  const [dishes, setDishes] = useState<RestaurantDish[]>([]);
  const [availableDishes, setAvailableDishes] = useState<Dish[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDishes = async () => {
    try {
      let query = supabase
        .from('restaurant_dishes')
        .select(`
          *,
          dish:dishes(id, name, name_en, slug, cuisine_tags),
          restaurant:restaurants(id, name)
        `);

      if (restaurantId) {
        query = query.eq('restaurant_id', restaurantId);
      }

      if (status) {
        if (Array.isArray(status)) {
          query = query.in('status', status);
        } else {
          query = query.eq('status', status);
        }
      }

      query = query.order('created_at', { ascending: false });

      const { data, error } = await query;

      if (error) throw error;
      setDishes((data || []) as RestaurantDish[]);
    } catch (err) {
      console.error('Error fetching restaurant dishes:', err);
      toast.error('Kon gerechten niet laden');
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableDishes = async () => {
    const { data, error } = await supabase
      .from('dishes')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (!error && data) {
      setAvailableDishes(data as Dish[]);
    }
  };

  useEffect(() => {
    fetchDishes();
    fetchAvailableDishes();
  }, [restaurantId, JSON.stringify(status)]);

  const suggestDish = async (
    restaurantId: string,
    dishId: string,
    confidence: number = 0.7,
    source: DishSource = 'admin'
  ) => {
    if (!user) return null;

    const { data, error } = await supabase
      .from('restaurant_dishes')
      .insert({
        restaurant_id: restaurantId,
        dish_id: dishId,
        status: 'suggested',
        source,
        confidence_score: confidence,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        toast.error('Dit gerecht is al toegevoegd aan dit restaurant');
      } else {
        toast.error('Kon gerecht niet toevoegen');
      }
      return null;
    }

    toast.success('Gerecht voorgesteld');
    await fetchDishes();
    return data;
  };

  const approveDish = async (id: string) => {
    if (!user) return false;

    const { error } = await supabase
      .from('restaurant_dishes')
      .update({
        status: 'approved_by_admin',
        approved_by: user.id,
        approved_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) {
      toast.error('Kon gerecht niet goedkeuren');
      return false;
    }

    toast.success('Gerecht goedgekeurd');
    await fetchDishes();
    return true;
  };

  const verifyDish = async (id: string) => {
    if (!user) return false;

    const { error } = await supabase
      .from('restaurant_dishes')
      .update({
        status: 'verified_by_owner',
        verified_by: user.id,
        verified_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) {
      toast.error('Kon gerecht niet bevestigen');
      return false;
    }

    toast.success('Gerecht bevestigd');
    await fetchDishes();
    return true;
  };

  const rejectDish = async (id: string, reason: string) => {
    if (!user) return false;

    const { error } = await supabase
      .from('restaurant_dishes')
      .update({
        status: 'rejected',
        rejected_reason: reason,
      })
      .eq('id', id);

    if (error) {
      toast.error('Kon gerecht niet afwijzen');
      return false;
    }

    toast.success('Gerecht afgewezen');
    await fetchDishes();
    return true;
  };

  const deleteDish = async (id: string) => {
    const { error } = await supabase
      .from('restaurant_dishes')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error('Kon gerecht niet verwijderen');
      return false;
    }

    toast.success('Gerecht verwijderd');
    await fetchDishes();
    return true;
  };

  const bulkApprove = async (minConfidence: number = 0.85) => {
    if (!user) return 0;

    const toApprove = dishes.filter(
      (d) => d.status === 'suggested' && d.confidence_score >= minConfidence
    );

    let count = 0;
    for (const dish of toApprove) {
      const success = await approveDish(dish.id);
      if (success) count++;
    }

    return count;
  };

  const bulkReject = async (maxConfidence: number = 0.4, reason: string = 'Lage confidence score') => {
    if (!user) return 0;

    const toReject = dishes.filter(
      (d) => d.status === 'suggested' && d.confidence_score <= maxConfidence
    );

    let count = 0;
    for (const dish of toReject) {
      const success = await rejectDish(dish.id, reason);
      if (success) count++;
    }

    return count;
  };

  return {
    dishes,
    availableDishes,
    loading,
    refetch: fetchDishes,
    suggestDish,
    approveDish,
    verifyDish,
    rejectDish,
    deleteDish,
    bulkApprove,
    bulkReject,
  };
}
