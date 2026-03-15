import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Star, MapPin, Heart, Sparkles, Trophy, ImageOff } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useFavorites } from '@/hooks/useFavorites';
import { useState } from 'react';
import type { Database } from '@/integrations/supabase/types';
import { SponsoredBadge } from '@/components/sponsored/SponsoredBadge';

type Restaurant = Database['public']['Tables']['restaurants']['Row'];

type RestaurantCardData = Restaurant & {
  chainName?: string;
  chainLocationsCount?: number;
};

interface DatabaseRestaurantCardProps {
  restaurant: RestaurantCardData;
  index?: number;
  isSponsored?: boolean;
}

import { PRICE_LABELS, AMBIENCE_TAG_STYLES, AMBIENCE_TAG_I18N_KEYS } from '@/lib/constants';

function ImageWithFallback({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  
  if (failed) {
    return (
      <div className="absolute inset-0 flex items-center justify-center">
        <ImageOff className="w-12 h-12 text-muted-foreground/40" />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      width={640}
      height={360}
      loading="lazy"
      decoding="async"
      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
      onError={() => setFailed(true)}
    />
  );
}

export function DatabaseRestaurantCard({ restaurant, index = 0, isSponsored = false }: DatabaseRestaurantCardProps) {
  const { t } = useTranslation();
  const { isFavorite, toggleFavorite } = useFavorites();
  const [isLikeAnimating, setIsLikeAnimating] = useState(false);
  
  const isFeatured = restaurant.is_featured || restaurant.is_top_listing;
  const hasImage = restaurant.images && restaurant.images.length > 0 && restaurant.images[0];

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsLikeAnimating(true);
    toggleFavorite(restaurant.id);
    setTimeout(() => setIsLikeAnimating(false), 300);
  };

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
        <div className="relative aspect-[16/10] sm:aspect-[16/9] overflow-hidden bg-muted">
          {hasImage ? (
            <ImageWithFallback
              src={restaurant.images![0]}
              alt={restaurant.name}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <ImageOff className="w-12 h-12 text-muted-foreground/40" />
            </div>
          )}
          
          {/* Badges */}
          <div className="absolute top-3 left-3 flex gap-2 flex-wrap">
            {isSponsored && (
              <SponsoredBadge />
            )}
            {restaurant.is_top_listing && (
              <Badge className="featured-badge border-0 gap-1">
                <Trophy className="h-3 w-3" />
                {t('restaurant.topListing')}
              </Badge>
            )}
            {restaurant.is_featured && !restaurant.is_top_listing && !isSponsored && (
              <Badge className="featured-badge border-0 gap-1">
                <Sparkles className="h-3 w-3" />
                {t('restaurant.featured')}
              </Badge>
            )}
          </div>

          {/* Favorite Button with Animation */}
          <motion.button
            onClick={handleFavoriteClick}
            whileTap={{ scale: 0.9 }}
            className={`absolute top-3 right-3 p-2 rounded-full backdrop-blur transition-colors ${
              isFavorite(restaurant.id)
                ? 'bg-primary text-primary-foreground'
                : 'bg-background/80 hover:bg-background'
            }`}
          >
            <Heart 
              className={`h-4 w-4 ${isFavorite(restaurant.id) ? 'fill-current' : ''} ${isLikeAnimating ? 'like-pop' : ''}`} 
            />
          </motion.button>

          {/* Price Badge */}
          <div className="absolute bottom-3 right-3">
            <span className="px-2 py-1 text-sm font-semibold bg-background/90 backdrop-blur rounded-lg">
              {PRICE_LABELS[restaurant.price_level]}
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="p-3 sm:p-4">
          {/* Header */}
          <div className="flex items-start justify-between gap-2 mb-1.5 sm:mb-2">
            <h3 className="font-bold text-base sm:text-lg leading-tight group-hover:text-primary transition-colors line-clamp-1">
              {restaurant.name}
            </h3>
            <div className="flex items-center gap-1 shrink-0">
              <Star className="h-3.5 w-3.5 sm:h-4 sm:w-4 fill-rating text-rating" />
              <span className="font-semibold text-sm sm:text-base">{Number(restaurant.rating).toFixed(1)}</span>
              <span className="text-muted-foreground text-xs sm:text-sm">
                ({restaurant.review_count})
              </span>
            </div>
          </div>

          {/* Chain + Location */}
          <div className="space-y-0.5 sm:space-y-1 mb-2 sm:mb-3">
            {(restaurant.chainName || restaurant.chainLocationsCount) && (
              <div className="text-xs text-muted-foreground line-clamp-1">
                {restaurant.chainName ? (
                  <span className="font-medium">{restaurant.chainName}</span>
                ) : null}
                {restaurant.chainName && restaurant.chainLocationsCount ? <span> • </span> : null}
                {typeof restaurant.chainLocationsCount === 'number' ? (
                  <span>{restaurant.chainLocationsCount} vestigingen</span>
                ) : null}
              </div>
            )}

            <div className="flex items-center gap-1 text-xs sm:text-sm text-muted-foreground">
              <MapPin className="h-3 w-3 sm:h-3.5 sm:w-3.5 shrink-0" />
              <span className="line-clamp-1">{restaurant.address}</span>
            </div>
          </div>

          {/* Cuisines */}
          {restaurant.cuisines && restaurant.cuisines.length > 0 && (
            <div className="flex flex-wrap gap-1 sm:gap-1.5 mb-2 sm:mb-3">
              {restaurant.cuisines.slice(0, 2).map((cuisine) => (
                <Badge key={cuisine} variant="secondary" className="text-[10px] sm:text-xs capitalize">
                  {cuisine}
                </Badge>
              ))}
            </div>
          )}

          {/* Ambience Tags */}
          {restaurant.ambience_tags && restaurant.ambience_tags.length > 0 && (
            <div className="flex flex-wrap gap-1 sm:gap-1.5">
              {restaurant.ambience_tags.slice(0, 2).map((tag) => (
                <span
                  key={tag}
                  className={`px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-xs font-medium rounded-full ${
                    AMBIENCE_TAG_STYLES[tag] || 'bg-muted text-muted-foreground'
                  }`}
                >
                  {AMBIENCE_TAG_I18N_KEYS[tag] ? t(AMBIENCE_TAG_I18N_KEYS[tag]) : tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </Link>
    </motion.div>
  );
}
