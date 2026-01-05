import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface SurpriseRecommendation {
  dish: string;
  reason: string;
  description: string;
  pairingTip: string;
}

interface PersonalizedRecommendation {
  dish: string;
  reason: string;
  matchScore: number;
}

interface SmartSuggestion {
  dish: string;
  connection: string;
}

interface AIRecommendationsState {
  surprise: SurpriseRecommendation | null;
  personalized: PersonalizedRecommendation[];
  smartSuggestions: SmartSuggestion[];
  loading: boolean;
  error: string | null;
}

export function useAIRecommendations() {
  const [state, setState] = useState<AIRecommendationsState>({
    surprise: null,
    personalized: [],
    smartSuggestions: [],
    loading: false,
    error: null,
  });

  const fetchDishesAndCuisines = async () => {
    const { data: dishes } = await supabase
      .from('dishes')
      .select('name')
      .eq('is_active', true);
    
    const { data: restaurants } = await supabase
      .from('restaurants')
      .select('cuisines')
      .eq('is_active', true);

    const dishNames = dishes?.map(d => d.name) || [];
    const cuisines = [...new Set(restaurants?.flatMap(r => r.cuisines || []) || [])];
    
    return { dishNames, cuisines };
  };

  const getSurpriseRecommendation = useCallback(async (
    mood?: string,
    favorites?: string[],
    recentSearches?: string[]
  ) => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const { dishNames, cuisines } = await fetchDishesAndCuisines();

      const { data, error } = await supabase.functions.invoke('ai-recommendations', {
        body: {
          type: 'surprise',
          mood,
          favorites,
          recentSearches,
          availableDishes: dishNames,
          availableCuisines: cuisines,
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
      const { dishNames } = await fetchDishesAndCuisines();

      const { data, error } = await supabase.functions.invoke('ai-recommendations', {
        body: {
          type: 'personalized',
          favorites,
          recentSearches,
          availableDishes: dishNames,
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
      const { dishNames } = await fetchDishesAndCuisines();

      const { data, error } = await supabase.functions.invoke('ai-recommendations', {
        body: {
          type: 'smart-suggestion',
          currentDish,
          availableDishes: dishNames,
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

  const clearRecommendations = useCallback(() => {
    setState({
      surprise: null,
      personalized: [],
      smartSuggestions: [],
      loading: false,
      error: null,
    });
  }, []);

  return {
    ...state,
    getSurpriseRecommendation,
    getPersonalizedRecommendations,
    getSmartSuggestions,
    clearRecommendations,
  };
}
