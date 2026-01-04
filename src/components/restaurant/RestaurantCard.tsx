import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Star, MapPin, Heart, ExternalLink, Sparkles, Trophy } from 'lucide-react';
import { Restaurant, dishes } from '@/data/mockData';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface RestaurantCardProps {
  restaurant: Restaurant;
  index?: number;
  variant?: 'default' | 'featured';
}

const priceLabels: { [key: number]: string } = {
  1: '€',
  2: '€€',
  3: '€€€',
  4: '€€€€',
};

const ambienceTagStyles: { [key: string]: string } = {
  'romantic': 'tag-romantic',
  'family-friendly': 'tag-family',
  'high-end': 'tag-highend',
  'cozy': 'tag-cozy',
  'business': 'tag-business',
  'trendy': 'tag-cozy',
  'casual': 'tag-family',
  'lively': 'tag-romantic',
};

export function RestaurantCard({ restaurant, index = 0, variant = 'default' }: RestaurantCardProps) {
  const { t } = useTranslation();
  
  const restaurantDishes = restaurant.dishes
    .map(rd => dishes.find(d => d.id === rd.dishId))
    .filter(Boolean)
    .slice(0, 3);

  const isFeatured = restaurant.isFeatured || restaurant.isTopListing;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.4 }}
    >
      <Link
        to={`/restaurant/${restaurant.slug}`}
        className={`block restaurant-card rounded-2xl overflow-hidden group ${
          isFeatured ? 'ring-2 ring-primary/20' : ''
        }`}
      >
        {/* Image */}
        <div className="relative aspect-[16/10] overflow-hidden">
          <img
            src={restaurant.images[0]}
            alt={restaurant.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
          
          {/* Badges */}
          <div className="absolute top-3 left-3 flex gap-2">
            {restaurant.isTopListing && (
              <Badge className="featured-badge border-0 gap-1">
                <Trophy className="h-3 w-3" />
                {t('restaurant.topListing')}
              </Badge>
            )}
            {restaurant.isFeatured && !restaurant.isTopListing && (
              <Badge className="featured-badge border-0 gap-1">
                <Sparkles className="h-3 w-3" />
                {t('restaurant.featured')}
              </Badge>
            )}
          </div>

          {/* Favorite Button */}
          <button
            onClick={(e) => {
              e.preventDefault();
              // TODO: Toggle favorite
            }}
            className="absolute top-3 right-3 p-2 rounded-full bg-background/80 backdrop-blur hover:bg-background transition-colors"
          >
            <Heart className="h-4 w-4" />
          </button>

          {/* Price Badge */}
          <div className="absolute bottom-3 right-3">
            <span className="px-2 py-1 text-sm font-semibold bg-background/90 backdrop-blur rounded-lg">
              {priceLabels[restaurant.priceLevel]}
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          {/* Header */}
          <div className="flex items-start justify-between gap-2 mb-2">
            <h3 className="font-bold text-lg leading-tight group-hover:text-primary transition-colors">
              {restaurant.name}
            </h3>
            <div className="flex items-center gap-1 shrink-0">
              <Star className="h-4 w-4 fill-rating text-rating" />
              <span className="font-semibold">{restaurant.rating.toFixed(1)}</span>
              <span className="text-muted-foreground text-sm">
                ({restaurant.reviewCount})
              </span>
            </div>
          </div>

          {/* Location */}
          <div className="flex items-center gap-1 text-sm text-muted-foreground mb-3">
            <MapPin className="h-3.5 w-3.5" />
            <span>{restaurant.address}</span>
          </div>

          {/* Known for */}
          {restaurantDishes.length > 0 && (
            <div className="mb-3">
              <p className="text-sm text-muted-foreground mb-1.5">
                {t('restaurant.knownFor')}:
              </p>
              <div className="flex flex-wrap gap-1.5">
                {restaurantDishes.map((dish) => (
                  <Badge key={dish!.id} variant="secondary" className="text-xs">
                    {dish!.name}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Ambience Tags */}
          <div className="flex flex-wrap gap-1.5">
            {restaurant.ambienceTags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                  ambienceTagStyles[tag] || 'bg-muted text-muted-foreground'
                }`}
              >
                {t(`filters.${tag.replace('-', '')}`) || tag}
              </span>
            ))}
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
