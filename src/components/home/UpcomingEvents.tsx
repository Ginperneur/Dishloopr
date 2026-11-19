import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, PartyPopper } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EventCard } from '@/components/events/EventCard';
import { usePublicEvents } from '@/hooks/useRestaurantEvents';

/** Upcoming events; with a city only that city's, as "Deze week te doen" on the homepage. */
export function UpcomingEvents({ city }: { city?: { slug: string; name: string } } = {}) {
  const { t } = useTranslation();
  const { data: all = [], isLoading } = usePublicEvents();
  const events = city ? all.filter(e => (e as { restaurant?: { city?: { slug?: string } } }).restaurant?.city?.slug === city.slug) : all;

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
            {city ? `Deze week te doen in ${city.name}` : t('events.upcoming', 'Aankomende evenementen')}
          </h2>
          {city && <span className="mr-auto ml-2 rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">Door restaurants geplaatst</span>}
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
