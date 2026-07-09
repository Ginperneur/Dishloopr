import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Heart, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useFavorites } from '@/hooks/useFavorites';
import { supabase } from '@/integrations/supabase/client';
import { DatabaseRestaurantCard } from '@/components/restaurant/DatabaseRestaurantCard';
import type { Database } from '@/integrations/supabase/types';

type Restaurant = Database['public']['Tables']['restaurants']['Row'];

const MAX_VISIBLE = 8;

export function FavoritesPreview() {
  const { favorites, loading: favLoading } = useFavorites();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (favLoading) return;
      if (favorites.length === 0) {
        setRestaurants([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      const { data } = await supabase
        .from('restaurants')
        .select('*')
        .in('id', favorites.slice(0, MAX_VISIBLE))
        .eq('is_active', true);
      if (!cancelled) {
        setRestaurants((data as Restaurant[]) || []);
        setLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [favorites, favLoading]);

  return (
    <section aria-labelledby="favorites-heading">
      <div className="flex items-center justify-between mb-3">
        <h2 id="favorites-heading" className="text-lg sm:text-xl font-semibold">
          Favorieten
        </h2>
        {favorites.length > 0 && (
          <Link
            to="/favorites"
            className="text-xs sm:text-sm text-primary hover:underline flex items-center gap-1 min-h-[44px] px-1"
          >
            Alle favorieten <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>

      {loading || favLoading ? (
        <div className="flex gap-3 overflow-hidden">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="shrink-0 w-[260px] sm:w-[280px] h-56 rounded-xl bg-muted animate-pulse"
            />
          ))}
        </div>
      ) : restaurants.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-border bg-card p-6 text-center">
          <div className="w-12 h-12 rounded-full bg-rose-500/10 flex items-center justify-center mx-auto mb-3">
            <Heart className="w-6 h-6 text-rose-500" />
          </div>
          <p className="font-medium mb-1 text-sm">Nog geen favorieten</p>
          <p className="text-xs text-muted-foreground mb-4 max-w-xs mx-auto">
            Tik op het hartje bij een restaurant om het hier te bewaren.
          </p>
          <Button asChild className="min-h-[44px]">
            <Link to="/search">
              <Search className="w-4 h-4 mr-1.5" /> Ontdek restaurants
            </Link>
          </Button>
        </div>
      ) : (
        <div className="-mx-4 px-4 sm:mx-0 sm:px-0">
          <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            {restaurants.map((r, index) => (
              <div
                key={r.id}
                className="shrink-0 w-[260px] sm:w-[280px] snap-start"
              >
                <DatabaseRestaurantCard restaurant={r} index={index} />
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}