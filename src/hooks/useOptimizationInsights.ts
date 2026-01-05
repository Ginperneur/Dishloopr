import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface DishVisibility {
  dishId: string;
  dishName: string;
  position: number;
  totalRestaurants: number;
  topCompetitors: { name: string; rating: number; position: number }[];
  searchVolume: number;
  clickShare: number;
}

interface TagAnalysis {
  tag: string;
  type: 'cuisine' | 'ambience';
  confirmedCount: number;
  disputedCount: number;
  status: 'confirmed' | 'disputed' | 'neutral';
  userSentiment: number;
}

interface OptimizationSuggestion {
  id: string;
  type: 'missing_dish' | 'price_mismatch' | 'underperforming_tag' | 'menu_gap';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  expectedImpact: string;
  actionLabel: string;
}

interface SimulationResult {
  currentPosition: number;
  projectedPosition: number;
  visibilityChange: number;
  competitorComparison: string;
  confidence: number;
}

export interface OptimizationData {
  dishVisibility: DishVisibility[];
  tagAnalysis: TagAnalysis[];
  suggestions: OptimizationSuggestion[];
  overallScore: number;
  isPremium: boolean;
}

export function useOptimizationInsights(restaurantId: string | undefined) {
  const [data, setData] = useState<OptimizationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInsights = useCallback(async () => {
    if (!restaurantId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Fetch restaurant data with dishes
      const { data: restaurant, error: restError } = await supabase
        .from('restaurants')
        .select('*, restaurant_dishes(*, dishes(*))')
        .eq('id', restaurantId)
        .single();

      if (restError) throw restError;

      // Fetch all dishes to find gaps
      const { data: allDishes } = await supabase
        .from('dishes')
        .select('*')
        .eq('is_active', true)
        .order('search_count', { ascending: false })
        .limit(50);

      // Fetch competing restaurants in same city
      const { data: competitors } = await supabase
        .from('restaurants')
        .select('id, name, rating, cuisines, price_level, restaurant_dishes(dish_id, clicks)')
        .eq('city_id', restaurant.city_id)
        .eq('is_active', true)
        .neq('id', restaurantId)
        .limit(20);

      // Fetch analytics for click data
      const { data: analyticsData } = await supabase
        .from('analytics_events')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

      // Fetch reviews for tag sentiment
      const { data: reviews } = await supabase
        .from('reviews')
        .select('suggested_tags, tag_votes, rating')
        .eq('restaurant_id', restaurantId)
        .eq('status', 'published');

      // Calculate dish visibility
      const restaurantDishes = restaurant.restaurant_dishes || [];
      const dishVisibility: DishVisibility[] = restaurantDishes.map((rd: any) => {
        const dish = rd.dishes;
        if (!dish) return null;

        // Find competitors with same dish
        const competitorsWithDish = (competitors || [])
          .filter((c: any) => c.restaurant_dishes?.some((d: any) => d.dish_id === dish.id))
          .sort((a: any, b: any) => b.rating - a.rating);

        // Calculate position (simplified - in real world, use search algorithm)
        const allWithDish = [...competitorsWithDish, { id: restaurantId, rating: restaurant.rating }]
          .sort((a: any, b: any) => b.rating - a.rating);
        const position = allWithDish.findIndex((r: any) => r.id === restaurantId) + 1;

        // Calculate click share
        const totalClicks = competitorsWithDish.reduce((sum: number, c: any) => {
          const cd = c.restaurant_dishes?.find((d: any) => d.dish_id === dish.id);
          return sum + (cd?.clicks || 0);
        }, 0) + rd.clicks;
        const clickShare = totalClicks > 0 ? (rd.clicks / totalClicks) * 100 : 0;

        return {
          dishId: dish.id,
          dishName: dish.name,
          position,
          totalRestaurants: allWithDish.length,
          topCompetitors: competitorsWithDish.slice(0, 3).map((c: any, i: number) => ({
            name: c.name,
            rating: c.rating,
            position: i + 1
          })),
          searchVolume: dish.search_count,
          clickShare: Math.round(clickShare)
        };
      }).filter(Boolean) as DishVisibility[];

      // Analyze tags
      const tagAnalysis: TagAnalysis[] = [];
      const cuisines = restaurant.cuisines || [];
      const ambience = restaurant.ambience_tags || [];

      // Analyze cuisine tags from reviews
      cuisines.forEach((cuisine: string) => {
        const mentionsInReviews = (reviews || []).filter((r: any) => 
          r.suggested_tags?.includes(cuisine)
        ).length;
        const totalReviews = (reviews || []).length;
        
        tagAnalysis.push({
          tag: cuisine,
          type: 'cuisine',
          confirmedCount: mentionsInReviews,
          disputedCount: Math.max(0, Math.floor((totalReviews - mentionsInReviews) * 0.3)),
          status: mentionsInReviews > totalReviews * 0.5 ? 'confirmed' : 
                  mentionsInReviews < totalReviews * 0.2 ? 'disputed' : 'neutral',
          userSentiment: totalReviews > 0 ? (mentionsInReviews / totalReviews) * 100 : 50
        });
      });

      ambience.forEach((tag: string) => {
        const mentionsInReviews = (reviews || []).filter((r: any) => 
          r.suggested_tags?.includes(tag)
        ).length;
        const totalReviews = (reviews || []).length;
        
        tagAnalysis.push({
          tag,
          type: 'ambience',
          confirmedCount: mentionsInReviews,
          disputedCount: Math.max(0, Math.floor((totalReviews - mentionsInReviews) * 0.3)),
          status: mentionsInReviews > totalReviews * 0.4 ? 'confirmed' : 
                  mentionsInReviews < totalReviews * 0.15 ? 'disputed' : 'neutral',
          userSentiment: totalReviews > 0 ? (mentionsInReviews / totalReviews) * 100 : 50
        });
      });

      // Generate suggestions
      const suggestions: OptimizationSuggestion[] = [];
      
      // Find trending dishes restaurant doesn't have
      const restaurantDishIds = restaurantDishes.map((rd: any) => rd.dish_id);
      const trendingMissing = (allDishes || [])
        .filter((d: any) => !restaurantDishIds.includes(d.id))
        .filter((d: any) => {
          // Check if dish matches restaurant cuisine
          const dishCuisines = d.cuisine_tags || [];
          return cuisines.some((c: string) => dishCuisines.includes(c));
        })
        .slice(0, 3);

      trendingMissing.forEach((dish: any) => {
        suggestions.push({
          id: `missing-${dish.id}`,
          type: 'missing_dish',
          priority: dish.search_count > 100 ? 'high' : dish.search_count > 30 ? 'medium' : 'low',
          title: `Voeg "${dish.name}" toe`,
          description: `Dit gerecht past bij je keuken en wordt ${dish.search_count}x per maand gezocht.`,
          expectedImpact: `+${Math.round(dish.search_count * 0.15)} extra weergaven/maand`,
          actionLabel: 'Toevoegen aan menu'
        });
      });

      // Check price level alignment
      const avgCompetitorPrice = (competitors || [])
        .filter((c: any) => cuisines.some((cuisine: string) => c.cuisines?.includes(cuisine)))
        .reduce((sum: number, c: any, _, arr) => sum + c.price_level / arr.length, 0);
      
      if (avgCompetitorPrice && Math.abs(restaurant.price_level - avgCompetitorPrice) > 1) {
        suggestions.push({
          id: 'price-mismatch',
          type: 'price_mismatch',
          priority: 'medium',
          title: 'Prijsniveau wijkt af',
          description: `Je prijsniveau (${restaurant.price_level}) wijkt af van vergelijkbare restaurants (${avgCompetitorPrice.toFixed(1)}).`,
          expectedImpact: 'Kan filteren beïnvloeden',
          actionLabel: 'Prijsniveau herzien'
        });
      }

      // Check underperforming tags
      tagAnalysis
        .filter(t => t.status === 'disputed')
        .forEach(tag => {
          suggestions.push({
            id: `tag-${tag.tag}`,
            type: 'underperforming_tag',
            priority: 'low',
            title: `Tag "${tag.tag}" wordt betwist`,
            description: `Slechts ${tag.userSentiment.toFixed(0)}% van reviews bevestigt deze tag.`,
            expectedImpact: 'Betere tag-matching voor zoekers',
            actionLabel: 'Tag verwijderen of aanpassen'
          });
        });

      // Calculate overall score
      const visibilityScore = dishVisibility.length > 0 
        ? dishVisibility.reduce((sum, d) => sum + (1 / d.position) * 100, 0) / dishVisibility.length 
        : 0;
      const tagScore = tagAnalysis.filter(t => t.status === 'confirmed').length / Math.max(tagAnalysis.length, 1) * 100;
      const suggestionPenalty = suggestions.filter(s => s.priority === 'high').length * 10;
      const overallScore = Math.min(100, Math.max(0, Math.round((visibilityScore + tagScore) / 2 - suggestionPenalty)));

      setData({
        dishVisibility: dishVisibility.sort((a, b) => b.searchVolume - a.searchVolume),
        tagAnalysis,
        suggestions: suggestions.sort((a, b) => {
          const priorityOrder = { high: 0, medium: 1, low: 2 };
          return priorityOrder[a.priority] - priorityOrder[b.priority];
        }),
        overallScore,
        isPremium: false // Would check subscription status
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load insights');
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    fetchInsights();
  }, [fetchInsights]);

  const simulateChange = async (
    changeType: 'add_dish' | 'remove_tag' | 'change_price',
    params: { dishId?: string; tag?: string; newPriceLevel?: number }
  ): Promise<SimulationResult | null> => {
    if (!restaurantId || !data) return null;

    // Simulated calculation based on current data
    if (changeType === 'add_dish' && params.dishId) {
      const { data: dish } = await supabase
        .from('dishes')
        .select('*, restaurant_dishes(restaurant_id)')
        .eq('id', params.dishId)
        .single();

      if (!dish) return null;

      const competitorCount = (dish.restaurant_dishes || []).length;
      const avgPosition = competitorCount > 0 ? Math.ceil(competitorCount / 2) : 1;
      
      return {
        currentPosition: 0,
        projectedPosition: avgPosition,
        visibilityChange: Math.round(dish.search_count * 0.1),
        competitorComparison: `${competitorCount} restaurants bieden dit gerecht aan`,
        confidence: competitorCount > 5 ? 85 : competitorCount > 2 ? 70 : 55
      };
    }

    if (changeType === 'remove_tag' && params.tag) {
      const tagData = data.tagAnalysis.find(t => t.tag === params.tag);
      if (!tagData) return null;

      return {
        currentPosition: 0,
        projectedPosition: 0,
        visibilityChange: tagData.status === 'disputed' ? 5 : -10,
        competitorComparison: tagData.status === 'disputed' 
          ? 'Verwijderen verbetert tag-matching' 
          : 'Kan zichtbaarheid in filters verminderen',
        confidence: 75
      };
    }

    return null;
  };

  return {
    data,
    loading,
    error,
    refetch: fetchInsights,
    simulateChange
  };
}
