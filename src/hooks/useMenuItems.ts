import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type CourseType = 'borrel' | 'voorgerecht' | 'hoofdgerecht' | 'bijgerecht' | 'nagerecht' | 'drank';

export const COURSE_TYPE_ORDER: CourseType[] = ['borrel', 'voorgerecht', 'hoofdgerecht', 'bijgerecht', 'nagerecht', 'drank'];

export const COURSE_TYPE_LABELS: Record<CourseType, string> = {
  borrel: '🍸 Borrel',
  voorgerecht: '🥗 Voorgerechten',
  hoofdgerecht: '🍽️ Hoofdgerechten',
  bijgerecht: '🥙 Bijgerechten',
  nagerecht: '🍰 Nagerechten',
  drank: '🥤 Dranken',
};

function normalizeCourse(raw: unknown): CourseType {
  const v = typeof raw === 'string' ? raw.toLowerCase().trim() : '';
  if (v === 'dessert') return 'nagerecht';
  if ((COURSE_TYPE_ORDER as string[]).includes(v)) return v as CourseType;
  return 'hoofdgerecht';
}

export interface MenuItem {
  id: string;
  restaurant_id: string;
  name: string;
  description: string | null;
  price: number;
  category: string;
  course_type: CourseType;
  allergens: string[];
  is_vegetarian: boolean;
  is_vegan: boolean;
  is_gluten_free: boolean;
  is_halal: boolean;
  image_url: string | null;
  is_available: boolean;
  is_signature: boolean;
}

export function useMenuItems(restaurantId: string | undefined) {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [courseTypes, setCourseTypes] = useState<CourseType[]>([]);
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
        const { data: restaurantDishes, error: dishesError } = await supabase
          .from('restaurant_dishes')
          .select(`
            id,
            restaurant_id,
            is_signature,
            is_halal,
            is_vegetarian,
            is_vegan,
            is_gluten_free,
            status,
            course_type,
            dish:dishes(
              id,
              name,
              cuisine_tags,
              course
            )
          `)
          .eq('restaurant_id', restaurantId)
          .in('status', ['approved_by_admin', 'verified_by_owner']);

        if (dishesError) throw dishesError;

        const items: MenuItem[] = (restaurantDishes || [])
          .filter(rd => rd.dish)
          .map(rd => {
            const dish = rd.dish as { id: string; name: string; cuisine_tags: string[] | null; course: string | null };
            const cuisineTags = dish.cuisine_tags || [];
            const courseType = normalizeCourse(dish.course ?? (rd as any).course_type);
            
            return {
              id: rd.id,
              restaurant_id: rd.restaurant_id,
              name: dish.name,
              description: null,
              price: 0,
              category: cuisineTags[0] || 'Gerechten',
              course_type: courseType,
              allergens: [],
              is_vegetarian: rd.is_vegetarian || false,
              is_vegan: rd.is_vegan || false,
              is_gluten_free: rd.is_gluten_free || false,
              is_halal: rd.is_halal || false,
              image_url: null,
              is_available: true,
              is_signature: rd.is_signature,
            };
          });

        setMenuItems(items);
        
        const uniqueCategories = [...new Set(items.map(item => item.category))];
        setCategories(uniqueCategories);

        const presentCourseTypes = COURSE_TYPE_ORDER.filter(ct =>
          items.some(item => item.course_type === ct)
        );
        setCourseTypes(presentCourseTypes);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load dishes');
      } finally {
        setLoading(false);
      }
    };

    fetchMenuItems();
  }, [restaurantId]);

  return { menuItems, categories, courseTypes, loading, error };
}
