import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import {
  scoreRestaurant,
  sortResults,
  rebalanceSponsoredResults,
  bayesianRating,
  type ScoringContext,
  type DishMatchInfo,
} from '@/lib/ranking';

type Restaurant = Database['public']['Tables']['restaurants']['Row'];
type Dish = Database['public']['Tables']['dishes']['Row'];
type City = Database['public']['Tables']['cities']['Row'];

export interface SearchResult extends Restaurant {
  cityName?: string;
  matchedDishes?: string[];
  matchScore: number;
  bayesianRating: number;
  isSponsored?: boolean;
  hasDishMatch?: boolean;
  chainName?: string;
  chainLocationsCount?: number;
}

interface SearchFilters {
  priceLevel?: number[];
  ambienceTags?: string[];
  cuisines?: string[];
  concepts?: string[];
  mealTypes?: string[];
  experiences?: string[];
  dietaryOptions?: string[];
  hasTerrace?: boolean;
}

// Performance: DB result limit to prevent fetching entire table
const DB_RESULT_LIMIT = 500;

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

  const search = useCallback(async (query: string, cityId?: string, filters?: SearchFilters, featuredOnly?: boolean) => {
    setLoading(true);
    
    const queryLower = query.toLowerCase().trim();
    const now = new Date();
    const ctx: ScoringContext = { queryLower, now };
    
    // Fetch dishes directly if not already loaded (prevents race condition)
    let dishesToSearch = dishes;
    let citiesToUse = cities;
    
    if (dishesToSearch.length === 0 || citiesToUse.length === 0) {
      const [dishesRes, citiesRes] = await Promise.all([
        supabase.from('dishes').select('*').eq('is_active', true),
        supabase.from('cities').select('*').eq('is_active', true).order('name')
      ]);
      dishesToSearch = dishesRes.data || [];
      citiesToUse = citiesRes.data || [];
      if (dishesToSearch.length > 0) setDishes(dishesToSearch);
      if (citiesToUse.length > 0) setCities(citiesToUse);
    }
    
    // Find matching dishes (by name or synonyms)
    const matchingDishes = dishesToSearch.filter(dish => {
      const nameMatch = dish.name.toLowerCase().includes(queryLower);
      const synonymMatch = dish.synonyms?.some(s => s.toLowerCase().includes(queryLower));
      return nameMatch || synonymMatch;
    });

    // Build restaurant query with DB-side limit
    let restaurantQuery = supabase
      .from('restaurants')
      .select('*')
      .eq('is_active', true)
      .limit(DB_RESULT_LIMIT);

    if (featuredOnly) {
      restaurantQuery = restaurantQuery.or('is_featured.eq.true,is_top_listing.eq.true');
    }

    if (cityId && cityId !== 'all') {
      restaurantQuery = restaurantQuery.eq('city_id', cityId);
    }

    // Apply filters
    if (filters?.priceLevel && filters.priceLevel.length > 0) {
      restaurantQuery = restaurantQuery.in('price_level', filters.priceLevel);
    }
    if (filters?.ambienceTags && filters.ambienceTags.length > 0) {
      restaurantQuery = restaurantQuery.overlaps('ambience_tags', filters.ambienceTags);
    }
    if (filters?.cuisines && filters.cuisines.length > 0) {
      restaurantQuery = restaurantQuery.overlaps('cuisines', filters.cuisines);
    }
    if (filters?.concepts && filters.concepts.length > 0) {
      restaurantQuery = restaurantQuery.overlaps('concepts', filters.concepts);
    }
    if (filters?.mealTypes && filters.mealTypes.length > 0) {
      restaurantQuery = restaurantQuery.overlaps('meal_types', filters.mealTypes);
    }
    if (filters?.experiences && filters.experiences.length > 0) {
      restaurantQuery = restaurantQuery.overlaps('experiences', filters.experiences);
    }
    if (filters?.dietaryOptions && filters.dietaryOptions.length > 0) {
      restaurantQuery = restaurantQuery.overlaps('dietary_options', filters.dietaryOptions);
    }
    if (filters?.hasTerrace) {
      restaurantQuery = restaurantQuery.eq('has_terrace', true);
    }

    const { data: restaurants, error } = await restaurantQuery;

    if (error || !restaurants) {
      if (error) console.error('Search error:', error);
      setResults([]);
      setLoading(false);
      return;
    }

    // Batch fetch chain info (single query, not N+1)
    const chainIds = [...new Set(restaurants.map(r => r.chain_id).filter(Boolean))] as string[];
    const chainNameById = new Map<string, string>();
    const chainCountById = new Map<string, number>();

    if (chainIds.length > 0) {
      const [chainsRes, chainRestaurantsRes] = await Promise.all([
        supabase.from('restaurant_chains').select('id,name').in('id', chainIds),
        supabase.from('restaurants').select('id,chain_id').eq('is_active', true).in('chain_id', chainIds),
      ]);
      (chainsRes.data || []).forEach((c: any) => chainNameById.set(c.id, c.name));
      (chainRestaurantsRes.data || []).forEach((r: any) => {
        if (r.chain_id) chainCountById.set(r.chain_id, (chainCountById.get(r.chain_id) || 0) + 1);
      });
    }

    const cityMap = new Map(citiesToUse.map(c => [c.id, c.name]));

    // No query: return all with Bayesian rating sort
    if (!queryLower) {
      const scoredResults: SearchResult[] = restaurants.map(r => ({
        ...r,
        cityName: cityMap.get(r.city_id),
        chainName: r.chain_id ? chainNameById.get(r.chain_id) : undefined,
        chainLocationsCount: r.chain_id ? chainCountById.get(r.chain_id) : undefined,
        matchScore: r.is_featured ? 2 : r.is_top_listing ? 1 : 0,
        bayesianRating: bayesianRating(Number(r.rating), r.review_count),
      }));
      
      const sorted = sortResults(scoredResults);
      setResults(sorted);
      setLoading(false);
      return;
    }

    // Fetch dish links with confidence_score (single batch query)
    let restaurantDishMap = new Map<string, DishMatchInfo[]>();
    
    if (matchingDishes.length > 0) {
      const dishIds = matchingDishes.map(d => d.id);
      const { data: links } = await supabase
        .from('restaurant_dishes')
        .select('restaurant_id, dish_id, status, is_signature, confidence_score')
        .in('dish_id', dishIds)
        .neq('status', 'rejected');

      if (links) {
        links.forEach(link => {
          const dishName = matchingDishes.find(d => d.id === link.dish_id)?.name;
          if (dishName) {
            const existing = restaurantDishMap.get(link.restaurant_id) || [];
            restaurantDishMap.set(link.restaurant_id, [
              ...existing,
              {
                name: dishName,
                isSignature: link.is_signature || false,
                confidenceScore: Number(link.confidence_score) || 0.5,
              },
            ]);
          }
        });
      }
    }

    // Sponsored check (single batch query)
    const sponsoredRestaurants = new Set<string>();
    if (matchingDishes.length > 0 && cityId && cityId !== 'all') {
      const dishIds = matchingDishes.map(d => d.id);
      const { data: sponsoredData } = await supabase
        .from('sponsored_purchases')
        .select('restaurant_id, sponsored_products!inner(dish_id, city_id)')
        .eq('is_active', true)
        .gt('expires_at', now.toISOString());

      if (sponsoredData) {
        sponsoredData.forEach((sp: any) => {
          const product = sp.sponsored_products;
          if (dishIds.includes(product.dish_id) && product.city_id === cityId) {
            sponsoredRestaurants.add(sp.restaurant_id);
          }
        });
      }
    }

    // Score all restaurants using ranking engine
    const scoredResults: SearchResult[] = [];

    for (const restaurant of restaurants) {
      const scored = scoreRestaurant(
        {
          id: restaurant.id,
          name: restaurant.name,
          rating: Number(restaurant.rating),
          review_count: restaurant.review_count,
          cuisines: restaurant.cuisines,
          is_featured: restaurant.is_featured,
          is_top_listing: restaurant.is_top_listing,
          chain_id: restaurant.chain_id,
          created_at: restaurant.created_at,
          linkedDishes: restaurantDishMap.get(restaurant.id) || null,
          isSponsored: sponsoredRestaurants.has(restaurant.id),
        },
        ctx
      );

      if (scored.matchScore > 0 || queryLower === '') {
        scoredResults.push({
          ...restaurant,
          cityName: cityMap.get(restaurant.city_id),
          chainName: restaurant.chain_id ? chainNameById.get(restaurant.chain_id) : undefined,
          chainLocationsCount: restaurant.chain_id ? chainCountById.get(restaurant.chain_id) : undefined,
          matchedDishes: scored.matchedDishes,
          matchScore: scored.matchScore,
          bayesianRating: scored.bayesianRating,
          isSponsored: scored.isSponsored,
          hasDishMatch: scored.hasDishMatch,
        });
      }
    }

    // Sort → rebalance sponsored → enforce chain diversity
    const sorted = sortResults(scoredResults);
    const rebalanced = rebalanceSponsoredResults(sorted);

    setResults(rebalanced);
    setLoading(false);
  }, [dishes, cities]);

  return { search, results, loading, dishes, cities };
}
