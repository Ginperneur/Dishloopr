import { Layout } from '@/components/layout/Layout';
import { motion } from 'framer-motion';
import { Heart, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useFavorites } from '@/hooks/useFavorites';
import { DatabaseRestaurantCard } from '@/components/restaurant/DatabaseRestaurantCard';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type Restaurant = Database['public']['Tables']['restaurants']['Row'];

export default function FavoritesPage() {
  const { user } = useAuth();
  const { favorites, loading: favoritesLoading } = useFavorites();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRestaurants = async () => {
      if (favorites.length === 0) {
        setRestaurants([]);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('restaurants')
        .select('*')
        .in('id', favorites);

      if (!error && data) {
        setRestaurants(data);
      }
      setLoading(false);
    };

    if (!favoritesLoading) {
      fetchRestaurants();
    }
  }, [favorites, favoritesLoading]);

  if (!user) {
    return (
      <Layout>
        <div className="container py-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-md mx-auto text-center"
          >
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
              <Heart className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-2xl font-bold mb-4">Mijn Favorieten</h1>
            <p className="text-muted-foreground mb-6">
              Log in om je favoriete restaurants te bekijken en beheren.
            </p>
            <Button asChild size="lg">
              <Link to="/login">Inloggen</Link>
            </Button>
          </motion.div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container py-6 md:py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 md:mb-8"
        >
          <h1 className="text-2xl md:text-4xl font-bold mb-1 md:mb-2">Mijn Favorieten</h1>
          <p className="text-muted-foreground text-sm md:text-base">
            {restaurants.length} opgeslagen restaurant{restaurants.length !== 1 ? 's' : ''}
          </p>
        </motion.div>

        {loading || favoritesLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-64 md:h-72 bg-muted animate-pulse rounded-xl" />
            ))}
          </div>
        ) : restaurants.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-12 md:py-16"
          >
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-6">
              <Heart className="w-8 h-8 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Nog geen favorieten</h2>
            <p className="text-muted-foreground mb-6 max-w-sm mx-auto text-sm md:text-base">
              Ontdek restaurants en voeg ze toe aan je favorieten door op het hartje te klikken.
            </p>
            <Button asChild>
              <Link to="/search">
                <Search className="w-4 h-4 mr-2" />
                Ontdek restaurants
              </Link>
            </Button>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {restaurants.map((restaurant, index) => (
              <DatabaseRestaurantCard
                key={restaurant.id}
                restaurant={restaurant}
                index={index}
              />
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
