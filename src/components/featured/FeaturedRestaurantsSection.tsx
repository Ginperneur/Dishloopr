import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Sparkles, MapPin, Star, ChefHat, TrendingUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { PRICE_LABELS } from '@/lib/constants';

interface FeaturedRestaurant {
  id: string;
  name: string;
  slug: string;
  address: string;
  cuisines: string[];
  price_level: number;
  rating: number;
  review_count: number;
  images: string[];
  ambiance_tags: string[];
  subscription?: {
    included_ambiance: string | null;
    extra_ambiances: string[];
    total_views: number;
    total_clicks: number;
  };
}

interface FeaturedRestaurantsSectionProps {
  cityId?: string;
  cuisine?: string;
  ambiance?: string;
  limit?: number;
  title?: string;
  showViewAll?: boolean;
}

export function FeaturedRestaurantsSection({
  cityId,
  cuisine,
  ambiance,
  limit = 6,
  title,
  showViewAll = true
}: FeaturedRestaurantsSectionProps) {
  const { t } = useTranslation();
  const [restaurants, setRestaurants] = useState<FeaturedRestaurant[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFeaturedRestaurants();
  }, [cityId, cuisine, ambiance]);

  const fetchFeaturedRestaurants = async () => {
    setLoading(true);
    try {
      // Get active featured subscriptions with restaurant data
      let query = supabase
        .from('featured_subscriptions_public' as any)
        .select(`
          id,
          included_ambiance,
          extra_ambiances,
          total_views,
          total_clicks,
          restaurants!inner(
            id,
            name,
            slug,
            address,
            cuisines,
            price_level,
            rating,
            review_count,
            images,
            ambiance_tags,
            city_id
          ),
          featured_slots!inner(
            cuisine,
            city_id
          )
        `)
        .eq('status', 'active')
        .gt('expires_at', new Date().toISOString());

      // Apply filters
      if (cityId) {
        query = query.eq('featured_slots.city_id', cityId);
      }
      if (cuisine) {
        query = query.eq('featured_slots.cuisine', cuisine);
      }

      const { data, error } = await query.limit(limit * 2); // Get more for filtering

      if (error) throw error;

      // Transform and rank data
      let featuredData = (data || []).map((sub: any) => ({
        ...sub.restaurants,
        subscription: {
          included_ambiance: sub.included_ambiance,
          extra_ambiances: sub.extra_ambiances,
          total_views: sub.total_views,
          total_clicks: sub.total_clicks,
        }
      }));

      // Filter by ambiance if specified
      if (ambiance) {
        featuredData = featuredData.filter((r: any) => {
          const subAmbiances = [
            r.subscription.included_ambiance,
            ...(r.subscription.extra_ambiances || [])
          ].filter(Boolean);
          return subAmbiances.includes(ambiance) || r.ambiance_tags?.includes(ambiance);
        });
      }

      // Rank by:
      // 1. Ambiance match (if ambiance filter)
      // 2. Dish/cuisine relevance
      // 3. Recent performance (views/clicks)
      featuredData.sort((a: any, b: any) => {
        // Ambiance match priority
        if (ambiance) {
          const aMatch = [a.subscription.included_ambiance, ...(a.subscription.extra_ambiances || [])].includes(ambiance);
          const bMatch = [b.subscription.included_ambiance, ...(b.subscription.extra_ambiances || [])].includes(ambiance);
          if (aMatch && !bMatch) return -1;
          if (!aMatch && bMatch) return 1;
        }

        // Performance score
        const aScore = (a.subscription.total_views * 0.3) + (a.subscription.total_clicks * 0.7);
        const bScore = (b.subscription.total_views * 0.3) + (b.subscription.total_clicks * 0.7);
        return bScore - aScore;
      });

      setRestaurants(featuredData.slice(0, limit));
    } catch (err) {
      console.error('Error fetching featured restaurants:', err);
      setRestaurants([]);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Skeleton className="h-6 w-6" />
          <Skeleton className="h-6 w-48" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-64 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (restaurants.length === 0) {
    return null;
  }

  return (
    <section className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">
            {title || t('featured.premiumSpots', 'Premium plekken')}
          </h2>
          <Badge variant="secondary" className="text-xs">
            {restaurants.length} {restaurants.length === 1 ? 'plek' : 'plekken'}
          </Badge>
        </div>
        {showViewAll && (
          <Button variant="ghost" size="sm" asChild>
            <Link to="/search?featured=true">
              Bekijk alle
            </Link>
          </Button>
        )}
      </div>

      {/* Restaurant Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {restaurants.map((restaurant, index) => (
          <motion.div
            key={restaurant.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Link to={`/restaurant/${restaurant.slug}`}>
              <div className="group relative rounded-lg overflow-hidden border bg-card hover:shadow-lg transition-all">
                {/* Image */}
                <div className="relative aspect-[16/10] overflow-hidden">
                  <img
                    src={restaurant.images?.[0] || '/placeholder.svg'}
                    alt={restaurant.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  {/* Premium Badge */}
                  <div className="absolute top-2 left-2">
                    <Badge className="bg-primary/90 text-primary-foreground gap-1">
                      <Sparkles className="h-3 w-3" />
                      Premium
                    </Badge>
                  </div>
                  {/* Performance indicator */}
                  {restaurant.subscription && restaurant.subscription.total_clicks > 10 && (
                    <div className="absolute top-2 right-2">
                      <Badge variant="secondary" className="gap-1 text-xs">
                        <TrendingUp className="h-3 w-3" />
                        Populair
                      </Badge>
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold line-clamp-1 group-hover:text-primary transition-colors">
                      {restaurant.name}
                    </h3>
                    <div className="flex items-center gap-1 shrink-0">
                      <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                      <span className="text-sm font-medium">{restaurant.rating.toFixed(1)}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    <span className="line-clamp-1">{restaurant.address}</span>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-xs">
                      {PRICE_LABELS[restaurant.price_level] || '€€'}
                    </Badge>
                    {restaurant.cuisines?.slice(0, 2).map((cuisine) => (
                      <Badge key={cuisine} variant="secondary" className="text-xs">
                        <ChefHat className="h-3 w-3 mr-1" />
                        {cuisine}
                      </Badge>
                    ))}
                  </div>

                  {/* Ambiance tags from subscription */}
                  {restaurant.subscription?.included_ambiance && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      <Badge variant="outline" className="text-xs capitalize">
                        {restaurant.subscription.included_ambiance}
                      </Badge>
                      {restaurant.subscription.extra_ambiances?.slice(0, 2).map((amb) => (
                        <Badge key={amb} variant="outline" className="text-xs capitalize">
                          {amb}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
