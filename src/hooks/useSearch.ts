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
    fetchCities();
  }, []);

  const fetchCities = async () => {
    const { data } = await supabase.from('cities').select('*').eq('is_active', true).order('name');
    if (data) setCities(data);
  };

  /**
   * Search for matching dishes server-side using ilike queries.
   * This avoids loading all 8000+ dishes client-side.
   */
  const findMatchingDishes = async (term: string): Promise<Dish[]> => {
    const pattern = `%${term}%`;
    
    // Search by name, name_en, and synonyms in parallel
    const [byName, byNameEn, bySynonym] = await Promise.all([
      supabase.from('dishes').select('*').eq('is_active', true).ilike('name', pattern).limit(200),
      supabase.from('dishes').select('*').eq('is_active', true).ilike('name_en', pattern).limit(200),
      supabase.from('dishes').select('*').eq('is_active', true).contains('synonyms', [term]).limit(200),
    ]);

    // Deduplicate
    const seen = new Set<string>();
    const results: Dish[] = [];
    for (const list of [byName.data, byNameEn.data, bySynonym.data]) {
      if (!list) continue;
      for (const dish of list) {
        if (!seen.has(dish.id)) {
          seen.add(dish.id);
          results.push(dish);
        }
      }
    }
    
    // Also do client-side synonym check (contains does exact array element match,
    // but we need partial matching in synonyms too)
    if (results.length < 50) {
      const { data: allSynonymMatches } = await supabase
        .from('dishes')
        .select('*')
        .eq('is_active', true)
        .limit(500);
      
      if (allSynonymMatches) {
        for (const dish of allSynonymMatches) {
          if (!seen.has(dish.id) && dish.synonyms?.some(s => s.toLowerCase().includes(term))) {
            seen.add(dish.id);
            results.push(dish);
          }
        }
      }
    }
    
    return results;
  };

  const search = useCallback(async (query: string, cityId?: string, filters?: SearchFilters, featuredOnly?: boolean) => {
    setLoading(true);
    
    const queryLower = query.toLowerCase().trim();
    const now = new Date();
    
    // Support multi-dish search: split by comma
    const queryTerms = queryLower
      .split(',')
      .map(t => t.trim())
      .filter(t => t.length > 0);
    const isMultiDish = queryTerms.length > 1;
    
    const ctx: ScoringContext = { queryLower: queryTerms[0] || '', now };
    
    let citiesToUse = cities;
    if (citiesToUse.length === 0) {
      const { data } = await supabase.from('cities').select('*').eq('is_active', true).order('name');
      citiesToUse = data || [];
      if (citiesToUse.length > 0) setCities(citiesToUse);
    }
    
    // Find matching dishes SERVER-SIDE for each query term
    const matchingDishesByTerm = new Map<string, Dish[]>();
    const allMatchingDishes: Dish[] = [];
    const seen = new Set<string>();
    
    if (queryTerms.length > 0) {
      const termResults = await Promise.all(queryTerms.map(term => findMatchingDishes(term)));
      
      queryTerms.forEach((term, i) => {
        const termMatches = termResults[i];
        if (termMatches.length > 0) {
          matchingDishesByTerm.set(term, termMatches);
          termMatches.forEach(d => {
            if (!seen.has(d.id)) {
              seen.add(d.id);
              allMatchingDishes.push(d);
            }
          });
        }
      });
    }
    const matchingDishes = allMatchingDishes;
    
    // Update dishes state for autocomplete/UI
    if (matchingDishes.length > 0) {
      setDishes(prev => {
        const existing = new Set(prev.map(d => d.id));
        const newDishes = matchingDishes.filter(d => !existing.has(d.id));
        return newDishes.length > 0 ? [...prev, ...newDishes] : prev;
      });
    }

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
    if (queryTerms.length === 0) {
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

    // Build per-restaurant query term coverage map for multi-dish search
    const restaurantTermCoverage = new Map<string, number>();
    if (isMultiDish && matchingDishesByTerm.size > 0) {
      for (const [_term, termDishes] of matchingDishesByTerm) {
        const termDishIds = new Set(termDishes.map(d => d.id));
        // For each restaurant that has linked dishes, check if any match this term
        for (const [restaurantId, dishes] of restaurantDishMap) {
          const matchesTerm = dishes.some(d => {
            const dish = matchingDishes.find(md => md.name === d.name);
            return dish && termDishIds.has(dish.id);
          });
          if (matchesTerm) {
            restaurantTermCoverage.set(restaurantId, (restaurantTermCoverage.get(restaurantId) || 0) + 1);
          }
        }
      }
    }

    // When query matches known dishes, ONLY show restaurants that have those dishes
    const hasDishMatches = matchingDishes.length > 0;

    // Score all restaurants using ranking engine
    const scoredResults: SearchResult[] = [];
    const totalQueryTerms = isMultiDish ? queryTerms.length : 1;

    for (const restaurant of restaurants) {
      const linkedDishes = restaurantDishMap.get(restaurant.id) || null;
      
      // If the search matched known dishes, skip restaurants without that dish
      if (hasDishMatches && (!linkedDishes || linkedDishes.length === 0)) {
        continue;
      }

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
          linkedDishes,
          isSponsored: sponsoredRestaurants.has(restaurant.id),
          queryTermsCovered: restaurantTermCoverage.get(restaurant.id) || 0,
          totalQueryTerms,
        },
        ctx
      );

      if (scored.matchScore > 0) {
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
