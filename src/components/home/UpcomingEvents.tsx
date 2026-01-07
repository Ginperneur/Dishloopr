import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';
import { Calendar, ArrowRight, ChefHat, Wine, Utensils } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useRestaurantEvents } from '@/hooks/useRestaurantEvents';

const eventTypeIcons: Record<string, React.ElementType> = {
  tasting: Wine,
  chefs_table: ChefHat,
  special_menu: Utensils,
  workshop: ChefHat,
};

export function UpcomingEvents() {
  const { t } = useTranslation();
  const { events, loading } = useRestaurantEvents();

  if (loading) {
    return (
      <section className="py-8">
        <div className="container px-4 md:px-6">
          <Skeleton className="h-8 w-48 mb-6" />
          <div className="grid md:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-40" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (events.length === 0) {
    return null;
  }

  return (
    <section className="py-8 md:py-12 bg-muted/30">
      <div className="container px-4 md:px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="flex items-center justify-between mb-6"
        >
          <h2 className="text-xl md:text-2xl font-bold flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            {t('events.upcoming', 'Aankomende evenementen')}
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
          {events.slice(0, 3).map((event, index) => {
            const Icon = eventTypeIcons[event.event_type] || Calendar;
            const eventDate = new Date(event.event_date);

            return (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="group p-4 md:p-5 rounded-xl border border-border bg-card hover:border-primary/50 hover:shadow-lg transition-all"
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
                    <Icon className="h-4 w-4 md:h-5 md:w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm md:text-base group-hover:text-primary transition-colors line-clamp-1">
                      {event.title}
                    </h3>
                    <p className="text-xs md:text-sm text-muted-foreground mt-1 line-clamp-2">
                      {event.description || t('events.noDescription', 'Geen beschrijving')}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between mt-3 md:mt-4">
                  <div className="text-sm">
                    <Badge variant="secondary" className="text-xs">
                      {format(eventDate, 'd MMM', { locale: nl })}
                    </Badge>
                  </div>
                  {event.price && (
                    <span className="text-xs md:text-sm font-semibold text-primary">
                      €{event.price}
                    </span>
                  )}
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full mt-3 text-xs md:text-sm group-hover:bg-primary group-hover:text-primary-foreground transition-all"
                >
                  {t('events.viewDetails', 'Bekijk details')}
                  <ArrowRight className="h-3 w-3 md:h-4 md:w-4 ml-1" />
                </Button>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
