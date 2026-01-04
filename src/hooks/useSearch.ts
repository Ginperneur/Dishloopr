import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type Restaurant = Database['public']['Tables']['restaurants']['Row'];
type Dish = Database['public']['Tables']['dishes']['Row'];
type City = Database['public']['Tables']['cities']['Row'];

export interface SearchResult extends Restaurant {
  cityName?: string;
  matchedDishes?: string[];
  matchScore: number;
}

interface SearchFilters {
  priceLevel?: number[];
  ambienceTags?: string[];
  cuisines?: string[];
}

export function useSearch() {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [cities, setCities] = useState<City[]>([]);

  useEffect(() => {
    fetchDishesAndCities();
  }, []);

  const fetchDishesAndCities = async () => {
    const [dishesRes, citiesRes] = await Promise.all([
      supabase.from('dishes').select('*').eq('is_active', true),
      supabase.from('cities').select('*').eq('is_active', true).order('name')
    ]);
    setDishes(dishesRes.data || []);
    setCities(citiesRes.data || []);
  };

  const search = async (query: string, cityId?: string, filters?: SearchFilters) => {
    setLoading(true);
    
    const queryLower = query.toLowerCase().trim();
    
    // Find matching dishes (by name or synonyms)
    const matchingDishes = dishes.filter(dish => {
      const nameMatch = dish.name.toLowerCase().includes(queryLower);
      const synonymMatch = dish.synonyms?.some(s => s.toLowerCase().includes(queryLower));
      return nameMatch || synonymMatch;
    });

    // Find if query matches a cuisine
    const cuisineMatch = queryLower.length > 0;

    // Build restaurant query
    let restaurantQuery = supabase
      .from('restaurants')
      .select('*')
      .eq('is_active', true);

    // Filter by city
    if (cityId && cityId !== 'all') {
      restaurantQuery = restaurantQuery.eq('city_id', cityId);
    }

    // Apply price level filter
    if (filters?.priceLevel && filters.priceLevel.length > 0) {
      restaurantQuery = restaurantQuery.in('price_level', filters.priceLevel);
    }

    // Apply ambience filter
    if (filters?.ambienceTags && filters.ambienceTags.length > 0) {
      restaurantQuery = restaurantQuery.overlaps('ambience_tags', filters.ambienceTags);
    }

    // Apply cuisine filter
    if (filters?.cuisines && filters.cuisines.length > 0) {
      restaurantQuery = restaurantQuery.overlaps('cuisines', filters.cuisines);
    }

    const { data: restaurants, error } = await restaurantQuery;

    if (error) {
      console.error('Search error:', error);
      setResults([]);
      setLoading(false);
      return;
    }

    if (!restaurants) {
      setResults([]);
      setLoading(false);
      return;
    }

    // If no search query, return all restaurants
    if (!queryLower) {
      const cityMap = new Map(cities.map(c => [c.id, c.name]));
      const scoredResults = restaurants.map(r => ({
        ...r,
        cityName: cityMap.get(r.city_id),
        matchScore: r.is_featured ? 2 : r.is_top_listing ? 1 : 0
      }));
      
      // Sort by featured, top listing, then rating
      scoredResults.sort((a, b) => {
        if (b.matchScore !== a.matchScore) return b.matchScore - a.matchScore;
        return Number(b.rating) - Number(a.rating);
      });
      
      setResults(scoredResults);
      setLoading(false);
      return;
    }

    // Get restaurant-dish links for matching dishes
    let restaurantDishMap: Map<string, string[]> = new Map();
    
    if (matchingDishes.length > 0) {
      const dishIds = matchingDishes.map(d => d.id);
      const { data: links } = await supabase
        .from('restaurant_dishes')
        .select('restaurant_id, dish_id')
        .in('dish_id', dishIds);

      if (links) {
        links.forEach(link => {
          const dishName = matchingDishes.find(d => d.id === link.dish_id)?.name;
          if (dishName) {
            const existing = restaurantDishMap.get(link.restaurant_id) || [];
            restaurantDishMap.set(link.restaurant_id, [...existing, dishName]);
          }
        });
      }
    }

    // Score and filter restaurants
    const cityMap = new Map(cities.map(c => [c.id, c.name]));
    const scoredResults: SearchResult[] = [];

    for (const restaurant of restaurants) {
      let matchScore = 0;
      const matchedDishes: string[] = [];

      // Check dish matches
      const linkedDishes = restaurantDishMap.get(restaurant.id);
      if (linkedDishes) {
        matchScore += linkedDishes.length * 10;
        matchedDishes.push(...linkedDishes);
      }

      // Check cuisine match
      if (restaurant.cuisines?.some(c => c.toLowerCase().includes(queryLower))) {
        matchScore += 5;
      }

      // Check name match
      if (restaurant.name.toLowerCase().includes(queryLower)) {
        matchScore += 3;
      }

      // Boost for featured/top listing
      if (restaurant.is_featured) matchScore += 2;
      if (restaurant.is_top_listing) matchScore += 1;

      // Only include if there's some match
      if (matchScore > 0 || queryLower === '') {
        scoredResults.push({
          ...restaurant,
          cityName: cityMap.get(restaurant.city_id),
          matchedDishes,
          matchScore
        });
      }
    }

    // Sort by match score, then rating
    scoredResults.sort((a, b) => {
      if (b.matchScore !== a.matchScore) return b.matchScore - a.matchScore;
      return Number(b.rating) - Number(a.rating);
    });

    setResults(scoredResults);
    setLoading(false);
  };

  return { 
    search, 
    results, 
    loading, 
    dishes, 
    cities 
  };
}
