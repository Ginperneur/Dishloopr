import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface MenuItem {
  id: string;
  restaurant_id: string;
  name: string;
  description: string | null;
  price: number;
  category: string;
  allergens: string[];
  is_vegetarian: boolean;
  is_vegan: boolean;
  is_gluten_free: boolean;
  image_url: string | null;
  is_available: boolean;
  is_signature: boolean;
}

export function useMenuItems(restaurantId: string | undefined) {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!restaurantId) {
      setLoading(false);
      return;
    }

    const fetchMenuItems = async () => {
      setLoading(true);
      try {
        // Fetch restaurant dishes (the actual dishes linked to the restaurant)
        const { data: restaurantDishes, error: dishesError } = await supabase
          .from('restaurant_dishes')
          .select(`
            id,
            restaurant_id,
            is_signature,
            status,
            dish:dishes(
              id,
              name,
              cuisine_tags
            )
          `)
          .eq('restaurant_id', restaurantId)
          .in('status', ['approved_by_admin', 'verified_by_owner']);

        if (dishesError) throw dishesError;

        // Transform restaurant_dishes to MenuItem format
        const items: MenuItem[] = (restaurantDishes || [])
          .filter(rd => rd.dish) // Ensure dish exists
          .map(rd => {
            const dish = rd.dish as { id: string; name: string; cuisine_tags: string[] | null };
            const cuisineTags = dish.cuisine_tags || [];
            
            return {
              id: rd.id,
              restaurant_id: rd.restaurant_id,
              name: dish.name,
              description: null, // restaurant_dishes doesn't have descriptions
              price: 0, // restaurant_dishes doesn't have prices
              category: cuisineTags[0] || 'Gerechten', // Use first cuisine tag as category
              allergens: [],
              is_vegetarian: cuisineTags.some(t => t.toLowerCase().includes('vegetar')),
              is_vegan: cuisineTags.some(t => t.toLowerCase().includes('vegan')),
              is_gluten_free: cuisineTags.some(t => t.toLowerCase().includes('gluten')),
              image_url: null,
              is_available: true,
              is_signature: rd.is_signature,
            };
          });

        setMenuItems(items);
        
        // Extract unique categories
        const uniqueCategories = [...new Set(items.map(item => item.category))];
        setCategories(uniqueCategories);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load dishes');
      } finally {
        setLoading(false);
      }
    };

    fetchMenuItems();
  }, [restaurantId]);

  return { menuItems, categories, loading, error };
}
