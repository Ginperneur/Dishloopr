import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Star, MapPin, Sparkles, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';
import { useFeaturedRestaurants } from '@/hooks/useFeaturedRestaurants';
import { Skeleton } from '@/components/ui/skeleton';
import { PRICE_LABELS } from '@/lib/constants';

interface FeaturedRestaurantsCarouselProps {
  currentRestaurantId: string;
  cityId?: string;
}

export function FeaturedRestaurantsCarousel({ 
  currentRestaurantId, 
  cityId 
}: FeaturedRestaurantsCarouselProps) {
  const { t } = useTranslation();
  const { restaurants, loading } = useFeaturedRestaurants();

  // Filter out current restaurant and optionally prioritize same city
  const filteredRestaurants = restaurants
    .filter(r => r.id !== currentRestaurantId)
    .sort((a, b) => {
      // Prioritize same city
      if (cityId) {
        if (a.city_id === cityId && b.city_id !== cityId) return -1;
        if (b.city_id === cityId && a.city_id !== cityId) return 1;
      }
      return 0;
    })
    .slice(0, 8);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            {t('restaurant.featuredRestaurants')}
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (filteredRestaurants.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          {t('restaurant.featuredRestaurants')}
        </h2>
        <Link 
          to="/search?featured=true" 
          className="text-sm text-primary hover:underline flex items-center gap-1"
        >
          {t('common.viewAll')}
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>

      <Carousel
        opts={{
          align: 'start',
          loop: filteredRestaurants.length > 2,
        }}
        className="w-full"
      >
        <CarouselContent className="-ml-2 md:-ml-4">
          {filteredRestaurants.map((restaurant) => (
            <CarouselItem key={restaurant.id} className="pl-2 md:pl-4 basis-full sm:basis-1/2">
              <Link
                to={`/restaurant/${restaurant.slug}`}
                className="block restaurant-card rounded-xl overflow-hidden group h-full"
              >
                <div className="flex h-28 sm:h-32">
                  {/* Image */}
                  <div className="relative w-28 sm:w-32 shrink-0 overflow-hidden bg-muted">
                    {restaurant.images && restaurant.images[0] ? (
                      <img
                        src={restaurant.images[0]}
                        alt={restaurant.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Sparkles className="h-8 w-8 text-muted-foreground/40" />
                      </div>
                    )}
                    {/* Featured indicator */}
                    <div className="absolute top-2 left-2">
                      <Badge className="featured-badge border-0 text-[10px] px-1.5 py-0.5">
                        <Sparkles className="h-2.5 w-2.5" />
                      </Badge>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex-1 p-3 flex flex-col justify-between min-w-0">
                    <div>
                      <h3 className="font-semibold text-sm line-clamp-1 group-hover:text-primary transition-colors">
                        {restaurant.name}
                      </h3>
                      <div className="flex items-center gap-1 mt-1">
                        <Star className="h-3 w-3 fill-rating text-rating" />
                        <span className="text-xs font-medium">
                          {Number(restaurant.rating).toFixed(1)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          ({restaurant.review_count})
                        </span>
                        <span className="text-xs text-muted-foreground ml-1">
                          {PRICE_LABELS[restaurant.price_level]}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3 shrink-0" />
                      <span className="line-clamp-1">{restaurant.address}</span>
                    </div>

                    {restaurant.cuisines && restaurant.cuisines.length > 0 && (
                      <div className="flex gap-1 flex-wrap">
                        {restaurant.cuisines.slice(0, 2).map((cuisine) => (
                          <span
                            key={cuisine}
                            className="text-[10px] px-1.5 py-0.5 bg-secondary text-secondary-foreground rounded capitalize"
                          >
                            {cuisine}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            </CarouselItem>
          ))}
        </CarouselContent>
        {filteredRestaurants.length > 2 && (
          <>
            <CarouselPrevious className="hidden sm:flex -left-3" />
            <CarouselNext className="hidden sm:flex -right-3" />
          </>
        )}
      </Carousel>
    </div>
  );
}
