import { PartyPopper } from 'lucide-react';
import { useRestaurantEvents } from '@/hooks/useRestaurantEvents';
import { EventCard } from '@/components/events/EventCard';

/** Active (released) specials of this restaurant; renders nothing when there are none. */
export function EventsSection({ restaurantId }: { restaurantId: string }) {
  const { events } = useRestaurantEvents(restaurantId);
  if (events.length === 0) return null;

  return (
    <section aria-labelledby="restaurant-events-title">
      <h2 id="restaurant-events-title" className="mb-4 flex items-center gap-2 font-display text-lg font-bold md:text-xl">
        <PartyPopper className="h-5 w-5 text-primary" />
        Specials en evenementen
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {events.map(event => <EventCard key={event.id} event={event} showRestaurant={false} />)}
      </div>
    </section>
  );
}
