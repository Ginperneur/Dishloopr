import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';
import { Calendar, Users, ChefHat, Wine, Utensils, Euro } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useRestaurantEvents } from '@/hooks/useRestaurantEvents';

interface EventsSectionProps {
  restaurantId: string;
}

const eventTypeIcons: Record<string, React.ElementType> = {
  tasting: Wine,
  chefs_table: ChefHat,
  special_menu: Utensils,
  workshop: ChefHat,
};

const eventTypeLabels: Record<string, string> = {
  tasting: 'Proeverij',
  chefs_table: "Chef's Table",
  special_menu: 'Speciaal menu',
  workshop: 'Workshop',
};

export function EventsSection({ restaurantId }: EventsSectionProps) {
  const { t } = useTranslation();
  const { events, loading } = useRestaurantEvents(restaurantId);

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (events.length === 0) {
    return null;
  }

  const formatEventDate = (dateString: string) => {
    const date = new Date(dateString);
    return format(date, "EEEE d MMMM 'om' HH:mm", { locale: nl });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
    >
      <h2 className="text-lg md:text-xl font-bold mb-4 flex items-center gap-2">
        <Calendar className="h-5 w-5" />
        {t('events.title', 'Evenementen')}
      </h2>

      <div className="space-y-3">
        {events.map((event, index) => {
          const Icon = eventTypeIcons[event.event_type] || Calendar;
          const spotsLeft = event.max_participants 
            ? event.max_participants - event.current_participants 
            : null;

          return (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className="p-4 rounded-xl border border-border bg-card hover:border-primary/50 transition-colors"
            >
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-semibold">{event.title}</h3>
                      <Badge variant="secondary" className="mt-1 text-xs">
                        {eventTypeLabels[event.event_type] || event.event_type}
                      </Badge>
                    </div>
                    {event.price && (
                      <div className="flex items-center gap-1 text-primary font-semibold shrink-0">
                        <Euro className="h-4 w-4" />
                        {event.price}
                      </div>
                    )}
                  </div>

                  {event.description && (
                    <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                      {event.description}
                    </p>
                  )}

                  <div className="flex items-center justify-between mt-3">
                    <div className="text-sm text-muted-foreground">
                      <Calendar className="h-3.5 w-3.5 inline mr-1" />
                      {formatEventDate(event.event_date)}
                    </div>
                    {spotsLeft !== null && (
                      <Badge 
                        variant={spotsLeft <= 3 ? 'destructive' : 'secondary'}
                        className="text-xs"
                      >
                        <Users className="h-3 w-3 mr-1" />
                        {spotsLeft > 0 
                          ? t('events.spotsLeft', '{{count}} plekken vrij', { count: spotsLeft })
                          : t('events.soldOut', 'Uitverkocht')
                        }
                      </Badge>
                    )}
                  </div>

                  {spotsLeft !== 0 && (
                    <Button size="sm" className="mt-3 w-full sm:w-auto">
                      {t('events.book', 'Reserveren')}
                    </Button>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
