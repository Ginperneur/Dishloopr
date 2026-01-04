import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export function useFavorites() {
  const { user } = useAuth();
  const [favorites, setFavorites] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      fetchFavorites();
    } else {
      setFavorites([]);
    }
  }, [user]);

  const fetchFavorites = async () => {
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
  };

  const toggleFavorite = async (restaurantId: string) => {
    if (!user) {
      toast.error('Log in om favorieten op te slaan');
      return;
    }

    const isFavorite = favorites.includes(restaurantId);

    if (isFavorite) {
      // Remove favorite
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
      // Add favorite
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
  };

  const isFavorite = (restaurantId: string) => favorites.includes(restaurantId);

  return { favorites, loading, toggleFavorite, isFavorite };
}
