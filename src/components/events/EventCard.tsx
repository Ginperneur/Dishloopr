import { Link } from 'react-router-dom';
import { CalendarDays, Repeat, Tag } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { optimizedImage, optimizedSrcSet, imgLoadingProps } from '@/lib/imageUrl';
import { eventTypeLabel, formatEventPrice, formatSchedule, nextOccurrence, shortDate, type PublicEvent } from '@/lib/events';
import { useEventImpression } from '@/lib/eventMetrics';

const IMG_W = 400;
const IMG_H = 225;

/** Public event card; counts an impression once it is half on screen. */
export function EventCard({ event, showRestaurant = true, priority = false }: { event: PublicEvent; showRestaurant?: boolean; priority?: boolean }) {
  const ref = useEventImpression<HTMLAnchorElement>(event.id);
  const image = event.image_url || event.restaurant?.images?.[0];
  const price = formatEventPrice(event.price);
  const weekly = event.recurrence === 'weekly';

  return (
    <Link
      ref={ref}
      to={`/evenementen/${event.id}`}
      className="group flex flex-col overflow-hidden rounded-xl border bg-card transition-shadow hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="relative aspect-video bg-muted">
        {image ? (
          <img
            src={optimizedImage(image, { width: IMG_W })}
            srcSet={optimizedSrcSet(image, IMG_W)}
            alt=""
            width={IMG_W}
            height={IMG_H}
            {...imgLoadingProps(priority)}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-primary/10">
            <CalendarDays className="h-10 w-10 text-primary/50" />
          </div>
        )}
        <Badge className="absolute left-3 top-3 bg-background/95 text-foreground hover:bg-background/95">{eventTypeLabel(event.event_type)}</Badge>
        <Badge className="absolute right-3 top-3 gap-1">
          {weekly && <Repeat className="h-3 w-3" />}
          {shortDate(nextOccurrence(event))}
        </Badge>
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-4">
        <h3 className="font-display text-lg font-semibold leading-snug group-hover:text-primary line-clamp-2">{event.title}</h3>
        {showRestaurant && event.restaurant && (
          <p className="text-sm text-muted-foreground">
            {event.restaurant.name}
            {event.restaurant.city?.name && ` · ${event.restaurant.city.name}`}
          </p>
        )}
        <p className="text-sm first-letter:uppercase">{formatSchedule(event)}</p>
        {(event.offer || price) && (
          <p className="mt-auto flex items-center gap-1.5 pt-1 text-sm font-medium text-primary">
            <Tag className="h-3.5 w-3.5 shrink-0" />
            <span className="line-clamp-1">{[event.offer, price].filter(Boolean).join(' · ')}</span>
          </p>
        )}
      </div>
    </Link>
  );
}
