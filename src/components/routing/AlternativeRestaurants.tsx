import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { MapPin, Star, ArrowRight, Sparkles } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { RoutingReason } from '@/hooks/useAlternativeRestaurants';

interface AlternativeRestaurant {
  id: string;
  name: string;
  slug: string;
  rating: number;
  price_level: number;
  address: string;
  images?: string[] | null;
  matchScore: number;
  matchReasons: string[];
  cityName?: string;
}

interface AlternativeRestaurantsProps {
  alternatives: AlternativeRestaurant[];
  loading: boolean;
  reason: RoutingReason;
  sourceRestaurantName: string;
  onAlternativeClick?: (targetId: string) => void;
}

const reasonMessages: Record<RoutingReason, { title: string; subtitle: string }> = {
  closed: {
    title: 'Dit restaurant is momenteel gesloten',
    subtitle: 'Bekijk deze vergelijkbare opties die nu wel open zijn',
  },
  busy: {
    title: 'Dit restaurant is erg druk',
    subtitle: 'Deze alternatieven zijn rustiger op dit moment',
  },
  fully_booked: {
    title: 'Dit restaurant is volgeboekt',
    subtitle: 'Probeer een van deze vergelijkbare restaurants',
  },
  low_availability: {
    title: 'Beperkte beschikbaarheid',
    subtitle: 'Meer opties in de buurt',
  },
};

export function AlternativeRestaurants({
  alternatives,
  loading,
  reason,
  sourceRestaurantName,
  onAlternativeClick,
}: AlternativeRestaurantsProps) {
  const { t } = useTranslation();

  if (loading) {
    return (
      <Card className="border-amber-200 dark:border-amber-900 bg-amber-50/50 dark:bg-amber-950/20">
        <CardHeader className="pb-3">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64 mt-1" />
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (alternatives.length === 0) {
    return null;
  }

  const messages = reasonMessages[reason];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="border-amber-200 dark:border-amber-800 bg-gradient-to-br from-amber-50/80 to-orange-50/50 dark:from-amber-950/30 dark:to-orange-950/20">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-full bg-amber-100 dark:bg-amber-900/50">
              <Sparkles className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            </div>
            <CardTitle className="text-base md:text-lg">
              {messages.title}
            </CardTitle>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {messages.subtitle}
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {alternatives.map((restaurant, index) => (
            <motion.div
              key={restaurant.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Link
                to={`/restaurant/${restaurant.slug}`}
                onClick={() => onAlternativeClick?.(restaurant.id)}
                className="block"
              >
                <div className="flex gap-3 p-3 rounded-xl bg-background/80 hover:bg-background transition-colors border border-border/50 hover:border-border hover:shadow-sm">
                  {/* Image */}
                  <div className="w-16 h-16 rounded-lg overflow-hidden bg-muted shrink-0">
                    {restaurant.images && restaurant.images.length > 0 ? (
                      <img
                        src={restaurant.images[0]}
                        alt={restaurant.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
                        Geen foto
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-semibold text-sm truncate">
                        {restaurant.name}
                      </h4>
                      <div className="flex items-center gap-1 shrink-0">
                        <Star className="h-3.5 w-3.5 fill-rating text-rating" />
                        <span className="text-sm font-medium">
                          {Number(restaurant.rating).toFixed(1)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                      <MapPin className="h-3 w-3" />
                      <span className="truncate">
                        {restaurant.cityName || restaurant.address}
                      </span>
                      <span className="mx-1">·</span>
                      <span>{'€'.repeat(restaurant.price_level)}</span>
                    </div>

                    {/* Match Reasons */}
                    <div className="flex flex-wrap gap-1 mt-2">
                      {restaurant.matchReasons.slice(0, 3).map((reason, i) => (
                        <Badge
                          key={i}
                          variant="secondary"
                          className="text-[10px] px-1.5 py-0 h-5 bg-primary/10 text-primary"
                        >
                          {reason}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* Arrow */}
                  <div className="flex items-center shrink-0">
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}

          {/* Transparency notice */}
          <p className="text-[11px] text-muted-foreground/70 text-center pt-2">
            {t('routing.transparencyNote', 'Suggesties gebaseerd op vergelijkbare kenmerken, niet op betaling')}
          </p>
        </CardContent>
      </Card>
    </motion.div>
  );
}
