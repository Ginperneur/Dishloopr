import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface DishRating {
  id: string;
  dishId: string;
  dishName: string;
  rating: number;
}

export interface TagConfirmation {
  tag: string;
  tagType: string;
  isConfirmed: boolean;
}

export interface RestaurantDishScore {
  dish_id: string;
  dish_name: string;
  review_count: number;
  weighted_rating: number;
  simple_rating: number;
}

export interface RestaurantTagScore {
  tag: string;
  tag_type: string;
  confirmations: number;
  disputes: number;
  confidence_score: number;
}

export function useDishRatings(restaurantId: string) {
  const { user } = useAuth();
  const [dishScores, setDishScores] = useState<RestaurantDishScore[]>([]);
  const [tagScores, setTagScores] = useState<RestaurantTagScore[]>([]);
  const [availableDishes, setAvailableDishes] = useState<{ id: string; name: string }[]>([]);
  const [userTagConfirmations, setUserTagConfirmations] = useState<TagConfirmation[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDishScores = useCallback(async () => {
    if (!restaurantId) return;

    // Fetch dish scores from view
    const { data: scores } = await supabase
      .from('restaurant_dish_scores')
      .select('*')
      .eq('restaurant_id', restaurantId);

    if (scores) {
      setDishScores(scores);
    }

    // Fetch available dishes for this restaurant
    const { data: dishes } = await supabase
      .from('restaurant_dishes')
      .select('dish_id, dishes:dish_id (id, name)')
      .eq('restaurant_id', restaurantId);

    if (dishes) {
      setAvailableDishes(
        dishes
          .filter(d => d.dishes)
          .map(d => ({
            id: (d.dishes as unknown as { id: string; name: string }).id,
            name: (d.dishes as unknown as { id: string; name: string }).name
          }))
      );
    }
  }, [restaurantId]);

  const fetchTagScores = useCallback(async () => {
    if (!restaurantId) return;

    const { data: scores } = await supabase
      .from('restaurant_tag_scores')
      .select('*')
      .eq('restaurant_id', restaurantId);

    if (scores) {
      setTagScores(scores);
    }

    // Fetch user's existing confirmations
    if (user) {
      const { data: confirmations } = await supabase
        .from('tag_confirmations')
        .select('tag, tag_type, is_confirmed')
        .eq('restaurant_id', restaurantId)
        .eq('user_id', user.id);

      if (confirmations) {
        setUserTagConfirmations(
          confirmations.map(c => ({
            tag: c.tag,
            tagType: c.tag_type,
            isConfirmed: c.is_confirmed
          }))
        );
      }
    }
  }, [restaurantId, user]);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      await Promise.all([fetchDishScores(), fetchTagScores()]);
      setLoading(false);
    };
    fetchAll();
  }, [fetchDishScores, fetchTagScores]);

  const submitDishRatings = async (
    reviewId: string,
    ratings: { dishId: string; rating: number }[]
  ) => {
    const inserts = ratings.map(r => ({
      review_id: reviewId,
      dish_id: r.dishId,
      rating: r.rating
    }));

    const { error } = await supabase
      .from('dish_ratings')
      .insert(inserts);

    if (error) {
      console.error('Error submitting dish ratings:', error);
      return false;
    }

    await fetchDishScores();
    return true;
  };

  const confirmTag = async (tag: string, tagType: string, isConfirmed: boolean) => {
    if (!user) return false;

    const { error } = await supabase
      .from('tag_confirmations')
      .upsert({
        restaurant_id: restaurantId,
        tag,
        tag_type: tagType,
        user_id: user.id,
        is_confirmed: isConfirmed
      }, {
        onConflict: 'restaurant_id,tag,tag_type,user_id'
      });

    if (error) {
      console.error('Error confirming tag:', error);
      return false;
    }

    await fetchTagScores();
    return true;
  };

  return {
    dishScores,
    tagScores,
    availableDishes,
    userTagConfirmations,
    loading,
    submitDishRatings,
    confirmTag,
    refetch: () => Promise.all([fetchDishScores(), fetchTagScores()])
  };
}
