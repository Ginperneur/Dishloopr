import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface SurpriseRecommendation {
  dish: string;
  reason: string;
  description: string;
  pairingTip: string;
  discoveryAngle?: string;
  confidence?: number;
}

interface PersonalizedRecommendation {
  dish: string;
  reason: string;
  matchScore: number;
  matchBasis?: 'flavor' | 'cuisine' | 'trending' | 'seasonal';
}

interface SmartSuggestion {
  dish: string;
  connection: string;
  connectionType?: 'flavor' | 'crossover' | 'technique' | 'seasonal';
}

interface DishExploration {
  origin: string;
  funFact: string;
  bestWith: string;
  variations: string[];
  seasonalNote: string | null;
}

interface AIRecommendationsState {
  surprise: SurpriseRecommendation | null;
  personalized: PersonalizedRecommendation[];
  smartSuggestions: SmartSuggestion[];
  dishExploration: DishExploration | null;
  loading: boolean;
  error: string | null;
}

// Gather user context from local storage and profile
function getUserContext() {
  const recentSearches = JSON.parse(localStorage.getItem('recentSearches') || '[]').slice(0, 8);
  const lastCity = localStorage.getItem('lastSearchCity') || '';
  return { recentSearches, lastCity };
}

export function useAIRecommendations() {
  const [state, setState] = useState<AIRecommendationsState>({
    surprise: null,
    personalized: [],
    smartSuggestions: [],
    dishExploration: null,
    loading: false,
    error: null,
  });

  const getSurpriseRecommendation = useCallback(async (options?: {
    mood?: string;
    favorites?: string[];
    city?: string;
    priceLevel?: number;
    dietary?: string[];
  }) => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const { recentSearches, lastCity } = getUserContext();

      // Fetch user's reviewed dishes if logged in
      const { data: { user } } = await supabase.auth.getUser();
      let reviewedDishes: string[] = [];
      let preferredCuisines: string[] = [];

      if (user) {
        const { data: reviews } = await supabase
          .from('reviews')
          .select('restaurant_id, rating')
          .eq('user_id', user.id)
          .gte('rating', 4)
          .limit(20);

        if (reviews && reviews.length > 0) {
          const restaurantIds = reviews.map(r => r.restaurant_id);
          const { data: restaurants } = await supabase
            .from('restaurants')
            .select('cuisines')
            .in('id', restaurantIds);

          preferredCuisines = [...new Set(restaurants?.flatMap(r => r.cuisines || []) || [])];
        }

        // Get reviewed dish names
        const { data: userReviews } = await supabase
          .from('reviews')
          .select('dishes_eaten')
          .eq('user_id', user.id)
          .limit(20);

        if (userReviews) {
          const dishIds = userReviews.flatMap(r => r.dishes_eaten || []);
          if (dishIds.length > 0) {
            const { data: dishes } = await supabase
              .from('dishes')
              .select('name')
              .in('id', dishIds);
            reviewedDishes = dishes?.map(d => d.name) || [];
          }
        }
      }

      const { data, error } = await supabase.functions.invoke('ai-recommendations', {
        body: {
          type: 'surprise',
          mood: options?.mood,
          favorites: options?.favorites || [],
          recentSearches,
          reviewedDishes,
          preferredCuisines,
          city: options?.city || lastCity,
          priceLevel: options?.priceLevel,
          dietary: options?.dietary || [],
        },
      });

      if (error) throw error;

      if (data?.recommendation) {
        setState(prev => ({
          ...prev,
          surprise: data.recommendation,
          loading: false,
        }));
        return data.recommendation;
      }
    } catch (error) {
      console.error('Surprise recommendation error:', error);
      const message = error instanceof Error ? error.message : 'Kon geen aanbeveling ophalen';
      setState(prev => ({ ...prev, error: message, loading: false }));
      toast.error(message);
    }
  }, []);

  const getPersonalizedRecommendations = useCallback(async (
    favorites: string[],
    recentSearches: string[]
  ) => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const { lastCity } = getUserContext();

      // Gather richer context
      const { data: { user } } = await supabase.auth.getUser();
      let reviewedDishes: string[] = [];
      let preferredCuisines: string[] = [];

      if (user) {
        const { data: prefs } = await supabase
          .from('user_tag_preferences')
          .select('tag')
          .eq('user_id', user.id)
          .eq('tag_type', 'cuisine');

        preferredCuisines = prefs?.map(p => p.tag) || [];
      }

      const { data, error } = await supabase.functions.invoke('ai-recommendations', {
        body: {
          type: 'personalized',
          favorites,
          recentSearches,
          reviewedDishes,
          preferredCuisines,
          city: lastCity,
        },
      });

      if (error) throw error;

      if (data?.recommendation?.recommendations) {
        setState(prev => ({
          ...prev,
          personalized: data.recommendation.recommendations,
          loading: false,
        }));
        return data.recommendation.recommendations;
      }
    } catch (error) {
      console.error('Personalized recommendations error:', error);
      const message = error instanceof Error ? error.message : 'Kon geen aanbevelingen ophalen';
      setState(prev => ({ ...prev, error: message, loading: false }));
    }
  }, []);

  const getSmartSuggestions = useCallback(async (currentDish: string) => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const { data, error } = await supabase.functions.invoke('ai-recommendations', {
        body: {
          type: 'smart-suggestion',
          currentDish,
        },
      });

      if (error) throw error;

      if (data?.recommendation?.suggestions) {
        setState(prev => ({
          ...prev,
          smartSuggestions: data.recommendation.suggestions,
          loading: false,
        }));
        return data.recommendation.suggestions;
      }
    } catch (error) {
      console.error('Smart suggestions error:', error);
      const message = error instanceof Error ? error.message : 'Kon geen suggesties ophalen';
      setState(prev => ({ ...prev, error: message, loading: false }));
    }
  }, []);

  const getDishExploration = useCallback(async (dishName: string, city?: string) => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const { data, error } = await supabase.functions.invoke('ai-recommendations', {
        body: {
          type: 'dish-explorer',
          currentDish: dishName,
          city,
        },
      });

      if (error) throw error;

      if (data?.recommendation) {
        setState(prev => ({
          ...prev,
          dishExploration: data.recommendation,
          loading: false,
        }));
        return data.recommendation;
      }
    } catch (error) {
      console.error('Dish exploration error:', error);
      const message = error instanceof Error ? error.message : 'Kon geen info ophalen';
      setState(prev => ({ ...prev, error: message, loading: false }));
    }
  }, []);

  const clearRecommendations = useCallback(() => {
    setState({
      surprise: null,
      personalized: [],
      smartSuggestions: [],
      dishExploration: null,
      loading: false,
      error: null,
    });
  }, []);

  return {
    ...state,
    getSurpriseRecommendation,
    getPersonalizedRecommendations,
    getSmartSuggestions,
    getDishExploration,
    clearRecommendations,
  };
}
