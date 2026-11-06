import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, PartyPopper } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EventCard } from '@/components/events/EventCard';
import { usePublicEvents } from '@/hooks/useRestaurantEvents';

export function UpcomingEvents() {
  const { t } = useTranslation();
  const { data: events = [], isLoading } = usePublicEvents();

  if (isLoading) {
    return (
      <section className="py-8">
        <div className="container px-4 md:px-6">
          <Skeleton className="mb-6 h-8 w-48" />
          <div className="grid gap-4 md:grid-cols-3">
            {[1, 2, 3].map(i => <Skeleton key={i} className="aspect-[4/3] rounded-xl" />)}
          </div>
        </div>
      </section>
    );
  }

  if (events.length === 0) return null;

  return (
    <section className="bg-muted/30 py-8">
      <div className="container px-4 md:px-6">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-display text-xl font-bold md:text-2xl">
            <PartyPopper className="h-5 w-5 text-primary" />
            {t('events.upcoming', 'Aankomende evenementen')}
          </h2>
          <Button variant="ghost" size="sm" asChild className="text-xs sm:text-sm">
            <Link to="/evenementen" className="flex items-center gap-1 md:gap-2">
              {t('home.viewAll', 'Bekijk alles')}
              <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </Link>
          </Button>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {events.slice(0, 3).map(event => <EventCard key={event.id} event={event} />)}
        </div>
      </div>
    </section>
  );
}
