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
        // Fetch menu items
        const { data: menuData, error: menuError } = await supabase
          .from('menu_items')
          .select('*')
          .eq('restaurant_id', restaurantId)
          .eq('is_available', true)
          .order('category')
          .order('name');

        if (menuError) throw menuError;

        // Fetch signature dishes for this restaurant
        const { data: signatureDishes } = await supabase
          .from('restaurant_dishes')
          .select('dish:dishes(name)')
          .eq('restaurant_id', restaurantId)
          .eq('is_signature', true);

        // Create a set of signature dish names (lowercase for matching)
        const signatureNames = new Set(
          (signatureDishes || [])
            .map(sd => (sd.dish as any)?.name?.toLowerCase())
            .filter(Boolean)
        );

        const items = (menuData || []).map(item => ({
          ...item,
          price: Number(item.price),
          allergens: item.allergens || [],
          is_signature: signatureNames.has(item.name.toLowerCase()),
        }));

        setMenuItems(items);
        
        // Extract unique categories
        const uniqueCategories = [...new Set(items.map(item => item.category))];
        setCategories(uniqueCategories);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load menu');
      } finally {
        setLoading(false);
      }
    };

    fetchMenuItems();
  }, [restaurantId]);

  return { menuItems, categories, loading, error };
}
