import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export function useFavorites() {
  const { user } = useAuth();
  const [favorites, setFavorites] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchFavorites = useCallback(async () => {
    if (!user) return;
    
    setLoading(true);
    const { data, error } = await supabase
      .from('favorites')
      .select('restaurant_id')
      .eq('user_id', user.id);

    if (error) {
      console.error('Error fetching favorites:', error);
    } else {
      setFavorites(data.map(f => f.restaurant_id));
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchFavorites();
    } else {
      setFavorites([]);
    }
  }, [user, fetchFavorites]);

  const toggleFavorite = useCallback(async (restaurantId: string) => {
    if (!user) {
      toast.error('Log in om favorieten op te slaan');
      return;
    }

    const isFav = favorites.includes(restaurantId);

    if (isFav) {
      const { error } = await supabase
        .from('favorites')
        .delete()
        .eq('user_id', user.id)
        .eq('restaurant_id', restaurantId);

      if (error) {
        toast.error('Kon favoriet niet verwijderen');
      } else {
        setFavorites(prev => prev.filter(id => id !== restaurantId));
        toast.success('Verwijderd uit favorieten');
      }
    } else {
      const { error } = await supabase
        .from('favorites')
        .insert({ user_id: user.id, restaurant_id: restaurantId });

      if (error) {
        toast.error('Kon favoriet niet opslaan');
      } else {
        setFavorites(prev => [...prev, restaurantId]);
        toast.success('Toegevoegd aan favorieten');
      }
    }
  }, [user, favorites]);


  const isFavorite = (restaurantId: string) => favorites.includes(restaurantId);

  return { favorites, loading, toggleFavorite, isFavorite };
}
