import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface YearlyWrapped {
  id: string;
  year: number;
  total_restaurants: number;
  total_reviews: number;
  total_cuisines: number;
  cuisines_list: string[];
  cities_list: string[];
  top_cuisine: string | null;
  top_restaurant_id: string | null;
  top_dish: string | null;
  total_photos: number;
  foodie_personality: string | null;
}

export function useYearlyWrapped(year?: number) {
  const { user } = useAuth();
  const [wrapped, setWrapped] = useState<YearlyWrapped | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const currentYear = year || new Date().getFullYear();

  useEffect(() => {
    if (user) {
      fetchWrapped();
    } else {
      setWrapped(null);
      setLoading(false);
    }
  }, [user, currentYear]);

  const fetchWrapped = async () => {
    if (!user) return;
    
    setLoading(true);
    
    const { data } = await supabase
      .from('yearly_wrapped')
      .select('*')
      .eq('user_id', user.id)
      .eq('year', currentYear)
      .maybeSingle();

    setWrapped(data as YearlyWrapped | null);
    setLoading(false);
  };

  const generateWrapped = async () => {
    if (!user) return;
    
    setGenerating(true);

    // Get user's reviews for the year
    const startOfYear = new Date(currentYear, 0, 1).toISOString();
    const endOfYear = new Date(currentYear, 11, 31, 23, 59, 59).toISOString();

    const { data: reviews } = await supabase
      .from('reviews')
      .select(`
        *,
        restaurant:restaurants(
          id, name, cuisines,
          city:cities(name)
        )
      `)
      .eq('user_id', user.id)
      .gte('created_at', startOfYear)
      .lte('created_at', endOfYear);

    if (!reviews || reviews.length === 0) {
      setGenerating(false);
      return;
    }

    // Calculate stats
    const cuisinesSet = new Set<string>();
    const citiesSet = new Set<string>();
    const cuisineCount: Record<string, number> = {};
    const restaurantVisits: Record<string, number> = {};
    let totalPhotos = 0;

    reviews.forEach(review => {
      const restaurant = review.restaurant as any;
      if (restaurant) {
        if (restaurant.cuisines) {
          restaurant.cuisines.forEach((c: string) => {
            cuisinesSet.add(c);
            cuisineCount[c] = (cuisineCount[c] || 0) + 1;
          });
        }
        if (restaurant.city?.name) {
          citiesSet.add(restaurant.city.name);
        }
        restaurantVisits[restaurant.id] = (restaurantVisits[restaurant.id] || 0) + 1;
      }
      if (review.photos) {
        totalPhotos += review.photos.length;
      }
    });

    // Find top cuisine
    const topCuisine = Object.entries(cuisineCount)
      .sort(([,a], [,b]) => b - a)[0]?.[0] || null;

    // Find most visited restaurant
    const topRestaurantId = Object.entries(restaurantVisits)
      .sort(([,a], [,b]) => b - a)[0]?.[0] || null;

    // Determine foodie personality
    const cuisineCount2 = cuisinesSet.size;
    const cityCount = citiesSet.size;
    let personality = 'Foodie Beginner';
    
    if (reviews.length >= 50 && cuisineCount2 >= 15) {
      personality = 'Culinaire Meester';
    } else if (reviews.length >= 25 && cuisineCount2 >= 10) {
      personality = 'Avontuurlijke Fijnproever';
    } else if (cityCount >= 5) {
      personality = 'Steden Ontdekker';
    } else if (cuisineCount2 >= 8) {
      personality = 'Wereldkeuken Liefhebber';
    } else if (reviews.length >= 10) {
      personality = 'Trouwe Reviewer';
    }

    // Upsert wrapped data
    const wrappedData = {
      user_id: user.id,
      year: currentYear,
      total_restaurants: new Set(reviews.map(r => (r.restaurant as any)?.id)).size,
      total_reviews: reviews.length,
      total_cuisines: cuisineCount2,
      cuisines_list: Array.from(cuisinesSet),
      cities_list: Array.from(citiesSet),
      top_cuisine: topCuisine,
      top_restaurant_id: topRestaurantId,
      total_photos: totalPhotos,
      foodie_personality: personality,
    };

    const { data: newWrapped } = await supabase
      .from('yearly_wrapped')
      .upsert(wrappedData, { onConflict: 'user_id,year' })
      .select()
      .single();

    setWrapped(newWrapped as YearlyWrapped);
    setGenerating(false);
  };

  return {
    wrapped,
    loading,
    generating,
    generateWrapped,
    refetch: fetchWrapped,
    year: currentYear
  };
}
